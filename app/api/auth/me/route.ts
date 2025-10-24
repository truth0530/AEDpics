/**
 * 현재 사용자 조회 API
 *
 * GET /api/auth/me
 * - JWT 토큰 검증
 * - 사용자 정보 반환
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  try {
    // 토큰 추출 (쿠키 또는 Authorization 헤더)
    const cookieToken = request.cookies.get('auth-token')?.value;
    const authHeader = request.headers.get('authorization');
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const token = cookieToken || headerToken;

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 토큰 검증
    const payload = await verifyAccessToken(token);

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // 사용자 정보 조회
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { profile: true },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        createdAt: true,
        profile: {
          select: {
            role: true,
            organization: true,
            phone: true,
            lastLoginAt: true,
            accountType: true,
            assignedDevices: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        role: user.profile?.role,
        organization: user.profile?.organization,
        phone: user.profile?.phone,
        lastLoginAt: user.profile?.lastLoginAt,
        accountType: user.profile?.accountType,
        assignedDevices: user.profile?.assignedDevices,
      },
    });
  } catch (error) {
    console.error('[Me] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
