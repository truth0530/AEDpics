'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { UnavailableReasonModal } from './UnavailableReasonModal';

interface QuickInspectPanelProps {
  device: AEDDevice;
  onClose: () => void;
  onRefetch?: () => void;
}

export function QuickInspectPanel({ device, onClose, onRefetch }: QuickInspectPanelProps) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showUnavailableModal, setShowUnavailableModal] = useState(false);

  const handleStartInspection = async () => {
    setIsSubmitting(true);

    try {
      const serial = device.equipment_serial || device.management_number || device.id;

      if (!serial) {
        throw new Error('장비 식별 정보가 없습니다.');
      }

      // Sessions API 사용 (스냅샷 자동 저장, 중복 체크 포함)
      const response = await fetch('/api/inspections/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          equipment_serial: serial,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));

        // 409 에러 = 이미 진행 중인 세션 존재
        if (response.status === 409 && payload.sessionId) {
          showSuccess(
            '진행 중인 점검이 있습니다.',
            { message: '기존 점검을 이어서 진행합니다.' }
          );
          setTimeout(() => {
            onClose();
            router.push(`/inspection/${encodeURIComponent(serial)}`);
          }, 300);
          return;
        }

        throw new Error(payload.error || '점검을 시작하지 못했습니다.');
      }

      await response.json().catch(() => null);

      showSuccess('점검 세션이 생성되었습니다.', { message: '점검 화면으로 이동합니다.' });

      setTimeout(() => {
        onClose();
        router.push(`/inspection/${encodeURIComponent(serial)}`);
      }, 300);
    } catch (err) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      showError('점검 시작에 실패했습니다.', { message });
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {showUnavailableModal ? (
        <UnavailableReasonModal
          device={device}
          onClose={() => setShowUnavailableModal(false)}
          onSuccess={() => {
            onRefetch?.();
            onClose();
          }}
        />
      ) : (
        <Dialog open onOpenChange={(open) => !open && !isSubmitting && onClose()}>
          <DialogContent className="bg-gray-900 border-gray-800 text-gray-100 sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-gray-100">
                점검 기록 등록
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <p className="text-sm text-gray-300">
                지금 점검기록을 등록하시겠습니까?
              </p>
              <p className="text-sm text-amber-400">
                확인을 누르면 해당 장비는 <strong>점검중</strong>으로 변경됩니다.
              </p>

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
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowUnavailableModal(true)}
                disabled={isSubmitting}
                className="bg-red-900/20 hover:bg-red-900/30 text-red-400 border-red-800 w-full sm:w-auto"
              >
                점검불가
              </Button>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-100 border-gray-700 flex-1 sm:flex-none"
                >
                  취소
                </Button>
                <Button
                  type="button"
                  onClick={handleStartInspection}
                  disabled={isSubmitting}
                  className="bg-green-600 hover:bg-green-700 text-white flex-1 sm:flex-none"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                      등록 중...
                    </span>
                  ) : (
                    '확인'
                  )}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
