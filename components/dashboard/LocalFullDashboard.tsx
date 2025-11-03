'use client';

import { useEffect, useState } from 'react';
import { UserProfile } from '@/packages/types';
import ImprovedDashboard from './ImprovedDashboard';

interface LocalFullDashboardProps {
  user: UserProfile;
}

export default function LocalFullDashboard({ user }: LocalFullDashboardProps) {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [hourlyData, setHourlyData] = useState<any>(null);
  const [dailyData, setDailyData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        // 지역 보건소는 자신의 관할 지역 데이터만 로드 (지역 고정)
        // user.region에는 시도 정보가 저장됨 (예: "대구")
        const sido = user.region;

        // API를 통해 데이터 가져오기 (클라이언트 컴포넌트는 서버 함수를 직접 호출할 수 없음)
        const params = new URLSearchParams();
        if (sido) {
          params.append('sido', sido);
        }

        const response = await fetch(`/api/dashboard?${params.toString()}`);
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
        console.error('[LocalFullDashboard] Error loading data:', error);
        setError(error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, [user.region]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <ImprovedDashboard
      dashboardData={dashboardData}
      hourlyData={hourlyData}
      dailyData={dailyData}
      userRole={user.role}
    />
  );
}
