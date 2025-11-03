'use client';

import { useEffect, useState } from 'react';
import { UserProfile } from '@/packages/types';
import AEDDashboardNew from './AEDDashboardNew';

interface ReadOnlyDashboardProps {
  user: UserProfile;
}

export default function ReadOnlyDashboard({ user }: ReadOnlyDashboardProps) {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [hourlyData, setHourlyData] = useState<any>(null);
  const [dailyData, setDailyData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        // 조회 전용: 통계만 표시
        // API를 통해 데이터 가져오기
        const response = await fetch('/api/dashboard');
        if (!response.ok) {
          throw new Error(`Failed to fetch dashboard data: ${response.statusText}`);
        }

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'Failed to load dashboard data');
        }

        setDashboardData(result.data.dashboard);
        setHourlyData(result.data.hourly);
        setDailyData(result.data.daily);
      } catch (error) {
        console.error('[ReadOnlyDashboard] Error loading data:', error);
        setError(error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

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
