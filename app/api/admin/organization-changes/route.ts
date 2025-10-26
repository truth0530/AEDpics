import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';
import { checkPermission, getPermissionError } from '@/lib/auth/permissions';

const prisma = new PrismaClient();

/**
 * GET /api/admin/organization-changes
 * 조직 변경 요청 목록 조회 (관리자용)
 *
 * Query Parameters:
 * - status: 요청 상태 필터 (pending, approved, rejected)
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
    const currentProfile = await prisma.userProfile.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!currentProfile || !checkPermission(currentProfile.role, 'APPROVE_ORG_CHANGES')) {
      return NextResponse.json(
        { error: getPermissionError('APPROVE_ORG_CHANGES') },
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
    if (status) {
      where.status = status;
    }

    // 5. 조직 변경 요청 목록 조회
    const [requests, total] = await Promise.all([
      prisma.organizationChangeRequest.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              full_name: true,
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
          reviewed_by_profile: {
            select: {
              id: true,
              email: true,
              full_name: true
            }
          }
        },
        orderBy: {
          created_at: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.organizationChangeRequest.count({ where })
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
