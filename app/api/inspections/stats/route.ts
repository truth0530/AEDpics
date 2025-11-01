import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { checkPermission, getPermissionError } from '@/lib/auth/permissions';
import { logger } from '@/lib/logger';

import { prisma } from '@/lib/prisma';
/**
 * GET /api/inspections/stats
 * 점검 통계 데이터
 *
 * 쿼리 파라미터:
 * - period: '7d' | '30d' | '90d' | '1y' (기본값: 30d)
 * - groupBy: 'day' | 'week' | 'month' (기본값: day)
 *
 * 반환 데이터:
 * - 전체 점검 통계
 * - 기간별 점검 추이
 * - 상태별 점검 분포
 * - 지역별 점검 현황
 * - 점검자별 점검 실적
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
    const userProfile = await prisma.user_profiles.findUnique({
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

    // 3. 쿼리 파라미터 파싱
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d';
    const groupBy = searchParams.get('groupBy') || 'day';

    // 4. 기간 계산
    const now = new Date();
    const startDate = new Date();

    switch (period) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    // 5. 전체 점검 통계
    const [totalInspections, completedInspections, inProgressInspections] = await Promise.all([
      prisma.inspections.count({
        where: {
          inspection_date: {
            gte: startDate
          }
        }
      }),
      prisma.inspections.count({
        where: {
          inspection_date: {
            gte: startDate
          },
          completed_at: {
            not: null
          }
        }
      }),
      prisma.inspection_sessions.count({
        where: {
          status: 'in_progress'
        }
      })
    ]);

    // 6. overall_status별 점검 분포
    const inspectionsByStatus = await prisma.inspections.groupBy({
      by: ['overall_status'],
      where: {
        inspection_date: {
          gte: startDate
        }
      },
      _count: true
    });

    // 7. inspection_type별 점검 분포
    const inspectionsByType = await prisma.inspections.groupBy({
      by: ['inspection_type'],
      where: {
        inspection_date: {
          gte: startDate
        }
      },
      _count: true
    });

    // 8. 기간별 점검 추이
    const inspectionTrend = await prisma.$queryRaw<Array<{
      date: Date;
      count: bigint;
    }>>`
      SELECT
        DATE(inspection_date) as date,
        COUNT(*) as count
      FROM aedpics.inspections
      WHERE inspection_date >= ${startDate}
      GROUP BY DATE(inspection_date)
      ORDER BY date ASC
    `;

    // 9. 지역별 점검 현황 (시도 기준)
    const inspectionsByRegion = await prisma.$queryRaw<Array<{
      sido: string;
      count: bigint;
    }>>`
      SELECT
        ad.sido,
        COUNT(i.id) as count
      FROM aedpics.inspections i
      JOIN aedpics.aed_data ad ON i.equipment_serial = ad.equipment_serial
      WHERE i.inspection_date >= ${startDate}
      GROUP BY ad.sido
      ORDER BY count DESC
      LIMIT 20
    `;

    // 10. 점검자별 점검 실적 (상위 10명)
    const inspectorPerformance = await prisma.$queryRaw<Array<{
      inspector_id: string;
      full_name: string;
      email: string;
      count: bigint;
      avg_duration: number;
    }>>`
      SELECT
        i.inspector_id,
        up.full_name,
        up.email,
        COUNT(i.id) as count,
        AVG(EXTRACT(EPOCH FROM (i.completed_at - i.inspection_date))) as avg_duration
      FROM aedpics.inspections i
      LEFT JOIN aedpics.user_profiles up ON i.inspector_id = up.id
      WHERE i.inspection_date >= ${startDate}
        AND i.completed_at IS NOT NULL
      GROUP BY i.inspector_id, up.full_name, up.email
      ORDER BY count DESC
      LIMIT 10
    `;

    // 11. 오늘의 점검 현황
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayInspections = await prisma.inspections.count({
      where: {
        inspection_date: {
          gte: today
        }
      }
    });

    // 12. 평균 점검 소요 시간
    const avgInspectionDuration = await prisma.$queryRaw<Array<{
      avg_duration: number;
    }>>`
      SELECT
        AVG(EXTRACT(EPOCH FROM (completed_at - inspection_date))) as avg_duration
      FROM aedpics.inspections
      WHERE inspection_date >= ${startDate}
        AND completed_at IS NOT NULL
    `;

    // 13. 응답 데이터 구성
    return NextResponse.json({
      overview: {
        total: totalInspections,
        completed: completedInspections,
        inProgress: inProgressInspections,
        today: todayInspections,
        avgDuration: avgInspectionDuration[0]?.avg_duration ? Math.round(avgInspectionDuration[0].avg_duration / 60) : 0 // 분 단위
      },
      byStatus: inspectionsByStatus.reduce((acc, item) => {
        acc[item.overall_status || 'unknown'] = item._count;
        return acc;
      }, {} as Record<string, number>),
      byType: inspectionsByType.reduce((acc, item) => {
        acc[item.inspection_type || 'unknown'] = item._count;
        return acc;
      }, {} as Record<string, number>),
      trend: inspectionTrend.map(item => ({
        date: item.date,
        count: Number(item.count)
      })),
      byRegion: inspectionsByRegion.map(item => ({
        sido: item.sido,
        count: Number(item.count)
      })),
      topInspectors: inspectorPerformance.map(item => ({
        id: item.inspector_id,
        name: item.full_name,
        email: item.email,
        count: Number(item.count),
        avgDuration: item.avg_duration ? Math.round(item.avg_duration / 60) : 0 // 분 단위
      })),
      period,
      groupBy,
      startDate,
      endDate: now
    });

  } catch (error) {
    logger.error('InspectionStats:GET', 'Inspection stats error',
      error instanceof Error ? error : { error }
    );
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
