'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { AEDDevice } from '@/packages/types/aed';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import { TeamMemberSelector } from '@/components/team/TeamMemberSelector';

interface ScheduleModalProps {
  devices: AEDDevice[];
  onClose: () => void;
  onScheduled?: (action?: 'continue' | 'view-scheduled' | 'start-inspection') => void;
}

export function ScheduleModal({ devices, onClose, onScheduled }: ScheduleModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<'confirm' | 'assign-member' | 'start-inspection' | 'success'>('confirm');
  const [addedEquipmentSerial, setAddedEquipmentSerial] = useState<string | null>(null);
  const [assignedToUserId, setAssignedToUserId] = useState<string | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showError } = useToast();

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

  const handleConfirm = () => {
    // Step 1: 확인 → Step 2: 팀원 선택으로 이동
    setStep('assign-member');
  };

  const handleAssignAndCreate = async () => {
    setIsSubmitting(true);

    try {
      // 장비 시리얼 번호 추출
      const equipmentSerials = deviceList.map(d => d.equipment_serial).filter(Boolean);

      if (equipmentSerials.length === 0) {
        throw new Error('유효한 장비 시리얼 번호가 없습니다.');
      }

      // 대량 일정추가 API 호출
      const response = await fetch('/api/inspections/assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          equipmentSerials,
          assignedTo: assignedToUserId, // null = 본인, string = 팀원 user_profile_id
          scheduledDate: new Date().toISOString().split('T')[0],
          scheduledTime: null,
          assignmentType: 'scheduled',
          priorityLevel: 0,
          notes: '일정 추가됨',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // 409 Conflict - 이미 할당된 경우 특별 처리
        if (response.status === 409) {
          // stats가 있으면 부분 성공 처리
          if (result.stats) {
            const { created, skipped } = result.stats;
            if (created > 0) {
              // 일부 성공
              console.log(`${created}개 추가됨, ${skipped}개 이미 할당됨`);
              // 성공한 것만 카운트
            } else if (skipped > 0) {
              // 모두 이미 할당됨
              console.log('모든 장비가 이미 할당되어 있습니다');
            }
          } else {
            // 단일 장비 중복
            console.log('이미 할당된 장비입니다');
          }
          // 409는 에러가 아닌 정상 처리로 간주
        } else {
          throw new Error(result.error || '일정을 저장하지 못했습니다.');
        }
      }

      // 캐시 무효화 (UI 즉시 업데이트)
      queryClient.invalidateQueries({
        queryKey: ['aed-data'],
        predicate: (query) => {
          const key = query.queryKey as any[];
          return key[0] === 'aed-data' && key[2] === 'inspection';
        }
      });

      queryClient.invalidateQueries({
        queryKey: ['aed-data'],
        predicate: (query) => {
          const key = query.queryKey as any[];
          return key[0] === 'aed-data' && key[2] === 'admin';
        }
      });

      queryClient.invalidateQueries({
        queryKey: ['scheduled-equipment']
      });

      // 단일 장비일 경우에만 점검 시작 단계로 진행
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
          equipment_serial: addedEquipmentSerial,  // snake_case로 변경 (API 요구사항과 일치)
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
    onScheduled?.('continue');
    onClose();
  };

  const handleViewScheduled = () => {
    onScheduled?.('view-scheduled');
    onClose();
  };

  const handleGoToInspection = () => {
    onScheduled?.('start-inspection');
    router.push('/inspection');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-2xl rounded-xl border border-gray-700 bg-gray-900 shadow-xl">
        <div className="px-6 py-8">
          {step === 'confirm' ? (
            // 1단계: 일정 추가 확인
            <div className="text-center">
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
                  취소
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={isSubmitting}
                  className="px-8 py-2 bg-green-600 hover:bg-green-700 text-white"
                >
                  다음
                </Button>
              </div>
            </div>
          ) : step === 'assign-member' ? (
            // 2단계: 팀원 선택 (NEW!)
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white mb-2">담당자 선택</h2>
                <p className="text-sm text-gray-400">
                  {isMultiple
                    ? `${deviceList.length}개 AED를 담당할 팀원을 선택하세요`
                    : '이 AED를 담당할 팀원을 선택하세요'}
                </p>
              </div>

              <div className="max-h-[60vh] overflow-y-auto">
                <TeamMemberSelector
                  onSelect={setAssignedToUserId}
                  defaultValue={null}
                  showSelfOption={true}
                />
              </div>

              <div className="flex gap-3 mt-6 pt-6 border-t border-gray-700">
                <Button
                  onClick={() => setStep('confirm')}
                  variant="outline"
                  className="flex-1 text-gray-300 border-gray-600 hover:bg-gray-800"
                  disabled={isSubmitting}
                >
                  이전
                </Button>
                <Button
                  onClick={handleAssignAndCreate}
                  disabled={isSubmitting}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  {isSubmitting ? '추가 중...' : '일정 추가'}
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
