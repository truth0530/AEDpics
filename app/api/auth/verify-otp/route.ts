/**
 * OTP 인증 API
 *
 * POST /api/auth/verify-otp
 * - OTP 코드 검증
 * - 이메일 인증 완료
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyOTP, resendOTP, canSendOTP } from '@/lib/auth/otp';
import { createAuditLog } from '@/lib/db/prisma';
import { checkRateLimit, createRateLimitResponse, getIdentifier, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rate-limiter';

/**
 * OTP 검증
 */
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
    const { email, code } = body;

    // 필수 필드 검증
    if (!email || !code) {
      return NextResponse.json(
        { error: 'Email and code are required' },
        { status: 400 }
      );
    }

    // OTP 검증
    const verified = await verifyOTP(email, code);

    if (!verified) {
      return NextResponse.json(
        { error: 'Invalid or expired verification code' },
        { status: 400 }
      );
    }

    // 감사 로그 기록
    await createAuditLog({
      action: 'EMAIL_VERIFIED',
      resource: 'User',
      changes: { email },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully',
    });
  } catch (error) {
    console.error('[Verify OTP] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * OTP 재발송
 */
export async function PUT(request: NextRequest) {
  try {
    // Rate limiting
    const identifier = getIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, RATE_LIMIT_CONFIGS.auth);

    if (!rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult);
    }

    // 요청 본문 파싱
    const body = await request.json();
    const { email } = body;

    // 필수 필드 검증
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // 발송 가능 여부 확인
    const canSend = await canSendOTP(email);
    if (!canSend.can) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          retryAfter: canSend.retryAfter,
        },
        { status: 429 }
      );
    }

    // OTP 재발송
    const sent = await resendOTP(email);

    if (!sent) {
      return NextResponse.json(
        { error: 'Failed to send verification code' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code resent successfully',
    });
  } catch (error) {
    console.error('[Resend OTP] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
