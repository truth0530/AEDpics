/**
 * 로그인 API
 *
 * POST /api/auth/login
 * - 사용자 인증
 * - JWT 토큰 반환
 * - 로그인 히스토리 기록
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth/jwt';
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
    const { email, password } = body;

    // 필수 필드 검증
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // 사용자 인증
    const result = await authenticateUser(email, password);

    if (!result) {
      // 감사 로그 기록 (실패한 로그인 시도)
      await createAuditLog({
        action: 'LOGIN_FAILED',
        resource: 'User',
        changes: { email },
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      });

      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // 감사 로그 기록 (성공한 로그인)
    await createAuditLog({
      userId: result.user.id,
      action: 'LOGIN',
      resource: 'User',
      resourceId: result.user.id,
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    // JWT 토큰을 쿠키에 설정
    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
      token: result.token,
      user: result.user,
    });

    response.cookies.set('auth-token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('[Login] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
