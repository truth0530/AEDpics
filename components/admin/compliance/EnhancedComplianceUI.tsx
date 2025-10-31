'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Check,
  X,
  Search,
  MapPin,
  Building2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Eye,
  Zap,
  Filter,
  ChevronRight,
  ChevronLeft,
  Keyboard,
  Hash,
  Target,
  TrendingUp,
  Clock,
  SparklesIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { calculateMatchingScore } from '@/lib/utils/similarity-matching';
import { toast } from 'sonner';

interface AEDDevice {
  management_number: string;
  equipment_name: string;
  installation_location_name: string;
  detailed_location: string;
  sido: string;
  gugun: string;
  road_address: string;
  land_address: string;
  matching_score?: number;
  matching_details?: {
    name_similarity: number;
    address_similarity: number;
    keyword_match: boolean;
  };
}

interface TargetInstitution {
  target_key: string;
  institution_name: string;
  sido: string;
  gugun: string;
  division: string;
  sub_division: string;
  target_keygroup: string;
  status?: 'installed' | 'not_installed' | 'pending';
  matched_devices?: AEDDevice[];
}

interface EnhancedComplianceUIProps {
  year?: string;
}

export default function EnhancedComplianceUI({ year = '2024' }: EnhancedComplianceUIProps) {
  const { data: session } = useSession();
  const [selectedTarget, setSelectedTarget] = useState<TargetInstitution | null>(null);
  const [targets, setTargets] = useState<TargetInstitution[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'high' | 'medium' | 'low'>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0 });
  const [selectedDeviceIndex, setSelectedDeviceIndex] = useState(0);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  // 키보드 단축키 설정
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!selectedTarget || processingId) return;

      // 1: 설치 확인
      if (e.key === '1' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleQuickConfirm('installed');
      }
      // 2: 미설치 확인
      else if (e.key === '2' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleQuickConfirm('not_installed');
      }
      // 화살표 위/아래: 목록 네비게이션
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        navigateTargets(e.key === 'ArrowDown' ? 1 : -1);
      }
      // Tab: 매칭 디바이스 전환
      else if (e.key === 'Tab' && selectedTarget?.matched_devices?.length) {
        e.preventDefault();
        setSelectedDeviceIndex(prev =>
          (prev + 1) % (selectedTarget.matched_devices?.length || 1)
        );
      }
      // Space: 배치 모드 토글
      else if (e.key === ' ' && e.shiftKey) {
        e.preventDefault();
        setBatchMode(!batchMode);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedTarget, processingId, batchMode]);

  // 관할지역 정보
  const userJurisdiction = useMemo(() => {
    const email = session?.user?.email || '';
    const orgName = (session as any)?.organizationName || '';
    const domain = email.split('@')[1];

    if (domain === 'korea.kr' && orgName?.includes('보건소')) {
      const match = orgName.match(/^(.+?)(시|도)\s+(.+?)(시|군|구)\s+보건소/);
      if (match) {
        return { sido: match[1] + match[2], gugun: match[3] + match[4] };
      }
    }
    return null;
  }, [session]);

  // 데이터 로드
  useEffect(() => {
    fetchComplianceData();
  }, [year, searchTerm, filterStatus, userJurisdiction]);

  const fetchComplianceData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        year,
        ...(userJurisdiction?.sido && { sido: userJurisdiction.sido }),
        ...(userJurisdiction?.gugun && { gugun: userJurisdiction.gugun }),
        ...(searchTerm && { search: searchTerm }),
        confidence_level: filterStatus === 'pending' ? 'all' : filterStatus
      });

      const response = await fetch(`/api/compliance/check?${params}`);
      const data = await response.json();

      setTargets(data.matches || []);
      setStats({
        total: data.statistics?.total || 0,
        completed: data.statistics?.completed || 0,
        pending: data.statistics?.pending || 0
      });

      // 첫 번째 항목 자동 선택
      if (data.matches?.length > 0 && !selectedTarget) {
        setSelectedTarget(data.matches[0]);
      }
    } catch (error) {
      toast.error('데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  const navigateTargets = (direction: number) => {
    const currentIndex = targets.findIndex(t => t.target_key === selectedTarget?.target_key);
    const newIndex = Math.max(0, Math.min(targets.length - 1, currentIndex + direction));
    if (targets[newIndex]) {
      setSelectedTarget(targets[newIndex]);
      setSelectedDeviceIndex(0);
    }
  };

  const handleQuickConfirm = async (status: 'installed' | 'not_installed') => {
    if (!selectedTarget || processingId) return;

    setProcessingId(selectedTarget.target_key);
    try {
      const managementNumbers = status === 'installed'
        ? selectedTarget.matched_devices?.map(d => d.management_number) || []
        : [];

      const response = await fetch('/api/compliance/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_key: selectedTarget.target_key,
          status,
          management_numbers: managementNumbers,
          year
        })
      });

      if (response.ok) {
        toast.success(status === 'installed' ? '설치 확인 완료' : '미설치 확인 완료');

        // 다음 항목으로 자동 이동
        navigateTargets(1);

        // 목록 새로고침
        await fetchComplianceData();
      }
    } catch (error) {
      toast.error('처리 실패');
    } finally {
      setProcessingId(null);
    }
  };

  const handleBatchProcess = async (status: 'installed' | 'not_installed') => {
    if (selectedBatch.size === 0) return;

    setProcessingId('batch');
    try {
      for (const targetKey of selectedBatch) {
        const target = targets.find(t => t.target_key === targetKey);
        if (!target) continue;

        await fetch('/api/compliance/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target_key: targetKey,
            status,
            management_numbers: status === 'installed'
              ? target.matched_devices?.map(d => d.management_number) || []
              : [],
            year
          })
        });
      }

      toast.success(`${selectedBatch.size}개 항목 처리 완료`);
      setSelectedBatch(new Set());
      setBatchMode(false);
      await fetchComplianceData();
    } catch (error) {
      toast.error('일괄 처리 실패');
    } finally {
      setProcessingId(null);
    }
  };

  // 텍스트 차이 하이라이트 함수
  const highlightDifferences = (text1: string, text2: string) => {
    if (!text1 || !text2) return { highlighted1: text1 || '', highlighted2: text2 || '' };

    const words1 = text1.split(/\s+/);
    const words2 = text2.split(/\s+/);

    const highlighted1 = words1.map(word => {
      const isMatch = words2.some(w =>
        w.toLowerCase().includes(word.toLowerCase()) ||
        word.toLowerCase().includes(w.toLowerCase())
      );
      return isMatch
        ? `<span class="text-green-600 font-semibold">${word}</span>`
        : `<span class="text-gray-700">${word}</span>`;
    }).join(' ');

    const highlighted2 = words2.map(word => {
      const isMatch = words1.some(w =>
        w.toLowerCase().includes(word.toLowerCase()) ||
        word.toLowerCase().includes(w.toLowerCase())
      );
      return isMatch
        ? `<span class="text-green-600 font-semibold">${word}</span>`
        : `<span class="text-gray-700">${word}</span>`;
    }).join(' ');

    return { highlighted1, highlighted2 };
  };

  const getConfidenceBadge = (score?: number) => {
    if (!score) return null;
    if (score >= 90) return <Badge className="bg-green-500">높음 {Math.round(score)}%</Badge>;
    if (score >= 60) return <Badge className="bg-yellow-500">중간 {Math.round(score)}%</Badge>;
    return <Badge className="bg-red-500">낮음 {Math.round(score)}%</Badge>;
  };

  return (
    <div className="h-full flex flex-col" ref={containerRef}>
      {/* 상단 툴바 */}
      <div className="bg-white dark:bg-gray-900 border-b dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            {/* 검색 */}
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
              <Input
                placeholder="기관명 또는 주소 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
              />
            </div>

            {/* 필터 */}
            <TabsList className="h-9">
              <TabsTrigger value="pending" onClick={() => setFilterStatus('pending')} className="h-8">
                <Clock className="w-4 h-4 mr-1" />
                대기중
              </TabsTrigger>
              <TabsTrigger value="high" onClick={() => setFilterStatus('high')} className="h-8">
                <TrendingUp className="w-4 h-4 mr-1" />
                높은 신뢰도
              </TabsTrigger>
              <TabsTrigger value="medium" onClick={() => setFilterStatus('medium')} className="h-8">
                중간 신뢰도
              </TabsTrigger>
              <TabsTrigger value="low" onClick={() => setFilterStatus('low')} className="h-8">
                낮은 신뢰도
              </TabsTrigger>
            </TabsList>

            {/* 배치 모드 토글 */}
            <Button
              variant={batchMode ? "default" : "outline"}
              size="sm"
              onClick={() => setBatchMode(!batchMode)}
            >
              <Zap className="w-4 h-4 mr-1" />
              일괄처리
            </Button>
          </div>

          {/* 진행률 */}
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <span className="text-gray-500 dark:text-gray-400">완료:</span>
              <span className="font-semibold ml-1 dark:text-gray-200">{stats.completed}/{stats.total}</span>
            </div>
            <Progress value={(stats.completed / stats.total) * 100} className="w-32" />
          </div>

          {/* 단축키 안내 */}
          <Button variant="ghost" size="sm">
            <Keyboard className="w-4 h-4 mr-1" />
            단축키
          </Button>
        </div>

        {/* 배치 모드 액션바 */}
        {batchMode && selectedBatch.size > 0 && (
          <div className="mt-3 flex items-center gap-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
            <span className="text-sm font-medium dark:text-gray-200">{selectedBatch.size}개 선택됨</span>
            <Button
              size="sm"
              variant="default"
              onClick={() => handleBatchProcess('installed')}
              disabled={processingId === 'batch'}
            >
              일괄 설치 확인
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleBatchProcess('not_installed')}
              disabled={processingId === 'batch'}
            >
              일괄 미설치 처리
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedBatch(new Set())}
            >
              선택 해제
            </Button>
          </div>
        )}
      </div>

      {/* 메인 콘텐츠 - 3단 레이아웃 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 좌측: 의무기관 목록 */}
        <div className="w-96 border-r dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex flex-col">
          <div className="px-4 py-2 bg-white dark:bg-gray-900 border-b dark:border-gray-700">
            <h3 className="font-semibold dark:text-gray-200">의무설치기관</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{targets.length}개 항목</p>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-2">
              {targets.map((target) => {
                const isSelected = selectedTarget?.target_key === target.target_key;
                const highestScore = Math.max(...(target.matched_devices?.map(d => d.matching_score || 0) || [0]));

                return (
                  <Card
                    key={target.target_key}
                    className={cn(
                      "cursor-pointer transition-all hover:shadow-md dark:hover:shadow-gray-700",
                      isSelected && "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/30",
                      target.status === 'installed' && "border-green-500 bg-green-50/30 dark:bg-green-900/20",
                      target.status === 'not_installed' && "border-red-500 bg-red-50/30 dark:bg-red-900/20",
                      !isSelected && !target.status && "dark:bg-gray-900 dark:border-gray-700"
                    )}
                    onClick={() => {
                      if (batchMode) {
                        const newBatch = new Set(selectedBatch);
                        if (newBatch.has(target.target_key)) {
                          newBatch.delete(target.target_key);
                        } else {
                          newBatch.add(target.target_key);
                        }
                        setSelectedBatch(newBatch);
                      } else {
                        setSelectedTarget(target);
                        setSelectedDeviceIndex(0);
                      }
                    }}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {batchMode && (
                              <input
                                type="checkbox"
                                checked={selectedBatch.has(target.target_key)}
                                className="mt-1"
                                onClick={(e) => e.stopPropagation()}
                              />
                            )}
                            <Building2 className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                            <p className="font-medium text-sm line-clamp-1 dark:text-gray-200">{target.institution_name}</p>
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {target.sido} {target.gugun}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            {target.status === 'installed' ? (
                              <Badge variant="default" className="text-xs bg-green-500">설치됨</Badge>
                            ) : target.status === 'not_installed' ? (
                              <Badge variant="destructive" className="text-xs">미설치</Badge>
                            ) : (
                              <>
                                {getConfidenceBadge(highestScore)}
                                {(target.matched_devices?.length || 0) > 0 && (
                                  <span className="text-xs text-gray-500">
                                    {target.matched_devices?.length}개 매칭
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        {isSelected && <ChevronRight className="w-4 h-4 text-blue-500 mt-1" />}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* 중앙: 매칭 결과 및 비교 */}
        <div className="flex-1 bg-white dark:bg-gray-900 flex flex-col">
          {selectedTarget ? (
            <>
              {/* 헤더 */}
              <div className="px-6 py-4 border-b dark:border-gray-700 bg-gradient-to-r from-blue-50 to-white dark:from-blue-900/20 dark:to-gray-900">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold dark:text-gray-200">{selectedTarget.institution_name}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {selectedTarget.sido} {selectedTarget.gugun} | {selectedTarget.division} - {selectedTarget.sub_division}
                    </p>
                  </div>
                  {selectedTarget.status ? (
                    <Badge
                      variant={selectedTarget.status === 'installed' ? 'default' : 'destructive'}
                      className="text-lg px-4 py-1"
                    >
                      {selectedTarget.status === 'installed' ? '설치 확인됨' : '미설치 확인됨'}
                    </Badge>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        size="lg"
                        variant="default"
                        onClick={() => handleQuickConfirm('installed')}
                        disabled={!!processingId}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle2 className="w-5 h-5 mr-2" />
                        설치 확인 (1)
                      </Button>
                      <Button
                        size="lg"
                        variant="destructive"
                        onClick={() => handleQuickConfirm('not_installed')}
                        disabled={!!processingId}
                      >
                        <XCircle className="w-5 h-5 mr-2" />
                        미설치 (2)
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* 매칭 결과 */}
              <div className="flex-1 overflow-auto p-6">
                {selectedTarget.matched_devices && selectedTarget.matched_devices.length > 0 ? (
                  <div className="space-y-4">
                    {/* 매칭 디바이스 탭 */}
                    {selectedTarget.matched_devices.length > 1 && (
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-sm text-gray-500">매칭된 AED:</span>
                        <div className="flex gap-1">
                          {selectedTarget.matched_devices.map((_, index) => (
                            <Button
                              key={index}
                              variant={index === selectedDeviceIndex ? "default" : "outline"}
                              size="sm"
                              onClick={() => setSelectedDeviceIndex(index)}
                              className="h-7 px-3"
                            >
                              {index + 1}
                            </Button>
                          ))}
                        </div>
                        <span className="text-xs text-gray-400 ml-2">(Tab키로 전환)</span>
                      </div>
                    )}

                    {/* 비교 테이블 */}
                    <div className="grid grid-cols-2 gap-6">
                      {/* 의무기관 정보 */}
                      <Card className="dark:bg-gray-800 dark:border-gray-700">
                        <CardHeader className="pb-3 bg-blue-50 dark:bg-blue-900/20">
                          <CardTitle className="text-base flex items-center gap-2 dark:text-gray-200">
                            <Target className="w-5 h-5" />
                            의무설치기관
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-3">
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">기관명</p>
                            <p
                              className="font-medium"
                              dangerouslySetInnerHTML={{
                                __html: highlightDifferences(
                                  selectedTarget.institution_name,
                                  selectedTarget.matched_devices[selectedDeviceIndex]?.equipment_name || ''
                                ).highlighted1
                              }}
                            />
                          </div>
                          <Separator />
                          <div>
                            <p className="text-xs text-gray-500 mb-1">주소</p>
                            <p
                              className="text-sm"
                              dangerouslySetInnerHTML={{
                                __html: highlightDifferences(
                                  `${selectedTarget.sido} ${selectedTarget.gugun}`,
                                  selectedTarget.matched_devices[selectedDeviceIndex]?.road_address || ''
                                ).highlighted1
                              }}
                            />
                          </div>
                          <Separator />
                          <div>
                            <p className="text-xs text-gray-500 mb-1">구분</p>
                            <p className="text-sm">{selectedTarget.division} - {selectedTarget.sub_division}</p>
                          </div>
                          <Separator />
                          <div>
                            <p className="text-xs text-gray-500 mb-1">그룹 키</p>
                            <p className="text-sm font-mono text-gray-600">{selectedTarget.target_keygroup}</p>
                          </div>
                        </CardContent>
                      </Card>

                      {/* AED 정보 */}
                      {selectedTarget.matched_devices[selectedDeviceIndex] && (
                        <Card>
                          <CardHeader className="pb-3 bg-green-50">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Hash className="w-5 h-5" />
                              매칭된 AED
                              {getConfidenceBadge(selectedTarget.matched_devices[selectedDeviceIndex].matching_score)}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-4 space-y-3">
                            <div>
                              <p className="text-xs text-gray-500 mb-1">설치기관명</p>
                              <p
                                className="font-medium"
                                dangerouslySetInnerHTML={{
                                  __html: highlightDifferences(
                                    selectedTarget.institution_name,
                                    selectedTarget.matched_devices[selectedDeviceIndex].equipment_name
                                  ).highlighted2
                                }}
                              />
                            </div>
                            <Separator />
                            <div>
                              <p className="text-xs text-gray-500 mb-1">설치위치</p>
                              <p
                                className="text-sm"
                                dangerouslySetInnerHTML={{
                                  __html: highlightDifferences(
                                    `${selectedTarget.sido} ${selectedTarget.gugun}`,
                                    selectedTarget.matched_devices[selectedDeviceIndex].road_address
                                  ).highlighted2
                                }}
                              />
                            </div>
                            <Separator />
                            <div>
                              <p className="text-xs text-gray-500 mb-1">상세위치</p>
                              <p className="text-sm">{selectedTarget.matched_devices[selectedDeviceIndex].detailed_location}</p>
                            </div>
                            <Separator />
                            <div>
                              <p className="text-xs text-gray-500 mb-1">관리번호</p>
                              <p className="text-sm font-mono text-gray-600">
                                {selectedTarget.matched_devices[selectedDeviceIndex].management_number}
                              </p>
                            </div>

                            {/* 매칭 상세 정보 */}
                            {selectedTarget.matched_devices[selectedDeviceIndex].matching_details && (
                              <>
                                <Separator />
                                <div className="bg-gray-50 p-3 rounded">
                                  <p className="text-xs text-gray-500 mb-2">매칭 분석</p>
                                  <div className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                      <span>이름 유사도</span>
                                      <span className="font-medium">
                                        {Math.round(selectedTarget.matched_devices[selectedDeviceIndex].matching_details.name_similarity)}%
                                      </span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                      <span>주소 유사도</span>
                                      <span className="font-medium">
                                        {Math.round(selectedTarget.matched_devices[selectedDeviceIndex].matching_details.address_similarity)}%
                                      </span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                      <span>키워드 매칭</span>
                                      <span className="font-medium">
                                        {selectedTarget.matched_devices[selectedDeviceIndex].matching_details.keyword_match ? '일치' : '불일치'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </>
                            )}
                          </CardContent>
                        </Card>
                      )}
                    </div>

                    {/* AI 추천 */}
                    {selectedTarget.matched_devices[selectedDeviceIndex]?.matching_score && (
                      <Alert className={cn(
                        "mt-4",
                        selectedTarget.matched_devices[selectedDeviceIndex].matching_score >= 90
                          ? "border-green-500 bg-green-50"
                          : selectedTarget.matched_devices[selectedDeviceIndex].matching_score >= 60
                          ? "border-yellow-500 bg-yellow-50"
                          : "border-red-500 bg-red-50"
                      )}>
                        <SparklesIcon className="h-4 w-4" />
                        <AlertDescription>
                          <strong>AI 추천:</strong>{' '}
                          {selectedTarget.matched_devices[selectedDeviceIndex].matching_score >= 90
                            ? '높은 신뢰도로 매칭되었습니다. 설치 확인을 권장합니다.'
                            : selectedTarget.matched_devices[selectedDeviceIndex].matching_score >= 60
                            ? '중간 신뢰도입니다. 추가 확인이 필요할 수 있습니다.'
                            : '낮은 신뢰도입니다. 신중한 검토가 필요합니다.'}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <AlertCircle className="w-12 h-12 mb-3" />
                    <p className="text-lg font-medium">매칭된 AED가 없습니다</p>
                    <p className="text-sm mt-1">이 기관은 AED가 설치되지 않은 것으로 보입니다.</p>
                    <Button
                      size="lg"
                      variant="destructive"
                      onClick={() => handleQuickConfirm('not_installed')}
                      disabled={!!processingId}
                      className="mt-4"
                    >
                      <XCircle className="w-5 h-5 mr-2" />
                      미설치 확인
                    </Button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <Target className="w-16 h-16 mx-auto mb-4" />
                <p className="text-lg font-medium">기관을 선택하세요</p>
                <p className="text-sm mt-2">좌측 목록에서 확인할 기관을 선택해주세요</p>
              </div>
            </div>
          )}
        </div>

        {/* 우측: 빠른 액션 패널 */}
        <div className="w-80 border-l dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 space-y-4">
          {/* 단축키 가이드 */}
          <Card className="dark:bg-gray-900 dark:border-gray-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 dark:text-gray-200">
                <Keyboard className="w-4 h-4" />
                단축키
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-xs dark:text-gray-300">
                <kbd className="px-2 py-1 bg-white dark:bg-gray-800 rounded border dark:border-gray-600">1</kbd>
                <span>설치 확인</span>
              </div>
              <div className="flex justify-between text-xs dark:text-gray-300">
                <kbd className="px-2 py-1 bg-white dark:bg-gray-800 rounded border dark:border-gray-600">2</kbd>
                <span>미설치 처리</span>
              </div>
              <div className="flex justify-between text-xs dark:text-gray-300">
                <kbd className="px-2 py-1 bg-white dark:bg-gray-800 rounded border dark:border-gray-600">↑↓</kbd>
                <span>목록 이동</span>
              </div>
              <div className="flex justify-between text-xs dark:text-gray-300">
                <kbd className="px-2 py-1 bg-white dark:bg-gray-800 rounded border dark:border-gray-600">Tab</kbd>
                <span>매칭 전환</span>
              </div>
              <div className="flex justify-between text-xs dark:text-gray-300">
                <kbd className="px-2 py-1 bg-white dark:bg-gray-800 rounded border dark:border-gray-600">Shift+Space</kbd>
                <span>일괄처리</span>
              </div>
            </CardContent>
          </Card>

          {/* 통계 */}
          <Card className="dark:bg-gray-900 dark:border-gray-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm dark:text-gray-200">오늘의 진행 상황</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between text-sm dark:text-gray-300">
                  <span>전체</span>
                  <span className="font-medium">{stats.total}</span>
                </div>
                <div className="flex justify-between text-sm dark:text-gray-300">
                  <span>완료</span>
                  <span className="font-medium text-green-600 dark:text-green-400">{stats.completed}</span>
                </div>
                <div className="flex justify-between text-sm dark:text-gray-300">
                  <span>대기</span>
                  <span className="font-medium text-yellow-600 dark:text-yellow-400">{stats.pending}</span>
                </div>
              </div>
              <Separator />
              <Progress value={(stats.completed / stats.total) * 100} className="h-2" />
              <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                {Math.round((stats.completed / stats.total) * 100)}% 완료
              </p>
            </CardContent>
          </Card>

          {/* 다음 추천 작업 */}
          {targets.filter(t => !t.status).length > 0 && (
            <Card className="border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2 dark:text-gray-200">
                  <SparklesIcon className="w-4 h-4" />
                  다음 추천 작업
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                  높은 신뢰도 항목을 우선 처리하면 효율적입니다
                </p>
                {targets
                  .filter(t => !t.status && t.matched_devices && t.matched_devices.length > 0)
                  .sort((a, b) => {
                    const scoreA = Math.max(...(a.matched_devices?.map(d => d.matching_score || 0) || [0]));
                    const scoreB = Math.max(...(b.matched_devices?.map(d => d.matching_score || 0) || [0]));
                    return scoreB - scoreA;
                  })
                  .slice(0, 3)
                  .map(target => (
                    <Button
                      key={target.target_key}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-left mb-1"
                      onClick={() => {
                        setSelectedTarget(target);
                        setSelectedDeviceIndex(0);
                      }}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs truncate">{target.institution_name}</span>
                        {getConfidenceBadge(Math.max(...(target.matched_devices?.map(d => d.matching_score || 0) || [0])))}
                      </div>
                    </Button>
                  ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}