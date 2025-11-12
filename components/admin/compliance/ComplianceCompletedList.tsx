'use client';

import React, { useState, useEffect, useMemo, useImperativeHandle, forwardRef } from 'react';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
  sido?: string | null;
  gugun?: string | null;
  statusFilter?: 'all' | 'installed' | 'not_installed';
  subDivisionFilter?: string;
  searchTerm?: string;
}

export interface ComplianceCompletedListRef {
  exportToExcel: () => void;
  statistics: {
    total: number;
    installed: number;
    notInstalled: number;
    avgConfidence: number;
  };
  availableSubDivisions: string[];
}

const ComplianceCompletedList = forwardRef<ComplianceCompletedListRef, ComplianceCompletedListProps>(
  ({
    year = '2025',
    sido,
    gugun,
    statusFilter = 'not_installed',
    subDivisionFilter = 'all',
    searchTerm = ''
  }, ref) => {
  const { data: session } = useSession();
  const [selectedYear, setSelectedYear] = useState(year);
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
  const [availableSubDivisions, setAvailableSubDivisions] = useState<string[]>([]);

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
      // props로 받은 sido/gugun 우선 사용, 없으면 userJurisdiction 사용
      const effectiveSido = sido !== undefined ? sido : userJurisdiction?.sido;
      const effectiveGugun = gugun !== undefined ? gugun : userJurisdiction?.gugun;

      const params = new URLSearchParams({
        year: selectedYear,
        limit: '10000', // API MAX_PAGE_SIZE와 일치 (전체 데이터 가져오기)
        ...(effectiveSido && { sido: effectiveSido }),
        ...(effectiveGugun && { gugun: effectiveGugun }),
        ...(searchTerm && { search: searchTerm })
      });

      const response = await fetch(`/api/compliance/check?${params}`);
      const data = await response.json();

      const allMatches = data.matches || [];
      const totalCount = data.totalCount || 0; // API가 반환하는 전체 의무시설 수 (target_list_2025 기준)

      // sub_division 목록 추출
      const subDivisions = Array.from(new Set(
        allMatches
          .map((m: any) => m.targetInstitution?.sub_division)
          .filter((sd: string) => sd) // 빈 값 제거
      )) as string[];
      setAvailableSubDivisions(subDivisions);

      // 상태 필터 적용
      let filtered;
      if (statusFilter === 'installed') {
        // 매칭완료: status가 'installed'인 항목
        filtered = allMatches.filter((m: any) => m.status === 'installed');
      } else if (statusFilter === 'not_installed') {
        // 미완료: status가 없거나 확인되지 않은 항목
        filtered = allMatches.filter((m: any) =>
          !m.status || m.status === 'pending' || m.requiresMatching === true
        );
      } else {
        // all: 모든 항목
        filtered = allMatches;
      }

      // 구분 필터 적용
      if (subDivisionFilter !== 'all') {
        filtered = filtered.filter((m: any) =>
          m.targetInstitution?.sub_division === subDivisionFilter
        );
      }

      setCompletedTargets(filtered);

      // 통계 계산 (전체 데이터 기준)
      const installed = allMatches.filter((m: any) => m.status === 'installed');
      const avgConfidence = installed.length > 0
        ? installed.reduce((acc: number, curr: any) =>
            acc + (curr.matches?.[0]?.confidence || 0), 0) / installed.length
        : 0;

      setStatistics({
        total: totalCount, // target_list_2025에서 가져온 전체 의무시설 수
        installed: installed.length,
        notInstalled: totalCount - installed.length, // 전체 - 매칭완료 = 미완료
        avgConfidence
      });
    } catch (error) {
      console.error('Failed to load completed targets:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userJurisdiction !== null || sido !== undefined) {
      loadCompletedTargets();
    }
  }, [selectedYear, searchTerm, statusFilter, subDivisionFilter, userJurisdiction, sido, gugun]);

  // Expose export function, statistics, and availableSubDivisions to parent via ref
  useImperativeHandle(ref, () => ({
    exportToExcel: handleExportCSV,
    statistics,
    availableSubDivisions
  }), [statistics, availableSubDivisions]);

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
    <div className="space-y-4">
      {/* 완료 목록 테이블 */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>시도</TableHead>
              <TableHead>구군</TableHead>
              <TableHead>구분</TableHead>
              <TableHead>의무설치기관명</TableHead>
              <TableHead>매칭된 기관명</TableHead>
              <TableHead>매칭된 관리번호</TableHead>
              <TableHead>매칭된 장비연번</TableHead>
              <TableHead>주소</TableHead>
              <TableHead className="text-right">작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {completedTargets.map((target) => (
              <TableRow key={target.targetInstitution.target_key}>
                <TableCell>{target.targetInstitution.sido}</TableCell>
                <TableCell>{target.targetInstitution.gugun}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {target.targetInstitution.sub_division}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">
                  {target.targetInstitution.institution_name}
                </TableCell>
                <TableCell>
                  {target.status === 'installed' && target.matches[0] ? (
                    <div className="flex items-center gap-2">
                      <span>{target.matches[0].institution_name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {target.matches[0].confidence}%
                      </Badge>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">매칭 없음</span>
                  )}
                </TableCell>
                <TableCell>
                  {target.status === 'installed' && target.matches[0] ? (
                    <span className="font-mono text-sm">{target.matches[0].management_number}</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {target.status === 'installed' && target.matches[0] ? (
                    <span className="text-sm">{target.matches[0].equipment_count}대</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="max-w-xs">
                  {target.status === 'installed' && target.matches[0] ? (
                    <span className="text-sm truncate">{target.matches[0].address}</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (target.status === 'installed') {
                          // 매칭완료: 수정 다이얼로그 표시
                          setSelectedTarget(target);
                          setEditNote(target.note || '');
                          setShowEditDialog(true);
                        } else {
                          // 미완료: 매칭하기 탭으로 전환 + 해당 기관 자동 선택
                          window.dispatchEvent(new CustomEvent('openMatchingWorkflow', {
                            detail: { institution: target.targetInstitution }
                          }));
                        }
                      }}
                      title={target.status === 'installed' ? '매칭 정보 수정' : '매칭하기'}
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
});

ComplianceCompletedList.displayName = 'ComplianceCompletedList';

export default ComplianceCompletedList;