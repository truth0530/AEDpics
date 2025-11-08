'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, TrendingDown, MapPin, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CoverageData {
  totalOrganizations: number;
  organizationsWithAdmin: number;
  organizationsWithoutAdmin: number;
  coverage: number;
  orphanInspectors: Array<{
    name: string;
    email: string;
    region: string;
    organization: string;
  }>;
  regionalBreakdown: Array<{
    region: string;
    total: number;
    withAdmin: number;
  }>;
}

export function OrganizationCoveragePanel() {
  const [data, setData] = useState<CoverageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCoverageData = async () => {
      try {
        const response = await fetch('/api/admin/organization-coverage');
        if (response.ok) {
          const coverageData = await response.json();
          setData(coverageData);
        }
      } catch (error) {
        console.error('Failed to fetch coverage data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCoverageData();
    // 5분마다 새로고침
    const interval = setInterval(fetchCoverageData, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  if (loading || !data) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* 주요 지표 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 담당자 커버리지 */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Users className="w-4 h-4" />
              담당자 커버리지
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-white">
                {data.coverage.toFixed(1)}%
              </div>
              <p className="text-xs text-gray-400">
                {data.organizationsWithAdmin} / {data.totalOrganizations}개 조직
              </p>
              {data.coverage < 10 && (
                <div className="flex items-start gap-2 p-2 bg-red-500/10 rounded border border-red-500/30 mt-2">
                  <AlertCircle className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-300">
                    담당자 비율이 매우 낮습니다. 긴급 확보 필요
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 미커버 조직 */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <TrendingDown className="w-4 h-4" />
              미커버 조직
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-red-400">
                {data.organizationsWithoutAdmin}
              </div>
              <p className="text-xs text-gray-400">
                담당자 필요 조직
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 고아 임시점검원 */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              고아 임시점검원
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-yellow-400">
                {data.orphanInspectors.length}
              </div>
              <p className="text-xs text-gray-400">
                담당자 없는 조직 소속
              </p>
              {data.orphanInspectors.length > 0 && (
                <div className="flex items-start gap-2 p-2 bg-yellow-500/10 rounded border border-yellow-500/30 mt-2">
                  <AlertCircle className="w-3 h-3 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-yellow-300">
                    {data.orphanInspectors.map(i => i.name).join(', ')}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 고아 임시점검원 상세 */}
      {data.orphanInspectors.length > 0 && (
        <Card className="bg-gray-900 border-yellow-500/20">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-300">고아 임시점검원 - 즉시 조치 필요</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.orphanInspectors.map((inspector, idx) => (
                <div key={idx} className="p-3 bg-gray-800/50 rounded-lg border border-yellow-500/20">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{inspector.name}</p>
                      <p className="text-xs text-gray-400">{inspector.email}</p>
                      <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                        <MapPin className="w-3 h-3" />
                        {inspector.region} - {inspector.organization}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-yellow-400 font-medium">⚠️ 담당자 없음</p>
                      <p className="text-xs text-gray-500">장비 할당됨</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 지역별 현황 */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-sm">지역별 담당자 현황</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.regionalBreakdown.map((region, idx) => {
              const regionCoverage = (region.withAdmin / region.total) * 100;
              const status = region.withAdmin > 0 ? '✅' : '🔴';

              return (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-gray-400 min-w-20">{status} {region.region}</span>
                    <div className="flex-1 h-2 bg-gray-800 rounded overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          region.withAdmin === 0
                            ? 'bg-red-500'
                            : region.withAdmin === region.total
                            ? 'bg-green-500'
                            : 'bg-yellow-500'
                        }`}
                        style={{ width: `${regionCoverage}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-gray-400 text-xs ml-2 min-w-12 text-right">
                    {region.withAdmin}/{region.total}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 조치 안내 */}
      <Card className="bg-blue-950/20 border-blue-500/30">
        <CardContent className="pt-4">
          <p className="text-xs text-blue-200 mb-2">
            <strong>📋 조치 방법:</strong>
          </p>
          <ul className="text-xs text-blue-200 space-y-1">
            <li>1. 관할 응급의료지원센터에 담당자 이메일 확보</li>
            <li>2. /admin/users 페이지에서 해당 조직에 new local_admin 계정 생성</li>
            <li>3. 담당자 활성화 후 임시점검원 즉시 활동 가능</li>
            <li>
              📖{' '}
              <a
                href="/docs/operations/TEMPORARY_INSPECTOR_MANAGEMENT.md"
                className="text-blue-300 hover:text-blue-200 underline"
              >
                자세한 가이드
              </a>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}