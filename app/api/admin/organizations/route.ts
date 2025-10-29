import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth/auth-options';
import { NextRequest, NextResponse } from 'next/server';
import { checkPermission, getPermissionError } from '@/lib/auth/permissions';
import { randomUUID } from 'crypto';

import { prisma } from '@/lib/prisma';
/**
 * GET /api/admin/organizations
 * 조직 목록 조회
 *
 * Query Parameters:
 * - type: 조직 타입 필터 (central, metropolitan_city, province, city, district, health_center)
 * - region: 지역 코드 필터 (KR, 11, 26 등)
 * - search: 조직명 검색
 * - page: 페이지 번호 (기본값: 1)
 * - limit: 페이지당 항목 수 (기본값: 50)
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

    if (!currentProfile || !checkPermission(currentProfile.role, 'LIST_USERS')) {
      return NextResponse.json(
        { error: getPermissionError('LIST_USERS') },
        { status: 403 }
      );
    }

    // 3. Query Parameters 파싱
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const region = searchParams.get('region');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    // 4. 조회 조건 구성
    const where: any = {};
    if (type) where.type = type;
    if (region) where.region_code = region;
    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive'
      };
    }

    // 5. 조직 목록 조회
    const [organizations, total] = await Promise.all([
      prisma.organizations.findMany({
        where,
        select: {
          id: true,
          name: true,
          type: true,
          region_code: true,
          _count: {
            select: {
              user_profiles: true
            }
          }
        },
        orderBy: {
          name: 'asc'
        },
        skip,
        take: limit
      }),
      prisma.organizations.count({ where })
    ]);

    return NextResponse.json({
      organizations,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('[GET /api/admin/organizations] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/organizations
 * 조직 생성
 *
 * Request Body:
 * {
 *   "name": "조직명 (필수)",
 *   "type": "조직 타입 (필수)",
 *   "region_code": "지역 코드 (필수)"
 * }
 */
export async function POST(request: NextRequest) {
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

    if (!currentProfile || !checkPermission(currentProfile.role, 'MANAGE_ORGANIZATIONS')) {
      return NextResponse.json(
        { error: getPermissionError('MANAGE_ORGANIZATIONS') },
        { status: 403 }
      );
    }

    // 3. Request Body 파싱
    const body = await request.json();
    const { name, type, region_code } = body;

    // 4. 입력값 검증
    if (!name || !type || !region_code) {
      return NextResponse.json(
        { error: 'name, type, and region_code are required' },
        { status: 400 }
      );
    }

    // 5. 동일한 이름의 조직이 이미 존재하는지 확인
    const existingOrg = await prisma.organizations.findFirst({
      where: {
        name,
        region_code
      }
    });

    if (existingOrg) {
      return NextResponse.json(
        { error: 'Organization with this name already exists in this region' },
        { status: 400 }
      );
    }

    // 6. 조직 생성
    const organization = await prisma.organizations.create({
      data: {
        id: randomUUID(),
        name,
        type,
        region_code
      }
    });

    // 7. Audit Log 기록
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        user_id: session.user.id,
        action: 'organization_created',
        entity_type: 'organization',
        entity_id: organization.id,
        metadata: {
          name,
          type,
          region_code
        },
        ip_address: request.headers.get('x-forwarded-for') ||
                    request.headers.get('x-real-ip') ||
                    'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
      }
    });

    console.log(`[Organization Created] ${name} (${type}) created by ${session.user.email}`);

    return NextResponse.json({
      success: true,
      organization
    }, { status: 201 });

  } catch (error) {
    console.error('[POST /api/admin/organizations] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}