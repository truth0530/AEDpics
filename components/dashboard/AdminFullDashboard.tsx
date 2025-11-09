'use client';

import { useEffect, useState, useRef } from 'react';
import { UserProfile } from '@/packages/types';
import ImprovedDashboard from './ImprovedDashboard';
import { logger } from '@/lib/logger';

interface AdminFullDashboardProps {
  user: UserProfile;
}

export default function AdminFullDashboard({ user }: AdminFullDashboardProps) {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [hourlyData, setHourlyData] = useState<any>(null);
  const [dailyData, setDailyData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSido, setSelectedSido] = useState<string>('전체');
  const [selectedGugun, setSelectedGugun] = useState<string>('전체');
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'this_week' | 'this_month' | 'last_month'>('all');

  const loadDashboardData = async (sido: string, gugun: string, range: 'all' | 'today' | 'this_week' | 'this_month' | 'last_month' = 'all') => {
    try {
      setLoading(true);

      // API를 통해 대시보드 데이터 가져오기
      const params = new URLSearchParams();
      if (sido && sido !== '전체' && sido !== '시도') params.append('sido', sido);
      if (gugun && gugun !== '전체' && gugun !== '구군') params.append('gugun', gugun);
      params.append('dateRange', range);

      const response = await fetch(`/api/dashboard?${params.toString()}`);
      const result = await response.json();

      if (result.success && result.data) {
        setDashboardData(result.data.dashboard);
        setHourlyData(result.data.hourly);
        setDailyData(result.data.daily);
      } else {
        logger.error('AdminFullDashboard', 'Failed to load dashboard data', { error: result.error });
      }
    } catch (error) {
      logger.error('AdminFullDashboard', 'Error loading data', { error });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 초기 로드 시 sessionStorage에서 지역 정보 복원
    const storedSido = window.sessionStorage.getItem('selectedSido') || '전체';
    const storedGugun = window.sessionStorage.getItem('selectedGugun') || '전체';

    setSelectedSido(storedSido);
    setSelectedGugun(storedGugun);
    // 초기 로드
    loadDashboardData(storedSido, storedGugun, 'all');
  }, [user]);

  useEffect(() => {
    // regionSelected 이벤트 리스너 등록
    const handleRegionSelected = (event: Event) => {
      const customEvent = event as CustomEvent<{ sido: string; gugun: string }>;
      const { sido, gugun } = customEvent.detail;

      setSelectedSido(sido);
      setSelectedGugun(gugun);
      // 현재 dateRange 상태를 참조 (클로저)
      setDateRange(currentRange => {
        loadDashboardData(sido, gugun, currentRange);
        return currentRange;
      });
    };

    window.addEventListener('regionSelected', handleRegionSelected as EventListener);

    return () => {
      window.removeEventListener('regionSelected', handleRegionSelected as EventListener);
    };
  }, [user]);

  // 날짜 범위 변경 핸들러
  const handleDateRangeChange = (newRange: 'all' | 'today' | 'this_week' | 'this_month' | 'last_month') => {
    setDateRange(newRange);
    loadDashboardData(selectedSido, selectedGugun, newRange);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (!dashboardData || !hourlyData || !dailyData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-yellow-500">
          <p className="text-xl font-bold">데이터가 없습니다</p>
          <p className="mt-2 text-sm">대시보드 데이터를 불러올 수 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <ImprovedDashboard
      dashboardData={dashboardData}
      hourlyData={hourlyData}
      dailyData={dailyData}
      userRole={user.role}
      dateRange={dateRange}
      onDateRangeChange={handleDateRangeChange}
      selectedSido={selectedSido}
      selectedGugun={selectedGugun}
    />
  );
}
