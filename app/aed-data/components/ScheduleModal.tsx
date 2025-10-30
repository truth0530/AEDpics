'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { AEDDevice } from '@/packages/types/aed';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';

interface ScheduleModalProps {
  devices: AEDDevice[];
  onClose: () => void;
  onScheduled?: (action?: 'continue' | 'view-scheduled' | 'start-inspection') => void;
}

export function ScheduleModal({ devices, onClose, onScheduled }: ScheduleModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<'confirm' | 'start-inspection' | 'success'>('confirm');
  const [addedEquipmentSerial, setAddedEquipmentSerial] = useState<string | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  const deviceList = devices.length > 0 ? devices : [];
  const isMultiple = deviceList.length > 1;

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  if (deviceList.length === 0) {
    return null;
  }

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);

    try {
      // 장비 시리얼 번호 추출
      const equipmentSerials = deviceList.map(d => d.equipment_serial).filter(Boolean);

      if (equipmentSerials.length === 0) {
        throw new Error('유효한 장비 시리얼 번호가 없습니다.');
      }

      // 대량 일정추가 API 호출 (assignedTo를 생략하면 서버에서 자동으로 auth.uid()로 설정됨)
      const response = await fetch('/api/inspections/assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          equipmentSerials, // 대량 처리
          // assignedTo를 생략하여 서버에서 자동으로 현재 사용자에게 할당
          scheduledDate: new Date().toISOString().split('T')[0], // 오늘 날짜
          scheduledTime: null,
          assignmentType: 'scheduled',
          priorityLevel: 0,
          notes: '일정 추가됨',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '일정을 저장하지 못했습니다.');
      }

      // ✅ 캐시 무효화 (UI 즉시 업데이트)
      // 1. inspection 페이지 캐시 무효화
      queryClient.invalidateQueries({ 
        queryKey: ['aed-data'],
        predicate: (query) => {
          const key = query.queryKey as any[];
          return key[0] === 'aed-data' && key[2] === 'inspection';
        }
      });
      
      // 2. 일정관리 페이지(admin viewMode) 캐시 무효화
      queryClient.invalidateQueries({ 
        queryKey: ['aed-data'],
        predicate: (query) => {
          const key = query.queryKey as any[];
          return key[0] === 'aed-data' && key[2] === 'admin';
        }
      });
      
      // 3. scheduled-equipment 캐시 무효화 ("추가된일정" 탭 업데이트)
      queryClient.invalidateQueries({ 
        queryKey: ['scheduled-equipment']
      });

      // 단일 장비일 경우에만 2단계로 진행
      if (!isMultiple && equipmentSerials[0]) {
        setAddedEquipmentSerial(equipmentSerials[0]);
        setStep('start-inspection');
      } else {
        // 다중 장비일 경우 성공 모달 표시
        setStep('success');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      showError('일정 추가에 실패했습니다.', { message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartInspection = async () => {
    if (!addedEquipmentSerial) return;

    setIsSubmitting(true);
    try {
      // 점검 세션 시작
      const response = await fetch('/api/inspections/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipmentSerial: addedEquipmentSerial,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '점검 세션 시작에 실패했습니다.');
      }

      // 점검 페이지로 이동
      router.push(`/inspection/${encodeURIComponent(addedEquipmentSerial)}`);
      onClose();
      onScheduled?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      showError('점검 시작에 실패했습니다.', { message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinueAdding = () => {
    onClose();
    onScheduled?.('continue');
  };

  const handleViewScheduled = () => {
    onClose();
    onScheduled?.('view-scheduled');
  };

  const handleGoToInspection = () => {
    router.push('/inspection');
    onClose();
    onScheduled?.('start-inspection');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 shadow-xl">
        <div className="px-6 py-8 text-center">
          {step === 'confirm' ? (
            // 1단계: 일정 추가 확인
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white mb-3">일정 추가 확인</h2>
                <p className="text-base text-gray-300">
                  {isMultiple
                    ? `선택한 ${deviceList.length}개의 장비를 일정에 추가하시겠습니까?`
                    : '선택한 장비를 일정에 추가하시겠습니까?'}
                </p>
              </div>

              <div className="flex gap-3 justify-center">
                <Button
                  onClick={onClose}
                  disabled={isSubmitting}
                  variant="outline"
                  className="px-8 py-2 text-gray-300 border-gray-600 hover:bg-gray-800"
                >
                  아니오
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={isSubmitting}
                  className="px-8 py-2 bg-green-600 hover:bg-green-700 text-white"
                >
                  {isSubmitting ? '처리 중...' : '네'}
                </Button>
              </div>
            </>
          ) : step === 'start-inspection' ? (
            // 2단계: 점검 시작 확인 (단일 장비)
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white mb-3">일정에 추가되었습니다</h2>
                <p className="text-base text-gray-300">
                  바로 점검을 시작하시겠습니까?
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  onClick={handleStartInspection}
                  disabled={isSubmitting}
                  className="w-full py-3 bg-green-600 hover:bg-green-700 text-white"
                >
                  {isSubmitting ? '처리 중...' : '네, 점검화면으로 이동'}
                </Button>
                <Button
                  onClick={handleContinueAdding}
                  disabled={isSubmitting}
                  variant="outline"
                  className="w-full py-3 text-gray-300 border-gray-600 hover:bg-gray-800"
                >
                  아니오, 다른 장비 계속 추가
                </Button>
              </div>
            </>
          ) : (
            // 3단계: 성공 - 3가지 선택지 (다중 장비)
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-green-400 mb-3">일정이 추가되었습니다</h2>
                <p className="text-base text-gray-300">
                  {deviceList.length}개의 장비가 일정에 추가되었습니다
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  onClick={handleContinueAdding}
                  className="w-full py-3 bg-green-600 hover:bg-green-700 text-white"
                >
                  계속 추가
                </Button>
                <Button
                  onClick={handleViewScheduled}
                  variant="outline"
                  className="w-full py-3 text-gray-300 border-gray-600 hover:bg-gray-800"
                >
                  추가된 목록
                </Button>
                <Button
                  onClick={handleGoToInspection}
                  variant="outline"
                  className="w-full py-3 text-gray-300 border-gray-600 hover:bg-gray-800"
                >
                  현장점검
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
