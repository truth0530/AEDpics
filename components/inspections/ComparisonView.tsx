'use client';

import { useState, useEffect } from 'react';
import {
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
import { abbreviateRegion, REGIONS } from '@/lib/utils/region-utils';

type CompareType = 'region' | 'period';

interface ComparisonData {
  label: string;
  totalCount: number;
  problematicCount: number;
  improvedCount: number;
  neglectedCount: number;
  improvementRate: number;
}

export default function ComparisonView() {
  const [compareType, setCompareType] = useState<CompareType>('region');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparisonData, setComparisonData] = useState<ComparisonData[]>([]);

  // 지역 비교 필터
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  // 기간 비교 필터
  const [period1Start, setPeriod1Start] = useState('');
  const [period1End, setPeriod1End] = useState('');
  const [period2Start, setPeriod2Start] = useState('');
  const [period2End, setPeriod2End] = useState('');
  const [periodRegion, setPeriodRegion] = useState<string>('all');

  const toggleRegion = (region: string) => {
    if (selectedRegions.includes(region)) {
      setSelectedRegions(selectedRegions.filter(r => r !== region));
    } else if (selectedRegions.length < 5) {
      setSelectedRegions([...selectedRegions, region]);
    }
  };

  const loadComparison = async () => {
    try {
      setLoading(true);
      setError(null);

      let url = '/api/inspections/improvement-reports/compare?';

      if (compareType === 'region') {
        if (selectedRegions.length === 0) {
          setError('최소 1개 지역을 선택하세요');
          return;
        }
        url += `compareType=region&regions=${selectedRegions.join(',')}`;
        if (periodStart && periodEnd) {
          url += `&period1Start=${periodStart}&period1End=${periodEnd}`;
        }
      } else {
        if (!period1Start || !period1End || !period2Start || !period2End) {
          setError('모든 기간을 선택하세요');
          return;
        }
        url += `compareType=period&period1Start=${period1Start}&period1End=${period1End}&period2Start=${period2Start}&period2End=${period2End}`;
        if (periodRegion && periodRegion !== 'all') {
          url += `&region=${periodRegion}`;
        }
      }

      const response = await fetch(url);
      const result = await response.json();

      if (result.success) {
        setComparisonData(result.data);
      } else {
        setError(result.error || '비교 통계를 불러오는데 실패했습니다');
      }
    } catch (error) {
      logger.error('ComparisonView', '비교 통계 로드 실패', error instanceof Error ? error : { error });
      setError('비교 통계를 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* 비교 유형 선택 */}
      <div className="flex gap-2">
        <button
          onClick={() => setCompareType('region')}
          className={`px-3 py-1 text-xs rounded ${
            compareType === 'region'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          지역 비교
        </button>
        <button
          onClick={() => setCompareType('period')}
          className={`px-3 py-1 text-xs rounded ${
            compareType === 'period'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          기간 비교
        </button>
      </div>

      {/* 지역 비교 필터 */}
      {compareType === 'region' && (
        <div className="bg-white dark:bg-gray-800 rounded shadow p-2">
          <h3 className="text-xs font-semibold mb-2 text-gray-900 dark:text-gray-100">
            지역 선택 (최대 5개)
          </h3>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-1">
            {REGIONS.map(region => (
              <button
                key={region}
                onClick={() => toggleRegion(region)}
                className={`text-xs px-2 py-1 rounded ${
                  selectedRegions.includes(region)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                {abbreviateRegion(region)}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <label className="block text-xs text-gray-700 dark:text-gray-300 mb-0.5">시작일</label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full text-xs rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 py-1 px-2"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-700 dark:text-gray-300 mb-0.5">종료일</label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full text-xs rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 py-1 px-2"
              />
            </div>
          </div>
        </div>
      )}

      {/* 기간 비교 필터 */}
      {compareType === 'period' && (
        <div className="bg-white dark:bg-gray-800 rounded shadow p-2">
          <div className="mb-2">
            <label className="block text-xs font-semibold mb-1 text-gray-900 dark:text-gray-100">
              지역 필터 (선택)
            </label>
            <select
              value={periodRegion}
              onChange={(e) => setPeriodRegion(e.target.value)}
              className="w-full text-xs rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 py-1 px-2"
            >
              <option value="all">전체</option>
              {REGIONS.map(region => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <h3 className="text-xs font-semibold mb-1 text-gray-900 dark:text-gray-100">기간 1</h3>
              <div className="space-y-1">
                <input
                  type="date"
                  value={period1Start}
                  onChange={(e) => setPeriod1Start(e.target.value)}
                  className="w-full text-xs rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 py-1 px-2"
                />
                <input
                  type="date"
                  value={period1End}
                  onChange={(e) => setPeriod1End(e.target.value)}
                  className="w-full text-xs rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 py-1 px-2"
                />
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold mb-1 text-gray-900 dark:text-gray-100">기간 2</h3>
              <div className="space-y-1">
                <input
                  type="date"
                  value={period2Start}
                  onChange={(e) => setPeriod2Start(e.target.value)}
                  className="w-full text-xs rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 py-1 px-2"
                />
                <input
                  type="date"
                  value={period2End}
                  onChange={(e) => setPeriod2End(e.target.value)}
                  className="w-full text-xs rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 py-1 px-2"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 조회 버튼 */}
      <button
        onClick={loadComparison}
        disabled={loading}
        className="w-full text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? '조회 중...' : '비교 조회'}
      </button>

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900 p-2 rounded text-xs text-red-600 dark:text-red-200">
          {error}
        </div>
      )}

      {/* 빈 상태 안내 */}
      {!loading && !error && comparisonData.length === 0 && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded shadow p-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            비교할 지역 또는 기간을 선택하고 조회 버튼을 클릭하세요
          </p>
        </div>
      )}

      {/* 비교 결과 차트 */}
      {comparisonData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded shadow p-2">
          <h3 className="text-sm font-semibold mb-2 text-gray-900 dark:text-gray-100">비교 결과</h3>

          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={comparisonData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
              <XAxis
                dataKey="label"
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
              <Bar dataKey="problematicCount" fill="#EF4444" name="문제" />
              <Bar dataKey="improvedCount" fill="#3B82F6" name="개선" />
              <Bar dataKey="neglectedCount" fill="#F59E0B" name="방치" />
            </BarChart>
          </ResponsiveContainer>

          {/* 통계 테이블 */}
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-2 py-1 text-left font-medium text-gray-500 dark:text-gray-300">구분</th>
                  <th className="px-2 py-1 text-right font-medium text-gray-500 dark:text-gray-300">총점검</th>
                  <th className="px-2 py-1 text-right font-medium text-gray-500 dark:text-gray-300">문제</th>
                  <th className="px-2 py-1 text-right font-medium text-gray-500 dark:text-gray-300">개선</th>
                  <th className="px-2 py-1 text-right font-medium text-gray-500 dark:text-gray-300">방치</th>
                  <th className="px-2 py-1 text-right font-medium text-gray-500 dark:text-gray-300">개선율</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {comparisonData.map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-2 py-1 text-gray-900 dark:text-gray-100">{item.label}</td>
                    <td className="px-2 py-1 text-right text-gray-700 dark:text-gray-300">{item.totalCount}</td>
                    <td className="px-2 py-1 text-right text-red-600 dark:text-red-400">{item.problematicCount}</td>
                    <td className="px-2 py-1 text-right text-blue-600 dark:text-blue-400">{item.improvedCount}</td>
                    <td className="px-2 py-1 text-right text-yellow-600 dark:text-yellow-400">{item.neglectedCount}</td>
                    <td className="px-2 py-1 text-right font-bold text-green-600 dark:text-green-400">{item.improvementRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
