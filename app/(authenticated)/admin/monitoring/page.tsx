'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  Clock,
  CheckCircle2,
  AlertCircle,
  PlayCircle,
  TrendingUp,
  Users,
  Timer
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';


export default function RealtimeMonitoringPage() {
  // 실시간 점검 현황 (10초마다 갱신)
  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['realtime-inspections'],
    queryFn: async () => {
      const res = await fetch('/api/inspections/realtime?includeCompleted=true&completedLimit=20');
      if (!res.ok) throw new Error('Failed to fetch realtime data');
      return res.json();
    },
    refetchInterval: 10000, // 10초마다 자동 갱신
    refetchIntervalInBackground: true // 백그라운드에서도 갱신
  });

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ko-KR').format(num);
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}분`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}시간 ${mins}분`;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      'good': { label: '정상', className: 'bg-green-500' },
      'warning': { label: '주의', className: 'bg-yellow-500' },
      'danger': { label: '위험', className: 'bg-red-500' },
      'unknown': { label: '알 수 없음', className: 'bg-gray-500' }
    };
    const config = statusConfig[status] || statusConfig['unknown'];
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const getRoleBadge = (role: string) => {
    const roleConfig: Record<string, { label: string; className: string }> = {
      'field_inspector': { label: '현장점검자', className: 'bg-blue-500' },
      'health_center_inspector': { label: '보건소점검자', className: 'bg-indigo-500' },
      'regional_admin': { label: '지역관리자', className: 'bg-purple-500' },
      'emergency_center_admin': { label: '응급센터관리자', className: 'bg-pink-500' }
    };
    const config = roleConfig[role] || { label: role, className: 'bg-gray-500' };
    return <Badge variant="outline" className={`${config.className} text-white border-0`}>{config.label}</Badge>;
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Activity className="h-8 w-8 text-blue-600 animate-pulse" />
            실시간 점검 모니터링
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            마지막 업데이트: {dataUpdatedAt ? formatDistanceToNow(dataUpdatedAt, { addSuffix: true, locale: ko }) : '-'}
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-sm font-medium text-green-700">10초마다 자동 갱신</span>
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <div className="mt-4 text-gray-600">로딩 중...</div>
        </div>
      )}

      {!isLoading && data && (
        <div className="space-y-6">
          {/* 오늘의 통계 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">오늘 총 점검</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(data.todayStats?.total || 0)}건</div>
                <p className="text-xs text-gray-500 mt-1">
                  완료: {formatNumber(data.todayStats?.completed || 0)}건
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">진행 중</CardTitle>
                <PlayCircle className="h-4 w-4 text-blue-500 animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{formatNumber(data.todayStats?.inProgress || 0)}건</div>
                <p className="text-xs text-gray-500 mt-1">현재 진행 중인 점검</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">완료된 점검</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatNumber(data.todayStats?.completed || 0)}건</div>
                <p className="text-xs text-gray-500 mt-1">오늘 완료</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">평균 소요시간</CardTitle>
                <Timer className="h-4 w-4 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.todayStats?.avgDuration || 0}분</div>
                <p className="text-xs text-gray-500 mt-1">완료된 점검 기준</p>
              </CardContent>
            </Card>
          </div>

          {/* 진행 중인 점검 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlayCircle className="h-5 w-5 text-blue-600 animate-pulse" />
                진행 중인 점검 ({data.inProgress?.length || 0}건)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.inProgress && data.inProgress.length > 0 ? (
                <div className="space-y-4">
                  {data.inProgress.map((session: any) => (
                    <div key={session.sessionId} className="flex items-start gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex-shrink-0">
                        <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                          <Clock className="h-6 w-6 text-blue-600" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div>
                            <h3 className="font-semibold text-lg">{session.aed?.facilityName || '시설명 없음'}</h3>
                            <p className="text-sm text-gray-600">
                              {session.aed?.sido} {session.aed?.gugun} | {session.aed?.serial}
                            </p>
                          </div>
                          <Badge className="bg-blue-600 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            진행 중
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                          <div>
                            <span className="text-gray-500">점검자:</span>{' '}
                            <span className="font-medium">{session.inspector?.name || '알 수 없음'}</span>
                            {' '}
                            {session.inspector?.role && getRoleBadge(session.inspector.role)}
                          </div>
                          <div>
                            <span className="text-gray-500">소요시간:</span>{' '}
                            <span className="font-medium text-blue-600">{session.duration}분</span>
                          </div>
                          <div>
                            <span className="text-gray-500">현재 단계:</span>{' '}
                            <span className="font-medium">{session.currentStep || '-'}단계</span>
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          시작: {new Date(session.startedAt).toLocaleString('ko-KR')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  현재 진행 중인 점검이 없습니다
                </div>
              )}
            </CardContent>
          </Card>

          {/* 최근 완료된 점검 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                최근 완료된 점검 (30분 이내)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.recentlyCompleted && data.recentlyCompleted.length > 0 ? (
                <div className="space-y-3">
                  {data.recentlyCompleted.map((inspection: any) => (
                    <div key={inspection.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex-shrink-0">
                        <CheckCircle2 className="h-8 w-8 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h4 className="font-medium">{inspection.aed?.facilityName || '시설명 없음'}</h4>
                            <p className="text-sm text-gray-600">
                              {inspection.aed?.sido} {inspection.aed?.gugun} | {inspection.aed?.serial}
                            </p>
                          </div>
                          <div className="text-right">
                            {getStatusBadge(inspection.overallStatus)}
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDistanceToNow(new Date(inspection.completedAt), { addSuffix: true, locale: ko })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                          <span>{inspection.inspector?.name || '알 수 없음'}</span>
                          <span className="text-gray-400">|</span>
                          <span>{inspection.inspectionType || '-'}</span>
                          {inspection.issuesFound > 0 && (
                            <>
                              <span className="text-gray-400">|</span>
                              <span className="text-red-600 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                문제 {inspection.issuesFound}건
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  최근 30분 이내 완료된 점검이 없습니다
                </div>
              )}
            </CardContent>
          </Card>

          {/* 시간대별 점검 추이 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                오늘의 시간대별 점검 현황
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.hourlyTrend && data.hourlyTrend.length > 0 ? (
                <div className="space-y-2">
                  {data.hourlyTrend.map((item: any) => (
                    <div key={item.hour} className="flex items-center gap-4">
                      <div className="w-16 text-sm text-gray-600 font-medium">
                        {item.hour}:00
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-6">
                            <div
                              className="bg-blue-600 h-6 rounded-full flex items-center justify-end pr-2"
                              style={{
                                width: `${Math.max((item.count / Math.max(...data.hourlyTrend.map((t: any) => t.count))) * 100, 5)}%`
                              }}
                            >
                              <span className="text-xs text-white font-medium">{item.count}건</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  시간대별 데이터가 없습니다
                </div>
              )}
            </CardContent>
          </Card>

          {/* 점검자별 오늘의 실적 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                점검자별 오늘의 실적
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.inspectorPerformance && data.inspectorPerformance.length > 0 ? (
                <div className="space-y-3">
                  {data.inspectorPerformance.map((inspector: any, index: number) => (
                    <div key={inspector.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{inspector.name}</div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="text-center">
                          <div className="font-semibold text-green-600">{formatNumber(inspector.completed)}</div>
                          <div className="text-xs text-gray-500">완료</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-blue-600">{formatNumber(inspector.inProgress)}</div>
                          <div className="text-xs text-gray-500">진행 중</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  오늘 점검 실적이 없습니다
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
