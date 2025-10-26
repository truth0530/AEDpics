import { redirect } from 'next/navigation';
import AEDDashboardNew from '@/components/dashboard/AEDDashboardNew';
import { getCachedAuthUser, getCachedUserProfile } from '@/lib/auth/cached-queries';
import {
  getCachedDashboardData,
  getCachedHourlyInspections,
  getCachedDailyInspections
} from '@/lib/aed/dashboard-queries';

export default async function DashboardPage() {
  // 캐싱된 사용자 조회
  const user = await getCachedAuthUser();

  if (!user) {
    redirect('/auth/signin');
  }

  // 캐싱된 프로필 조회
  const typedProfile = await getCachedUserProfile(user.id);

  if (!typedProfile) {
    console.error('Profile not found in dashboard page - this should not happen');
    redirect('/auth/signin');
  }

  // 캐싱된 대시보드 데이터 조회 (병렬 처리)
  const [dashboardData, hourlyData, dailyData] = await Promise.all([
    getCachedDashboardData(typedProfile),
    getCachedHourlyInspections(typedProfile),
    getCachedDailyInspections(typedProfile),
  ]);

  return (
    <AEDDashboardNew
      dashboardData={dashboardData}
      hourlyData={hourlyData}
      dailyData={dailyData}
      userRole={typedProfile.role}
    />
  );
}