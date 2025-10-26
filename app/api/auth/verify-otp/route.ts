import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimits } from '@/lib/rate-limit';

// 환경변수 검증
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing required environment variables for OTP verification');
}

// Admin 클라이언트 생성 (RLS 우회, 익명 사용자도 접근 가능)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(request: NextRequest) {
  // Rate Limiting 체크
  const rateLimitResult = await rateLimits.verifyOtp(request);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        error: '너무 많은 시도입니다. 잠시 후 다시 시도해주세요.',
        retryAfter: rateLimitResult.reset.toISOString()
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.reset.toISOString(),
          'Retry-After': Math.ceil((rateLimitResult.reset.getTime() - Date.now()) / 1000).toString()
        }
      }
    );
  }

  try {
    const { email, code } = await request.json();

    // user_profiles 테이블 확인 (Admin 클라이언트 사용)
    const { data: existingUser } = await supabaseAdmin
      .from('user_profiles')
      .select('email')
      .eq('email', email)
      .single();

    if (existingUser) {
      return NextResponse.json(
        {
          error: '이미 가입된 이메일입니다. 로그인을 시도해주세요.',
          code: 'EMAIL_ALREADY_EXISTS'
        },
        { status: 409 }
      );
    }

    // OTP 확인 (Admin 클라이언트 사용)
    const { data: otpData, error: otpError } = await supabaseAdmin
      .from('email_verification_codes')
      .select('*')
      .eq('email', email)
      .eq('code', code)
      .eq('used', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (otpError || !otpData) {
      return NextResponse.json(
        { error: '잘못된 인증번호이거나 만료되었습니다.' },
        { status: 400 }
      );
    }

    // OTP를 사용됨으로 표시 (Admin 클라이언트 사용)
    await supabaseAdmin
      .from('email_verification_codes')
      .update({ used: true })
      .eq('id', otpData.id);

    return NextResponse.json({ 
      success: true,
      email: email
    });
  } catch (error) {
    console.error('OTP 검증 오류:', error);
    return NextResponse.json(
      { error: '서버 오류' },
      { status: 500 }
    );
  }
}