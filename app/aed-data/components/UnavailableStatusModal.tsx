'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AEDDevice } from '@/packages/types/aed';
import { useToast } from '@/components/ui/Toast';

interface UnavailableStatusModalProps {
  device: AEDDevice;
  onClose: () => void;
  onSuccess: () => void;
}

const REASON_LABELS: Record<string, string> = {
  disposed: '폐기장비',
  broken: '고장/수리',
  other: '기타',
};

export function UnavailableStatusModal({ device, onClose, onSuccess }: UnavailableStatusModalProps) {
  const { showSuccess, showError } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRestore = async () => {
    setIsSubmitting(true);

    try {
      const serial = device.equipment_serial || device.management_number || device.id;

      if (!serial) {
        throw new Error('장비 식별 정보가 없습니다.');
      }

      const response = await fetch(`/api/inspections/mark-unavailable?equipmentSerial=${encodeURIComponent(serial)}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '점검불가 상태 취소에 실패했습니다.');
      }

      showSuccess('점검불가 취소 완료', { message: data.message || '장비가 정상 상태로 복원되었습니다.' });
      onSuccess();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      showError('점검불가 취소 실패', { message });
      setIsSubmitting(false);
    }
  };

  const reasonLabel = device.unavailable_reason
    ? REASON_LABELS[device.unavailable_reason] || device.unavailable_reason
    : '알 수 없음';

  return (
    <Dialog open onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="bg-gray-900 border-gray-800 text-gray-100 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-gray-100">
            점검불가 상태
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-400">
            해당 장비는 현재 점검불가 상태입니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 장비 정보 */}
          <div className="rounded-lg border border-gray-800 bg-gray-950 p-4 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">설치기관</span>
              <span className="text-gray-100 font-medium">
                {device.installation_institution || '미등록'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">관리번호</span>
              <span className="text-gray-100">{device.management_number || '미등록'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">장비연번</span>
              <span className="text-gray-100">{device.equipment_serial || '미등록'}</span>
            </div>
          </div>

          {/* 점검불가 정보 */}
          <div className="rounded-lg border border-red-800 bg-red-900/20 p-4 space-y-3">
            <div className="flex items-center gap-2 text-red-400 font-medium">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>점검불가 사유</span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">사유</span>
                <span className="text-gray-100 font-medium">{reasonLabel}</span>
              </div>

              {device.unavailable_note && (
                <div className="space-y-1">
                  <span className="text-gray-400">상세 사유</span>
                  <div className="mt-1 p-3 rounded bg-gray-950 border border-gray-800 text-gray-100">
                    {device.unavailable_note}
                  </div>
                </div>
              )}

              {device.unavailable_at && (
                <div className="flex justify-between">
                  <span className="text-gray-400">등록일시</span>
                  <span className="text-gray-100">
                    {new Date(device.unavailable_at).toLocaleString('ko-KR', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="text-sm text-gray-400 px-1">
            점검불가 상태를 취소하면 이 장비는 다시 점검 가능한 상태로 변경됩니다.
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="bg-gray-800 hover:bg-gray-700 text-gray-100 border-gray-700"
          >
            닫기
          </Button>
          <Button
            type="button"
            onClick={handleRestore}
            disabled={isSubmitting}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                처리 중...
              </span>
            ) : (
              '점검불가 취소'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
