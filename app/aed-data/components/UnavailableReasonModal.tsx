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

interface UnavailableReasonModalProps {
  device: AEDDevice;
  onClose: () => void;
  onSuccess: () => void;
}

type UnavailableReason = 'disposed' | 'broken' | 'other';

const REASON_OPTIONS: { value: UnavailableReason; label: string; description: string }[] = [
  {
    value: 'disposed',
    label: '폐기장비',
    description: '폐기신청 권고 후 새올행정시스템 폐기처리 필요',
  },
  {
    value: 'broken',
    label: '고장/수리',
    description: '장비 고장 또는 수리 중인 경우',
  },
  {
    value: 'other',
    label: '기타',
    description: '기타 사유 (직접 입력)',
  },
];

export function UnavailableReasonModal({ device, onClose, onSuccess }: UnavailableReasonModalProps) {
  const { showSuccess, showError } = useToast();
  const [selectedReason, setSelectedReason] = useState<UnavailableReason | null>(null);
  const [customNote, setCustomNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) {
      showError('사유를 선택해주세요.', { message: '점검불가 사유는 필수입니다.' });
      return;
    }

    if (selectedReason === 'other' && !customNote.trim()) {
      showError('기타 사유를 입력해주세요.', { message: '상세 사유는 필수입니다.' });
      return;
    }

    setIsSubmitting(true);

    try {
      const serial = device.equipment_serial || device.management_number || device.id;

      if (!serial) {
        throw new Error('장비 식별 정보가 없습니다.');
      }

      const response = await fetch('/api/inspections/mark-unavailable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          equipmentSerial: serial,
          reason: selectedReason,
          note: selectedReason === 'other' ? customNote.trim() : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '점검불가 상태 변경에 실패했습니다.');
      }

      showSuccess('점검불가 처리 완료', { message: data.message || '해당 장비는 점검불가 상태로 변경되었습니다.' });
      onSuccess();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      showError('점검불가 처리 실패', { message });
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="bg-gray-900 border-gray-800 text-gray-100 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-gray-100">
            점검불가 사유 선택
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-400">
            해당 장비를 점검할 수 없는 사유를 선택해주세요.
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

          {/* 사유 선택 */}
          <div className="space-y-3">
            {REASON_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`block rounded-lg border p-4 cursor-pointer transition-colors ${
                  selectedReason === option.value
                    ? 'border-green-600 bg-green-900/20'
                    : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                }`}
              >
                <input
                  type="radio"
                  name="reason"
                  value={option.value}
                  checked={selectedReason === option.value}
                  onChange={(e) => setSelectedReason(e.target.value as UnavailableReason)}
                  disabled={isSubmitting}
                  className="sr-only"
                />
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-1 h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      selectedReason === option.value
                        ? 'border-green-600 bg-green-600'
                        : 'border-gray-500'
                    }`}
                  >
                    {selectedReason === option.value && (
                      <div className="h-2 w-2 rounded-full bg-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-white">{option.label}</div>
                    <div className="text-sm text-gray-400 mt-1">{option.description}</div>
                  </div>
                </div>
              </label>
            ))}
          </div>

          {/* 기타 사유 입력 */}
          {selectedReason === 'other' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                상세 사유 <span className="text-red-400">*</span>
              </label>
              <textarea
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                disabled={isSubmitting}
                placeholder="점검불가 사유를 상세히 입력해주세요..."
                className="w-full min-h-[100px] px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent disabled:opacity-50"
                maxLength={500}
              />
              <div className="text-xs text-gray-500 text-right">
                {customNote.length} / 500
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="bg-gray-800 hover:bg-gray-700 text-gray-100 border-gray-700"
          >
            취소
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedReason}
            className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                처리 중...
              </span>
            ) : (
              '점검불가 처리'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
