/**
 * local_admin이 있는 조직만 조회하는 API
 *
 * 목적: 임시점검원 회원가입 시 담당자가 있는 보건소만 선택 가능하도록
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const region = searchParams.get('region');

    // local_admin이 있는 조직 조회
    const organizationsWithAdmin = await prisma.organizations.findMany({
      where: {
        ...(region && {
          OR: [
            { region_code: region },
            { city_code: region }
          ]
        }),
        type: 'health_center',
        // local_admin이 있는 조직만
        user_profiles: {
          some: {
            role: 'local_admin',
            is_active: true
          }
        }
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