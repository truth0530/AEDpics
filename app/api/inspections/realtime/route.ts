import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';
import { checkPermission, getPermissionError } from '@/lib/auth/permissions';

const prisma = new PrismaClient();

/**
 * GET /api/inspections/realtime
 * 실시간 점검 현황 모니터링
 *
 * 쿼리 파라미터:
 * - includeCompleted: boolean (최근 완료된 점검 포함 여부, 기본값: true)
 * - completedLimit: number (완료된 점검 조회 개수, 기본값: 20)
 *
 * 반환 데이터:
 * - 진행 중인 점검 세션 목록
 * - 최근 완료된 점검 목록
 * - 실시간 통계
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
    const includeCompleted = searchParams.get('includeCompleted') !== 'false';
    const completedLimit = parseInt(searchParams.get('completedLimit') || '20');

    // 4. 진행 중인 점검 세션 조회
    const inProgressSessions = await prisma.inspection_sessions.findMany({
      where: {
        status: 'in_progress'
      },
      include: {
        user_profiles: {
          select: {
            full_name: true,
            email: true,
            role: true
          }
        },
        aed_data: {
          select: {
            equipment_serial: true,
            management_number: true,
            installation_institution: true,
            sido: true,
            gugun: true,
            installation_location_address: true
          }
        }
      },
      orderBy: {
        started_at: 'desc'
      }
    });

    // 5. 최근 완료된 점검 조회 (includeCompleted가 true인 경우)
    let recentlyCompleted = [];
    if (includeCompleted) {
      const thirtyMinutesAgo = new Date();
      thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);

      recentlyCompleted = await prisma.inspections.findMany({
        where: {
          completed_at: {
            gte: thirtyMinutesAgo
          }
        },
        include: {
          user_profiles: {
            select: {
              full_name: true,
              email: true,
              role: true
            }
          },
          aed_data: {
            select: {
              equipment_serial: true,
              management_number: true,
              installation_institution: true,
              sido: true,
              gugun: true
            }
          }
        },
        orderBy: {
          completed_at: 'desc'
        },
        take: completedLimit
      });
    }

    // 6. 오늘의 점검 통계
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayTotal, todayCompleted, todayInProgress] = await Promise.all([
      prisma.inspections.count({
        where: {
          inspection_date: {
            gte: today
          }
        }
      }),
      prisma.inspections.count({
        where: {
          inspection_date: {
            gte: today
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

    // 7. 시간대별 점검 현황 (오늘)
    const hourlyInspections = await prisma.$queryRaw<Array<{
      hour: number;
      count: bigint;
    }>>`
      SELECT
        EXTRACT(HOUR FROM inspection_date) as hour,
        COUNT(*) as count
      FROM aedpics.inspections
      WHERE inspection_date >= ${today}
      GROUP BY EXTRACT(HOUR FROM inspection_date)
      ORDER BY hour ASC
    `;

    // 8. 점검자별 오늘의 실적
    const inspectorToday = await prisma.$queryRaw<Array<{
      inspector_id: string;
      full_name: string;
      completed: bigint;
      in_progress: bigint;
    }>>`
      SELECT
        up.id as inspector_id,
        up.full_name,
        COUNT(CASE WHEN i.completed_at IS NOT NULL THEN 1 END) as completed,
        COUNT(CASE WHEN i.completed_at IS NULL THEN 1 END) as in_progress
      FROM aedpics.user_profiles up
      LEFT JOIN aedpics.inspections i ON up.id = i.inspector_id AND i.inspection_date >= ${today}
      WHERE up.role IN ('field_inspector', 'health_center_inspector', 'regional_admin', 'emergency_center_admin')
      GROUP BY up.id, up.full_name
      HAVING COUNT(i.id) > 0
      ORDER BY completed DESC
      LIMIT 10
    `;

    // 9. 평균 점검 소요 시간 (오늘)
    const avgDurationToday = await prisma.$queryRaw<Array<{
      avg_duration: number;
    }>>`
      SELECT
        AVG(EXTRACT(EPOCH FROM (completed_at - inspection_date))) as avg_duration
      FROM aedpics.inspections
      WHERE inspection_date >= ${today}
        AND completed_at IS NOT NULL
    `;

    // 10. 응답 데이터 구성
    return NextResponse.json({
      inProgress: inProgressSessions.map(session => ({
        sessionId: session.id,
        equipmentSerial: session.equipment_serial,
        inspector: {
          id: session.inspector_id,
          name: session.user_profiles?.full_name || 'Unknown',
          email: session.user_profiles?.email,
          role: session.user_profiles?.role
        },
        aed: {
          serial: session.aed_data?.equipment_serial,
          managementNumber: session.aed_data?.management_number,
          facilityName: session.aed_data?.installation_institution,
          sido: session.aed_data?.sido,
          gugun: session.aed_data?.gugun,
          location: session.aed_data?.installation_location_address
        },
        startedAt: session.started_at,
        duration: Math.floor((new Date().getTime() - new Date(session.started_at).getTime()) / 1000 / 60), // 분 단위
        currentStep: session.current_step
      })),
      recentlyCompleted: recentlyCompleted.map(inspection => ({
        id: inspection.id,
        equipmentSerial: inspection.equipment_serial,
        inspector: {
          id: inspection.inspector_id,
          name: inspection.user_profiles?.full_name || 'Unknown',
          email: inspection.user_profiles?.email,
          role: inspection.user_profiles?.role
        },
        aed: {
          serial: inspection.aed_data?.equipment_serial,
          managementNumber: inspection.aed_data?.management_number,
          facilityName: inspection.aed_data?.facility_name,
          sido: inspection.aed_data?.sido,
          gugun: inspection.aed_data?.gugun
        },
        completedAt: inspection.completed_at,
        overallStatus: inspection.overall_status,
        inspectionType: inspection.inspection_type,
        issuesFound: inspection.issues_found?.length || 0
      })),
      todayStats: {
        total: todayTotal,
        completed: todayCompleted,
        inProgress: todayInProgress,
        avgDuration: avgDurationToday[0]?.avg_duration ? Math.round(avgDurationToday[0].avg_duration / 60) : 0 // 분 단위
      },
      hourlyTrend: hourlyInspections.map(item => ({
        hour: Number(item.hour),
        count: Number(item.count)
      })),
      inspectorPerformance: inspectorToday.map(item => ({
        id: item.inspector_id,
        name: item.full_name,
        completed: Number(item.completed),
        inProgress: Number(item.in_progress)
      })),
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('[GET /api/inspections/realtime] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
