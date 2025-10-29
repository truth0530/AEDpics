import { NextRequest, NextResponse } from 'next/server';
import { rateLimits } from '@/lib/rate-limit';
import { isAllowedEmailDomain } from '@/lib/auth/config';

import { prisma } from '@/lib/prisma';
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

    // 서버사이드 이메일 도메인 검증 (보안 강화)
    if (!isAllowedEmailDomain(email)) {
      return NextResponse.json(
        { error: '허용되지 않은 이메일 도메인입니다' },
        { status: 400 }
      );
    }

    // user_profiles 테이블 확인
    const existingUser = await prisma.user_profiles.findUnique({
      where: { email },
      select: { email: true }
    });

    if (existingUser) {
      return NextResponse.json(
        {
          error: '이미 가입된 이메일입니다. 로그인을 시도해주세요.',
          code: 'EMAIL_ALREADY_EXISTS'
        },
        { status: 409 }
      );
    }

    // OTP 확인 (Prisma)
    const otpData = await prisma.email_verification_codes.findFirst({
      where: {
        email,
        code,
        used: false,
        expires_at: {
          gte: new Date()
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    if (!otpData) {
      return NextResponse.json(
        { error: '잘못된 인증번호이거나 만료되었습니다.' },
        { status: 400 }
      );
    }

    // OTP를 사용됨으로 표시
    await prisma.email_verification_codes.update({
      where: { id: otpData.id },
      data: { used: true }
    });

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
