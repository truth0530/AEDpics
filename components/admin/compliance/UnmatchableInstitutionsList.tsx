'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertCircle, Loader2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface UnmatchableInstitution {
  targetInstitution: {
    target_key: string;
    institution_name: string;
    sido: string;
    gugun: string;
    division: string;
    sub_division: string;
    unique_key?: string;
    address?: string;
  };
  reason: string;
  markedBy: string;
  markedAt: Date;
  status: 'unmatchable';
}

interface UnmatchableInstitutionsListProps {
  year?: string;
  sido?: string | null;
  gugun?: string | null;
}

export default function UnmatchableInstitutionsList({
  year = '2025',
  sido,
  gugun
}: UnmatchableInstitutionsListProps) {
  const [loading, setLoading] = useState(false);
  const [unmatchableList, setUnmatchableList] = useState<UnmatchableInstitution[]>([]);
  const [selectedInstitution, setSelectedInstitution] = useState<UnmatchableInstitution | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // 매칭 불가 기관 목록 로드
  const loadUnmatchableInstitutions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        year,
        ...(sido && { sido }),
        ...(gugun && { gugun })
      });

      const response = await fetch(`/api/compliance/unmatchable-list?${params}`);
      const data = await response.json();

      setUnmatchableList(data.unmatchableInstitutions || []);
    } catch (error) {
      console.error('Failed to load unmatchable institutions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUnmatchableInstitutions();
  }, [year, sido, gugun]);

  // 매칭 불가 취소
  const handleCancelUnmatchable = async () => {
    if (!selectedInstitution) return;

    setCancelling(true);
    try {
      const response = await fetch('/api/compliance/mark-unmatchable', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_key: selectedInstitution.targetInstitution.target_key,
          year
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cancel unmatchable status');
      }

      // 성공 시 목록 새로고침
      await loadUnmatchableInstitutions();
      setShowCancelDialog(false);
      setSelectedInstitution(null);
      alert('매칭 불가 상태가 취소되었습니다.');
    } catch (error) {
      console.error('Failed to cancel unmatchable status:', error);
      alert(error instanceof Error ? error.message : '취소 중 오류가 발생했습니다.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (unmatchableList.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" />
            매칭 불가 기관
          </CardTitle>
          <CardDescription>
            매칭 불가로 표시된 의무설치기관이 없습니다.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                매칭 불가 기관
              </CardTitle>
              <CardDescription>
                총 {unmatchableList.length}개 기관이 매칭 불가로 표시되어 있습니다.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>시도</TableHead>
                  <TableHead>구군</TableHead>
                  <TableHead>구분</TableHead>
                  <TableHead>의무설치기관명</TableHead>
                  <TableHead>매칭 불가 사유</TableHead>
                  <TableHead>처리자</TableHead>
                  <TableHead>처리일시</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unmatchableList.map((institution) => (
                  <TableRow key={institution.targetInstitution.target_key}>
                    <TableCell>{institution.targetInstitution.sido}</TableCell>
                    <TableCell>{institution.targetInstitution.gugun}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {institution.targetInstitution.sub_division}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {institution.targetInstitution.institution_name}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{institution.reason}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {institution.markedBy}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(institution.markedAt), 'yyyy-MM-dd HH:mm', { locale: ko })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedInstitution(institution);
                          setShowCancelDialog(true);
                        }}
                      >
                        취소
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 취소 확인 다이얼로그 */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>매칭 불가 상태 취소</DialogTitle>
            <DialogDescription className="pt-2">
              <span className="font-medium text-foreground">
                &quot;{selectedInstitution?.targetInstitution.institution_name}&quot;
              </span>
              <span className="block mt-1">
                의 매칭 불가 상태를 취소하시겠습니까?
              </span>
              <span className="block mt-2 text-sm">
                취소 후에는 매칭하기 탭에서 다시 매칭할 수 있습니다.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowCancelDialog(false);
                setSelectedInstitution(null);
              }}
              disabled={cancelling}
            >
              아니오
            </Button>
            <Button
              onClick={handleCancelUnmatchable}
              disabled={cancelling}
            >
              {cancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              네, 취소합니다
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
