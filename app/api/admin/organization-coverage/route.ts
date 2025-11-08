import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // 1. 전체 조직 수
    const totalOrganizations = await prisma.organizations.count({
      where: { type: 'health_center' }
    });

    // 2. local_admin이 있는 조직
    const organizationsWithAdmin = await prisma.organizations.count({
      where: {
        type: 'health_center',
        user_profiles: {
          some: {
            role: 'local_admin',
            is_active: true
          }
        }
      }
    });

    // 3. 담당자 없는 조직
    const organizationsWithoutAdmin = totalOrganizations - organizationsWithAdmin;

    // 4. 커버리지 비율
    const coverage = (organizationsWithAdmin / totalOrganizations) * 100;

    // 5. 고아 임시점검원 (담당자 없는 조직에 소속)
    const orphanInspectors = await prisma.user_profiles.findMany({
      where: {
        role: 'temporary_inspector',
        is_active: true,
        organization_id: {
          not: null
        },
        organizations: {
          user_profiles: {
            none: {
              role: 'local_admin',
              is_active: true
            }
          }
        }
      },
      include: {
        organizations: true
      }
    });

    // 6. 지역별 현황
    const allOrganizations = await prisma.organizations.findMany({
      where: { type: 'health_center' },
      include: {
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
      }
    });

    const regionalBreakdown: Record<string, { total: number; withAdmin: number }> = {};

    allOrganizations.forEach(org => {
      const region = org.region_code || 'Unknown';
      if (!regionalBreakdown[region]) {
        regionalBreakdown[region] = { total: 0, withAdmin: 0 };
      }
      regionalBreakdown[region].total++;
      if (org._count.user_profiles > 0) {
        regionalBreakdown[region].withAdmin++;
      }
    });

    const regionalBreakdownArray = Object.entries(regionalBreakdown)
      .map(([region, data]) => ({
        region,
        ...data
      }))
      .sort((a, b) => (b.withAdmin / b.total) - (a.withAdmin / a.total));

    return NextResponse.json({
      totalOrganizations,
      organizationsWithAdmin,
      organizationsWithoutAdmin,
      coverage: Math.round(coverage * 10) / 10,
      orphanInspectors: orphanInspectors.map(inspector => ({
        name: inspector.full_name || 'Unknown',
        email: inspector.email,
        region: inspector.region || 'Unknown',
        organization: inspector.organizations?.name || inspector.organization_name || 'Unknown'
      })),
      regionalBreakdown: regionalBreakdownArray
    });
  } catch (error) {
    console.error('Failed to fetch organization coverage:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organization coverage data' },
      { status: 500 }
    );
  }
}