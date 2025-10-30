'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Building2,
  MapPin,
  Hash,
  Edit2,
  FileText,
  Calendar,
  User,
  Loader2,
  CheckCheck,
  Filter,
  Download
} from 'lucide-react';

interface CompletedTarget {
  targetInstitution: {
    target_key: string;
    institution_name: string;
    sido: string;
    gugun: string;
    division: string;
    sub_division: string;
  };
  matches: Array<{
    management_number: string;
    institution_name: string;
    address: string;
    equipment_count: number;
    confidence: number;
  }>;
  status: 'installed' | 'not_installed';
  confirmedBy?: string;
  confirmedAt?: Date;
  note?: string;
}

interface ComplianceCompletedListProps {
  year?: string;
}

export default function ComplianceCompletedList({ year = '2024' }: ComplianceCompletedListProps) {
  const { data: session } = useSession();
  const [selectedYear, setSelectedYear] = useState(year);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'installed' | 'not_installed'>('all');
  const [loading, setLoading] = useState(false);
  const [completedTargets, setCompletedTargets] = useState<CompletedTarget[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<CompletedTarget | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editNote, setEditNote] = useState('');
  const [statistics, setStatistics] = useState({
    total: 0,
    installed: 0,
    notInstalled: 0,
    avgConfidence: 0
  });

  // year prop이 변경되면 selectedYear 업데이트
  useEffect(() => {
    setSelectedYear(year);
  }, [year]);

  // 관할지역 정보
  const userJurisdiction = useMemo(() => {
    if (!session?.user?.organizationName) return null;

    const orgName = session.user.organizationName;
    const domain = session.user.email?.split('@')[1];

    if (domain === 'korea.kr' && orgName?.includes('보건소')) {
      const match = orgName.match(/^(.+?)(시|도)\s+(.+?)(시|군|구)\s+보건소/);
      if (match) {
        return { sido: match[1] + match[2], gugun: match[3] + match[4] };
      }
    }

    if (domain === 'nmc.or.kr') {
      return { sido: null, gugun: null, isNational: true };
    }

    return null;
  }, [session]);

  // 완료된 데이터 로드
  const loadCompletedTargets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        year: selectedYear,
        ...(userJurisdiction?.sido && { sido: userJurisdiction.sido }),
        ...(userJurisdiction?.gugun && { gugun: userJurisdiction.gugun }),
        ...(searchTerm && { search: searchTerm })
      });

      const response = await fetch(`/api/compliance/check?${params}`);
      const data = await response.json();

      // 완료된 항목만 필터링
      const completed = (data.matches || []).filter((m: CompletedTarget) =>
        m.status === 'installed' || m.status === 'not_installed'
      );

      // 상태 필터 적용
      const filtered = statusFilter === 'all'
        ? completed
        : completed.filter((m: CompletedTarget) => m.status === statusFilter);

      setCompletedTargets(filtered);

      // 통계 계산
      const installed = completed.filter((m: CompletedTarget) => m.status === 'installed');
      const avgConfidence = installed.length > 0
        ? installed.reduce((acc: number, curr: CompletedTarget) =>
            acc + (curr.matches[0]?.confidence || 0), 0) / installed.length
        : 0;

      setStatistics({
        total: completed.length,
        installed: installed.length,
        notInstalled: completed.filter((m: CompletedTarget) => m.status === 'not_installed').length,
        avgConfidence
      });
    } catch (error) {
      console.error('Failed to load completed targets:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userJurisdiction !== null) {
      loadCompletedTargets();
    }
  }, [selectedYear, searchTerm, statusFilter, userJurisdiction]);

  // 상태 변경
  const handleStatusChange = async (targetKey: string, newStatus: 'installed' | 'not_installed') => {
    try {
      const response = await fetch('/api/compliance/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_key: targetKey,
          status: newStatus,
          management_numbers: newStatus === 'installed' && selectedTarget?.matches[0]
            ? [selectedTarget.matches[0].management_number]
            : [],
          year: selectedYear,
          note: editNote || '상태 수정'
        })
      });

      if (response.ok) {
        await loadCompletedTargets();
        setShowEditDialog(false);
        setSelectedTarget(null);
        setEditNote('');
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  // CSV 다운로드
  const handleExportCSV = () => {
    const csvContent = [
      ['기관명', '시도', '구군', '분류', '상태', '확인일자', '확인자', '비고'],
      ...completedTargets.map(target => [
        target.targetInstitution.institution_name,
        target.targetInstitution.sido,
        target.targetInstitution.gugun,
        target.targetInstitution.sub_division,
        target.status === 'installed' ? '설치' : '미설치',
        target.confirmedAt ? new Date(target.confirmedAt).toLocaleDateString() : '',
        target.confirmedBy || '',
        target.note || ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `의무설치기관_확인현황_${selectedYear}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
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
              ? '전국 의무설치기관 설치확인 현황'
              : `${userJurisdiction.sido} ${userJurisdiction.gugun} 설치확인 현황`}
          </h3>
          <p className="text-muted-foreground text-sm mt-1">
            처리 완료된 항목을 검토하고 수정할 수 있습니다
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="px-3 py-1">
            {selectedYear}년 완료
          </Badge>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            CSV 다운로드
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">처리 완료</CardTitle>
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
            <CardTitle className="text-sm font-medium">미설치 확인</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{statistics.notInstalled}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">평균 신뢰도</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.avgConfidence.toFixed(1)}%</div>
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
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="all">
              전체 ({statistics.total})
            </TabsTrigger>
            <TabsTrigger value="installed">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              설치 ({statistics.installed})
            </TabsTrigger>
            <TabsTrigger value="not_installed">
              <XCircle className="w-4 h-4 mr-2" />
              미설치 ({statistics.notInstalled})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* 완료 목록 */}
      <div className="space-y-4">
        {completedTargets.map((target) => (
          <Card key={target.targetInstitution.target_key}>
            <CardContent className="p-6">
              <div className="grid grid-cols-7 gap-4 items-center">
                <div className="col-span-2">
                  <div className="font-medium">{target.targetInstitution.institution_name}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {target.targetInstitution.sido} {target.targetInstitution.gugun}
                  </div>
                </div>

                <div>
                  <Badge variant="outline">
                    {target.targetInstitution.sub_division}
                  </Badge>
                </div>

                <div>
                  <Badge
                    variant={target.status === 'installed' ? 'default' : 'destructive'}
                    className={target.status === 'installed' ? 'bg-green-600' : ''}
                  >
                    {target.status === 'installed' ? '설치' : '미설치'}
                  </Badge>
                </div>

                <div className="col-span-2">
                  {target.status === 'installed' && target.matches[0] ? (
                    <div className="text-sm">
                      <div>{target.matches[0].institution_name}</div>
                      <div className="text-muted-foreground">
                        관리번호: {target.matches[0].management_number} ({target.matches[0].confidence}%)
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">매칭 없음</span>
                  )}
                </div>

                <div className="flex items-center gap-2 justify-end">
                  {target.confirmedAt && (
                    <div className="text-sm text-right mr-2">
                      <div>{new Date(target.confirmedAt).toLocaleDateString()}</div>
                      <div className="text-muted-foreground text-xs">
                        {new Date(target.confirmedAt).toLocaleTimeString()}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedTarget(target);
                        setEditNote(target.note || '');
                        setShowEditDialog(true);
                      }}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    {target.note && (
                      <Button
                        variant="ghost"
                        size="sm"
                        title={target.note}
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {completedTargets.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>완료된 항목이 없습니다</AlertTitle>
          <AlertDescription>
            아직 처리 완료된 의무설치기관이 없습니다.
          </AlertDescription>
        </Alert>
      )}

      {/* 수정 다이얼로그 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          {selectedTarget && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedTarget.targetInstitution.institution_name}</DialogTitle>
                <DialogDescription>
                  확인 상태를 수정하거나 메모를 추가할 수 있습니다.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">현재 상태</label>
                  <div className="mt-1">
                    <Badge
                      variant={selectedTarget.status === 'installed' ? 'default' : 'destructive'}
                      className={selectedTarget.status === 'installed' ? 'bg-green-600' : ''}
                    >
                      {selectedTarget.status === 'installed' ? '설치' : '미설치'}
                    </Badge>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">수정 사유</label>
                  <Textarea
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    placeholder="수정 사유를 입력하세요..."
                    rows={3}
                    className="mt-1"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                  취소
                </Button>
                {selectedTarget.status === 'installed' ? (
                  <Button
                    variant="destructive"
                    onClick={() => handleStatusChange(selectedTarget.targetInstitution.target_key, 'not_installed')}
                  >
                    미설치로 변경
                  </Button>
                ) : (
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => handleStatusChange(selectedTarget.targetInstitution.target_key, 'installed')}
                  >
                    설치로 변경
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