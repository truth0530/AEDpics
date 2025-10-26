'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface TargetMatching {
  management_number: string;
  target_key_2024: string | null;
  auto_suggested_2024: string | null;
  auto_confidence_2024: number | null;
  confirmed_2024: boolean;
  // modified_2024 컬럼은 DB에 없음! modified_by_2024와 modified_at_2024만 있음
  modified_by_2024: string | null;  // UUID as string
  modified_at_2024: string | null;
  aed_institution: string;
  target_institution: string;
  sido: string;
  gugun: string;
  aed_count: number;
  matching_reason: any;
}

interface MatchingStats {
  total_mappings: number;
  total_aed_count: number;
  confirmed_count: number;
  pending_count: number;
  high_confidence_count: number;
  medium_confidence_count: number;
  low_confidence_count: number;
  avg_confidence: number;
}

interface TargetMatchingClientProps {
  year: 2024 | 2025;
}

export function TargetMatchingClient({ year }: TargetMatchingClientProps) {
  const queryClient = useQueryClient();
  const selectedYear = year; // year는 props로 고정
  const [activeTab, setActiveTab] = useState<'high' | 'medium' | 'low' | 'all'>('high');
  const [filters, setFilters] = useState({
    search: '',
    confirmedOnly: false,
  });
  const [selectedMapping, setSelectedMapping] = useState<TargetMatching | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // 통계 조회
  const { data: statsData } = useQuery<MatchingStats>({
    queryKey: ['target-matching-stats', selectedYear],
    queryFn: async () => {
      const res = await fetch(`/api/target-matching/stats?year=${selectedYear}`);
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
    refetchInterval: 30000,
  });

  // 매칭 목록 조회
  const { data: matchingsData, isLoading } = useQuery<{
    mappings: TargetMatching[];
    total: number;
  }>({
    queryKey: ['target-matchings', selectedYear, activeTab, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('year', selectedYear.toString());
      params.append('confidence_level', activeTab);
      if (filters.search) params.append('search', filters.search);
      if (filters.confirmedOnly) params.append('confirmed_only', 'true');

      const res = await fetch(`/api/target-matching?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch mappings');
      return res.json();
    },
  });

  // 매칭 확정
  const confirmMutation = useMutation({
    mutationFn: async (managementNumber: string) => {
      const res = await fetch('/api/target-matching/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ managementNumber, year: selectedYear.toString() }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to confirm mapping');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['target-matchings'] });
      queryClient.invalidateQueries({ queryKey: ['target-matching-stats'] });
      alert('매칭이 확정되었습니다.');
    },
    onError: (error: Error) => {
      alert(`오류: ${error.message}`);
    },
  });

  // 일괄 확정 (고신뢰도)
  const bulkConfirmMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/target-matching/bulk-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: selectedYear.toString() }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to bulk confirm');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['target-matchings'] });
      queryClient.invalidateQueries({ queryKey: ['target-matching-stats'] });
      alert(`${data.confirmed_count}건의 고신뢰도 매칭이 일괄 확정되었습니다.`);
    },
  });

  const stats = statsData;

  const getConfidenceBadge = (confidence: number | null) => {
    if (!confidence) return null;
    if (confidence >= 90) {
      return <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-900 text-green-300 whitespace-nowrap">{confidence}점</span>;
    } else if (confidence >= 70) {
      return <span className="px-1.5 py-0.5 rounded text-[10px] bg-yellow-900 text-yellow-300 whitespace-nowrap">{confidence}점</span>;
    } else {
      return <span className="px-1.5 py-0.5 rounded text-[10px] bg-orange-900 text-orange-300 whitespace-nowrap">{confidence}점</span>;
    }
  };

  return (
    <div className="flex h-full flex-col bg-gray-950">
      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-auto px-4 py-2 md:py-3 space-y-2 md:space-y-3">
        {/* 연도 표시 및 평균 신뢰도 */}
        {stats && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-400">
              <span className="font-semibold text-blue-400">{selectedYear}년</span> 구비의무기관 매칭
            </div>
            <div className="text-xs text-gray-400 hidden md:block">
              평균 신뢰도: <span className="text-blue-400 font-semibold">{stats.avg_confidence.toFixed(2)}점</span>
              {stats.avg_confidence >= 80 && <span className="text-green-400 ml-1">✓ 목표 달성</span>}
            </div>
          </div>
        )}

        {/* 통계 카드 - 모바일 최적화 */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 md:gap-2">
            <Card className="bg-gray-900 border-gray-800 p-1.5 md:p-2">
              <div className="text-gray-400 text-[9px] md:text-[10px]">전체매칭</div>
              <div className="text-base md:text-lg font-bold text-white">{stats.total_mappings.toLocaleString()}</div>
              <div className="text-[9px] md:text-[10px] text-gray-500">AED {stats.total_aed_count.toLocaleString()}대</div>
            </Card>
            <Card className="bg-gray-900 border-gray-800 p-1.5 md:p-2">
              <div className="text-gray-400 text-[9px] md:text-[10px]">확정완료</div>
              <div className="text-base md:text-lg font-bold text-green-400">{stats.confirmed_count.toLocaleString()}</div>
              <div className="text-[9px] md:text-[10px] text-gray-500">{((stats.confirmed_count / stats.total_mappings) * 100).toFixed(1)}%</div>
            </Card>
            <Card className="bg-gray-900 border-gray-800 p-1.5 md:p-2">
              <div className="text-gray-400 text-[9px] md:text-[10px]">검토대기</div>
              <div className="text-base md:text-lg font-bold text-yellow-400">{stats.pending_count.toLocaleString()}</div>
              <div className="text-[9px] md:text-[10px] text-gray-500">{((stats.pending_count / stats.total_mappings) * 100).toFixed(1)}%</div>
            </Card>
            <Card className="bg-gray-900 border-gray-800 p-1.5 md:p-2">
              <div className="text-gray-400 text-[9px] md:text-[10px]">평균신뢰도</div>
              <div className="text-base md:text-lg font-bold text-blue-400">{stats.avg_confidence.toFixed(1)}점</div>
              <div className="text-[9px] md:text-[10px] text-gray-500">
                고{stats.high_confidence_count.toLocaleString()} 중{stats.medium_confidence_count.toLocaleString()} 저{stats.low_confidence_count.toLocaleString()}
              </div>
            </Card>
          </div>
        )}

        {/* 필터 - 슬림화 (시도 제거) */}
        <Card className="bg-gray-900 border-gray-800 p-1.5 md:p-2">
          <div className="flex flex-col sm:flex-row gap-1.5 md:gap-2">
            <div className="flex-1">
              <label className="text-[9px] md:text-[10px] text-gray-400 mb-0.5 md:mb-1 block">검색 (기관명, 관리번호)</label>
              <Input
                placeholder="검색어 입력"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white h-7 md:h-8 text-[11px] md:text-xs"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center space-x-1.5 md:space-x-2 cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={filters.confirmedOnly}
                  onChange={(e) => setFilters({ ...filters, confirmedOnly: e.target.checked })}
                  className="w-3 h-3 rounded bg-gray-800 border-gray-700"
                />
                <span className="text-[11px] md:text-xs text-gray-400">확정된 것만</span>
              </label>
            </div>
          </div>
        </Card>

        {/* 탭 - 모바일 최적화 */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
          <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-1.5 md:gap-0">
            <TabsList className="bg-gray-900 border border-gray-800 h-7 md:h-8 grid grid-cols-4 w-full md:w-auto">
              <TabsTrigger value="high" className="data-[state=active]:bg-green-900 data-[state=active]:text-green-300 text-[10px] md:text-xs px-1 md:px-2 py-1">
                고신뢰 ({stats?.high_confidence_count.toLocaleString() || 0})
              </TabsTrigger>
              <TabsTrigger value="medium" className="data-[state=active]:bg-yellow-900 data-[state=active]:text-yellow-300 text-[10px] md:text-xs px-1 md:px-2 py-1">
                중신뢰 ({stats?.medium_confidence_count.toLocaleString() || 0})
              </TabsTrigger>
              <TabsTrigger value="low" className="data-[state=active]:bg-orange-900 data-[state=active]:text-orange-300 text-[10px] md:text-xs px-1 md:px-2 py-1">
                저신뢰 ({stats?.low_confidence_count.toLocaleString() || 0})
              </TabsTrigger>
              <TabsTrigger value="all" className="data-[state=active]:bg-blue-900 data-[state=active]:text-blue-300 text-[10px] md:text-xs px-1 md:px-2 py-1">
                전체 ({stats?.total_mappings.toLocaleString() || 0})
              </TabsTrigger>
            </TabsList>
            {activeTab === 'high' && stats && stats.high_confidence_count > 0 && (
              <Button
                onClick={() => {
                  if (confirm(`${stats.high_confidence_count}건의 고신뢰도 매칭을 일괄 확정하시겠습니까?`)) {
                    bulkConfirmMutation.mutate();
                  }
                }}
                className="bg-green-600 hover:bg-green-700 text-[11px] md:text-xs h-7 px-2 w-full md:w-auto"
              >
                고신뢰도 일괄 확정
              </Button>
            )}
          </div>

          <TabsContent value={activeTab} className="mt-1.5 md:mt-2">
            <Card className="bg-gray-900 border-gray-800">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-800 border-b border-gray-700">
                    <tr>
                      <th className="px-1 md:px-2 py-1.5 md:py-2 text-left text-[9px] md:text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap w-28">관리번호</th>
                      <th className="px-1 md:px-2 py-1.5 md:py-2 text-left text-[9px] md:text-[10px] font-medium text-gray-400 uppercase hidden md:table-cell">AED 설치기관</th>
                      <th className="px-1 md:px-2 py-1.5 md:py-2 text-left text-[9px] md:text-[10px] font-medium text-gray-400 uppercase max-w-[150px]">구비의무기관</th>
                      <th className="px-1 md:px-2 py-1.5 md:py-2 text-left text-[9px] md:text-[10px] font-medium text-gray-400 uppercase hidden sm:table-cell whitespace-nowrap w-24">지역</th>
                      <th className="px-1 md:px-2 py-1.5 md:py-2 text-left text-[9px] md:text-[10px] font-medium text-gray-400 uppercase hidden lg:table-cell w-16">AED수</th>
                      <th className="px-1 md:px-2 py-1.5 md:py-2 text-left text-[9px] md:text-[10px] font-medium text-gray-400 uppercase w-16">신뢰도</th>
                      <th className="px-1 md:px-2 py-1.5 md:py-2 text-left text-[9px] md:text-[10px] font-medium text-gray-400 uppercase hidden sm:table-cell w-12">상태</th>
                      <th className="px-1 md:px-2 py-1.5 md:py-2 text-left text-[9px] md:text-[10px] font-medium text-gray-400 uppercase whitespace-nowrap w-20">작업</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {isLoading ? (
                      <tr>
                        <td colSpan={8} className="px-1 md:px-2 py-2 text-center text-gray-400 text-xs">
                          로딩 중...
                        </td>
                      </tr>
                    ) : matchingsData?.mappings.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-1 md:px-2 py-2 text-center text-gray-400 text-xs">
                          매칭 정보가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      matchingsData?.mappings.map((mapping) => (
                        <tr key={mapping.management_number} className="hover:bg-gray-800/50">
                          <td className="px-1 md:px-2 py-1.5 md:py-2 text-[10px] md:text-xs text-white font-mono whitespace-nowrap">{mapping.management_number}</td>
                          <td className="px-1 md:px-2 py-1.5 md:py-2 text-[10px] md:text-xs text-gray-300 hidden md:table-cell">{mapping.aed_institution}</td>
                          <td className="px-1 md:px-2 py-1.5 md:py-2 text-[10px] md:text-xs text-gray-300 truncate max-w-[150px]" title={mapping.target_institution || '미매칭'}>{mapping.target_institution || '미매칭'}</td>
                          <td className="px-1 md:px-2 py-1.5 md:py-2 text-[10px] md:text-xs text-gray-400 hidden sm:table-cell whitespace-nowrap">
                            {mapping.sido} {mapping.gugun}
                          </td>
                          <td className="px-1 md:px-2 py-1.5 md:py-2 text-[10px] md:text-xs text-gray-300 hidden lg:table-cell">{mapping.aed_count}</td>
                          <td className="px-1 md:px-2 py-1.5 md:py-2 text-[10px] md:text-xs">
                            {getConfidenceBadge(mapping.auto_confidence_2024)}
                          </td>
                          <td className="px-1 md:px-2 py-1.5 md:py-2 text-[10px] md:text-xs hidden sm:table-cell whitespace-nowrap">
                            {mapping.confirmed_2024 ? (
                              <span className="text-green-400 text-[9px] md:text-[10px]">✓확정</span>
                            ) : mapping.modified_by_2024 ? (
                              <span className="text-blue-400 text-[9px] md:text-[10px]">수정</span>
                            ) : (
                              <span className="text-yellow-400 text-[9px] md:text-[10px]">검토</span>
                            )}
                          </td>
                          <td className="px-1 md:px-2 py-1.5 md:py-2 text-[10px] md:text-xs">
                            <div className="flex flex-row gap-0.5 whitespace-nowrap">
                              {!mapping.confirmed_2024 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => confirmMutation.mutate(mapping.management_number)}
                                  className="border-green-700 text-green-400 hover:bg-green-900 h-5 md:h-6 text-[9px] md:text-[10px] px-1 md:px-1.5"
                                >
                                  확정
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedMapping(mapping);
                                  setIsDetailOpen(true);
                                }}
                                className="border-blue-700 text-blue-400 hover:bg-blue-900 h-5 md:h-6 text-[9px] md:text-[10px] px-1 md:px-1.5"
                              >
                                상세
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* 상세 보기 모달 - 모바일 최적화 */}
      {isDetailOpen && selectedMapping && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 md:p-4">
          <Card className="bg-gray-900 border-gray-800 p-3 md:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg md:text-xl font-bold text-white mb-2 md:mb-4">매칭 상세 정보</h2>
            <div className="space-y-2 md:space-y-4">
              <div className="grid grid-cols-2 gap-2 md:gap-4">
                <div>
                  <label className="text-xs md:text-sm text-gray-400 block mb-0.5 md:mb-1">관리번호</label>
                  <div className="text-white font-mono text-xs md:text-sm">{selectedMapping.management_number}</div>
                </div>
                <div>
                  <label className="text-xs md:text-sm text-gray-400 block mb-0.5 md:mb-1">AED 수량</label>
                  <div className="text-white text-xs md:text-sm">{selectedMapping.aed_count}대</div>
                </div>
              </div>

              <div>
                <label className="text-xs md:text-sm text-gray-400 block mb-0.5 md:mb-1">AED 설치기관</label>
                <div className="text-white text-xs md:text-sm">{selectedMapping.aed_institution}</div>
              </div>

              <div>
                <label className="text-xs md:text-sm text-gray-400 block mb-0.5 md:mb-1">매칭된 구비의무기관</label>
                <div className="text-white text-xs md:text-sm">{selectedMapping.target_institution || '미매칭'}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 md:gap-4">
                <div>
                  <label className="text-xs md:text-sm text-gray-400 block mb-0.5 md:mb-1">시도</label>
                  <div className="text-white text-xs md:text-sm">{selectedMapping.sido}</div>
                </div>
                <div>
                  <label className="text-xs md:text-sm text-gray-400 block mb-0.5 md:mb-1">시군구</label>
                  <div className="text-white text-xs md:text-sm">{selectedMapping.gugun}</div>
                </div>
              </div>

              <div>
                <label className="text-xs md:text-sm text-gray-400 block mb-0.5 md:mb-1">신뢰도 점수</label>
                {getConfidenceBadge(selectedMapping.auto_confidence_2024)}
              </div>

              {selectedMapping.matching_reason && (
                <div>
                  <label className="text-xs md:text-sm text-gray-400 block mb-0.5 md:mb-1">매칭 이유</label>
                  <div className="bg-gray-800 p-2 md:p-3 rounded text-[10px] md:text-xs text-gray-300">
                    <pre className="whitespace-pre-wrap">{JSON.stringify(selectedMapping.matching_reason, null, 2)}</pre>
                  </div>
                </div>
              )}

              {selectedMapping.modified_by_2024 && (
                <div className="bg-blue-900/20 border border-blue-800 p-2 md:p-3 rounded">
                  <div className="text-xs md:text-sm text-blue-300">
                    수정됨 - {selectedMapping.modified_by_2024} ({new Date(selectedMapping.modified_at_2024!).toLocaleString('ko-KR')})
                  </div>
                </div>
              )}

              <div className="flex gap-1.5 md:gap-2 justify-end pt-2 md:pt-4 border-t border-gray-800">
                <Button
                  variant="outline"
                  onClick={() => setIsDetailOpen(false)}
                  className="border-gray-700 text-gray-300 h-8 md:h-9 text-xs md:text-sm"
                >
                  닫기
                </Button>
                {!selectedMapping.confirmed_2024 && (
                  <Button
                    onClick={() => confirmMutation.mutate(selectedMapping.management_number)}
                    className="bg-green-600 hover:bg-green-700 h-8 md:h-9 text-xs md:text-sm"
                  >
                    확정
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
