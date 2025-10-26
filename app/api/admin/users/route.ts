import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';
import { checkPermission, getPermissionError } from '@/lib/auth/permissions';

const prisma = new PrismaClient();

/**
 * GET /api/admin/users
 * 사용자 목록 조회 (관리자용)
 *
 * Query Parameters:
 * - role: 역할별 필터링 (예: pending_approval, local_admin)
 * - region: 지역별 필터링
 * - search: 이름 또는 이메일 검색
 * - page: 페이지 번호 (기본: 1)
 * - limit: 페이지당 개수 (기본: 20)
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

    // 2. 사용자 프로필 조회
    const userProfile = await prisma.userProfile.findUnique({
      where: { id: session.user.id }
    });

    if (!userProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    // 3. 권한 확인
    if (!checkPermission(userProfile.role, 'LIST_USERS')) {
      return NextResponse.json(
        { error: getPermissionError('LIST_USERS') },
        { status: 403 }
      );
    }

    // 4. Query Parameters 파싱
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const region = searchParams.get('region');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // 5. WHERE 조건 구성
    const where: any = {};

    if (role) {
      where.role = role;
    }

    if (region) {
      where.region_code = region;
    }

    if (search) {
      where.OR = [
        { full_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    // 6. 사용자 목록 조회
    const [users, total] = await Promise.all([
      prisma.userProfile.findMany({
        where,
        include: {
          organizations: {
            select: {
              id: true,
              name: true,
              type: true,
              region_code: true
            }
          }
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit
      }),
      prisma.userProfile.count({ where })
    ]);

    // 7. 응답 반환
    return NextResponse.json({
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('[GET /api/admin/users] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
