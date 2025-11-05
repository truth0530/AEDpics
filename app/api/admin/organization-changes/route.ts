import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { checkPermission, getPermissionError } from '@/lib/auth/permissions';

import { prisma } from '@/lib/prisma';
/**
 * GET /api/admin/organization-changes
 * 모든 조직 변경 요청 조회 (관리자 전용)
 *
 * Query Parameters:
 * - status: 상태 필터 (pending, approved, rejected, requires_revision, cancelled)
 * - page: 페이지 번호 (기본값: 1)
 * - limit: 페이지당 항목 수 (기본값: 20)
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. 관리자 권한 확인
    const currentProfile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!currentProfile || !checkPermission(currentProfile.role, 'APPROVE_USERS')) {
      return NextResponse.json(
        { error: getPermissionError('APPROVE_USERS') },
        { status: 403 }
      );
    }

    // 3. Query Parameters 파싱
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // 4. 조회 조건 구성
    const where: any = {};
    if (status && ['pending', 'approved', 'rejected', 'requires_revision', 'cancelled'].includes(status)) {
      where.status = status;
    }

    // 5. 조직 변경 요청 목록 조회
    const [requests, total] = await Promise.all([
      prisma.organization_change_requests.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              full_name: true,
              email: true,
              role: true
            }
          },
          current_organization: {
            select: {
              id: true,
              name: true,
              type: true,
              region_code: true
            }
          },
          requested_organization: {
            select: {
              id: true,
              name: true,
              type: true,
              region_code: true
            }
          },
          reviewer: {
            select: {
              id: true,
              full_name: true,
              email: true
            }
          }
        },
        orderBy: {
          requested_at: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.organization_change_requests.count({ where })
    ]);

    return NextResponse.json({
      requests,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('[GET /api/admin/organization-changes] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
