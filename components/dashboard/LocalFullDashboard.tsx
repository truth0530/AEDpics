'use client';

import { useEffect, useState } from 'react';
import { UserProfile } from '@/packages/types';
import ImprovedDashboard from './ImprovedDashboard';
import { logger } from '@/lib/logger';

interface LocalFullDashboardProps {
  user: UserProfile;
}

export default function LocalFullDashboard({ user }: LocalFullDashboardProps) {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [hourlyData, setHourlyData] = useState<any>(null);
  const [dailyData, setDailyData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'today' | 'this_week' | 'this_month' | 'last_month'>('today');

  const loadDashboardData = async (range: 'today' | 'this_week' | 'this_month' | 'last_month' = 'today') => {
    try {
      setLoading(true);

      // 지역 보건소는 자신의 관할 지역 데이터만 로드 (지역 고정)
      const sido = user.region;
      // 구군 정보는 region_code를 통해 서버에서 자동 판별

      // API를 통해 데이터 가져오기
      const params = new URLSearchParams();
      if (sido) params.append('sido', sido);
      params.append('dateRange', range);

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
      setError(null);
    } catch (error) {
      logger.error('LocalFullDashboard', 'Error loading data', { error });
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData(dateRange);
  }, [user.region]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500">
          <p className="text-xl font-bold">데이터 로드 실패</p>
          <p className="mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (!dashboardData || !hourlyData || !dailyData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-yellow-500">
          <p className="text-xl font-bold">데이터가 없습니다</p>
        </div>
      </div>
    );
  }

  // 날짜 범위 변경 핸들러
  const handleDateRangeChange = (newRange: 'today' | 'this_week' | 'this_month' | 'last_month') => {
    setDateRange(newRange);
    loadDashboardData(newRange);
  };

  return (
    <ImprovedDashboard
      dashboardData={dashboardData}
      hourlyData={hourlyData}
      dailyData={dailyData}
      userRole={user.role}
      dateRange={dateRange}
      onDateRangeChange={handleDateRangeChange}
      selectedSido={user.region}
      selectedGugun={undefined}
    />
  );
}
