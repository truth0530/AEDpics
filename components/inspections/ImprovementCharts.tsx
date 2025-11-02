'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { logger } from '@/lib/logger';

type TrendData = {
  period: string;
  totalInspections: number;
  goodCount: number;
  problematicCount: number;
  improvedCount: number;
  neglectedCount: number;
  improvementRate: number;
};

type DistributionData = {
  category: string;
  total: number;
  improved: number;
  neglected: number;
  pending: number;
  improvementRate: number;
};

interface ImprovementChartsProps {
  startDate?: string;
  endDate?: string;
}

export default function ImprovementCharts({ startDate, endDate }: ImprovementChartsProps) {
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [distributionData, setDistributionData] = useState<DistributionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<'week' | 'month'>('week');

  const loadChartData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        groupBy,
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
      });

      // 개선율 추이 데이터
      const trendResponse = await fetch(`/api/inspections/improvement-reports/charts?type=trend&${params}`);
      const trendResult = await trendResponse.json();

      if (trendResult.success) {
        setTrendData(trendResult.data);
      } else {
        setError(trendResult.error || '차트 데이터를 불러오는데 실패했습니다');
        return;
      }

      // 필드별 분포도 데이터
      const distResponse = await fetch(`/api/inspections/improvement-reports/charts?type=distribution&${params}`);
      const distResult = await distResponse.json();

      if (distResult.success) {
        setDistributionData(distResult.data);
      } else {
        setError(distResult.error || '차트 데이터를 불러오는데 실패했습니다');
      }

    } catch (error) {
      logger.error('ImprovementCharts', '차트 데이터 로드 실패', error instanceof Error ? error : { error });
      setError('차트 데이터를 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, groupBy]);

  useEffect(() => {
    loadChartData();
  }, [loadChartData]);

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="bg-white dark:bg-gray-800 rounded shadow p-3 h-64 flex items-center justify-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">차트 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <div className="bg-red-50 dark:bg-red-900 rounded shadow p-3 flex items-center justify-center">
          <p className="text-sm text-red-600 dark:text-red-200">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 개선율 추이 차트 */}
      <div className="bg-white dark:bg-gray-800 rounded shadow p-3">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            개선율 추이
          </h3>
          <div className="flex gap-1">
            <button
              onClick={() => setGroupBy('week')}
              className={`px-2 py-0.5 text-xs rounded ${
                groupBy === 'week'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              주별
            </button>
            <button
              onClick={() => setGroupBy('month')}
              className={`px-2 py-0.5 text-xs rounded ${
                groupBy === 'month'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              월별
            </button>
          </div>
        </div>

        {trendData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
            데이터가 없습니다
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
              <XAxis
                dataKey="period"
                stroke="#9CA3AF"
                style={{ fontSize: '10px' }}
                tick={{ fontSize: 10 }}
              />
              <YAxis
                yAxisId="left"
                stroke="#9CA3AF"
                style={{ fontSize: '10px' }}
                tick={{ fontSize: 10 }}
                width={30}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#9CA3AF"
                style={{ fontSize: '10px' }}
                tick={{ fontSize: 10 }}
                width={30}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '4px',
                  color: '#F3F4F6',
                  fontSize: '11px',
                  padding: '6px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="problematicCount"
                stroke="#EF4444"
                name="문제"
                strokeWidth={1.5}
                dot={{ fill: '#EF4444', r: 2 }}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="improvedCount"
                stroke="#3B82F6"
                name="개선"
                strokeWidth={1.5}
                dot={{ fill: '#3B82F6', r: 2 }}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="neglectedCount"
                stroke="#F59E0B"
                name="방치"
                strokeWidth={1.5}
                dot={{ fill: '#F59E0B', r: 2 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="improvementRate"
                stroke="#10B981"
                name="개선율"
                strokeWidth={2}
                dot={{ fill: '#10B981', r: 3 }}
                strokeDasharray="5 5"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 필드별 문제 분포도 */}
      <div className="bg-white dark:bg-gray-800 rounded shadow p-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          필드별 분포 및 개선 현황
        </h3>

        {distributionData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
            데이터가 없습니다
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={distributionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
              <XAxis
                dataKey="category"
                stroke="#9CA3AF"
                style={{ fontSize: '10px' }}
                tick={{ fontSize: 10 }}
              />
              <YAxis
                stroke="#9CA3AF"
                style={{ fontSize: '10px' }}
                tick={{ fontSize: 10 }}
                width={30}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '4px',
                  color: '#F3F4F6',
                  fontSize: '11px',
                  padding: '6px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              <Bar dataKey="improved" stackId="a" fill="#3B82F6" name="개선" />
              <Bar dataKey="neglected" stackId="a" fill="#F59E0B" name="방치" />
              <Bar dataKey="pending" stackId="a" fill="#6B7280" name="확인중" />
            </BarChart>
          </ResponsiveContainer>
        )}

        {/* 카테고리별 개선율 요약 */}
        <div className="mt-3 grid grid-cols-3 md:grid-cols-5 gap-2">
          {distributionData.map((item) => (
            <div key={item.category} className="text-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
              <p className="text-xs text-gray-500 dark:text-gray-400">{item.category}</p>
              <p className="text-base font-bold text-gray-900 dark:text-gray-100">
                {item.improvementRate}%
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {item.improved}/{item.total}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
