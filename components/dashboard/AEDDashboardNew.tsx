'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Activity, MapPin, CheckCircle2, AlertTriangle } from 'lucide-react';
import RegionStatsTable from './RegionStatsTable';
import { getRegionSortOrder } from '@/lib/constants/regions';

// dashboard-queries.ts의 DashboardData 타입과 일치
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
  uninspected: number;
  uninspectedMandatory: number;
  uninspectedNonMandatory: number;
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
  mandatory: number;
  nonMandatory: number;
}

interface DailyInspectionData {
  date: string;
  mandatory: number;
  nonMandatory: number;
}

interface AEDDashboardProps {
  dashboardData: DashboardData;
  hourlyData: HourlyInspectionData[];
  dailyData: DailyInspectionData[];
  userRole: string;
}

export default function AEDDashboardNew({ dashboardData, hourlyData, dailyData, userRole }: AEDDashboardProps) {
  // 숫자에 천단위 쉼표 추가 함수
  const formatNumber = (num: number): string => {
    return num.toLocaleString('ko-KR');
  };

  // 실제 데이터로부터 통계 계산
  const stats = useMemo(() => {
    // 점검불가 통계
    const unavailableTotal = dashboardData.data.reduce((sum, r) => sum + r.unavailable, 0);
    const unavailableMandatory = dashboardData.data.reduce((sum, r) => sum + r.unavailableMandatory, 0);
    const unavailableNonMandatory = dashboardData.data.reduce((sum, r) => sum + r.unavailableNonMandatory, 0);

    return {
      totalAED: dashboardData.totalAED,
      totalMandatory: dashboardData.data.reduce((sum, r) => sum + r.mandatory, 0),
      totalNonMandatory: dashboardData.data.reduce((sum, r) => sum + r.nonMandatory, 0),
      // 관리자점검 (last_inspection_date 기준 90일 이내)
      completedMandatory: dashboardData.data.reduce((sum, r) => sum + r.completedMandatory, 0),
      completedNonMandatory: dashboardData.data.reduce((sum, r) => sum + r.completedNonMandatory, 0),
      // 일정추가된 건수 (inspection_assignments에서 pending 상태)
      assignedMandatory: dashboardData.data.reduce((sum, r) => sum + r.assignedMandatory, 0),
      assignedNonMandatory: dashboardData.data.reduce((sum, r) => sum + r.assignedNonMandatory, 0),
      // 현장점검 (inspection_sessions에서 completed 상태) - 실제 데이터
      fieldInspectedMandatory: dashboardData.data.reduce((sum, r) => sum + r.fieldInspectedMandatory, 0),
      fieldInspectedNonMandatory: dashboardData.data.reduce((sum, r) => sum + r.fieldInspectedNonMandatory, 0),
      fieldInspectedTotal: dashboardData.data.reduce((sum, r) => sum + r.fieldInspected, 0),
      totalUrgent: dashboardData.totalUrgent,
      // 외부표출 차단 (실제 데이터)
      totalBlocked: dashboardData.data.reduce((sum, r) => sum + r.blocked, 0),
      totalBlockedMandatory: dashboardData.data.reduce((sum, r) => sum + r.blockedMandatory, 0),
      totalBlockedNonMandatory: dashboardData.data.reduce((sum, r) => sum + r.blockedNonMandatory, 0),
      totalBlockedInspected: dashboardData.data.reduce((sum, r) => sum + r.blockedInspected, 0),
      totalBlockedInspectedMandatory: dashboardData.data.reduce((sum, r) => sum + r.blockedInspectedMandatory, 0),
      totalBlockedInspectedNonMandatory: dashboardData.data.reduce((sum, r) => sum + r.blockedInspectedNonMandatory, 0),
      assignedBlocked: 0, // TODO: 실제 데이터 연동 필요
      fieldInspectedBlocked: 0, // TODO: 실제 데이터 연동 필요
      // 미점검 장비 (last_inspection_date IS NULL)
      totalUninspected: dashboardData.data.reduce((sum, r) => sum + r.uninspected, 0),
      totalUninspectedMandatory: dashboardData.data.reduce((sum, r) => sum + r.uninspectedMandatory, 0),
      totalUninspectedNonMandatory: dashboardData.data.reduce((sum, r) => sum + r.uninspectedNonMandatory, 0),
      assignedUninspected: 0, // TODO: 실제 데이터 연동 필요
      fieldInspectedUninspected: 0, // TODO: 실제 데이터 연동 필요
      // 점검불가 (inspection_assignments에서 unavailable 상태)
      unavailableTotal,
      unavailableMandatory,
      unavailableNonMandatory,
    };
  }, [dashboardData]);

  // 완료율 계산
  const completionRate = useMemo(() => {
    return dashboardData.completionRate;
  }, [dashboardData]);

  // 지역별 데이터 (실제 데이터 사용)
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

  // 상위 5개 지역 (완료율 기준)
  const top5Regions = useMemo(() => {
    return [...regionData]
      .sort((a, b) => b.completionRate - a.completionRate)
      .slice(0, 5);
  }, [regionData]);

  // 하위 5개 지역 (완료율 기준)
  const bottom5Regions = useMemo(() => {
    return [...regionData]
      .sort((a, b) => a.completionRate - b.completionRate)
      .slice(0, 5);
  }, [regionData]);

  // 차트 색상
  const COLORS = {
    mandatory: '#3b82f6',
    nonMandatory: '#10b981',
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-4 md:p-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">{dashboardData.title}</h1>
        <p className="text-xs sm:text-sm text-gray-300 mt-1">실시간 AED 점검 현황을 확인하세요</p>
      </div>

      {/* 상단 통계 카드 - 워크플로우 4단계 */}
      <div className="grid gap-2 sm:gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {/* 1. 전체 AED */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-2 sm:p-3 md:p-4">
          <div className="flex items-center justify-between mb-2 sm:mb-3 md:mb-4">
            <h3 className="text-xs sm:text-sm font-medium text-gray-300">전체 AED</h3>
            {stats.unavailableTotal > 0 && (
              <span className="text-[10px] sm:text-xs text-red-400">
                점검불가 {formatNumber(stats.unavailableTotal)}대 제외
              </span>
            )}
          </div>

          {/* 워크플로우 3단계 */}
          <div className="space-y-1.5 sm:space-y-2 md:space-y-2.5">
            {/* 1. 관리자점검 (관할대상과 병합) - 점검불가 제외 */}
            <div>
              <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <span className="text-[8px] sm:text-[10px] font-bold text-purple-400">1</span>
                  </div>
                  <span className="text-[10px] sm:text-xs text-gray-400">관리자점검</span>
                </div>
                <span className="text-xs sm:text-sm font-semibold text-purple-400">
                  {formatNumber(stats.completedMandatory + stats.completedNonMandatory)}/{formatNumber(stats.totalAED - stats.unavailableTotal)}
                  <span className="text-[10px] sm:text-xs text-gray-500 ml-0.5 sm:ml-1">
                    ({(stats.totalAED - stats.unavailableTotal) > 0 ? Math.round(((stats.completedMandatory + stats.completedNonMandatory) / (stats.totalAED - stats.unavailableTotal)) * 100) : 0}%)
                  </span>
                </span>
              </div>
              <div className="w-full bg-blue-500 rounded-full h-1 sm:h-1.5">
                <div className="bg-purple-500 h-1 sm:h-1.5 rounded-full" style={{width: `${(stats.totalAED - stats.unavailableTotal) > 0 ? Math.round(((stats.completedMandatory + stats.completedNonMandatory) / (stats.totalAED - stats.unavailableTotal)) * 100) : 0}%`}}></div>
              </div>
            </div>

            {/* 2. 일정추가 */}
            <div>
              <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <span className="text-[8px] sm:text-[10px] font-bold text-orange-400">2</span>
                  </div>
                  <span className="text-[10px] sm:text-xs text-gray-400">일정추가</span>
                </div>
                <span className="text-xs sm:text-sm font-semibold text-orange-400">
                  {formatNumber(stats.assignedMandatory + stats.assignedNonMandatory)}대
                  <span className="text-[10px] sm:text-xs text-gray-500 ml-0.5 sm:ml-1">
                    ({(stats.totalAED - stats.unavailableTotal) > 0 ? Math.round(((stats.assignedMandatory + stats.assignedNonMandatory) / (stats.totalAED - stats.unavailableTotal)) * 100) : 0}%)
                  </span>
                </span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1 sm:h-1.5">
                <div className="bg-orange-500 h-1 sm:h-1.5 rounded-full" style={{width: `${(stats.totalAED - stats.unavailableTotal) > 0 ? Math.round(((stats.assignedMandatory + stats.assignedNonMandatory) / (stats.totalAED - stats.unavailableTotal)) * 100) : 0}%`}}></div>
              </div>
            </div>

            {/* 3. 현장점검 */}
            <div>
              <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                    <span className="text-[8px] sm:text-[10px] font-bold text-green-400">3</span>
                  </div>
                  <span className="text-[10px] sm:text-xs text-gray-400">현장점검</span>
                </div>
                <span className="text-xs sm:text-sm font-semibold text-green-400">
                  {formatNumber(stats.fieldInspectedTotal)}대
                  <span className="text-[10px] sm:text-xs text-gray-500 ml-0.5 sm:ml-1">
                    ({(stats.totalAED - stats.unavailableTotal) > 0 ? Math.round((stats.fieldInspectedTotal / (stats.totalAED - stats.unavailableTotal)) * 100) : 0}%)
                  </span>
                </span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1 sm:h-1.5">
                <div className="bg-green-500 h-1 sm:h-1.5 rounded-full" style={{width: `${(stats.totalAED - stats.unavailableTotal) > 0 ? Math.round((stats.fieldInspectedTotal / (stats.totalAED - stats.unavailableTotal)) * 100) : 0}%`}}></div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. 구비의무기관 */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-2 sm:p-3 md:p-4">
          <div className="flex items-center justify-between mb-2 sm:mb-3 md:mb-4">
            <h3 className="text-xs sm:text-sm font-medium text-gray-300">구비의무기관</h3>
            {stats.unavailableMandatory > 0 && (
              <span className="text-[10px] sm:text-xs text-red-400">
                점검불가 {formatNumber(stats.unavailableMandatory)}대 제외
              </span>
            )}
          </div>

          {/* 워크플로우 3단계 */}
          <div className="space-y-1.5 sm:space-y-2 md:space-y-2.5">
            {/* 1. 관리자점검 (관할대상과 병합) - 점검불가 제외 */}
            <div>
              <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <span className="text-[8px] sm:text-[10px] font-bold text-purple-400">1</span>
                  </div>
                  <span className="text-[10px] sm:text-xs text-gray-400">관리자점검</span>
                </div>
                <span className="text-xs sm:text-sm font-semibold text-purple-400">
                  {formatNumber(stats.completedMandatory)}/{formatNumber(stats.totalMandatory - stats.unavailableMandatory)}
                  <span className="text-[10px] sm:text-xs text-gray-500 ml-0.5 sm:ml-1">
                    ({(stats.totalMandatory - stats.unavailableMandatory) > 0 ? Math.round((stats.completedMandatory / (stats.totalMandatory - stats.unavailableMandatory)) * 100) : 0}%)
                  </span>
                </span>
              </div>
              <div className="w-full bg-blue-500 rounded-full h-1 sm:h-1.5">
                <div className="bg-purple-500 rounded-full h-1 sm:h-1.5" style={{width: `${(stats.totalMandatory - stats.unavailableMandatory) > 0 ? Math.round((stats.completedMandatory / (stats.totalMandatory - stats.unavailableMandatory)) * 100) : 0}%`}}></div>
              </div>
            </div>

            {/* 2. 일정추가 */}
            <div>
              <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <span className="text-[8px] sm:text-[10px] font-bold text-orange-400">2</span>
                  </div>
                  <span className="text-[10px] sm:text-xs text-gray-400">일정추가</span>
                </div>
                <span className="text-xs sm:text-sm font-semibold text-orange-400">
                  {formatNumber(stats.assignedMandatory)}대
                  <span className="text-[10px] sm:text-xs text-gray-500 ml-0.5 sm:ml-1">
                    ({(stats.totalMandatory - stats.unavailableMandatory) > 0 ? Math.round((stats.assignedMandatory / (stats.totalMandatory - stats.unavailableMandatory)) * 100) : 0}%)
                  </span>
                </span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1 sm:h-1.5">
                <div className="bg-orange-500 rounded-full h-1 sm:h-1.5" style={{width: `${(stats.totalMandatory - stats.unavailableMandatory) > 0 ? Math.round((stats.assignedMandatory / (stats.totalMandatory - stats.unavailableMandatory)) * 100) : 0}%`}}></div>
              </div>
            </div>

            {/* 3. 현장점검 */}
            <div>
              <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                    <span className="text-[8px] sm:text-[10px] font-bold text-green-400">3</span>
                  </div>
                  <span className="text-[10px] sm:text-xs text-gray-400">현장점검</span>
                </div>
                <span className="text-xs sm:text-sm font-semibold text-green-400">
                  {formatNumber(stats.fieldInspectedMandatory)}대
                  <span className="text-[10px] sm:text-xs text-gray-500 ml-0.5 sm:ml-1">
                    ({(stats.totalMandatory - stats.unavailableMandatory) > 0 ? Math.round((stats.fieldInspectedMandatory / (stats.totalMandatory - stats.unavailableMandatory)) * 100) : 0}%)
                  </span>
                </span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1 sm:h-1.5">
                <div className="bg-green-500 rounded-full h-1 sm:h-1.5" style={{width: `${(stats.totalMandatory - stats.unavailableMandatory) > 0 ? Math.round((stats.fieldInspectedMandatory / (stats.totalMandatory - stats.unavailableMandatory)) * 100) : 0}%`}}></div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. 구비의무기관 외 */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-2 sm:p-3 md:p-4">
          <div className="flex items-center justify-between mb-2 sm:mb-3 md:mb-4">
            <h3 className="text-xs sm:text-sm font-medium text-gray-300">구비의무기관 외</h3>
            {stats.unavailableNonMandatory > 0 && (
              <span className="text-[10px] sm:text-xs text-red-400">
                점검불가 {formatNumber(stats.unavailableNonMandatory)}대 제외
              </span>
            )}
          </div>

          {/* 워크플로우 3단계 */}
          <div className="space-y-1.5 sm:space-y-2 md:space-y-2.5">
            {/* 1. 관리자점검 (관할대상과 병합) - 점검불가 제외 */}
            <div>
              <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <span className="text-[8px] sm:text-[10px] font-bold text-purple-400">1</span>
                  </div>
                  <span className="text-[10px] sm:text-xs text-gray-400">관리자점검</span>
                </div>
                <span className="text-xs sm:text-sm font-semibold text-purple-400">
                  {formatNumber(stats.completedNonMandatory)}/{formatNumber(stats.totalNonMandatory - stats.unavailableNonMandatory)}
                  <span className="text-[10px] sm:text-xs text-gray-500 ml-0.5 sm:ml-1">
                    ({(stats.totalNonMandatory - stats.unavailableNonMandatory) > 0 ? Math.round((stats.completedNonMandatory / (stats.totalNonMandatory - stats.unavailableNonMandatory)) * 100) : 0}%)
                  </span>
                </span>
              </div>
              <div className="w-full bg-blue-500 rounded-full h-1 sm:h-1.5">
                <div className="bg-purple-500 rounded-full h-1 sm:h-1.5" style={{width: `${(stats.totalNonMandatory - stats.unavailableNonMandatory) > 0 ? Math.round((stats.completedNonMandatory / (stats.totalNonMandatory - stats.unavailableNonMandatory)) * 100) : 0}%`}}></div>
              </div>
            </div>

            {/* 2. 일정추가 */}
            <div>
              <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <span className="text-[8px] sm:text-[10px] font-bold text-orange-400">2</span>
                  </div>
                  <span className="text-[10px] sm:text-xs text-gray-400">일정추가</span>
                </div>
                <span className="text-xs sm:text-sm font-semibold text-orange-400">
                  {formatNumber(stats.assignedNonMandatory)}대
                  <span className="text-[10px] sm:text-xs text-gray-500 ml-0.5 sm:ml-1">
                    ({(stats.totalNonMandatory - stats.unavailableNonMandatory) > 0 ? Math.round((stats.assignedNonMandatory / (stats.totalNonMandatory - stats.unavailableNonMandatory)) * 100) : 0}%)
                  </span>
                </span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1 sm:h-1.5">
                <div className="bg-orange-500 rounded-full h-1 sm:h-1.5" style={{width: `${(stats.totalNonMandatory - stats.unavailableNonMandatory) > 0 ? Math.round((stats.assignedNonMandatory / (stats.totalNonMandatory - stats.unavailableNonMandatory)) * 100) : 0}%`}}></div>
              </div>
            </div>

            {/* 3. 현장점검 */}
            <div>
              <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                    <span className="text-[8px] sm:text-[10px] font-bold text-green-400">3</span>
                  </div>
                  <span className="text-[10px] sm:text-xs text-gray-400">현장점검</span>
                </div>
                <span className="text-xs sm:text-sm font-semibold text-green-400">
                  {formatNumber(stats.fieldInspectedNonMandatory)}대
                  <span className="text-[10px] sm:text-xs text-gray-500 ml-0.5 sm:ml-1">
                    ({(stats.totalNonMandatory - stats.unavailableNonMandatory) > 0 ? Math.round((stats.fieldInspectedNonMandatory / (stats.totalNonMandatory - stats.unavailableNonMandatory)) * 100) : 0}%)
                  </span>
                </span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1 sm:h-1.5">
                <div className="bg-green-500 rounded-full h-1 sm:h-1.5" style={{width: `${(stats.totalNonMandatory - stats.unavailableNonMandatory) > 0 ? Math.round((stats.fieldInspectedNonMandatory / (stats.totalNonMandatory - stats.unavailableNonMandatory)) * 100) : 0}%`}}></div>
              </div>
            </div>
          </div>
        </div>

        {/* 4. 외부표출 차단 */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-2 sm:p-3 md:p-4">
          <h3 className="text-xs sm:text-sm font-medium text-gray-300 mb-2 sm:mb-3 md:mb-4">외부표출 차단</h3>

          {/* 워크플로우 3단계 */}
          <div className="space-y-1.5 sm:space-y-2 md:space-y-2.5">
            {/* 1. 관리자점검 (관할대상과 병합) */}
            <div>
              <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <span className="text-[8px] sm:text-[10px] font-bold text-purple-400">1</span>
                  </div>
                  <span className="text-[10px] sm:text-xs text-gray-400">관리자점검</span>
                </div>
                <span className="text-xs sm:text-sm font-semibold text-purple-400">
                  {formatNumber(stats.totalBlockedInspected)}/{formatNumber(stats.totalBlocked)}
                  <span className="text-[10px] sm:text-xs text-gray-500 ml-0.5 sm:ml-1">
                    ({stats.totalBlocked > 0 ? Math.round((stats.totalBlockedInspected / stats.totalBlocked) * 100) : 0}%)
                  </span>
                </span>
              </div>
              <div className="w-full bg-blue-500 rounded-full h-1 sm:h-1.5">
                <div className="bg-purple-500 rounded-full h-1 sm:h-1.5" style={{width: `${stats.totalBlocked > 0 ? Math.round((stats.totalBlockedInspected / stats.totalBlocked) * 100) : 0}%`}}></div>
              </div>
            </div>

            {/* 2. 일정추가 */}
            <div>
              <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <span className="text-[8px] sm:text-[10px] font-bold text-orange-400">2</span>
                  </div>
                  <span className="text-[10px] sm:text-xs text-gray-400">일정추가</span>
                </div>
                <span className="text-xs sm:text-sm font-semibold text-orange-400">
                  {formatNumber(stats.assignedBlocked)}대
                  <span className="text-[10px] sm:text-xs text-gray-500 ml-0.5 sm:ml-1">
                    ({stats.totalBlocked > 0 ? Math.round((stats.assignedBlocked / stats.totalBlocked) * 100) : 0}%)
                  </span>
                </span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1 sm:h-1.5">
                <div className="bg-orange-500 rounded-full h-1 sm:h-1.5" style={{width: `${stats.totalBlocked > 0 ? Math.round((stats.assignedBlocked / stats.totalBlocked) * 100) : 0}%`}}></div>
              </div>
            </div>

            {/* 3. 현장점검 */}
            <div>
              <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                    <span className="text-[8px] sm:text-[10px] font-bold text-green-400">3</span>
                  </div>
                  <span className="text-[10px] sm:text-xs text-gray-400">현장점검</span>
                </div>
                <span className="text-xs sm:text-sm font-semibold text-green-400">
                  {formatNumber(stats.fieldInspectedBlocked)}대
                  <span className="text-[10px] sm:text-xs text-gray-500 ml-0.5 sm:ml-1">
                    ({stats.totalBlocked > 0 ? Math.round((stats.fieldInspectedBlocked / stats.totalBlocked) * 100) : 0}%)
                  </span>
                </span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1 sm:h-1.5">
                <div className="bg-green-500 rounded-full h-1 sm:h-1.5" style={{width: `${stats.totalBlocked > 0 ? Math.round((stats.fieldInspectedBlocked / stats.totalBlocked) * 100) : 0}%`}}></div>
              </div>
            </div>
          </div>
        </div>

        {/* 5. 미점검 장비 */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-2 sm:p-3 md:p-4">
          <h3 className="text-xs sm:text-sm font-medium text-gray-300 mb-2 sm:mb-3 md:mb-4">미점검 장비</h3>

          {/* 워크플로우 3단계 */}
          <div className="space-y-1.5 sm:space-y-2 md:space-y-2.5">
            {/* 1. 관리자점검 (관할대상과 병합) */}
            <div>
              <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <span className="text-[8px] sm:text-[10px] font-bold text-purple-400">1</span>
                  </div>
                  <span className="text-[10px] sm:text-xs text-gray-400">관리자점검</span>
                </div>
                <span className="text-xs sm:text-sm font-semibold text-purple-400">0/{formatNumber(stats.totalUninspected)}
                  <span className="text-[10px] sm:text-xs text-gray-500 ml-0.5 sm:ml-1">(0%)</span>
                </span>
              </div>
              <div className="w-full bg-blue-500 rounded-full h-1 sm:h-1.5">
                <div className="bg-purple-500 rounded-full h-1 sm:h-1.5" style={{width: "0%"}}></div>
              </div>
            </div>

            {/* 2. 일정추가 */}
            <div>
              <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <span className="text-[8px] sm:text-[10px] font-bold text-orange-400">2</span>
                  </div>
                  <span className="text-[10px] sm:text-xs text-gray-400">일정추가</span>
                </div>
                <span className="text-xs sm:text-sm font-semibold text-orange-400">
                  {formatNumber(stats.assignedUninspected)}대
                  <span className="text-[10px] sm:text-xs text-gray-500 ml-0.5 sm:ml-1">
                    ({stats.totalUninspected > 0 ? Math.round((stats.assignedUninspected / stats.totalUninspected) * 100) : 0}%)
                  </span>
                </span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1 sm:h-1.5">
                <div className="bg-orange-500 rounded-full h-1 sm:h-1.5" style={{width: `${stats.totalUninspected > 0 ? Math.round((stats.assignedUninspected / stats.totalUninspected) * 100) : 0}%`}}></div>
              </div>
            </div>

            {/* 3. 현장점검 */}
            <div>
              <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                    <span className="text-[8px] sm:text-[10px] font-bold text-green-400">3</span>
                  </div>
                  <span className="text-[10px] sm:text-xs text-gray-400">현장점검</span>
                </div>
                <span className="text-xs sm:text-sm font-semibold text-green-400">
                  {formatNumber(stats.fieldInspectedUninspected)}대
                  <span className="text-[10px] sm:text-xs text-gray-500 ml-0.5 sm:ml-1">
                    ({stats.totalUninspected > 0 ? Math.round((stats.fieldInspectedUninspected / stats.totalUninspected) * 100) : 0}%)
                  </span>
                </span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1 sm:h-1.5">
                <div className="bg-green-500 rounded-full h-1 sm:h-1.5" style={{width: `${stats.totalUninspected > 0 ? Math.round((stats.fieldInspectedUninspected / stats.totalUninspected) * 100) : 0}%`}}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 차트 영역 */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* 시간대별 점검현황 */}
        <Card>
          <CardHeader>
            <CardTitle>시간대별 점검현황</CardTitle>
            <p className="text-sm text-muted-foreground">최근 24시간</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 12 }}
                  interval={2}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="mandatory" name="의무" fill={COLORS.mandatory} />
                <Bar dataKey="nonMandatory" name="비의무" fill={COLORS.nonMandatory} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 날짜별 점검건수 */}
        <Card>
          <CardHeader>
            <CardTitle>날짜별 점검건수</CardTitle>
            <p className="text-sm text-muted-foreground">최근 7일</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="mandatory" name="의무" fill={COLORS.mandatory} />
                <Bar dataKey="nonMandatory" name="비의무" fill={COLORS.nonMandatory} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 지역별 현황 테이블 */}
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-right">{row.mandatory.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-right">{row.nonMandatory.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-right">
                      {row.completedMandatory.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-right">
                      {row.completedNonMandatory.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-400 text-right">{row.urgent.toLocaleString()}</td>
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

      {/* 상위/하위 5개 지역 */}
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
                      <div className="font-medium">{region.region}</div>
                      <div className="text-sm text-muted-foreground">
                        {region.completed}/{region.total}
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
                      <div className="font-medium">{region.region}</div>
                      <div className="text-sm text-muted-foreground">
                        {region.completed}/{region.total}
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

      {/* 시도별 상세 통계 섹션 */}
      <div className="mt-8">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-white">시도별 상세 통계</h2>
          <p className="text-sm text-gray-400 mt-1">17개 시도별 AED 점검 현황을 확인하세요</p>
        </div>

        <RegionStatsTable
          data={dashboardData.data}
        />
      </div>
    </div>
  );
}
