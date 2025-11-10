/**
 * 지역별 조직 목록 조회 API (역할 기반 필터링)
 *
 * 동작:
 * - region: 조회할 지역 코드 (필수)
 * - role: 사용자 역할 (선택사항, 제공 시 역할에 맞는 조직만 반환)
 * - includeAll: true일 때 모든 조직 타입 반환, false일 때 역할별 필터링 적용
 *
 * 역할별 조직 타입:
 * - emergency_center_admin, regional_emergency_center_admin: emergency_center만
 * - ministry_admin, regional_admin: province만
 * - local_admin, temporary_inspector: health_center만
 *
 * 목적: 역할과 조직 타입의 일관성을 보장하여 데이터 무결성 유지
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAllowedOrganizationTypes } from '@/lib/constants/role-organization-mapping';
import { UserRole } from '@/packages/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const region = searchParams.get('region');
    const role = searchParams.get('role') as UserRole | null;
    const includeAll = searchParams.get('includeAll') === 'true';

    // 역할에 따른 선택 가능한 조직 타입 결정
    let allowedTypes: string[] = [];
    if (role && !includeAll) {
      allowedTypes = getAllowedOrganizationTypes(role);
    }

    // includeAll=true면 모든 조직, false면 역할별 필터링 + local_admin 조건
    const organizationsWithAdmin = await prisma.organizations.findMany({
      where: {
        ...(region && {
          OR: [
            { region_code: region },
            { city_code: region }
          ]
        }),
        // role이 제공되고 includeAll이 false일 때만 역할별 타입 필터링
        ...(role && !includeAll && allowedTypes.length > 0 && {
          type: { in: allowedTypes as any }
        }),
        // role이 없거나 includeAll이 false인 경우만 local_admin 조건 추가
        ...(!role && includeAll === false && {
          type: 'health_center',
          user_profiles: {
            some: {
              role: 'local_admin',
              is_active: true
            }
          }
        })
      },
      select: {
        id: true,
        name: true,
        region_code: true,
        city_code: true,
        type: true,
        _count: {
          select: {
            user_profiles: {
              where: {
                role: 'local_admin',
                is_active: true
              }
            }
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    // 응답 형식 정리
    const result = organizationsWithAdmin.map(org => ({
      id: org.id,
      name: org.name,
      region_code: org.region_code,
      city_code: org.city_code,
      type: org.type,
      adminCount: org._count.user_profiles,
      hasAdmin: org._count.user_profiles > 0
    }));

    return NextResponse.json({
      success: true,
      organizations: result,
      total: result.length,
      withoutAdmin: 0 // 이 API는 admin 있는 것만 반환
    });
  } catch (error) {
    console.error('Failed to fetch organizations with admin:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch organizations',
        organizations: []
      },
      { status: 500 }
    );
  }
}

// POST: 특정 조직에 local_admin이 있는지 확인
export async function POST(request: NextRequest) {
  try {
    const { organizationId, organizationName } = await request.json();

    let hasAdmin = false;
    let adminInfo = null;

    if (organizationId) {
      // ID로 조회
      const org = await prisma.organizations.findFirst({
        where: {
          id: organizationId,
          user_profiles: {
            some: {
              role: 'local_admin',
              is_active: true
            }
          }
        },
        include: {
          user_profiles: {
            where: {
              role: 'local_admin',
              is_active: true
            },
            select: {
              id: true,
              full_name: true,
              email: true
            },
            take: 1
          }
        }
      });

      if (org && org.user_profiles.length > 0) {
        hasAdmin = true;
        adminInfo = org.user_profiles[0];
      }
    } else if (organizationName) {
      // 이름으로 조회
      const org = await prisma.organizations.findFirst({
        where: {
          name: organizationName,
          user_profiles: {
            some: {
              role: 'local_admin',
              is_active: true
            }
          }
        },
        include: {
          user_profiles: {
            where: {
              role: 'local_admin',
              is_active: true
            },
            select: {
              id: true,
              full_name: true,
              email: true
            },
            take: 1
          }
        }
      });

      if (org && org.user_profiles.length > 0) {
        hasAdmin = true;
        adminInfo = org.user_profiles[0];
      }
    }

    return NextResponse.json({
      success: true,
      hasAdmin,
      adminInfo: hasAdmin ? {
        name: adminInfo?.full_name,
        email: adminInfo?.email
      } : null
    });
  } catch (error) {
    console.error('Failed to check organization admin:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check organization',
        hasAdmin: false
      },
      { status: 500 }
    );
  }
}