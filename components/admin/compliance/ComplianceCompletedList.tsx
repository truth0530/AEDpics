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
import { shortenSidoInAddress } from '@/lib/utils/address-formatter';

interface CompletedTarget {
  targetInstitution: {
    target_key: string;
    institution_name: string;
    sido: string;
    gugun: string;
    division: string;
    sub_division: string;
  };
  matches?: Array<{
    management_number: string;
    institution_name: string;
    address: string;
    equipment_count: number;
    confidence: number;
  }>;
  status: 'installed' | 'not_installed' | 'confirmed' | 'pending' | 'unmatchable';
  requiresMatching?: boolean;
  confirmedBy?: string;
  confirmedAt?: Date;
  note?: string;
  // unmatchable 관련 필드
  reason?: string;
  markedBy?: string;
  markedAt?: Date;
}

interface ComplianceCompletedListProps {
  year?: string;
  sido?: string | null;
  gugun?: string | null;
  statusFilter?: 'all' | 'installed' | 'not_installed' | 'unmatchable';
  subDivisionFilter?: string;
  searchTerm?: string;
}

export interface ComplianceCompletedListRef {
  exportToExcel: () => void;
  statistics: {
    total: number;
    installed: number;
    notInstalled: number;
    unmatchable: number;
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
  const [showUnmatchDialog, setShowUnmatchDialog] = useState(false);
  const [unmatchReason, setUnmatchReason] = useState('');
  const [editNote, setEditNote] = useState('');
  const [statistics, setStatistics] = useState({
    total: 0,
    installed: 0,
    notInstalled: 0,
    unmatchable: 0,
    avgConfidence: 0
  });
  const [availableSubDivisions, setAvailableSubDivisions] = useState<string[]>([]);

  // 페이지네이션 상태
  const [pageSize, setPageSize] = useState(30); // 기본 30개
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

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
  const loadCompletedTargets = React.useCallback(async () => {
    setLoading(true);
    try {
      // props로 받은 sido/gugun 우선 사용, 없으면 userJurisdiction 사용
      // null이나 '전체', '시도'는 무시하고 전국 데이터 조회
      const effectiveSido = (sido && sido !== '전체' && sido !== '시도') ? sido :
                            (userJurisdiction?.sido && !userJurisdiction?.isNational) ? userJurisdiction.sido : null;
      const effectiveGugun = (gugun && gugun !== '전체' && gugun !== '구군') ? gugun :
                             userJurisdiction?.gugun || null;

      // 통계는 별도 API로 조회 (빠른 응답)
      const statsParams = new URLSearchParams({
        year: selectedYear,
        ...(effectiveSido && { sido: effectiveSido }),
        ...(effectiveGugun && { gugun: effectiveGugun }),
        ...(searchTerm && { search: searchTerm })
      });
      const statsResponse = await fetch(`/api/compliance/stats?${statsParams}`);
      const statsData = await statsResponse.json();

      // 페이지 데이터 조회 - 필터를 API에 전달하여 서버에서 필터링
      const params = new URLSearchParams({
        year: selectedYear,
        page: currentPage.toString(),
        limit: pageSize.toString(),
        ...(effectiveSido && { sido: effectiveSido }),
        ...(effectiveGugun && { gugun: effectiveGugun }),
        ...(searchTerm && { search: searchTerm }),
        ...(subDivisionFilter !== 'all' && { sub_division: subDivisionFilter })
      });

      // statusFilter에 따라 API 및 파라미터 결정
      let response;
      if (statusFilter === 'unmatchable') {
        // 매칭불가 리스트 조회 (별도 API)
        response = await fetch(`/api/compliance/unmatchable-list?${params}`);
      } else {
        // check-optimized API 사용 (target_list_devices 기반)
        let showOnlyUnmatched = 'false';
        if (statusFilter === 'not_installed') {
          showOnlyUnmatched = 'true'; // 미매칭만 보기
        } else if (statusFilter === 'installed') {
          showOnlyUnmatched = 'matched_only'; // 매칭완료만 보기
        }
        response = await fetch(`/api/compliance/check-optimized?${params}&showOnlyUnmatched=${showOnlyUnmatched}`);
      }
      const data = await response.json();

      // API 응답에 따라 데이터 형식 통일
      const allMatches = statusFilter === 'unmatchable'
        ? (data.unmatchableInstitutions || [])
        : (data.matches || []);

      // 페이지 정보 업데이트
      setTotalPages(data.totalPages || 1);

      // sub_division 목록 추출 (전체 데이터 기준이어야 하지만, 현재는 응답 데이터 기준)
      const subDivisions = Array.from(new Set(
        allMatches
          .map((m: any) => m.targetInstitution?.sub_division)
          .filter((sd: string) => sd)
      )) as string[];
      setAvailableSubDivisions(subDivisions);

      // API에서 이미 필터링된 데이터를 받으므로 클라이언트 필터링 불필요
      setCompletedTargets(allMatches);

      // 통계는 stats API 결과 사용
      setStatistics({
        total: statsData.stats?.total || 0,
        installed: statsData.stats?.installed || 0,
        notInstalled: statsData.stats?.notInstalled || 0,
        unmatchable: statsData.stats?.unmatchable || 0,
        avgConfidence: 0 // TODO: stats API에 추가 가능
      });
    } catch (error) {
      console.error('Failed to load completed targets:', error);
    } finally {
      setLoading(false);
    }
  }, [sido, gugun, userJurisdiction, selectedYear, searchTerm, statusFilter, subDivisionFilter, currentPage, pageSize]);

  useEffect(() => {
    if (userJurisdiction !== null || sido !== undefined) {
      loadCompletedTargets();
    }
  }, [selectedYear, searchTerm, statusFilter, subDivisionFilter, userJurisdiction, sido, gugun, currentPage, pageSize, loadCompletedTargets]);

  // 매칭 완료 이벤트 수신하여 목록 새로고침
  useEffect(() => {
    const handleMatchCompleted = () => {
      loadCompletedTargets();
    };

    window.addEventListener('matchCompleted', handleMatchCompleted);
    return () => {
      window.removeEventListener('matchCompleted', handleMatchCompleted);
    };
  }, [loadCompletedTargets]);

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

  // 매칭 취소
  const handleUnmatch = async () => {
    if (!selectedTarget) return;

    try {
      const response = await fetch('/api/compliance/unmatch', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_key: selectedTarget.targetInstitution.target_key,
          year: parseInt(selectedYear),
          reason: unmatchReason.trim() || undefined
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to unmatch');
      }

      const result = await response.json();

      // 성공 시 목록 새로고침
      await loadCompletedTargets();

      // 매칭 취소 이벤트 발송 (매칭하기 탭의 Section 1 새로고침)
      window.dispatchEvent(new CustomEvent('matchCompleted', {
        detail: {
          target_key: selectedTarget.targetInstitution.target_key,
          institution_name: selectedTarget.targetInstitution.institution_name,
          action: 'unmatch'
        }
      }));

      setShowUnmatchDialog(false);
      setSelectedTarget(null);
      setUnmatchReason('');
      alert(`매칭이 취소되었습니다.\n(${result.unmatched_count}개 관리번호, ${result.equipment_count}대 장비연번)`);
    } catch (error) {
      console.error('Failed to unmatch:', error);
      alert(error instanceof Error ? error.message : '매칭 취소 중 오류가 발생했습니다.');
    }
  };

  // CSV 다운로드
  const handleExportCSV = () => {
    const csvContent = [
      ['기관명', '시도', '구군', '분류', '상태', '확인일자', '확인자', '비고'],
      ...completedTargets.map(target => [
        target.targetInstitution.institution_name,
        // 중앙 관리: 시도명 약어 변환 (대구광역시 → 대구)
        shortenSidoInAddress(target.targetInstitution.sido),
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
                {/* 중앙 관리: 시도명 약어 변환 (대구광역시 → 대구) */}
                <TableCell>{shortenSidoInAddress(target.targetInstitution.sido)}</TableCell>
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
                  {target.status === 'unmatchable' ? (
                    <Badge variant="destructive" className="text-xs">매칭불가</Badge>
                  ) : target.status === 'confirmed' && target.matches[0] ? (
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
                  {target.status === 'unmatchable' ? (
                    <span className="text-sm text-muted-foreground">{target.reason || '-'}</span>
                  ) : target.status === 'confirmed' && target.matches[0] ? (
                    <span className="font-mono text-sm">{target.matches[0].management_number}</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {target.status === 'unmatchable' ? (
                    <span className="text-muted-foreground">-</span>
                  ) : target.status === 'confirmed' && target.matches[0] ? (
                    <span className="text-sm">{target.matches[0].equipment_count}대</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="max-w-xs">
                  {target.status === 'unmatchable' ? (
                    <span className="text-muted-foreground">-</span>
                  ) : target.status === 'confirmed' && target.matches[0] ? (
                    <span className="text-sm truncate">{target.matches[0].address}</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    {target.status === 'unmatchable' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          if (confirm('매칭불가 상태를 취소하시겠습니까?')) {
                            try {
                              const response = await fetch('/api/compliance/mark-unmatchable', {
                                method: 'DELETE',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  target_key: target.targetInstitution.target_key,
                                  year: selectedYear
                                })
                              });
                              if (response.ok) {
                                await loadCompletedTargets();
                              } else {
                                alert('매칭불가 취소 실패');
                              }
                            } catch (error) {
                              console.error('Failed to cancel unmatchable:', error);
                              alert('매칭불가 취소 중 오류 발생');
                            }
                          }
                        }}
                        title="매칭불가 취소"
                        className="text-blue-600 hover:text-blue-700"
                      >
                        취소
                      </Button>
                    ) : target.status === 'confirmed' ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedTarget(target);
                            setEditNote(target.note || '');
                            setShowEditDialog(true);
                          }}
                          title="매칭 정보 수정"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedTarget(target);
                            setUnmatchReason('');
                            setShowUnmatchDialog(true);
                          }}
                          title="매칭 취소"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          // 미완료: 매칭하기 탭으로 전환 + 해당 기관 자동 선택
                          window.dispatchEvent(new CustomEvent('openMatchingWorkflow', {
                            detail: { institution: target.targetInstitution }
                          }));
                        }}
                        title="매칭하기"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    )}
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

      {/* 페이지 크기 선택 및 페이지네이션 컨트롤 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">페이지당</span>
          <Select
            value={pageSize.toString()}
            onValueChange={(value) => {
              setPageSize(parseInt(value));
              setCurrentPage(1); // 페이지 크기 변경 시 첫 페이지로
            }}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15">15개</SelectItem>
              <SelectItem value="30">30개</SelectItem>
              <SelectItem value="100">100개</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">보기</span>
        </div>

        {/* 페이지네이션 컨트롤 */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1 || loading}
          >
            이전
          </Button>

          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              // 현재 페이지 근처의 페이지 번호만 표시
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }

              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(pageNum)}
                  disabled={loading}
                  className="w-10"
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages || loading}
          >
            다음
          </Button>

          <span className="text-sm text-muted-foreground ml-2">
            {currentPage} / {totalPages} 페이지
          </span>
        </div>
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

      {/* 매칭 취소 다이얼로그 */}
      <Dialog open={showUnmatchDialog} onOpenChange={setShowUnmatchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>매칭 취소 확인</DialogTitle>
            <DialogDescription className="pt-2">
              <span className="font-medium text-foreground">
                &quot;{selectedTarget?.targetInstitution.institution_name}&quot;
              </span>
              <span className="block mt-1">
                의 매칭을 취소하시겠습니까?
              </span>
              <span className="block mt-2 text-sm text-muted-foreground">
                매칭된 모든 관리번호와 장비연번이 target_list_devices에서 삭제됩니다.
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium">취소 사유 (선택)</label>
            <Textarea
              placeholder="취소 사유를 입력하세요 (다른 사람의 매칭을 취소할 경우 필수)"
              value={unmatchReason}
              onChange={(e) => setUnmatchReason(e.target.value)}
              className="mt-1"
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowUnmatchDialog(false);
                setSelectedTarget(null);
                setUnmatchReason('');
              }}
            >
              아니오
            </Button>
            <Button
              variant="destructive"
              onClick={handleUnmatch}
            >
              네, 매칭 취소
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

ComplianceCompletedList.displayName = 'ComplianceCompletedList';

export default ComplianceCompletedList;