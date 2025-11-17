'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle } from 'lucide-react';

interface UnmatchableReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  institutionName: string;
  has100PercentMatch: boolean;
  matchingInstitutionName?: string;
}

export function UnmatchableReasonDialog({
  open,
  onOpenChange,
  onConfirm,
  institutionName,
  has100PercentMatch,
  matchingInstitutionName,
}: UnmatchableReasonDialogProps) {
  const [reason, setReason] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(has100PercentMatch);

  const handleSubmit = () => {
    if (!reason.trim()) return;
    onConfirm(reason.trim());
    setReason('');
    setShowConfirmation(has100PercentMatch);
  };

  const handleConfirmProceed = () => {
    setShowConfirmation(false);
  };

  const handleCancel = () => {
    setReason('');
    setShowConfirmation(has100PercentMatch);
    onOpenChange(false);
  };

  // 100% 매칭 존재 시 경고 단계
  if (showConfirmation && has100PercentMatch) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <DialogTitle>100% 일치 후보 확인</DialogTitle>
            </div>
            <DialogDescription className="pt-2 space-y-2">
              <p className="font-medium text-foreground">
                &quot;{matchingInstitutionName || institutionName}&quot; 기관과 100% 일치하는 후보가 있습니다.
              </p>
              <p className="text-sm">
                그럼에도 불구하고 매칭 불가로 처리하시겠습니까?
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={handleCancel}
            >
              아니오
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmProceed}
            >
              네, 계속 진행
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // 사유 입력 단계
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>매칭 불가 사유 입력</DialogTitle>
          <DialogDescription className="pt-2">
            <span className="font-medium text-foreground">
              &quot;{institutionName}&quot;
            </span>
            <span className="block mt-1">
              매칭 불가 사유를 간단하게 작성해주세요.
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Textarea
            placeholder="예: 폐업, 업종 변경, 주소 불일치 등"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="min-h-[100px]"
            autoFocus
          />
          <p className="text-xs text-muted-foreground mt-2">
            이 사유는 매칭 결과 탭에서 확인할 수 있습니다.
          </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleCancel}
          >
            취소
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!reason.trim()}
          >
            확인
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
