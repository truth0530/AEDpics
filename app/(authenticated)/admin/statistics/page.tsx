'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart3,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Users,
  Building2,
  MapPin
} from 'lucide-react';

export const dynamic = 'force-dynamic';

type Period = '7d' | '30d' | '90d' | '1y';

export default function StatisticsPage() {
  const [period, setPeriod] = useState<Period>('30d');

  // 시스템 전체 통계
  const { data: systemData, isLoading: systemLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const res = await fetch('/api/admin/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
    refetchInterval: 60000 // 1분마다 갱신
  });

  // 점검 통계
  const { data: inspectionData, isLoading: inspectionLoading } = useQuery({
    queryKey: ['inspection-stats', period],
    queryFn: async () => {
      const res = await fetch(`/api/inspections/stats?period=${period}`);
      if (!res.ok) throw new Error('Failed to fetch inspection stats');
      return res.json();
    },
    refetchInterval: 60000
  });

  const isLoading = systemLoading || inspectionLoading;

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ko-KR').format(num);
  };

  const periodLabels: Record<Period, string> = {
    '7d': '최근 7일',
    '30d': '최근 30일',
    '90d': '최근 90일',
    '1y': '최근 1년'
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">통계 대시보드</h1>
        <div className="flex gap-2">
          {(['7d', '30d', '90d', '1y'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <div className="mt-4 text-gray-600">로딩 중...</div>
        </div>
      )}

      {!isLoading && systemData && inspectionData && (
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto">
            <TabsTrigger value="overview">전체 개요</TabsTrigger>
            <TabsTrigger value="inspections">점검 통계</TabsTrigger>
            <TabsTrigger value="performance">실적 분석</TabsTrigger>
            <TabsTrigger value="regions">지역별 현황</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">전체 사용자</CardTitle>
                  <Users className="h-4 w-4 text-gray-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatNumber(systemData.users?.total || 0)}</div>
                  <p className="text-xs text-gray-500 mt-1">
                    승인 대기: {systemData.users?.pending || 0}명
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">전체 조직</CardTitle>
                  <Building2 className="h-4 w-4 text-gray-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatNumber(systemData.organizations?.total || 0)}</div>
                  <p className="text-xs text-gray-500 mt-1">조직 수</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">전체 AED</CardTitle>
                  <BarChart3 className="h-4 w-4 text-gray-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatNumber(systemData.aedDevices?.total || 0)}</div>
                  <p className="text-xs text-gray-500 mt-1">등록된 AED 대수</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">총 점검</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-gray-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatNumber(inspectionData.overview?.total || 0)}</div>
                  <p className="text-xs text-gray-500 mt-1">{periodLabels[period]}</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">점검 현황</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">완료된 점검</span>
                    <span className="font-semibold">{formatNumber(inspectionData.overview?.completed || 0)}건</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">진행 중</span>
                    <span className="font-semibold text-blue-600">{formatNumber(inspectionData.overview?.inProgress || 0)}건</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">오늘 점검</span>
                    <span className="font-semibold text-green-600">{formatNumber(inspectionData.overview?.today || 0)}건</span>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t">
                    <span className="text-sm text-gray-600">평균 소요 시간</span>
                    <span className="font-semibold">{inspectionData.overview?.avgDuration || 0}분</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">점검 상태 분포</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(inspectionData.byStatus || {}).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 capitalize">{status}</span>
                      <span className="font-semibold">{formatNumber(count as number)}건</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">점검 유형 분포</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(inspectionData.byType || {}).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{type}</span>
                      <span className="font-semibold">{formatNumber(count as number)}건</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="inspections" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  점검 추이
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {inspectionData.trend?.slice(0, 10).map((item: any) => (
                    <div key={item.date} className="flex items-center justify-between py-2 border-b last:border-0">
                      <span className="text-sm text-gray-600">
                        {new Date(item.date).toLocaleDateString('ko-KR')}
                      </span>
                      <div className="flex items-center gap-4">
                        <div className="w-48 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${Math.min((item.count / Math.max(...inspectionData.trend.map((t: any) => t.count))) * 100, 100)}%` }}
                          ></div>
                        </div>
                        <span className="font-semibold w-12 text-right">{item.count}건</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  점검자별 실적 (상위 10명)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {inspectionData.topInspectors?.map((inspector: any, index: number) => (
                    <div key={inspector.id} className="flex items-center gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{inspector.name}</div>
                        <div className="text-xs text-gray-500">{inspector.email}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{formatNumber(inspector.count)}건</div>
                        <div className="text-xs text-gray-500">평균 {inspector.avgDuration}분</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="regions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  지역별 점검 현황 (상위 20개)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {inspectionData.byRegion?.map((region: any) => (
                    <div key={region.sido} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium">{region.sido}</span>
                      <span className="text-lg font-bold text-blue-600">{formatNumber(region.count)}건</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
