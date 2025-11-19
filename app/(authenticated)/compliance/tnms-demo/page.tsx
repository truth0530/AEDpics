'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  Activity,
  Target,
  MapPin,
  Info
} from 'lucide-react';
import AutoSuggestCard from '@/components/compliance/AutoSuggestCard';

interface MatchingResult {
  target_key: string;
  target_institution_name: string;
  target_sido: string;
  target_gugun: string;
  target_address: string;
  matched_equipment_serial?: string;
  matched_institution_name?: string;
  matched_address?: string;
  confidence_score: number;
  name_confidence: number;
  address_confidence: number;
  match_type: string;
}

interface Statistics {
  total_targets: number;
  matched_count: number;
  unmatched_count: number;
  avg_confidence: number;
  high_confidence_count: number;
  medium_confidence_count: number;
  low_confidence_count: number;
}

export default function TNMSDemoPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResult, setSelectedResult] = useState<MatchingResult | null>(null);
  const [searchResults, setSearchResults] = useState<MatchingResult[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState('search');

  // 통계 데이터 로드
  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    try {
      const response = await fetch('/api/compliance/tnms-stats');
      if (response.ok) {
        const data = await response.json();
        setStatistics(data);
      }
    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/compliance/tnms-search?q=${encodeURIComponent(searchQuery)}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results);
        if (data.results.length > 0) {
          setSelectedResult(data.results[0]);
        }
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getConfidenceIcon = (score: number) => {
    if (score >= 90) return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    if (score >= 70) return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    if (score > 0) return <AlertTriangle className="h-5 w-5 text-orange-500" />;
    return <XCircle className="h-5 w-5 text-red-500" />;
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 90) return 'bg-green-500';
    if (score >= 70) return 'bg-yellow-500';
    if (score > 0) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const handleConfirmMatch = async (targetKey: string, equipmentSerial: string) => {
    console.log(`Confirmed match: ${targetKey} -> ${equipmentSerial}`);
    // 실제 API 호출 구현
    alert(`매칭 확정됨: ${targetKey} -> ${equipmentSerial}`);
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Sparkles className="h-8 w-8 text-blue-500" />
          TNMS 자동매칭 시스템 데모
        </h1>
        <p className="text-gray-600 mt-2">
          Text Normalization Management System을 활용한 지능형 기관명 매칭
        </p>
      </div>

      {/* 통계 카드 */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">전체 타겟</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.total_targets.toLocaleString()}</div>
              <p className="text-xs text-gray-500 mt-1">target_list_2025</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">매칭 성공</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {statistics.matched_count.toLocaleString()}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {((statistics.matched_count / statistics.total_targets) * 100).toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">평균 신뢰도</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {statistics.avg_confidence.toFixed(1)}%
              </div>
              <div className="flex gap-1 mt-2">
                <div className="flex-1 h-2 bg-green-500 rounded" style={{ flex: statistics.high_confidence_count }} />
                <div className="flex-1 h-2 bg-yellow-500 rounded" style={{ flex: statistics.medium_confidence_count }} />
                <div className="flex-1 h-2 bg-orange-500 rounded" style={{ flex: statistics.low_confidence_count }} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">매칭 실패</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {statistics.unmatched_count.toLocaleString()}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {((statistics.unmatched_count / statistics.total_targets) * 100).toFixed(1)}%
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 메인 탭 */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="search">
            <Search className="h-4 w-4 mr-2" />
            검색
          </TabsTrigger>
          <TabsTrigger value="examples">
            <Activity className="h-4 w-4 mr-2" />
            예시
          </TabsTrigger>
          <TabsTrigger value="stats">
            <Target className="h-4 w-4 mr-2" />
            상세통계
          </TabsTrigger>
        </TabsList>

        <TabsContent value="search">
          <Card>
            <CardHeader>
              <CardTitle>기관명 검색</CardTitle>
              <CardDescription>
                타겟 기관명을 입력하여 매칭 결과를 확인하세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Input
                  placeholder="예: 대구중부소방서, 인천중부소방서..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={isLoading}>
                  {isLoading ? '검색 중...' : '검색'}
                </Button>
              </div>

              {/* 검색 결과 */}
              {searchResults.length > 0 && (
                <div className="space-y-3">
                  {searchResults.map((result) => (
                    <div
                      key={result.target_key}
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${
                        selectedResult?.target_key === result.target_key
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                          : 'hover:border-gray-400'
                      }`}
                      onClick={() => setSelectedResult(result)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {getConfidenceIcon(result.confidence_score)}
                            <span className="font-medium">{result.target_institution_name}</span>
                            <Badge variant="outline" className={`${getConfidenceColor(result.confidence_score)} text-white`}>
                              {result.confidence_score}%
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            <div>{result.target_sido} {result.target_gugun}</div>
                            {result.matched_institution_name && (
                              <div className="mt-1">
                                → 매칭: {result.matched_institution_name}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 선택된 결과의 자동추천 카드 */}
          {selectedResult && (
            <div className="mt-6">
              <AutoSuggestCard
                targetKey={selectedResult.target_key}
                targetName={selectedResult.target_institution_name}
                onConfirm={handleConfirmMatch}
                onReject={() => console.log('Rejected')}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="examples">
          <div className="grid gap-4">
            {/* 높은 신뢰도 예시 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  높은 신뢰도 매칭 (90% 이상)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AutoSuggestCard
                  targetKey="00020026428202"
                  targetName="덕수호"
                  onConfirm={handleConfirmMatch}
                />
              </CardContent>
            </Card>

            {/* 중간 신뢰도 예시 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  중간 신뢰도 매칭 (70-90%)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AutoSuggestCard
                  targetKey="00020016267100"
                  targetName="제103창양호"
                  onConfirm={handleConfirmMatch}
                />
              </CardContent>
            </Card>

            {/* 낮은 신뢰도 예시 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  낮은 신뢰도 매칭 (70% 미만)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AutoSuggestCard
                  targetKey="00010096482201"
                  targetName="제307해림호"
                  onConfirm={handleConfirmMatch}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="stats">
          <Card>
            <CardHeader>
              <CardTitle>상세 통계 분석</CardTitle>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4">
                <Info className="h-4 w-4" />
                <AlertTitle>TNMS 매칭 결과</AlertTitle>
                <AlertDescription>
                  총 29,295개 타겟 중 29,277개 (99.94%) 매칭 성공
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">신뢰도 분포</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-32">높음 (90%+)</div>
                      <div className="flex-1 bg-gray-200 rounded-full h-6">
                        <div className="bg-green-500 h-6 rounded-full text-xs text-white flex items-center justify-center"
                             style={{ width: '39.6%' }}>
                          11,607건
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-32">중간 (70-90%)</div>
                      <div className="flex-1 bg-gray-200 rounded-full h-6">
                        <div className="bg-yellow-500 h-6 rounded-full text-xs text-white flex items-center justify-center"
                             style={{ width: '15.8%' }}>
                          4,632건
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-32">낮음 (70% 미만)</div>
                      <div className="flex-1 bg-gray-200 rounded-full h-6">
                        <div className="bg-orange-500 h-6 rounded-full text-xs text-white flex items-center justify-center"
                             style={{ width: '44.5%' }}>
                          13,038건
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">주요 성과</h3>
                  <ul className="space-y-1 text-sm">
                    <li>• 완전 매칭 (100% 신뢰도): 5,847건</li>
                    <li>• 평균 신뢰도: 71.1%</li>
                    <li>• 처리 시간: 약 20분 (29,295건)</li>
                    <li>• 자동 업데이트 트리거: 활성화됨</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}