import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';
import { checkPermission, getPermissionError } from '@/lib/auth/permissions';

const prisma = new PrismaClient();

/**
 * GET /api/admin/stats
 * 관리자 대시보드 통계 데이터
 *
 * 반환 데이터:
 * - 사용자 통계 (전체, 승인 대기, 역할별)
 * - 조직 통계
 * - AED 통계 (총 대수, 점검 통계)
 * - 최근 활동 로그
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

    // 2. 사용자 프로필 및 권한 확인
    const userProfile = await prisma.userProfile.findUnique({
      where: { id: session.user.id }
    });

    if (!userProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    if (!checkPermission(userProfile.role, 'VIEW_DASHBOARD')) {
      return NextResponse.json(
        { error: getPermissionError('VIEW_DASHBOARD') },
        { status: 403 }
      );
    }

    // 3. 사용자 통계
    const [totalUsers, pendingUsers, usersByRole] = await Promise.all([
      prisma.userProfile.count(),
      prisma.userProfile.count({
        where: { role: 'pending_approval' }
      }),
      prisma.userProfile.groupBy({
        by: ['role'],
        _count: true
      })
    ]);

    // 4. 조직 통계
    const [totalOrganizations, organizationsByType] = await Promise.all([
      prisma.organization.count(),
      prisma.organization.groupBy({
        by: ['type'],
        _count: true
      })
    ]);

    // 5. AED 통계
    const [totalAedDevices, aedByStatus] = await Promise.all([
      prisma.aedDevice.count(),
      prisma.aedDevice.groupBy({
        by: ['status'],
        _count: true
      })
    ]);

    // 6. 점검 통계 (최근 30일)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [totalInspections, inspectionsByResult] = await Promise.all([
      prisma.inspection.count({
        where: {
          inspection_date: {
            gte: thirtyDaysAgo
          }
        }
      }),
      prisma.inspection.groupBy({
        by: ['result'],
        where: {
          inspection_date: {
            gte: thirtyDaysAgo
          }
        },
        _count: true
      })
    ]);

    // 7. 오늘의 활동 로그 (최근 10개)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const recentLogs = await prisma.auditLog.findMany({
      where: {
        created_at: {
          gte: today
        },
        action: {
          in: [
            'user_approved',
            'user_rejected',
            'organization_created',
            'organization_updated',
            'organization_change_approved'
          ]
        }
      },
      include: {
        user: {
          select: {
            email: true,
            full_name: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      },
      take: 10
    });

    // 8. 조직 변경 요청 대기 건수
    const pendingOrgChangeRequests = await prisma.organizationChangeRequest.count({
      where: { status: 'pending' }
    });

    // 9. 응답 데이터 구성
    return NextResponse.json({
      users: {
        total: totalUsers,
        pending: pendingUsers,
        byRole: usersByRole.reduce((acc, item) => {
          acc[item.role] = item._count;
          return acc;
        }, {} as Record<string, number>)
      },
      organizations: {
        total: totalOrganizations,
        byType: organizationsByType.reduce((acc, item) => {
          acc[item.type] = item._count;
          return acc;
        }, {} as Record<string, number>)
      },
      aedDevices: {
        total: totalAedDevices,
        byStatus: aedByStatus.reduce((acc, item) => {
          acc[item.status] = item._count;
          return acc;
        }, {} as Record<string, number>)
      },
      inspections: {
        last30Days: totalInspections,
        byResult: inspectionsByResult.reduce((acc, item) => {
          acc[item.result] = item._count;
          return acc;
        }, {} as Record<string, number>)
      },
      pendingRequests: {
        users: pendingUsers,
        organizationChanges: pendingOrgChangeRequests
      },
      recentActivity: recentLogs.map(log => ({
        id: log.id,
        action: log.action,
        user: log.user?.email || 'Unknown',
        userFullName: log.user?.full_name,
        details: log.details,
        timestamp: log.created_at
      }))
    });

  } catch (error) {
    console.error('[GET /api/admin/stats] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
