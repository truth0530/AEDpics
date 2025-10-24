/**
 * 로그아웃 API
 *
 * POST /api/auth/logout
 * - JWT 토큰 쿠키 삭제
 * - 로그아웃 감사 로그 기록
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { createAuditLog } from '@/lib/db/prisma';

export async function POST(request: NextRequest) {
  try {
    // 토큰에서 사용자 정보 추출
    const token = request.cookies.get('auth-token')?.value;
    let userId: number | undefined;

    if (token) {
      const payload = await verifyAccessToken(token);
      if (payload) {
        userId = payload.userId;
      }
    }

    // 감사 로그 기록
    if (userId) {
      await createAuditLog({
        userId,
        action: 'LOGOUT',
        resource: 'User',
        resourceId: userId,
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      });
    }

    // 쿠키 삭제
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });

    response.cookies.delete('auth-token');

    return response;
  } catch (error) {
    console.error('[Logout] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
