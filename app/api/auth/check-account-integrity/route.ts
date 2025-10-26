import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
/**
 * 계정 무결성 체크 API
 *
 * 목적:
 * - Auth.users와 user_profiles 동기화 확인
 * - Orphan 계정 감지 및 처리
 * - 이중 가입 방지
 *
 * 사용법: POST /api/auth/check-account-integrity
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export interface AccountIntegrityResult {
  email: string;
  authExists: boolean;
  profileExists: boolean;
  canSignup: boolean;
  action: 'SIGNUP' | 'LOGIN' | 'CONTACT_ADMIN' | 'REAPPLY';
  message: string;
  details?: {
    authUserId?: string;
    profileStatus?: 'active' | 'pending' | 'rejected' | 'inactive';
    isActive?: boolean;
  };
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: '이메일이 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 1. Auth.users 확인
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('Auth users fetch error:', authError);
      // Auth API 오류 시 안전하게 가입 허용
      return NextResponse.json<AccountIntegrityResult>({
        email,
        authExists: false,
        profileExists: false,
        canSignup: true,
        action: 'SIGNUP',
        message: '가입 가능합니다.'
      });
    }

    const authUser = authUsers.users?.find(u => u.email === email);

    // 2. user_profiles 확인
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, role, is_active, email')
      .eq('email', email)
      .maybeSingle();

    // 케이스별 처리
    const result: AccountIntegrityResult = {
      email,
      authExists: !!authUser,
      profileExists: !!profile,
      canSignup: false,
      action: 'LOGIN',
      message: '',
      details: {}
    };

    // 케이스 1: Auth O, Profile O (정상)
    if (authUser && profile) {
      result.details = {
        authUserId: authUser.id,
        profileStatus: profile.role as any,
        isActive: profile.is_active
      };

      // 거부된 사용자
      if (profile.role === 'rejected' || profile.is_active === false) {
        result.canSignup = true;
        result.action = 'REAPPLY';
        result.message = '가입이 거부된 계정입니다. 재신청 가능합니다.';
        return NextResponse.json<AccountIntegrityResult>(result);
      }

      // 승인 대기 중
      if (profile.role === 'pending_approval') {
        result.canSignup = false;
        result.action = 'CONTACT_ADMIN';
        result.message = '승인 대기 중입니다. 관리자 승인을 기다려주세요.';
        return NextResponse.json<AccountIntegrityResult>(result);
      }

      // 활성 계정
      result.canSignup = false;
      result.action = 'LOGIN';
      result.message = '이미 가입된 계정입니다. 로그인해주세요.';
      return NextResponse.json<AccountIntegrityResult>(result);
    }

    // 케이스 2: Auth O, Profile X (Orphan Auth 계정)
    if (authUser && !profile) {
      result.canSignup = false;
      result.action = 'CONTACT_ADMIN';
      result.message = '계정 설정이 완료되지 않았습니다. 관리자에게 문의해주세요.';
      result.details = {
        authUserId: authUser.id,
        profileStatus: 'inactive'
      };
      return NextResponse.json<AccountIntegrityResult>(result);
    }

    // 케이스 3: Auth X, Profile O (Orphan Profile - 발생하면 안 됨)
    if (!authUser && profile) {
      // Profile 삭제 후 재가입 허용
      await supabase
        .from('user_profiles')
        .delete()
        .eq('email', email);

      result.canSignup = true;
      result.action = 'SIGNUP';
      result.message = '가입 가능합니다. (기존 불완전한 데이터 정리됨)';
      return NextResponse.json<AccountIntegrityResult>(result);
    }

    // 케이스 4: Auth X, Profile X (정상 신규 가입)
    result.canSignup = true;
    result.action = 'SIGNUP';
    result.message = '가입 가능합니다.';
    return NextResponse.json<AccountIntegrityResult>(result);

  } catch (error) {
    console.error('Account integrity check error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * GET 엔드포인트 - 현재 사용자의 계정 상태 조회
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 현재 인증된 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: '인증되지 않은 사용자입니다.' },
        { status: 401 }
      );
    }

    // 프로필 확인
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, role, is_active, email, full_name, created_at')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { error: '프로필 조회 실패' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      authUserId: user.id,
      email: user.email,
      hasProfile: !!profile,
      profile: profile || null,
      isComplete: !!profile && profile.role !== 'pending_approval',
      status: profile?.role || 'no_profile'
    });

  } catch (error) {
    console.error('Get account status error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
