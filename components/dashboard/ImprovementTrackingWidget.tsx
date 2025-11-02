'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { logger } from '@/lib/logger';

type ImprovementStats = {
  totalProblems: number;
  improved: number;
  neglected: number;
  improvementRate: number;
  criticalNeglected: number;
};

export default function ImprovementTrackingWidget() {
  const [stats, setStats] = useState<ImprovementStats>({
    totalProblems: 0,
    improved: 0,
    neglected: 0,
    improvementRate: 0,
    criticalNeglected: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);

      // 최근 30일 데이터
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const params = new URLSearchParams({
        view: 'improvement',
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      });

      const response = await fetch(`/api/inspections/improvement-reports?${params}`);
      const result = await response.json();

      if (result.success) {
        const { stats } = result;

        // Critical 방치 건수 계산 (별도 조회 필요)
        const criticalParams = new URLSearchParams({
          view: 'improvement',
          improvementStatus: 'neglected',
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        });

        const criticalResponse = await fetch(`/api/inspections/improvement-reports?${criticalParams}`);
        const criticalResult = await criticalResponse.json();

        const criticalNeglected = criticalResult.success
          ? criticalResult.data.filter((r: any) => r.issue_severity === 'critical').length
          : 0;

        setStats({
          totalProblems: stats.problematicCount,
          improved: stats.improvedCount,
          neglected: stats.neglectedCount,
          improvementRate: parseFloat(stats.improvementRate),
          criticalNeglected,
        });
      }
    } catch (error) {
      logger.error('ImprovementTrackingWidget', '통계 로드 실패', error instanceof Error ? error : { error });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          데이터 개선 추적
        </h3>
        <div className="flex items-center justify-center h-40">
          <p className="text-gray-500 dark:text-gray-400">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          데이터 개선 추적 (최근 30일)
        </h3>
        <Link
          href="/inspections/improvement-reports"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          상세보기 →
        </Link>
      </div>

      {/* 주요 지표 */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-4">
          <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">개선율</p>
          <p className="text-3xl font-bold text-blue-900 dark:text-blue-200">
            {stats.improvementRate.toFixed(1)}%
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            {stats.improved}/{stats.totalProblems}건 개선
          </p>
        </div>

        <div className={`rounded-lg p-4 ${
          stats.criticalNeglected > 0
            ? 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20'
            : 'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20'
        }`}>
          <p className={`text-xs font-medium mb-1 ${
            stats.criticalNeglected > 0
              ? 'text-red-700 dark:text-red-400'
              : 'text-green-700 dark:text-green-400'
          }`}>
            중요 방치 건수
          </p>
          <p className={`text-3xl font-bold ${
            stats.criticalNeglected > 0
              ? 'text-red-900 dark:text-red-200'
              : 'text-green-900 dark:text-green-200'
          }`}>
            {stats.criticalNeglected}
          </p>
          <p className={`text-xs mt-1 ${
            stats.criticalNeglected > 0
              ? 'text-red-600 dark:text-red-400'
              : 'text-green-600 dark:text-green-400'
          }`}>
            {stats.criticalNeglected > 0 ? '즉시 조치 필요' : '조치 필요 없음'}
          </p>
        </div>
      </div>

      {/* 진행률 바 */}
      <div className="space-y-3">
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">개선됨</span>
            <span className="text-xs text-gray-600 dark:text-gray-400">{stats.improved}건</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${stats.totalProblems > 0 ? (stats.improved / stats.totalProblems) * 100 : 0}%` }}
            ></div>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">방치됨</span>
            <span className="text-xs text-gray-600 dark:text-gray-400">{stats.neglected}건</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-yellow-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${stats.totalProblems > 0 ? (stats.neglected / stats.totalProblems) * 100 : 0}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* 경고 메시지 */}
      {stats.criticalNeglected > 0 && (
        <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                중요 문제 {stats.criticalNeglected}건 방치 중
              </p>
              <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                배터리/패드 만료일 등 중요 정보가 개선되지 않았습니다.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
