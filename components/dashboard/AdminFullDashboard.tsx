'use client';

import { useEffect, useState } from 'react';
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

  const loadDashboardData = async (sido: string, gugun: string) => {
    try {
      setLoading(true);

      // API를 통해 대시보드 데이터 가져오기
      const params = new URLSearchParams();
      if (sido && sido !== '전체' && sido !== '시도') params.append('sido', sido);
      if (gugun && gugun !== '전체' && gugun !== '구군') params.append('gugun', gugun);

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
    loadDashboardData(storedSido, storedGugun);
  }, [user]);

  useEffect(() => {
    // regionSelected 이벤트 리스너 등록
    const handleRegionSelected = (event: Event) => {
      const customEvent = event as CustomEvent<{ sido: string; gugun: string }>;
      const { sido, gugun } = customEvent.detail;

      setSelectedSido(sido);
      setSelectedGugun(gugun);
      loadDashboardData(sido, gugun);
    };

    window.addEventListener('regionSelected', handleRegionSelected as EventListener);

    return () => {
      window.removeEventListener('regionSelected', handleRegionSelected as EventListener);
    };
  }, [user]);

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
