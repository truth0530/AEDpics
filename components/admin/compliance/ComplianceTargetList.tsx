'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Building2,
  MapPin,
  Hash,
  Eye,
  ArrowUpRight,
  Target,
  Loader2,
  ChevronRight,
  Users,
  Filter
} from 'lucide-react';
import { shortenSidoInAddress } from '@/lib/utils/address-formatter';

interface TargetInstitution {
  target_key: string;
  institution_name: string;
  sido: string;
  gugun: string;
  division: string;
  sub_division: string;
  unique_key?: string | null;
}

interface AEDMatch {
  management_number: string;
  institution_name: string;
  address: string;
  equipment_count: number;
  confidence: number;
  matchingReason: {
    nameScore: number;
    addressScore: number;
    keywordBonus: number;
    method: string;
    details: string[];
  };
}

interface ComplianceTarget {
  targetInstitution: TargetInstitution;
  matches: AEDMatch[];
  status?: 'installed' | 'not_installed' | 'pending';
  confirmedBy?: string;
  confirmedAt?: Date;
  note?: string;
}

interface ComplianceTargetListProps {
  year?: string;
}

export default function ComplianceTargetList({ year = '2025' }: ComplianceTargetListProps) {
  const { data: session } = useSession();
  const [selectedYear, setSelectedYear] = useState(year);
  const [searchTerm, setSearchTerm] = useState('');
  const [confidenceFilter, setConfidenceFilter] = useState<'all' | 'high' | 'medium' | 'low' | 'pending'>('pending');
  const [loading, setLoading] = useState(false);
  const [targets, setTargets] = useState<ComplianceTarget[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<ComplianceTarget | null>(null);
  const [showMatchDialog, setShowMatchDialog] = useState(false);
  const [statistics, setStatistics] = useState({
    total: 0,
    installed: 0,
    notInstalled: 0,
    pending: 0,
    completionRate: 0
  });

  // 관할지역 정보 가져오기 (보건소 담당자용)
  // year prop이 변경되면 selectedYear 업데이트
  useEffect(() => {
    setSelectedYear(year);
  }, [year]);

  const userJurisdiction = useMemo(() => {
    if (!session?.user?.organizationName) return null;

    // 조직 도메인과 이름으로 관할 구역 파악
    const orgName = session.user.organizationName;
    const domain = session.user.email?.split('@')[1];

    // @korea.kr 도메인 중 보건소
    if (domain === 'korea.kr' && orgName?.includes('보건소')) {
      // 조직명에서 시도/구군 추출
      const match = orgName.match(/^(.+?)(시|도)\s+(.+?)(시|군|구)\s+보건소/);
      if (match) {
        return { sido: match[1] + match[2], gugun: match[3] + match[4] };
      }
    }

    // @nmc.or.kr 도메인 (전국 권한)
    if (domain === 'nmc.or.kr') {
      return { sido: null, gugun: null, isNational: true };
    }

    return null;
  }, [session]);

  // 데이터 로드
  const loadTargets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        year: selectedYear,
        ...(userJurisdiction?.sido && { sido: userJurisdiction.sido }),
        ...(userJurisdiction?.gugun && { gugun: userJurisdiction.gugun }),
        ...(searchTerm && { search: searchTerm }),
        confidence_level: confidenceFilter === 'pending' ? 'all' : confidenceFilter
      });

      const response = await fetch(`/api/compliance/check?${params}`);
      const data = await response.json();

      // pending 필터일 경우 미처리 항목만 표시
      const filteredData = confidenceFilter === 'pending'
        ? (data.matches || []).filter((m: ComplianceTarget) => !m.status || m.status === 'pending')
        : data.matches || [];

      setTargets(filteredData);

      // 통계 계산
      const installed = data.matches.filter((m: ComplianceTarget) => m.status === 'installed').length;
      const notInstalled = data.matches.filter((m: ComplianceTarget) => m.status === 'not_installed').length;
      const pending = data.matches.filter((m: ComplianceTarget) => !m.status || m.status === 'pending').length;
      const total = data.matches.length;

      setStatistics({
        total,
        installed,
        notInstalled,
        pending,
        completionRate: total > 0 ? (installed / total) * 100 : 0
      });
    } catch (error) {
      console.error('Failed to load targets:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userJurisdiction !== null) {
      loadTargets();
    }
  }, [selectedYear, searchTerm, confidenceFilter, userJurisdiction]);

  // 매칭 확인/미설치 처리
  const handleConfirmMatch = async (targetKey: string, managementNumbers: string[], status: 'installed' | 'not_installed') => {
    try {
      const response = await fetch('/api/compliance/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_key: targetKey,
          status,
          management_numbers: status === 'installed' ? managementNumbers : [],
          year: selectedYear
        })
      });

      if (response.ok) {
        // 리스트 새로고침
        await loadTargets();
        setShowMatchDialog(false);
        setSelectedTarget(null);
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  // 신뢰도에 따른 색상 설정
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-600 bg-green-50';
    if (confidence >= 70) return 'text-yellow-600 bg-yellow-50';
    if (confidence >= 50) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!userJurisdiction) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>권한 확인 필요</AlertTitle>
        <AlertDescription>
          관할지역 정보를 확인할 수 없습니다. 시스템 관리자에게 문의하세요.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">
            {userJurisdiction.isNational
              ? '전국 의무설치기관 AED 설치 현황'
              : `${userJurisdiction.sido} ${userJurisdiction.gugun} 관할 의무설치기관`}
          </h3>
          <p className="text-muted-foreground text-sm mt-1">
            미처리 항목을 우선 확인하고 설치 여부를 판단하세요
          </p>
        </div>
        <Badge variant="outline" className="px-3 py-1">
          {selectedYear}년 대상
        </Badge>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">전체 대상</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">설치 완료</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{statistics.installed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">미설치</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{statistics.notInstalled}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">검토 대기</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{statistics.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">설치율</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.completionRate.toFixed(1)}%</div>
            <Progress value={statistics.completionRate} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* 필터 및 검색 */}
      <div className="flex gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="기관명 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Tabs value={confidenceFilter} onValueChange={(v) => setConfidenceFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="pending">
              <AlertCircle className="w-4 h-4 mr-2" />
              미처리
            </TabsTrigger>
            <TabsTrigger value="high">고신뢰 (90%+)</TabsTrigger>
            <TabsTrigger value="medium">중신뢰 (60-89%)</TabsTrigger>
            <TabsTrigger value="low">저신뢰 (60% 미만)</TabsTrigger>
            <TabsTrigger value="all">전체</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* 타겟 리스트 */}
      <div className="grid gap-4">
        {targets.map((target) => (
          <Card
            key={target.targetInstitution.target_key}
            className={`transition-all hover:shadow-lg ${
              target.status === 'installed' ? 'opacity-60' : ''
            }`}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">
                      {target.targetInstitution.institution_name}
                    </h3>
                    {target.status && (
                      <Badge
                        variant={target.status === 'installed' ? 'default' :
                                target.status === 'not_installed' ? 'destructive' : 'secondary'}
                        className={target.status === 'installed' ? 'bg-green-600' : ''}
                      >
                        {target.status === 'installed' ? '설치완료' :
                         target.status === 'not_installed' ? '미설치' : '미처리'}
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      {target.targetInstitution.sub_division}
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {/* 중앙 관리: 시도명 약어 변환 (대구광역시 → 대구) */}
                      {shortenSidoInAddress(target.targetInstitution.sido)} {target.targetInstitution.gugun}
                    </div>
                    {target.targetInstitution.unique_key && (
                      <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4" />
                        <span className="font-medium">{target.targetInstitution.unique_key}</span>
                      </div>
                    )}
                  </div>

                  {/* 매칭 후보 미리보기 */}
                  {target.matches.length > 0 && (
                    <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm font-medium mb-2">매칭 후보 ({target.matches.length}개)</div>
                      <div className="space-y-2">
                        {target.matches.slice(0, 2).map((match, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <span className="truncate">{match.institution_name}</span>
                            <Badge
                              variant="outline"
                              className={getConfidenceColor(match.confidence)}
                            >
                              {match.confidence}%
                            </Badge>
                          </div>
                        ))}
                        {target.matches.length > 2 && (
                          <div className="text-xs text-muted-foreground">
                            +{target.matches.length - 2}개 더...
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 ml-4">
                  {!target.status || target.status === 'pending' ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedTarget(target);
                          setShowMatchDialog(true);
                        }}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        상세 확인
                      </Button>
                      {target.matches.length > 0 && target.matches[0].confidence >= 90 && (
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleConfirmMatch(
                            target.targetInstitution.target_key,
                            [target.matches[0].management_number],
                            'installed'
                          )}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          빠른 설치 확인
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        // 설치확인 메뉴로 이동
                        window.location.href = `/admin/compliance/completed?target=${target.targetInstitution.target_key}`;
                      }}
                    >
                      <ArrowUpRight className="w-4 h-4 mr-2" />
                      상세 보기
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {targets.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>검토할 항목이 없습니다</AlertTitle>
          <AlertDescription>
            선택한 조건에 해당하는 의무설치기관이 없거나 모두 처리되었습니다.
          </AlertDescription>
        </Alert>
      )}

      {/* 상세 매칭 확인 다이얼로그 */}
      <Dialog open={showMatchDialog} onOpenChange={setShowMatchDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          {selectedTarget && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedTarget.targetInstitution.institution_name}</DialogTitle>
                <DialogDescription>
                  {/* 중앙 관리: 시도명 약어 변환 (대구광역시 → 대구) */}
                  {selectedTarget.targetInstitution.sub_division} | {shortenSidoInAddress(selectedTarget.targetInstitution.sido)} {selectedTarget.targetInstitution.gugun}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                <h4 className="font-semibold">매칭된 AED 후보</h4>
                {selectedTarget.matches.length > 0 ? (
                  <div className="space-y-3">
                    {selectedTarget.matches.map((match, idx) => (
                      <Card key={idx} className={idx === 0 ? 'border-primary' : ''}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-medium">{match.institution_name}</div>
                              <div className="text-sm text-muted-foreground mt-1">{match.address}</div>
                              <div className="flex items-center gap-4 mt-2 text-sm">
                                <span className="flex items-center gap-1">
                                  <Hash className="w-3 h-3" />
                                  관리번호: {match.management_number}
                                </span>
                                <span>장비: {match.equipment_count}대</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold">
                                {match.confidence}%
                              </div>
                              <Badge
                                variant="outline"
                                className={getConfidenceColor(match.confidence)}
                              >
                                {match.matchingReason.method === 'exact' ? '완전일치' :
                                 match.matchingReason.method === 'partial' ? '부분일치' :
                                 match.matchingReason.method === 'keyword' ? '키워드매칭' : '유사'}
                              </Badge>
                              {match.matchingReason.keywordBonus > 0 && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  키워드 보너스: +{match.matchingReason.keywordBonus}
                                </div>
                              )}
                            </div>
                          </div>
                          {match.matchingReason.details.length > 0 && (
                            <Alert className="mt-3">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription>
                                {match.matchingReason.details.join(' / ')}
                              </AlertDescription>
                            </Alert>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>매칭 결과 없음</AlertTitle>
                    <AlertDescription>
                      해당 기관과 일치하는 AED 데이터를 찾을 수 없습니다.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <DialogFooter className="mt-6">
                <Button variant="outline" onClick={() => setShowMatchDialog(false)}>
                  취소
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleConfirmMatch(selectedTarget.targetInstitution.target_key, [], 'not_installed')}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  미설치 확인
                </Button>
                {selectedTarget.matches.length > 0 && (
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => handleConfirmMatch(
                      selectedTarget.targetInstitution.target_key,
                      selectedTarget.matches.slice(0, 1).map(m => m.management_number),
                      'installed'
                    )}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    최상위 매칭으로 설치 확인
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}