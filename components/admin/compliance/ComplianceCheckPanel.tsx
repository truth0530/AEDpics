'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Building2,
  MapPin,
  Hash,
  ChevronRight,
  ChevronLeft,
  Loader2,
  FileText
} from 'lucide-react';

interface TargetInstitution {
  target_key: string;
  institution_name: string;
  sido: string;
  gugun: string;
  division: string;
  sub_division: string;
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
    method: string;
    details: string[];
  };
}

interface ComplianceMatch {
  targetInstitution: TargetInstitution;
  matches: AEDMatch[];
  status?: 'installed' | 'not_installed' | 'pending';
  confirmedBy?: string;
  confirmedAt?: Date;
  note?: string;
}

export default function ComplianceCheckPanel() {
  const [selectedYear, setSelectedYear] = useState('2025');
  const [selectedSido, setSelectedSido] = useState('');
  const [selectedGugun, setSelectedGugun] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [confidenceFilter, setConfidenceFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [loading, setLoading] = useState(false);
  const [complianceData, setComplianceData] = useState<ComplianceMatch[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [statistics, setStatistics] = useState({
    total: 0,
    installed: 0,
    notInstalled: 0,
    pending: 0,
    completionRate: 0
  });

  // 데이터 로드
  const loadComplianceData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        year: selectedYear,
        ...(selectedSido && { sido: selectedSido }),
        ...(selectedGugun && { gugun: selectedGugun }),
        ...(searchTerm && { search: searchTerm }),
        confidence_level: confidenceFilter
      });

      const response = await fetch(`/api/compliance/check?${params}`);
      const data = await response.json();
      setComplianceData(data.matches || []);

      // 통계 계산
      const installed = data.matches.filter((m: ComplianceMatch) => m.status === 'installed').length;
      const notInstalled = data.matches.filter((m: ComplianceMatch) => m.status === 'not_installed').length;
      const pending = data.matches.filter((m: ComplianceMatch) => m.status === 'pending' || !m.status).length;
      const total = data.matches.length;

      setStatistics({
        total,
        installed,
        notInstalled,
        pending,
        completionRate: total > 0 ? (installed / total) * 100 : 0
      });
    } catch (error) {
      console.error('Failed to load compliance data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComplianceData();
  }, [selectedYear, selectedSido, selectedGugun, confidenceFilter]);

  // 현재 항목
  const currentItem = complianceData[currentIndex];

  // 신뢰도별 필터링
  const filteredData = useMemo(() => {
    return complianceData.filter(item => {
      if (!item.matches || item.matches.length === 0) return false;
      const topMatch = item.matches[0];

      switch (confidenceFilter) {
        case 'high':
          return topMatch.confidence >= 90;
        case 'medium':
          return topMatch.confidence >= 60 && topMatch.confidence < 90;
        case 'low':
          return topMatch.confidence < 60;
        default:
          return true;
      }
    });
  }, [complianceData, confidenceFilter]);

  // 설치/미설치 처리
  const handleStatusUpdate = async (status: 'installed' | 'not_installed') => {
    if (!currentItem) return;

    try {
      const response = await fetch('/api/compliance/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_key: currentItem.targetInstitution.target_key,
          status,
          management_numbers: status === 'installed'
            ? currentItem.matches.map(m => m.management_number)
            : [],
          year: selectedYear
        })
      });

      if (response.ok) {
        // 상태 업데이트
        const updatedData = [...complianceData];
        updatedData[currentIndex] = {
          ...currentItem,
          status,
          confirmedAt: new Date()
        };
        setComplianceData(updatedData);

        // 다음 항목으로 이동
        if (currentIndex < complianceData.length - 1) {
          setCurrentIndex(currentIndex + 1);
        }

        // 통계 업데이트
        await loadComplianceData();
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">의무설치기관 점검</h2>
          <p className="text-muted-foreground mt-1">
            의무설치 대상기관의 AED 설치 현황을 확인하고 기록합니다
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2024">2024년</SelectItem>
              <SelectItem value="2025">2025년</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
            <CardTitle className="text-sm font-medium">설치 확인</CardTitle>
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

      {/* 필터 탭 */}
      <Tabs defaultValue="all" value={confidenceFilter} onValueChange={(v) => setConfidenceFilter(v as any)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">
            전체 ({complianceData.length})
          </TabsTrigger>
          <TabsTrigger value="high">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            고신뢰 (90% 이상)
          </TabsTrigger>
          <TabsTrigger value="medium">
            <AlertCircle className="w-4 h-4 mr-2" />
            중신뢰 (60-89%)
          </TabsTrigger>
          <TabsTrigger value="low">
            <XCircle className="w-4 h-4 mr-2" />
            저신뢰 (60% 미만)
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 메인 확인 패널 */}
      {currentItem && (
        <Card className="border-2">
          <CardHeader className="pb-4">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-xl">{currentItem.targetInstitution.institution_name}</CardTitle>
                <CardDescription className="mt-2 space-y-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {currentItem.targetInstitution.sido} {currentItem.targetInstitution.gugun}
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    {currentItem.targetInstitution.sub_division}
                  </div>
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">진행 상황</div>
                <div className="text-lg font-semibold">
                  {currentIndex + 1} / {filteredData.length}
                </div>
                {currentItem.status && (
                  <Badge
                    variant={currentItem.status === 'installed' ? 'default' :
                            currentItem.status === 'not_installed' ? 'destructive' : 'secondary'}
                    className={`mt-2 ${currentItem.status === 'installed' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                  >
                    {currentItem.status === 'installed' ? '설치' :
                     currentItem.status === 'not_installed' ? '미설치' : '대기'}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* 매칭 결과 */}
            <div>
              <h3 className="font-semibold mb-3">매칭된 AED 목록</h3>
              {currentItem.matches.length > 0 ? (
                <div className="space-y-2">
                  {currentItem.matches.slice(0, 5).map((match, idx) => (
                    <div
                      key={match.management_number}
                      className={`p-4 rounded-lg border ${idx === 0 ? 'border-primary bg-primary/5' : 'border-gray-200'}`}
                    >
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
                            variant={match.confidence >= 90 ? 'default' :
                                   match.confidence >= 60 ? 'outline' : 'secondary'}
                            className={match.confidence >= 90 ? 'bg-green-600 hover:bg-green-700' :
                                     match.confidence >= 60 ? 'border-yellow-600 text-yellow-600' : ''}
                          >
                            {match.matchingReason.method === 'exact' ? '완전일치' :
                             match.matchingReason.method === 'partial' ? '부분일치' : '유사'}
                          </Badge>
                          <div className="text-xs text-muted-foreground mt-2">
                            <div>기관명: {match.matchingReason.nameScore}%</div>
                            <div>주소: {match.matchingReason.addressScore}%</div>
                          </div>
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
                    </div>
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

            {/* 액션 버튼 */}
            <div className="flex justify-between items-center pt-4 border-t">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                  disabled={currentIndex === 0}
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  이전
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCurrentIndex(Math.min(filteredData.length - 1, currentIndex + 1))}
                  disabled={currentIndex >= filteredData.length - 1}
                >
                  다음
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>

              <div className="flex gap-3">
                <Button
                  size="lg"
                  variant="destructive"
                  onClick={() => handleStatusUpdate('not_installed')}
                  disabled={currentItem.status !== undefined}
                >
                  <XCircle className="w-5 h-5 mr-2" />
                  미설치
                </Button>
                <Button
                  size="lg"
                  variant="default"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => handleStatusUpdate('installed')}
                  disabled={currentItem.status !== undefined || currentItem.matches.length === 0}
                >
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  설치 확인
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!currentItem && filteredData.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>검토할 항목이 없습니다</AlertTitle>
          <AlertDescription>
            선택한 조건에 해당하는 의무설치기관이 없거나 모두 처리되었습니다.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}