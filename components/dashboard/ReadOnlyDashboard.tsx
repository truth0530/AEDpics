'use client';

import { useEffect, useState } from 'react';
import { UserProfile } from '@/packages/types';
import AEDDashboardNew from './AEDDashboardNew';
import {
  getCachedDashboardData,
  getCachedHourlyInspections,
  getCachedDailyInspections
} from '@/lib/aed/dashboard-queries';

interface ReadOnlyDashboardProps {
  user: UserProfile;
}

export default function ReadOnlyDashboard({ user }: ReadOnlyDashboardProps) {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [hourlyData, setHourlyData] = useState<any>(null);
  const [dailyData, setDailyData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        // 조회 전용: 통계만 표시
        const [dashboard, hourly, daily] = await Promise.all([
          getCachedDashboardData(user),
          getCachedHourlyInspections(user),
          getCachedDailyInspections(user),
        ]);

        setDashboardData(dashboard);
        setHourlyData(hourly);
        setDailyData(daily);
      } catch (error) {
        console.error('[ReadOnlyDashboard] Error loading data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <AEDDashboardNew
      dashboardData={dashboardData}
      hourlyData={hourlyData}
      dailyData={dailyData}
      userRole={user.role}
    />
  );
}
