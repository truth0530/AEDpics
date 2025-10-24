/**
 * 회원가입 API
 *
 * POST /api/auth/signup
 * - 사용자 등록
 * - OTP 이메일 발송
 * - JWT 토큰 반환 (이메일 미인증 상태)
 */

import { NextRequest, NextResponse } from 'next/server';
import { registerUser } from '@/lib/auth/jwt';
import { createAndSendOTP } from '@/lib/auth/otp';
import { createAuditLog } from '@/lib/db/prisma';
import { checkRateLimit, createRateLimitResponse, getIdentifier, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rate-limiter';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const identifier = getIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, RATE_LIMIT_CONFIGS.auth);

    if (!rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult);
    }

    // 요청 본문 파싱
    const body = await request.json();
    const { email, password, name, role, organization } = body;

    // 필수 필드 검증
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // 비밀번호 강도 검증 (최소 8자)
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // 사용자 등록
    const result = await registerUser({
      email,
      password,
      name,
      role: role || 'viewer',
      organization,
    });

    if (!result) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 409 }
      );
    }

    // OTP 발송
    const otpSent = await createAndSendOTP(email);
    if (!otpSent) {
      console.error('[Signup] Failed to send OTP, but user created');
    }

    // 감사 로그 기록
    await createAuditLog({
      userId: result.user.id,
      action: 'SIGNUP',
      resource: 'User',
      resourceId: result.user.id,
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'User registered successfully. Please verify your email.',
      token: result.token,
      user: result.user,
      otpSent,
    });
  } catch (error) {
    console.error('[Signup] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
