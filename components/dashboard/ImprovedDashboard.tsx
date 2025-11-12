'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { StatCard, WorkflowStep } from './StatCard';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';
import { getRegionSortOrder } from '@/lib/constants/regions';
import { UserRole } from '@/packages/types';

interface RegionStats {
  region: string;
  total: number;
  mandatory: number;
  nonMandatory: number;
  completed: number;
  completedMandatory: number;
  completedNonMandatory: number;
  urgent: number;
  rate: number;
  blocked: number;
  blockedMandatory: number;
  blockedNonMandatory: number;
  blockedInspected: number;
  blockedInspectedMandatory: number;
  blockedInspectedNonMandatory: number;
  blockedAssigned: number;
  blockedFieldInspected: number;
  uninspected: number;
  uninspectedMandatory: number;
  uninspectedNonMandatory: number;
  uninspectedAssigned: number;
  uninspectedFieldInspected: number;
  fieldInspected: number;
  fieldInspectedMandatory: number;
  fieldInspectedNonMandatory: number;
  assigned: number;
  assignedMandatory: number;
  assignedNonMandatory: number;
  unavailable: number;
  unavailableMandatory: number;
  unavailableNonMandatory: number;
}

interface DashboardData {
  title: string;
  data: RegionStats[];
  totalAED: number;
  totalCompleted: number;
  totalUrgent: number;
  completionRate: number;
}

interface HourlyInspectionData {
  hour: string;
  count: number;
}

interface DailyInspectionData {
  day: string;
  count: number;
}

interface ImprovedDashboardProps {
  dashboardData: DashboardData;
  hourlyData: HourlyInspectionData[];
  dailyData: DailyInspectionData[];
  userRole: UserRole;
  dateRange: 'all' | 'today' | 'this_week' | 'this_month' | 'last_month';
  onDateRangeChange: (range: 'all' | 'today' | 'this_week' | 'this_month' | 'last_month') => void;
  selectedSido?: string;
  selectedGugun?: string;
}

export default function ImprovedDashboard({
  dashboardData,
  hourlyData,
  dailyData,
  userRole,
  dateRange,
  onDateRangeChange,
  selectedSido = '전체',
  selectedGugun = '전체'
}: ImprovedDashboardProps) {
  // 의무기관매칭 통계 상태
  const [complianceStats, setComplianceStats] = useState({
    total: 0,
    installed: 0,
    notInstalled: 0
  });
  const [complianceLoading, setComplianceLoading] = useState(false);

  // RegionFilter에서 선택된 지역 상태 (AppHeader의 regionSelected 이벤트 수신)
  const [headerSelectedSido, setHeaderSelectedSido] = useState<string | null>(null);
  const [headerSelectedGugun, setHeaderSelectedGugun] = useState<string | null>(null);

  const formatNumber = (num: number): string => {
    return num.toLocaleString('ko-KR');
  };

  // AppHeader의 RegionFilter에서 지역 변경 이벤트 수신
  useEffect(() => {
    const handleRegionChange = (e: CustomEvent) => {
      const { sido, gugun } = e.detail;
      console.log('[ImprovedDashboard] Region changed from header:', { sido, gugun });
      setHeaderSelectedSido(sido || null);
      setHeaderSelectedGugun(gugun || null);
    };

    window.addEventListener('regionSelected', handleRegionChange as EventListener);
    return () => {
      window.removeEventListener('regionSelected', handleRegionChange as EventListener);
    };
  }, []);

  // 의무기관매칭 통계 로드 (경량 통계 전용 엔드포인트 사용)
  const loadComplianceStats = async () => {
    try {
      setComplianceLoading(true);

      // header에서 선택된 지역 우선 사용, 없으면 dashboard props의 selectedSido/Gugun 사용
      const effectiveSido = headerSelectedSido || selectedSido;
      const effectiveGugun = headerSelectedGugun || selectedGugun;

      const params = new URLSearchParams({
        year: '2024'
      });

      if (effectiveSido && effectiveSido !== '전체' && effectiveSido !== '시도') {
        params.append('sido', effectiveSido);
      }
      if (effectiveGugun && effectiveGugun !== '전체' && effectiveGugun !== '구군') {
        params.append('gugun', effectiveGugun);
      }

      // 통계 전용 경량 API 사용 (similarity matching 없이 빠른 집계)
      const response = await fetch(`/api/compliance/stats?${params}`);
      const data = await response.json();

      if (data.success && data.stats) {
        setComplianceStats({
          total: data.stats.total,
          installed: data.stats.installed,
          notInstalled: data.stats.notInstalled
        });
      }
    } catch (error) {
      console.error('[ImprovedDashboard] Failed to load compliance stats:', error);
    } finally {
      setComplianceLoading(false);
    }
  };

  // 지역 변경 시 의무기관매칭 통계 다시 로드
  useEffect(() => {
    loadComplianceStats();
  }, [headerSelectedSido, headerSelectedGugun, selectedSido, selectedGugun]);

  // 날짜 범위에 따른 차트 설명 텍스트
  const getChartDescription = (range: string) => {
    switch (range) {
      case 'all': return '전체';
      case 'today': return '오늘';
      case 'this_week': return '이번주';
      case 'this_month': return '이번달';
      case 'last_month': return '지난달';
      default: return '전체';
    }
  };

  // 통계 계산
  const stats = useMemo(() => {
    const unavailableTotal = dashboardData.data.reduce((sum, r) => sum + r.unavailable, 0);
    const unavailableMandatory = dashboardData.data.reduce((sum, r) => sum + r.unavailableMandatory, 0);
    const unavailableNonMandatory = dashboardData.data.reduce((sum, r) => sum + r.unavailableNonMandatory, 0);

    const totalAED = dashboardData.totalAED;
    const totalMandatory = dashboardData.data.reduce((sum, r) => sum + r.mandatory, 0);
    const totalNonMandatory = dashboardData.data.reduce((sum, r) => sum + r.nonMandatory, 0);

    const completedMandatory = dashboardData.data.reduce((sum, r) => sum + r.completedMandatory, 0);
    const completedNonMandatory = dashboardData.data.reduce((sum, r) => sum + r.completedNonMandatory, 0);

    const assignedMandatory = dashboardData.data.reduce((sum, r) => sum + r.assignedMandatory, 0);
    const assignedNonMandatory = dashboardData.data.reduce((sum, r) => sum + r.assignedNonMandatory, 0);

    const fieldInspectedMandatory = dashboardData.data.reduce((sum, r) => sum + r.fieldInspectedMandatory, 0);
    const fieldInspectedNonMandatory = dashboardData.data.reduce((sum, r) => sum + r.fieldInspectedNonMandatory, 0);
    const fieldInspectedTotal = dashboardData.data.reduce((sum, r) => sum + r.fieldInspected, 0);

    const totalBlocked = dashboardData.data.reduce((sum, r) => sum + r.blocked, 0);
    const totalBlockedInspected = dashboardData.data.reduce((sum, r) => sum + r.blockedInspected, 0);
    const totalBlockedAssigned = dashboardData.data.reduce((sum, r) => sum + r.blockedAssigned, 0);
    const totalBlockedFieldInspected = dashboardData.data.reduce((sum, r) => sum + r.blockedFieldInspected, 0);

    const totalUninspected = dashboardData.data.reduce((sum, r) => sum + r.uninspected, 0);
    const totalUninspectedAssigned = dashboardData.data.reduce((sum, r) => sum + r.uninspectedAssigned, 0);
    const totalUninspectedFieldInspected = dashboardData.data.reduce((sum, r) => sum + r.uninspectedFieldInspected, 0);

    return {
      totalAED,
      totalMandatory,
      totalNonMandatory,
      completedMandatory,
      completedNonMandatory,
      assignedMandatory,
      assignedNonMandatory,
      fieldInspectedMandatory,
      fieldInspectedNonMandatory,
      fieldInspectedTotal,
      totalBlocked,
      totalBlockedInspected,
      totalBlockedAssigned,
      totalBlockedFieldInspected,
      totalUninspected,
      totalUninspectedAssigned,
      totalUninspectedFieldInspected,
      unavailableTotal,
      unavailableMandatory,
      unavailableNonMandatory,
    };
  }, [dashboardData]);

  // 워크플로우 단계 데이터 생성
  const createWorkflowSteps = (
    completed: number,
    assigned: number,
    fieldInspected: number,
    total: number
  ): WorkflowStep[] => {
    return [
      {
        id: 1,
        label: '관리자점검',
        value: completed,
        total: total,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
        color: 'purple' as const
      },
      {
        id: 2,
        label: '일정추가',
        value: assigned,
        total: total,
        percentage: total > 0 ? Math.round((assigned / total) * 100) : 0,
        color: 'orange' as const
      },
      {
        id: 3,
        label: '현장점검',
        value: fieldInspected,
        total: assigned,
        percentage: assigned > 0 ? Math.round((fieldInspected / assigned) * 100) : 0,
        color: 'green' as const
      }
    ];
  };

  // 지역별 데이터
  const regionData = useMemo(() => {
    return dashboardData.data
      .map((row) => ({
        region: row.region,
        mandatory: row.mandatory,
        nonMandatory: row.nonMandatory,
        completedMandatory: row.completedMandatory,
        completedNonMandatory: row.completedNonMandatory,
        total: row.total,
        completed: row.completed,
        urgent: row.urgent,
        completionRate: row.rate,
      }))
      .sort((a, b) => getRegionSortOrder(a.region) - getRegionSortOrder(b.region));
  }, [dashboardData]);

  // 상위 5개 지역
  const top5Regions = useMemo(() => {
    return [...regionData]
      .sort((a, b) => b.completionRate - a.completionRate)
      .slice(0, 5);
  }, [regionData]);

  // 하위 5개 지역
  const bottom5Regions = useMemo(() => {
    return [...regionData]
      .sort((a, b) => a.completionRate - b.completionRate)
      .slice(0, 5);
  }, [regionData]);

  // 상위/하위 지역 카드 표시 여부
  // 요구사항: "구군을 특정 지역으로 선택하는 즉시 사라져야 한다"
  // 구군이 특정 지역(중구, 동구 등)이 아닐 때만 표시
  const showRegionRankingCards = useMemo(() => {
    const isSpecificGugun = selectedGugun !== '전체' && selectedGugun !== '구군';
    return !isSpecificGugun;
  }, [selectedGugun]);

  // 시도별 현황 표 표시 여부
  // 시도가 선택되지 않았을 때만 표시 (시도 목록)
  const showSidoTable = useMemo(() => {
    const noSelectedSido = !selectedSido || selectedSido === '전체' || selectedSido === '시도';
    return noSelectedSido;
  }, [selectedSido]);

  // 구군별 현황 표 표시 여부
  // 시도를 선택하고 구군은 '전체' 또는 '구군'인 경우에만 표시 (구군 목록)
  const showGugunTable = useMemo(() => {
    const hasSelectedSido = selectedSido && selectedSido !== '전체' && selectedSido !== '시도';
    const isGugunAll = selectedGugun === '전체' || selectedGugun === '구군';
    return hasSelectedSido && isGugunAll;
  }, [selectedSido, selectedGugun]);

  // 차트 설정 (다크모드 대응)
  const chartConfig = {
    count: {
      label: "점검건수",
      color: "#06b6d4",
    },
  } satisfies ChartConfig;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{dashboardData.title}</h1>
          <p className="text-sm text-gray-300 mt-1">실시간 AED 점검 현황을 확인하세요</p>
        </div>

        {/* 의무기관매칭 현황 통계 */}
        <div className="flex items-center gap-3">
          {complianceLoading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
          ) : (
            <>
              <Link href="/admin/compliance">
                <Badge
                  variant="outline"
                  className="text-xs px-2 py-1 cursor-pointer hover:bg-muted transition-colors"
                >
                  의무시설: <span className="font-semibold ml-1">{formatNumber(complianceStats.total)}</span>
                </Badge>
              </Link>
              <Link href="/admin/compliance">
                <Badge
                  variant="outline"
                  className="text-xs px-2 py-1 border-green-500 text-green-700 dark:text-green-400 cursor-pointer hover:bg-muted transition-colors"
                >
                  매칭완료: <span className="font-semibold ml-1">{formatNumber(complianceStats.installed)}</span>
                </Badge>
              </Link>
              <Link href="/admin/compliance">
                <Badge
                  variant="outline"
                  className="text-xs px-2 py-1 border-amber-500 text-amber-700 dark:text-amber-400 cursor-pointer hover:bg-muted transition-colors"
                >
                  미완료: <span className="font-semibold ml-1">{formatNumber(complianceStats.notInstalled)}</span>
                </Badge>
              </Link>
            </>
          )}
        </div>

        <Select value={dateRange} onValueChange={onDateRangeChange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="기간 선택" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="today">오늘</SelectItem>
            <SelectItem value="this_week">이번주</SelectItem>
            <SelectItem value="this_month">이번달</SelectItem>
            <SelectItem value="last_month">지난달</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 상단 통계 카드 */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {/* 전체 AED */}
        <StatCard
          title="전체 AED"
          totalValue={stats.totalAED - stats.unavailableTotal}
          subtitle={stats.unavailableTotal > 0 ? `점검불가 ${formatNumber(stats.unavailableTotal)}대 제외` : undefined}
          workflowSteps={createWorkflowSteps(
            stats.completedMandatory + stats.completedNonMandatory,
            stats.assignedMandatory + stats.assignedNonMandatory,
            stats.fieldInspectedTotal,
            stats.totalAED - stats.unavailableTotal
          )}
          variant="gradient"
        />

        {/* 구비의무기관 */}
        <StatCard
          title="구비의무기관"
          totalValue={stats.totalMandatory - stats.unavailableMandatory}
          subtitle={stats.unavailableMandatory > 0 ? `점검불가 ${formatNumber(stats.unavailableMandatory)}대 제외` : undefined}
          workflowSteps={createWorkflowSteps(
            stats.completedMandatory,
            stats.assignedMandatory,
            stats.fieldInspectedMandatory,
            stats.totalMandatory - stats.unavailableMandatory
          )}
        />

        {/* 구비의무기관 외 */}
        <StatCard
          title="구비의무기관 외"
          totalValue={stats.totalNonMandatory - stats.unavailableNonMandatory}
          subtitle={stats.unavailableNonMandatory > 0 ? `점검불가 ${formatNumber(stats.unavailableNonMandatory)}대 제외` : undefined}
          workflowSteps={createWorkflowSteps(
            stats.completedNonMandatory,
            stats.assignedNonMandatory,
            stats.fieldInspectedNonMandatory,
            stats.totalNonMandatory - stats.unavailableNonMandatory
          )}
        />

        {/* 외부표출 차단 */}
        <StatCard
          title="외부표출 차단"
          totalValue={stats.totalBlocked}
          workflowSteps={[
            {
              id: 1,
              label: '관리자점검',
              value: stats.totalBlockedInspected,
              total: stats.totalBlocked,
              percentage: stats.totalBlocked > 0 ? Math.round((stats.totalBlockedInspected / stats.totalBlocked) * 100) : 0,
              color: 'purple' as const
            },
            {
              id: 2,
              label: '일정추가',
              value: stats.totalBlockedAssigned,
              total: stats.totalBlocked,
              percentage: stats.totalBlocked > 0 ? Math.round((stats.totalBlockedAssigned / stats.totalBlocked) * 100) : 0,
              color: 'orange' as const
            },
            {
              id: 3,
              label: '현장점검',
              value: stats.totalBlockedFieldInspected,
              total: stats.totalBlockedAssigned,
              percentage: stats.totalBlockedAssigned > 0 ? Math.round((stats.totalBlockedFieldInspected / stats.totalBlockedAssigned) * 100) : 0,
              color: 'green' as const
            }
          ]}
        />

        {/* 미점검 장비 */}
        <StatCard
          title="미점검 장비"
          totalValue={stats.totalUninspected}
          workflowSteps={[
            {
              id: 1,
              label: '관리자점검',
              value: 0,
              total: stats.totalUninspected,
              percentage: 0,
              color: 'purple' as const
            },
            {
              id: 2,
              label: '일정추가',
              value: stats.totalUninspectedAssigned,
              total: stats.totalUninspected,
              percentage: stats.totalUninspected > 0 ? Math.round((stats.totalUninspectedAssigned / stats.totalUninspected) * 100) : 0,
              color: 'orange' as const
            },
            {
              id: 3,
              label: '현장점검',
              value: stats.totalUninspectedFieldInspected,
              total: stats.totalUninspectedAssigned,
              percentage: stats.totalUninspectedAssigned > 0 ? Math.round((stats.totalUninspectedFieldInspected / stats.totalUninspectedAssigned) * 100) : 0,
              color: 'green' as const
            }
          ]}
        />
      </div>

      {/* 차트 영역 */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* 시간대별 점검현황 */}
        <Card>
          <CardHeader>
            <CardTitle>시간대별 점검현황</CardTitle>
            <CardDescription>{getChartDescription(dateRange)}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 12, fill: '#9ca3af' }}
                  interval={2}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis tick={{ fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Bar dataKey="count" name="점검건수" fill="#06b6d4" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* 날짜별 점검건수 */}
        <Card>
          <CardHeader>
            <CardTitle>날짜별 점검건수</CardTitle>
            <CardDescription>{getChartDescription(dateRange)}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <AreaChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis tick={{ fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Area
                  dataKey="count"
                  name="점검건수"
                  type="monotone"
                  fill="#06b6d4"
                  fillOpacity={0.4}
                  stroke="#06b6d4"
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* 지역별 현황 테이블 - local_admin 제외, 시도 미선택 시에만 표시 */}
      {userRole !== 'local_admin' && showSidoTable && (
      <Card>
        <CardHeader>
          <CardTitle>
            {userRole === 'master' || userRole === 'ministry_admin' || userRole === 'emergency_center_admin' || userRole === 'regional_emergency_center_admin'
              ? '시도별 현황'
              : userRole === 'regional_admin'
              ? '시군구별 현황'
              : '보건소별 현황'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-800">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">지역</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">의무</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">비의무</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">완료(의무)</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">완료(비의무)</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">긴급</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">점검률</th>
                </tr>
              </thead>
              <tbody className="bg-gray-900 divide-y divide-gray-800">
                {regionData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-800/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{row.region}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-right">{formatNumber(row.mandatory)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-right">{formatNumber(row.nonMandatory)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-right">
                      {formatNumber(row.completedMandatory)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-right">
                      {formatNumber(row.completedNonMandatory)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-400 text-right">{formatNumber(row.urgent)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      <Badge
                        variant={
                          row.completionRate >= 80
                            ? 'default'
                            : row.completionRate >= 50
                            ? 'secondary'
                            : 'destructive'
                        }
                      >
                        {row.completionRate.toFixed(1)}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      )}

      {/* 구군별 현황 표 - 시도 선택 + 구군 '전체'/'구군'인 경우에만 표시 */}
      {userRole !== 'local_admin' && showGugunTable && (
      <Card>
        <CardHeader>
          <CardTitle>구군별 현황</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-800">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">구군</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">의무</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">비의무</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">완료(의무)</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">완료(비의무)</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">긴급</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">점검률</th>
                </tr>
              </thead>
              <tbody className="bg-gray-900 divide-y divide-gray-800">
                {regionData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-800/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{row.region}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-right">{formatNumber(row.mandatory)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-right">{formatNumber(row.nonMandatory)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-right">
                      {formatNumber(row.completedMandatory)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-right">
                      {formatNumber(row.completedNonMandatory)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-400 text-right">{formatNumber(row.urgent)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      <Badge
                        variant={
                          row.completionRate >= 80
                            ? 'default'
                            : row.completionRate >= 50
                            ? 'secondary'
                            : 'destructive'
                        }
                      >
                        {row.completionRate.toFixed(1)}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      )}

      {/* 상위/하위 5개 지역 - local_admin 제외, 특정 구군 선택 시 숨김 */}
      {userRole !== 'local_admin' && showRegionRankingCards && (
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>점검률 상위 5개 지역</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {top5Regions.map((region, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {idx + 1}
                    </div>
                    <div>
                      <div className="font-medium text-white">{region.region}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatNumber(region.completed)}/{formatNumber(region.total)}
                      </div>
                    </div>
                  </div>
                  <Badge variant="default">{region.completionRate.toFixed(1)}%</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>점검률 하위 5개 지역</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {bottom5Regions.map((region, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10 text-sm font-bold text-destructive">
                      {idx + 1}
                    </div>
                    <div>
                      <div className="font-medium text-white">{region.region}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatNumber(region.completed)}/{formatNumber(region.total)}
                      </div>
                    </div>
                  </div>
                  <Badge variant="destructive">{region.completionRate.toFixed(1)}%</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      )}
    </div>
  );
}
