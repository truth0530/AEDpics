'use client';

import { useState, useEffect } from 'react';
import { Activity, Zap, Database, Clock, TrendingUp, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  status: 'good' | 'needs-improvement' | 'poor';
  icon: typeof Activity;
}

interface PerformanceDashboardProps {
  userRole: string;
}

export function PerformanceDashboard({ userRole }: PerformanceDashboardProps) {
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 브라우저 Performance API에서 메트릭 수집
    if (typeof window !== 'undefined' && 'performance' in window) {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

      const collectedMetrics: PerformanceMetric[] = [
        {
          name: 'Page Load Time',
          value: Math.round(navigation.loadEventEnd - navigation.fetchStart),
          unit: 'ms',
          status: navigation.loadEventEnd - navigation.fetchStart < 2000 ? 'good' : 'needs-improvement',
          icon: Clock,
        },
        {
          name: 'DOM Content Loaded',
          value: Math.round(navigation.domContentLoadedEventEnd - navigation.fetchStart),
          unit: 'ms',
          status: navigation.domContentLoadedEventEnd - navigation.fetchStart < 1500 ? 'good' : 'needs-improvement',
          icon: Activity,
        },
        {
          name: 'Time to Interactive',
          value: Math.round(navigation.domInteractive - navigation.fetchStart),
          unit: 'ms',
          status: navigation.domInteractive - navigation.fetchStart < 1000 ? 'good' : 'needs-improvement',
          icon: Zap,
        },
      ];

      setMetrics(collectedMetrics);
      setLoading(false);
    }
  }, []);

  const getStatusColor = (status: PerformanceMetric['status']) => {
    switch (status) {
      case 'good':
        return 'text-green-400';
      case 'needs-improvement':
        return 'text-yellow-400';
      case 'poor':
        return 'text-red-400';
    }
  };

  const getStatusBg = (status: PerformanceMetric['status']) => {
    switch (status) {
      case 'good':
        return 'bg-green-500/10';
      case 'needs-improvement':
        return 'bg-yellow-500/10';
      case 'poor':
        return 'bg-red-500/10';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Performance Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400">시스템 성능 및 Core Web Vitals 모니터링</p>
      </div>

      {/* Core Web Vitals */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Core Web Vitals
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {loading ? (
            <>
              {[1, 2, 3].map((i) => (
                <Card key={i} className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 p-6 animate-pulse">
                  <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </Card>
              ))}
            </>
          ) : (
            metrics.map((metric, index) => {
              const Icon = metric.icon;
              return (
                <Card key={index} className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-lg ${getStatusBg(metric.status)}`}>
                      <Icon className={`w-6 h-6 ${getStatusColor(metric.status)}`} />
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-medium ${getStatusBg(metric.status)} ${getStatusColor(metric.status)}`}>
                      {metric.status === 'good' ? '우수' : metric.status === 'needs-improvement' ? '개선필요' : '불량'}
                    </div>
                  </div>

                  <h3 className="text-sm text-gray-600 dark:text-gray-400 mb-1">{metric.name}</h3>
                  <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {metric.value}
                    <span className="text-lg text-gray-500 dark:text-gray-400 ml-1">{metric.unit}</span>
                  </p>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* API 성능 */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Database className="w-5 h-5" />
          API Performance
        </h2>

        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Timestamp API</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">~10ms</p>
              </div>
              <div className="px-3 py-1 rounded bg-green-500/10 text-green-600 dark:text-green-400 text-sm font-medium">
                Edge Cached
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">AED Data API</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">~200ms</p>
                </div>
                <div className="px-3 py-1 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-sm font-medium">
                  Optimized
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* 최적화 정보 */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Active Optimizations
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">✅ Vercel Analytics</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">실시간 Core Web Vitals 모니터링</p>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">✅ Edge Caching</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">Timestamp API 98% 성능 개선</p>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">✅ Rate Limiting</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">API 남용 방지 및 서버 보호</p>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">✅ Error Boundaries</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">앱 충돌 방지 및 오류 격리</p>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">✅ Skeleton UI</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">로딩 상태 시각화</p>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">✅ React Query Caching</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">클라이언트 사이드 캐싱 (30분 staleTime)</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
