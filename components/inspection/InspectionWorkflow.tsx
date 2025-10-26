'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cloneDeep, isEqual } from 'lodash';
import { useInspectionSessionStore } from '@/lib/state/inspection-session-store';
import { BasicInfoStep } from './steps/BasicInfoStep';
import { DeviceInfoStep } from './steps/DeviceInfoStep';
import { StorageChecklistStep } from './steps/StorageChecklistStep';
import { InspectionSummaryStep } from './steps/InspectionSummaryStep';
import { ValidationSummary } from './ValidationSummary';
import { showSaveSuccess, showSaveError, showSuccess, showError } from '@/utils/feedback';

const STEP_COMPONENTS = [
  BasicInfoStep,
  DeviceInfoStep,
  StorageChecklistStep,
  InspectionSummaryStep,
];

const STEP_TITLES = [
  '기본 정보 확인',
  '장비 및 소모품 점검',
  '보관함 점검',
  '점검 요약',
];

interface InspectionWorkflowProps {
  deviceSerial?: string;
  deviceData?: Record<string, unknown>;
  heading?: string;
}

export function InspectionWorkflow({ deviceSerial, deviceData, heading }: InspectionWorkflowProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const session = useInspectionSessionStore((state) => state.session);
  const currentStep = useInspectionSessionStore((state) => state.currentStep);
  const setCurrentStep = useInspectionSessionStore((state) => state.setCurrentStep);
  const persistProgress = useInspectionSessionStore((state) => state.persistProgress);
  const completeSession = useInspectionSessionStore((state) => state.completeSession);
  const cancelSessionSafely = useInspectionSessionStore((state) => state.cancelSessionSafely);
  const reopenCompletedSession = useInspectionSessionStore((state) => state.reopenCompletedSession);
  const isLoading = useInspectionSessionStore((state) => state.isLoading);
  const stepData = useInspectionSessionStore((state) => state.stepData);
  const resetSession = useInspectionSessionStore((state) => state.resetSession);

  // 📌 currentStep 검증: 유효한 범위 내인지 확인
  const validatedStep = Math.min(currentStep, STEP_COMPONENTS.length - 1);

  const [isSaving, setIsSaving] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGuidelineModal, setShowGuidelineModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [showRequiredFieldsModal, setShowRequiredFieldsModal] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [lastSavedStepData, setLastSavedStepData] = useState<Record<string, unknown>>({});

  // ✅ lastSavedStepData 초기화: 세션 로드 시 기존 step_data로 초기화
  useEffect(() => {
    if (session?.step_data && Object.keys(lastSavedStepData).length === 0) {
      console.log('[lastSavedStepData] Initializing from session.step_data:', session.step_data);
      setLastSavedStepData(session.step_data as Record<string, unknown>);
    }
  }, [session?.id]); // session.id가 변경될 때만 (새 세션 시작)

  // 🆕 완료된 세션 감지: 재점검 여부 확인
  useEffect(() => {
    if (session?.status === 'completed') {
      setShowReopenModal(true);
    }
  }, [session?.status]);

  // Auto-save mutation using React Query (must be called unconditionally)
  const saveProgressMutation = useMutation({
    mutationFn: async () => {
      await persistProgress();
    },
    onSuccess: () => {
      console.log('Progress saved successfully');
    },
    onError: (error) => {
      console.error('Failed to save progress:', error);
      // 🆕 상세 오류 메시지 등록
      const errorMessage = error instanceof Error ? error.message : '진행사항 저장에 실패했습니다.';
      setError(errorMessage);
    },
  });

  // Complete session mutation using React Query
  const completeSessionMutation = useMutation({
    mutationFn: async () => {
      await completeSession();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aed-inspections'] });
      queryClient.invalidateQueries({ queryKey: ['inspection-sessions'] });

      if (deviceSerial) {
        router.push(`/inspection/complete?serial=${deviceSerial}`);
      } else {
        router.push('/inspection');
      }
    },
    onError: (error) => {
      console.error('Failed to complete inspection:', error);
      setError('점검 완료 중 오류가 발생했습니다.');
    },
  });

  if (!session) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
        <p className="text-center text-gray-300">세션을 불러오는 중...</p>
      </div>
    );
  }

  const CurrentStepComponent = STEP_COMPONENTS[validatedStep];

  if (!CurrentStepComponent) {
    console.error(`Invalid validatedStep: ${validatedStep}, max: ${STEP_COMPONENTS.length - 1}, currentStep was: ${currentStep}`);
    // 🛡️ Fallback: 마지막 단계 표시 (안전한 폴백)
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900">
        <div className="text-center">
          <p className="text-red-400 mb-4">
            점검 단계 오류가 발생했습니다
          </p>
          <p className="text-gray-400 text-sm mb-6">
            (step: {currentStep})
          </p>
          <button
            onClick={() => {
              setCurrentStep(0);
              router.push('/inspection');
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // 필수 항목 검증 함수
  const checkRequiredFields = (step: number): string[] => {
    const missing: string[] = [];

    switch (step) {
      case 0: // BasicInfoStep
        const basicInfo = stepData.basicInfo as Record<string, any> | undefined;

        // 기본정보 검증 (수정했으면 값 필요)
        if (basicInfo?.all_matched === 'edited') {
          const fields = [
            { key: 'manager', label: '관리책임자' },
            { key: 'contact_info', label: '담당자 연락처' },
            { key: 'category_1', label: '대분류' },
            { key: 'category_2', label: '중분류' },
            { key: 'category_3', label: '소분류' }
          ];
          const emptyFields = fields.filter(f => !basicInfo[f.key]?.trim()).map(f => f.label);
          if (emptyFields.length > 0) {
            missing.push(`기본 정보 중 비어있는 항목: ${emptyFields.join(', ')}`);
          }
        }

        // 위치정보 검증
        if (basicInfo?.location_matched === 'edited') {
          if (!basicInfo.address?.trim()) {
            missing.push('주소 값이 비어있음');
          }
          if (!basicInfo.installation_position?.trim()) {
            missing.push('설치위치 값이 비어있음');
          }
        }
        break;

      case 1: // DeviceInfoStep - 장비 정보 및 소모품 확인 필수
        const deviceInfo = stepData.deviceInfo as Record<string, any> | undefined;

        // ✅ 장비 정보 검증 (all_matched가 true 또는 'edited'일 때만 통과)
        if (deviceInfo?.all_matched === true || deviceInfo?.all_matched === 'edited') {
          // 전체 일치 또는 수정됨 상태 → 필드 값도 검증
          const emptyDeviceFields = [];
          if (!deviceInfo.manufacturer?.trim()) emptyDeviceFields.push('제조사');
          if (!deviceInfo.model_name?.trim()) emptyDeviceFields.push('모델명');
          if (!deviceInfo.serial_number?.trim()) emptyDeviceFields.push('제조번호');

          if (emptyDeviceFields.length > 0) {
            missing.push(`장비 정보 중 비어있는 항목: ${emptyDeviceFields.join(', ')}`);
          }
        } else {
          // 아무 것도 하지 않음 → 필수 항목 누락
          missing.push('장비 정보 (제조사, 모델명, 제조번호) - 일치 또는 수정 확인 필요');
        }

        // ✅ 소모품 정보 검증 (개별 _matched 플래그 확인)
        const batteryMatched = deviceInfo?.battery_expiry_date_matched;
        const padMatched = deviceInfo?.pad_expiry_date_matched;
        const mfgDateMatched = deviceInfo?.manufacturing_date_matched;

        // 하나라도 확인되지 않았으면 경고
        if (!batteryMatched || batteryMatched === false) {
          missing.push('배터리 유효기간 - 일치 또는 수정 확인 필요');
        }
        if (!padMatched || padMatched === false) {
          missing.push('패드 유효기간 - 일치 또는 수정 확인 필요');
        }
        if (!mfgDateMatched || mfgDateMatched === false) {
          missing.push('제조일자 - 일치 또는 수정 확인 필요');
        }

        // 'edited' 상태인데 값이 비어있으면 경고
        if (batteryMatched === 'edited' && !deviceInfo.battery_expiry_date?.trim()) {
          missing.push('배터리 유효기간 값이 비어있음');
        }
        if (padMatched === 'edited' && !deviceInfo.pad_expiry_date?.trim()) {
          missing.push('패드 유효기간 값이 비어있음');
        }
        break;

      case 2: // StorageChecklistStep
        const storage = stepData.storage as Record<string, any> | undefined;
        
        if (!storage?.storage_type) {
          missing.push('보관함 형태');
          break;
        }
        
        // ✅ 보관함이 있는 경우, 체크리스트 항목 검증
        if (storage.storage_type !== 'none') {
          const checklistItems = storage.checklist_items || {};
          const checklistKeys = Object.keys(checklistItems);
          
          if (checklistKeys.length === 0) {
            missing.push('보관함 점검 체크리스트 항목 입력 필요');
          } else {
            // 응답되지 않은 항목 확인 (값이 undefined, null, '' 인 경우)
            const unansweredItems = checklistKeys.filter(key => {
              const value = checklistItems[key];
              return value === undefined || value === null || value === '';
            });
            
            if (unansweredItems.length > 0) {
              missing.push(`보관함 체크리스트 미응답 항목: ${unansweredItems.length}개`);
            }
          }
          
          // 안내표지 선택 검증
          const signageSelected = storage.signage_selected || [];
          if (!Array.isArray(signageSelected) || signageSelected.length === 0) {
            missing.push('보관함 안내표지 선택 필요');
          }
        }
        break;

      case 3: // InspectionSummaryStep - 검증 단계, 필수 항목 없음
        break;
    }

    return missing;
  };

  const handleNext = () => {
    if (currentStep < STEP_COMPONENTS.length - 1) {
      // ✅ 1. 필수 항목 검증
      const missing = checkRequiredFields(currentStep);
      if (missing.length > 0) {
        setMissingFields(missing);
        setShowRequiredFieldsModal(true);
        return;
      }

      // ✅ 2. 현재 단계의 데이터 변경 여부 확인
      const hasChanges = checkStepHasChanges(currentStep);

      if (hasChanges) {
        setShowSaveModal(true); // 변경사항 있으면 저장 모달 표시
      } else {
        setCurrentStep(currentStep + 1); // 변경사항 없으면 바로 다음 단계로
      }
    }
  };

  // 현재 단계에 변경사항이 있는지 확인
  const checkStepHasChanges = (step: number): boolean => {
    const currentStepKey = ['basicInfo', 'deviceInfo', 'storage', 'summary'][step];
    const currentData = stepData[currentStepKey];
    const savedData = lastSavedStepData[currentStepKey];

    // 🔍 디버깅 로그
    console.log(`[checkStepHasChanges] Step ${step} (${currentStepKey})`);
    console.log('  Current:', currentData);
    console.log('  Saved:', savedData);

    // ✅ 저장된 데이터와 현재 데이터를 비교
    // - 저장된 데이터가 없으면: 데이터 존재 여부로 판단
    // - 저장된 데이터가 있으면: lodash isEqual로 깊은 비교

    if (!savedData) {
      // 저장된 적이 없음 → 현재 데이터가 있으면 변경사항으로 간주
      const hasData = currentData && Object.keys(currentData).length > 0;
      console.log(`  No saved data. Has current data: ${hasData}`);
      return hasData;
    }

    // 저장된 데이터가 있음 → lodash isEqual로 깊은 비교 (속성 순서 무관)
    const hasChanges = !isEqual(currentData, savedData);
    console.log(`  Has changes: ${hasChanges}`);
    return hasChanges;
  };


  const handleNextWithSave = async () => {
    setShowSaveModal(false);
    setIsSaving(true);
    setError(null);
    try {
      await saveProgressMutation.mutateAsync();
      // ✅ 저장 성공 시 현재 stepData를 깊은 복사로 저장
      setLastSavedStepData(cloneDeep(stepData));
      showSaveSuccess();
      setCurrentStep(currentStep + 1);
    } catch (error) {
      console.error('Save failed:', error);
      // 🆕 상세 오류 메시지 등록
      const message = error instanceof Error ? error.message : '저장에 실패했습니다.';
      setError(message);
      showSaveError(error instanceof Error ? error : new Error(message));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await saveProgressMutation.mutateAsync();
      // ✅ 저장 성공 시 현재 stepData를 깊은 복사로 저장
      setLastSavedStepData(cloneDeep(stepData));
      showSaveSuccess();
    } catch (error) {
      console.error('Save failed:', error);
      // 🆕 상세 오류 메시지 등록
      const message = error instanceof Error ? error.message : '저장에 실패했습니다.';
      setError(message);
      showSaveError(error instanceof Error ? error : new Error(message));
    } finally {
      setIsSaving(false);
    }
  };

  const handleComplete = async () => {
    // ✅ 최종 검증: 모든 단계의 필수 항목 체크
    const allMissingFields: string[] = [];

    for (let step = 0; step < STEP_COMPONENTS.length - 1; step++) { // 마지막 단계(documentation) 제외
      const missing = checkRequiredFields(step);
      if (missing.length > 0) {
        allMissingFields.push(`[Step ${step + 1}] ${missing.join(', ')}`);
      }
    }

    if (allMissingFields.length > 0) {
      setMissingFields(allMissingFields);
      setShowRequiredFieldsModal(true);
      setError('필수 항목이 입력되지 않았습니다. 해당 단계로 돌아가서 입력해주세요.');
      return;
    }

    if (!confirm('점검을 완료하시겠습니까? 완료 후에는 수정할 수 없습니다.')) {
      return;
    }

    setIsCompleting(true);
    setError(null);
    try {
      await completeSessionMutation.mutateAsync();
      queryClient.invalidateQueries({ queryKey: ['inspection-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['inspection-assignments'] });
      showSuccess('점검이 완료되었습니다');
      // 📌 완료 후 안전한 클린업: currentStep을 리셋하고 약간의 딜레이 후 이동
      setCurrentStep(0);
      // 100ms의 딜레이를 두어 상태 업데이트 완료 후 이동
      setTimeout(() => {
        router.push('/inspection');
      }, 100);
    } catch (error) {
      console.error('Failed to complete session:', error);

      // 🔍 상세한 에러 메시지 구성
      let message = '점검을 완료하지 못했습니다.';
      let details = '';

      if (error instanceof Error) {
        message = error.message;
        // 백엔드에서 상세 에러 정보가 있으면 포함
        if ((error as any).details) {
          details = (error as any).details;
        }
      }

      // 상세 정보가 있으면 함께 표시
      const fullMessage = details ? `${message}\n\n(상세: ${details})` : message;

      setError(fullMessage);
      showError(fullMessage);
    } finally {
      setIsCompleting(false);
    }
  };

  const handleClose = () => {
    // Always show the close/cancel session modal when close button is clicked
    setShowCancelModal(true);
  };

  const handleCloseWithSave = async () => {
    setShowCloseModal(false);
    setIsSaving(true);
    setError(null);
    try {
      await saveProgressMutation.mutateAsync();
      showSaveSuccess('저장 후 닫기가 완료되었습니다');
      resetSession();
      router.push('/inspection');
    } catch (error) {
      console.error('Failed to save before closing:', error);
      // 🆕 상세 오류 메시지 등록
      const message = error instanceof Error ? error.message : '저장에 실패했습니다.';
      setError(message);
      showSaveError(error instanceof Error ? error : new Error(message));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseWithoutSave = () => {
    setShowCloseModal(false);
    resetSession();
    router.push('/inspection');
  };

  // 🆕 중간저장후 닫기 (세션 상태를 '점검중'으로 유지)
  const handleSaveAndClose = async () => {
    setShowCancelModal(false);
    setIsSaving(true);
    setError(null);

    try {
      // 데이터만 저장하고 세션은 유지 (점검중 상태 유지)
      await saveProgressMutation.mutateAsync();
      showSaveSuccess('중간저장 후 닫기가 완료되었습니다');
      // ✅ resetSession() 호출하지 않음 - 세션을 '점검중' 상태로 유지
      router.push('/inspection');
    } catch (error) {
      console.error('Failed to save before closing:', error);
      const message = error instanceof Error ? error.message : '저장에 실패했습니다.';
      setError(message);
      showSaveError(error instanceof Error ? error : new Error(message));
    } finally {
      setIsSaving(false);
    }
  };

  // 🆕 점검 취소 핸들러
  const handleCancelSession = async () => {
    setShowCancelModal(false);
    setIsCancelling(true);
    setError(null);

    try {
      await cancelSessionSafely();
      queryClient.invalidateQueries({ queryKey: ['inspection-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['inspection-assignments'] });
      showSuccess('점검이 취소되었습니다. 데이터는 보관되었습니다.');
      router.push('/inspection');
    } catch (error) {
      console.error('Failed to cancel session:', error);
      const message = error instanceof Error ? error.message : '세션 취소에 실패했습니다.';
      setError(message);
      showError(message);
    } finally {
      setIsCancelling(false);
    }
  };

  const isFirstStep = validatedStep === 0;
  const isLastStep = validatedStep === STEP_COMPONENTS.length - 1;

  // 🆕 재개 핸들러
  const handleReopenSession = async () => {
    setShowReopenModal(false);
    setIsReopening(true);
    setError(null);
    try {
      await reopenCompletedSession();
      showSuccess('점검 세션이 재개되었습니다. 수정 사항을 다시 확인해주세요.');
    } catch (error) {
      console.error('Failed to reopen session:', error);
      const message = error instanceof Error ? error.message : '세션 재개에 실패했습니다.';
      setError(message);
      showError(message);
    } finally {
      setIsReopening(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Reopen Completed Session Modal */}
      {showReopenModal && session?.status === 'completed' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-white mb-4">✅ 완료된 점검입니다</h3>
            <p className="text-gray-300 mb-4 text-sm">
              이 점검 기록을 수정하려면 "재점검 시작"을 누르세요.
            </p>
            <p className="text-gray-400 mb-6 text-xs">
              재점검을 통해 모든 내용을 다시 확인하고 수정할 수 있습니다.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleReopenSession}
                disabled={isReopening}
                className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isReopening ? '재점검 시작 중...' : '재점검 시작'}
              </button>
              <button
                onClick={() => {
                  setShowReopenModal(false);
                  router.push('/inspection');
                }}
                disabled={isReopening}
                className="w-full px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                돌아가기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Confirmation Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-white mb-4">저장하지 않은 데이터가 있습니다</h3>
            <p className="text-gray-300 mb-6 text-sm">
              중간 저장 후 다음 단계로 넘어가겠습니까?
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleNextWithSave}
                className="w-full px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                저장 후 이동
              </button>
              <button
                onClick={() => setShowSaveModal(false)}
                className="w-full px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Confirmation Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-white mb-4">입력한 데이터가 있습니다</h3>
            <p className="text-gray-300 mb-6 text-sm">
              어떻게 처리하시겠습니까?
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleCloseWithSave}
                disabled={isSaving}
                className="w-full px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isSaving ? '저장 중...' : '저장 후 닫기'}
              </button>
              <button
                onClick={handleCloseWithoutSave}
                disabled={isSaving}
                className="w-full px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                저장하지 않고 닫기
              </button>
              <button
                onClick={() => setShowCloseModal(false)}
                disabled={isSaving}
                className="w-full px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Session Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-white mb-4">⚠️ 점검 세션 닫기</h3>
            <p className="text-gray-300 mb-2 text-sm">
              점검을 중단하시겠습니까?
            </p>
            <p className="text-yellow-300 mb-6 text-sm">
              • 취소를 누르면 점검중이던 세션이 종료됩니다. (세션 상태'취소됨'으로 변경)<br/>
              • 중간저장후 닫기를 누르면 '점검중'으로 변경
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleCancelSession}
                disabled={isCancelling || isSaving}
                className="w-full px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isCancelling ? '취소 처리 중...' : '점검취소하기'}
              </button>
              <button
                onClick={handleSaveAndClose}
                disabled={isCancelling || isSaving}
                className="w-full px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isSaving ? '저장 중...' : '중간저장후 닫기'}
              </button>
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={isCancelling || isSaving}
                className="w-full px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                점검 계속하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Required Fields Warning Modal */}
      {showRequiredFieldsModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-white mb-4">⚠️ 필수 항목 미입력</h3>
            <p className="text-gray-300 mb-3 text-sm">
              다음 항목을 입력하지 않았습니다:
            </p>
            <ul className="list-disc list-inside mb-6 text-yellow-300 text-sm space-y-1">
              {missingFields.map((field, idx) => (
                <li key={idx}>{field}</li>
              ))}
            </ul>
            <p className="text-gray-400 mb-6 text-xs">
              필수 항목을 입력하지 않고 다음 단계로 넘어가시겠습니까?
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setShowRequiredFieldsModal(false)}
                className="w-full px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                입력하기 (이 화면에 남기)
              </button>
              <button
                onClick={() => {
                  setShowRequiredFieldsModal(false);
                  setCurrentStep(currentStep + 1);
                }}
                className="w-full px-4 py-2.5 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                무시하고 다음 단계로
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guideline Modal */}
      {showGuidelineModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">AED 점검 지침</h2>
              <button
                onClick={() => setShowGuidelineModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4 text-gray-300">
              <section>
                <h3 className="text-lg font-semibold text-white mb-2">1. 기본 정보 확인</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>관리번호, 제조번호, 설치기관이 일치하는지 확인</li>
                  <li>장치의 외관 상태를 육안으로 검사</li>
                </ul>
              </section>
              <section>
                <h3 className="text-lg font-semibold text-white mb-2">2. 장비 정보 점검</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>모델명과 제조사가 기록과 일치하는지 확인</li>
                  <li>장치 표시등이 정상 작동하는지 확인</li>
                </ul>
              </section>
              <section>
                <h3 className="text-lg font-semibold text-white mb-2">3. 위치 검증</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>설치 위치가 접근 가능하고 눈에 잘 띄는지 확인</li>
                  <li>위치 안내 표지판이 설치되어 있는지 확인</li>
                </ul>
              </section>
              <section>
                <h3 className="text-lg font-semibold text-white mb-2">4. 보관함 점검</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>보관함이 손상되지 않았는지 확인</li>
                  <li>보관함 잠금장치가 정상 작동하는지 확인</li>
                  <li>온도와 습도가 적정 범위 내에 있는지 확인</li>
                </ul>
              </section>
              <section>
                <h3 className="text-lg font-semibold text-white mb-2">5. 소모품 확인</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>배터리 유효기간을 확인하고 만료 여부 점검</li>
                  <li>패드 유효기간을 확인하고 만료 여부 점검</li>
                  <li>소모품이 훼손되지 않았는지 확인</li>
                </ul>
              </section>
              <section>
                <h3 className="text-lg font-semibold text-white mb-2">6. 사진 촬영</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>AED 전체 사진 촬영</li>
                  <li>배터리 및 패드 유효기간 표시 촬영</li>
                  <li>특이사항이 있는 경우 해당 부분 촬영</li>
                </ul>
              </section>
              <div className="pt-4 border-t border-gray-700">
                <p className="text-sm text-gray-400">
                  ※ 점검 중 이상이 발견되면 즉시 관리자에게 보고하세요.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header with Guidelines Button */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          <h1 className="text-base sm:text-2xl font-semibold text-white whitespace-nowrap">
            {deviceData?.installation_institution || deviceData?.installation_org || '장비 정보'}
          </h1>
          <div className="flex items-center gap-1 text-[10px] sm:text-sm text-gray-400">
            <span className="whitespace-nowrap">| 관리번호 {deviceData?.management_number || '-'} |</span>
            <span className="whitespace-nowrap">장비연번 {deviceData?.equipment_serial || deviceData?.serial_number || '-'}</span>
          </div>
        </div>
        <button
          onClick={() => setShowGuidelineModal(true)}
          className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded-md transition-colors flex-shrink-0 whitespace-nowrap"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          지침보기
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="rounded-lg bg-red-900/20 border border-red-500/30 p-4">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Progress Indicator */}
      <div className="flex space-x-2">
        {STEP_TITLES.map((title, index) => (
          <div
            key={index}
            className={`flex-1 ${
              index === validatedStep
                ? 'border-b-2 border-green-400'
                : index < validatedStep
                ? 'border-b-2 border-green-500'
                : 'border-b-2 border-gray-600'
            }`}
            title={title}
          >
            <button
              type="button"
              onClick={() => setCurrentStep(index)}
              disabled={index > validatedStep}
              className={`w-full py-1.5 text-xs ${
                index === validatedStep
                  ? 'font-semibold text-green-400'
                  : index < validatedStep
                  ? 'text-green-400'
                  : 'text-gray-500'
              }`}
            >
              {index + 1}
            </button>
          </div>
        ))}
      </div>

      {/* Validation Summary - Only on First Step */}
      {validatedStep === 0 && deviceData && (
        <ValidationSummary deviceData={deviceData} />
      )}

      {/* Current Step Content */}
      <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <h3 className="text-lg font-semibold text-white">{STEP_TITLES[validatedStep]}</h3>
          {validatedStep === 0 && (
            <span className="text-[10px] sm:text-xs text-green-400 whitespace-nowrap">| 일치하면 "전체 일치", 수정이 필요하면 "수정" 버튼을 누르세요.</span>
          )}
        </div>
        <CurrentStepComponent />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800 p-3">
        {isFirstStep ? (
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading || isSaving}
            className="rounded px-4 py-2 text-sm font-medium transition-colors bg-gray-600 text-white hover:bg-gray-500 disabled:opacity-50"
          >
            닫기
          </button>
        ) : (
          <button
            type="button"
            onClick={handlePrevious}
            disabled={isLoading}
            className="rounded px-4 py-2 text-sm font-medium transition-colors bg-gray-600 text-white hover:bg-gray-500 disabled:opacity-50 whitespace-nowrap"
          >
            이전
          </button>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isLoading || isSaving || isCancelling}
            className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 whitespace-nowrap"
          >
            {isSaving ? '저장 중...' : '중간저장'}
          </button>

          {isLastStep ? (
            <button
              type="button"
              onClick={handleComplete}
              disabled={isLoading || isCompleting || isCancelling}
              className="rounded bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 whitespace-nowrap"
            >
              {isCompleting ? '완료 처리 중...' : '완료'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              disabled={isLoading || isCancelling}
              className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 whitespace-nowrap"
            >
              다음
            </button>
          )}
        </div>
      </div>

      {/* Auto-save indicator */}
      {(saveProgressMutation.isPending || isSaving) && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-3 py-2 rounded-lg text-sm shadow-lg">
          자동 저장 중...
        </div>
      )}
    </div>
  );
}