import { NextRequest, NextResponse } from 'next/server';
import { getCachedAuthUser, getCachedUserProfile } from '@/lib/auth/cached-queries';
import {
  getCachedDashboardData,
  getCachedHourlyInspections,
  getCachedDailyInspections
} from '@/lib/aed/dashboard-queries';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 사용자 인증 확인
    const user = await getCachedAuthUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 프로필 조회
    const userProfile = await getCachedUserProfile(user.id);
    if (!userProfile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // 쿼리 파라미터에서 시도/구군 가져오기
    const { searchParams } = new URL(request.url);
    const selectedSido = searchParams.get('sido') || undefined;
    const selectedGugun = searchParams.get('gugun') || undefined;

    // 대시보드 데이터 조회
    const [dashboardData, hourlyData, dailyData] = await Promise.all([
      getCachedDashboardData(userProfile, selectedSido, selectedGugun),
      getCachedHourlyInspections(userProfile),
      getCachedDailyInspections(userProfile),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        dashboard: dashboardData,
        hourly: hourlyData,
        daily: dailyData,
      }
    });
  } catch (error) {
    logger.error('Dashboard API', 'Failed to fetch dashboard data', { error });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch dashboard data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
