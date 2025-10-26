/**
 * Admin Signup API Route
 *
 * Supabase Auth rate limit을 우회하기 위해
 * Service Role Key를 사용하여 서버 사이드에서 사용자 생성
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { encryptPhone } from '@/lib/utils/encryption';

// Service Role 클라이언트 생성 (rate limit 없음)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(request: NextRequest) {
  console.log('[Admin Signup API] ========== API 호출됨 ==========');
  console.log('[Admin Signup API] Timestamp:', new Date().toISOString());
  console.log('[Admin Signup API] Environment check - ENCRYPTION_KEY exists:', !!process.env.ENCRYPTION_KEY);

  try {
    const body = await request.json();
    console.log('[Admin Signup API] Request body parsed successfully');

    const { email, password, userData, profileData } = body;
    console.log('[Admin Signup API] Creating user:', { email, userData });
    console.log('[Admin Signup API] Profile data:', {
      ...profileData,
      phone: profileData?.phone ? `${profileData.phone.substring(0, 3)}***` : 'null',
      organization_id: profileData?.organization_id || 'null'
    });

    // 비밀번호 강도 검증 (프론트엔드 우회 방지)
    if (!password || password.length < 10) {
      return NextResponse.json(
        { error: '비밀번호는 최소 10자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (!hasLowerCase || !hasNumber) {
      return NextResponse.json(
        { error: '비밀번호는 영문 소문자와 숫자를 반드시 포함해야 합니다.' },
        { status: 400 }
      );
    }

    // 1. 사전 중복 체크 (더 명확한 에러 메시지 제공)
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = existingUsers?.users.some(user => user.email === email);

    if (userExists) {
      console.warn('[Admin Signup API] Email already exists:', email);
      return NextResponse.json(
        {
          error: '이미 가입된 이메일입니다. 로그인을 시도해주세요.',
          code: 'EMAIL_ALREADY_EXISTS'
        },
        { status: 409 }
      );
    }

    // 2. Service Role로 사용자 생성 (rate limit 없음)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // 이메일 확인 자동 승인 (OTP로 이미 확인했으므로)
      user_metadata: {
        full_name: userData.full_name,
        email_verified: true
      }
    });

    if (authError) {
      console.error('[Admin Signup API] Auth creation failed:', authError);

      // 모든 에러를 한글로 변환
      let errorMessage = '계정 생성 중 오류가 발생했습니다. 다시 시도해주세요.';
      let statusCode = 400;

      if (authError.message.includes('already been registered') || authError.code === 'email_exists') {
        errorMessage = '이미 가입된 이메일입니다. 로그인을 시도해주세요.';
        statusCode = 409; // Conflict
      } else if (authError.message.includes('Password')) {
        errorMessage = '비밀번호 형식이 올바르지 않습니다. 영문 소문자, 숫자를 포함한 10자 이상으로 설정해주세요.';
      } else if (authError.message.includes('Email')) {
        errorMessage = '이메일 형식이 올바르지 않습니다.';
      }

      return NextResponse.json(
        { error: errorMessage, code: authError.code, details: authError },
        { status: statusCode }
      );
    }

    if (!authData.user) {
      console.error('[Admin Signup API] No user created');
      return NextResponse.json(
        { error: '사용자 계정 생성에 실패했습니다. 다시 시도해주세요.' },
        { status: 500 }
      );
    }

    console.log('[Admin Signup API] User created successfully:', authData.user.id);

    // 2. Service Role로 프로필 생성 (RLS 우회)
    if (profileData) {
      console.log('[Admin Signup API] Creating profile:', profileData);

      // 전화번호 암호화
      console.log('[Admin Signup API] Starting phone encryption...');
      let encryptedPhone = null;
      try {
        encryptedPhone = profileData.phone ? encryptPhone(profileData.phone) : null;
        console.log('[Admin Signup API] Phone encryption SUCCESS:', {
          original: profileData.phone ? `${profileData.phone.substring(0, 3)}***` : 'null',
          encrypted: encryptedPhone ? `${encryptedPhone.substring(0, 10)}...` : 'null'
        });
      } catch (encryptError) {
        console.error('[Admin Signup API] Phone encryption FAILED:', encryptError);
        // 암호화 실패 시 auth user 삭제
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        throw new Error(`전화번호 암호화 실패: ${encryptError instanceof Error ? encryptError.message : String(encryptError)}`);
      }

      console.log('[Admin Signup API] Inserting profile into database...');
      const { error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          ...profileData,
          phone: encryptedPhone, // 암호화된 전화번호 저장
          id: authData.user.id // 생성된 사용자 ID 사용
        });

      if (profileError) {
        console.error('[Admin Signup API] Profile creation FAILED:', profileError);
        console.error('[Admin Signup API] Profile error details:', {
          code: profileError.code,
          message: profileError.message,
          details: profileError.details,
          hint: profileError.hint
        });

        // 트랜잭션 롤백: auth.users에 생성된 사용자 삭제
        try {
          console.log('[Admin Signup API] Rolling back auth user:', authData.user.id);
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
          console.log('[Admin Signup API] Rollback successful');
        } catch (rollbackError) {
          console.error('[Admin Signup API] Rollback failed:', rollbackError);
          // 롤백 실패 시 심각한 오류 - 수동 정리 필요
          return NextResponse.json(
            {
              error: '회원가입 처리 중 심각한 오류가 발생했습니다. 고객센터에 문의해주세요.',
              details: {
                profileError,
                rollbackError
              },
              userId: authData.user.id,
              action_required: '관리자 수동 처리 필요'
            },
            { status: 500 }
          );
        }

        return NextResponse.json(
          {
            error: '회원가입 처리 중 오류가 발생했습니다. 다시 시도해주세요.',
            details: profileError
          },
          { status: 500 }
        );
      }

      console.log('[Admin Signup API] Profile created successfully');
    }

    // 3. 성공 반환
    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email
      }
    });

  } catch (error) {
    console.error('[Admin Signup API] ========== 예외 발생 ==========');
    console.error('[Admin Signup API] Error name:', error instanceof Error ? error.name : 'Unknown');
    console.error('[Admin Signup API] Error message:', error instanceof Error ? error.message : String(error));
    console.error('[Admin Signup API] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('[Admin Signup API] Full error object:', error);

    return NextResponse.json(
      { error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
