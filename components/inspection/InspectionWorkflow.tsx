'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isEqual } from 'lodash';
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

/**
 * 페이지 상단으로 스크롤 (구형 브라우저 호환성 포함)
 */
const scrollToTop = () => {
  try {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) {
    // 폴백: behavior 미지원 브라우저 (IE11 등)
    window.scrollTo(0, 0);
  }
};

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
  const lastSavedStepData = useInspectionSessionStore((state) => state.lastSavedStepData); // 🆕 store에서 가져옴
  const resetSession = useInspectionSessionStore((state) => state.resetSession);

  // 📌 currentStep 검증: 유효한 범위 내인지 확인 (음수 및 최대값 방지)
  const validatedStep = Math.max(0, Math.min(currentStep, STEP_COMPONENTS.length - 1));

  const [isSaving, setIsSaving] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGuidelineModal, setShowGuidelineModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [showRequiredFieldsModal, setShowRequiredFieldsModal] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);

  // 🎯 통합 로딩 상태: 모든 버튼 disabled 로직 통일
  const isBusy = isLoading || isSaving || isCompleting || isCancelling || isReopening;

  // 🆕 완료된 세션 감지: 재점검 여부 확인
  useEffect(() => {
    if (session?.status === 'completed') {
      setShowReopenModal(true);
    } else {
      setShowReopenModal(false);
    }
  }, [session?.status, session?.id]); // ✅ session.id 변경 시에도 재실행

  // Auto-save mutation using React Query (must be called unconditionally)
  const saveProgressMutation = useMutation({
    mutationFn: async () => {
      await persistProgress();
    },
    onSuccess: () => {
      console.log('Progress saved successfully');
      // ✅ lastSavedStepData는 이제 store의 persistProgress에서 자동 업데이트
    },
    onError: (error) => {
      console.error('Failed to save progress:', error);
      // ⚠️ setError는 호출하는 쪽(catch 블록)에서 처리하므로 로깅만 수행
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
      queryClient.invalidateQueries({ queryKey: ['inspection-assignments'] });

      showSuccess('점검이 완료되었습니다');

      if (deviceSerial) {
        router.push(`/inspection/complete?serial=${deviceSerial}`);
      } else {
        router.push('/inspection');
      }
    },
    onError: (error) => {
      console.error('Failed to complete inspection:', error);
      const errorMessage = error instanceof Error ? error.message : '점검 완료 중 오류가 발생했습니다.';
      setError(errorMessage);
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
      scrollToTop(); // 🆕 단계 전환 시 상단으로 스크롤
    }
  };

  // 미입력 필드로 자동 포커스 이동
  const focusFirstMissingField = () => {
    try {
      const stepData = useInspectionSessionStore.getState().stepData;

      if (currentStep === 0) {
        // BasicInfoStep
        const basicInfo = stepData.basicInfo as Record<string, any> | undefined;

        // all_matched 체크 안됨
        if (!basicInfo?.all_matched) {
          const radioButton = document.querySelector('input[name="all_matched"]') as HTMLInputElement;
          if (radioButton) {
            radioButton.focus();
            radioButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          return;
        }

      // location_matched 체크 안됨
      if (!basicInfo?.location_matched) {
        const radioButton = document.querySelector('input[name="location_matched"]') as HTMLInputElement;
        if (radioButton) {
          radioButton.focus();
          radioButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }

      // 수정 모드에서 빈 필드 찾기
      if (basicInfo?.all_matched === 'edited') {
        const fields = ['manager', 'contact_info', 'category_1', 'category_2', 'category_3'];
        for (const field of fields) {
          if (!basicInfo[field]?.trim()) {
            const input = document.querySelector(`input[name="${field}"], select[name="${field}"]`) as HTMLElement;
            if (input) {
              input.focus();
              input.scrollIntoView({ behavior: 'smooth', block: 'center' });
              return;
            }
          }
        }
      }

      if (basicInfo?.location_matched === 'edited') {
        if (!basicInfo.address?.trim()) {
          const input = document.querySelector('input[name="address"]') as HTMLInputElement;
          if (input) {
            input.focus();
            input.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          return;
        }
      }
    } else if (currentStep === 1) {
      // DeviceInfoStep
      const deviceInfo = stepData.deviceInfo as Record<string, any> | undefined;

      // all_matched 체크 안됨
      if (!deviceInfo?.all_matched) {
        const radioButton = document.querySelector('input[name="device_all_matched"]') as HTMLInputElement;
        if (radioButton) {
          radioButton.focus();
          radioButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }

      // 소모품 체크 안됨
      if (!deviceInfo?.battery_expiry_date_matched) {
        const radioButton = document.querySelector('input[name="battery_expiry_date_matched"]') as HTMLInputElement;
        if (radioButton) {
          radioButton.focus();
          radioButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }

      if (!deviceInfo?.pad_expiry_date_matched) {
        const radioButton = document.querySelector('input[name="pad_expiry_date_matched"]') as HTMLInputElement;
        if (radioButton) {
          radioButton.focus();
          radioButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }
    }
    } catch (error) {
      // 브라우저 확장 프로그램 오류 무시 (예: 비밀번호 관리자)
      console.log('[focusFirstMissingField] Error ignored:', error);
    }
  };

  // 필수 항목 검증 함수
  const checkRequiredFields = (step: number): string[] => {
    const missing: string[] = [];

    switch (step) {
      case 0: // BasicInfoStep
        const basicInfo = stepData.basicInfo as Record<string, any> | undefined;

        // 필수: all_matched 체크 여부 확인 (true 또는 'edited' 모두 완료로 간주)
        if (basicInfo?.all_matched !== true && basicInfo?.all_matched !== 'edited') {
          missing.push('기본 정보 - 일치 여부를 확인해주세요');
        }

        // ✅ 'edited' 상태일 때 빈 값 체크
        if (basicInfo?.all_matched === 'edited') {
          const emptyBasicFields = [];
          if (!basicInfo.manager?.trim()) emptyBasicFields.push('담당자명');
          if (!basicInfo.contact_info?.trim()) emptyBasicFields.push('연락처');
          if (!basicInfo.category_1?.trim()) emptyBasicFields.push('설치장소(대)');
          if (!basicInfo.category_2?.trim()) emptyBasicFields.push('설치장소(중)');
          if (!basicInfo.category_3?.trim()) emptyBasicFields.push('설치장소(소)');

          if (emptyBasicFields.length > 0) {
            missing.push(`기본 정보 중 비어있는 항목: ${emptyBasicFields.join(', ')}`);
          }
        }

        // 필수: location_matched 체크 여부 확인 (true 또는 'edited' 모두 완료로 간주)
        if (basicInfo?.location_matched !== true && basicInfo?.location_matched !== 'edited') {
          missing.push('위치 정보 - 일치 여부를 확인해주세요');
        }

        // ✅ 위치 수정 시 주소 체크
        if (basicInfo?.location_matched === 'edited' && !basicInfo.address?.trim()) {
          missing.push('주소가 비어있음');
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

        // ✅ 소모품 정보 검증 (개별 _matched 플래그 확인, true 또는 'edited' 모두 완료로 간주)
        const batteryMatched = deviceInfo?.battery_expiry_date_matched;
        const padMatched = deviceInfo?.pad_expiry_date_matched;
        const mfgDateMatched = deviceInfo?.manufacturing_date_matched;

        // 하나라도 확인되지 않았으면 경고 (true 또는 'edited'가 아니면 미확인)
        if (batteryMatched !== true && batteryMatched !== 'edited') {
          missing.push('배터리 유효기간 - 일치 또는 수정 확인 필요');
        }
        if (padMatched !== true && padMatched !== 'edited') {
          missing.push('패드 유효기간 - 일치 또는 수정 확인 필요');
        }
        if (mfgDateMatched !== true && mfgDateMatched !== 'edited') {
          missing.push('제조일자 - 일치 또는 수정 확인 필요');
        }

        // 'edited' 상태인데 값이 비어있으면 경고
        if (batteryMatched === 'edited' && !deviceInfo.battery_expiry_date?.trim()) {
          missing.push('배터리 유효기간 값이 비어있음');
        }
        if (padMatched === 'edited' && !deviceInfo.pad_expiry_date?.trim()) {
          missing.push('패드 유효기간 값이 비어있음');
        }
        if (mfgDateMatched === 'edited' && !deviceInfo.manufacturing_date?.trim()) {
          missing.push('제조일자 값이 비어있음');
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

  const handleNext = async () => {
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

      // ✅ 3. Step 0에서 '일치' 또는 '수정' 확인 후 → 자동 저장
      if (currentStep === 0 && hasChanges) {
        const basicInfo = stepData.basicInfo as Record<string, any> | undefined;
        const isConfirmed = basicInfo?.all_matched === true || basicInfo?.all_matched === 'edited';
        const isLocationConfirmed = basicInfo?.location_matched === true || basicInfo?.location_matched === 'edited';

        if (isConfirmed && isLocationConfirmed) {
          // 사용자가 이미 '일치' 또는 '수정'을 확인함 → 경고 없이 자동 저장
          setIsSaving(true);
          setError(null);
          try {
            await saveProgressMutation.mutateAsync();
            showSaveSuccess();
            const latestStep = useInspectionSessionStore.getState().currentStep;
            setCurrentStep(latestStep + 1);
            scrollToTop();
          } catch (error) {
            console.error('Save failed:', error);
            const message = error instanceof Error ? error.message : '저장에 실패했습니다.';
            setError(message);
            showError(message);
          } finally {
            setIsSaving(false);
          }
          return;
        }
      }

      // ✅ 4. 다른 Step이거나 확인되지 않은 경우 → 저장 모달 표시
      if (hasChanges) {
        setShowSaveModal(true);
      } else {
        setCurrentStep(currentStep + 1);
        scrollToTop();
      }
    }
  };

  /**
   * 현재 단계의 데이터 변경 여부 확인
   *
   * ⚠️ 주의사항:
   * - stepData에는 순수 점검 데이터만 저장할 것
   * - UI 상태(isOpen, _validated 등)나 임시 필드 저장 금지
   * - 저장된 적 없으면: 데이터 존재 여부로 판단
   * - 저장된 데이터 있으면: lodash isEqual로 깊은 비교
   *
   * @param step - 단계 번호 (0-based)
   * @returns 변경사항 있으면 true
   */
  const checkStepHasChanges = (step: number): boolean => {
    const currentStepKey = ['basicInfo', 'deviceInfo', 'storage', 'documentation'][step];
    const currentData = stepData[currentStepKey];
    const savedData = lastSavedStepData[currentStepKey];

    // 🔍 개발 환경에서만 디버깅 로그 출력
    if (process.env.NODE_ENV === 'development') {
      console.log(`[checkStepHasChanges] Step ${step} (${currentStepKey})`);
      console.log('  Current:', currentData);
      console.log('  Saved:', savedData);
    }

    // ✅ 저장된 데이터와 현재 데이터를 비교
    // - 저장된 데이터가 없으면: 데이터 존재 여부로 판단
    // - 저장된 데이터가 있으면: lodash isEqual로 깊은 비교

    if (!savedData) {
      // 저장된 적이 없음 → 현재 데이터가 있으면 변경사항으로 간주
      const hasData = currentData && Object.keys(currentData).length > 0;
      if (process.env.NODE_ENV === 'development') {
        console.log(`  No saved data. Has current data: ${hasData}`);
      }
      return hasData;
    }

    // 저장된 데이터가 있음 → lodash isEqual로 깊은 비교 (속성 순서 무관)
    const hasChanges = !isEqual(currentData, savedData);
    if (process.env.NODE_ENV === 'development') {
      console.log(`  Has changes: ${hasChanges}`);
    }
    return hasChanges;
  };


  const handleNextWithSave = async () => {
    setShowSaveModal(false);
    setIsSaving(true);
    setError(null);
    try {
      await saveProgressMutation.mutateAsync();
      showSaveSuccess();
      // ✅ Stale closure 방지: 최신 currentStep 값 가져오기
      const latestStep = useInspectionSessionStore.getState().currentStep;
      setCurrentStep(latestStep + 1);
      scrollToTop(); // 🆕 단계 전환 시 상단으로 스크롤
    } catch (error) {
      console.error('Save failed:', error);
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
      showSaveSuccess();
    } catch (error) {
      console.error('Save failed:', error);
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

  // 🆕 중간저장후 닫기 (세션 상태를 '점검중'으로 유지)
  const handleSaveAndClose = async () => {
    setShowCancelModal(false);
    setIsSaving(true);
    setError(null);

    try {
      // 데이터만 저장하고 세션은 유지 (점검중 상태 유지)
      await saveProgressMutation.mutateAsync();
      showSaveSuccess('중간저장 후 닫기가 완료되었습니다');
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
                disabled={isBusy}
                className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isReopening ? '재점검 시작 중...' : '재점검 시작'}
              </button>
              <button
                onClick={() => {
                  setShowReopenModal(false);
                  router.push('/inspection');
                }}
                disabled={isBusy}
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
            <h3 className="text-lg font-semibold text-white mb-4">입력한 내용을 저장하시겠습니까?</h3>
            <p className="text-gray-300 mb-6 text-sm">
              저장 후 다음 단계로 이동합니다.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleNextWithSave}
                disabled={isBusy}
                className="w-full px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isSaving ? '저장 중...' : '저장 후 이동'}
              </button>
              <button
                onClick={() => setShowSaveModal(false)}
                disabled={isBusy}
                className="w-full px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                돌아가기
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
                disabled={isBusy}
                className="w-full px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isCancelling ? '취소 처리 중...' : '점검취소하기'}
              </button>
              <button
                onClick={handleSaveAndClose}
                disabled={isBusy}
                className="w-full px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isSaving ? '저장 중...' : '중간저장후 닫기'}
              </button>
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={isBusy}
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
              필수 항목을 입력해야 다음 단계로 진행할 수 있습니다.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setShowRequiredFieldsModal(false);
                  // 미입력 필드로 자동 포커스 이동
                  setTimeout(() => {
                    focusFirstMissingField();
                  }, 100);
                }}
                className="w-full px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                입력하기 (미입력 항목으로 이동)
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
            {(deviceData?.installation_institution || deviceData?.installation_org || '장비 정보') as React.ReactNode}
          </h1>
          <div className="flex items-center gap-1 text-[10px] sm:text-sm text-gray-400">
            <span className="whitespace-nowrap">| 관리번호 {(deviceData?.management_number || '-') as React.ReactNode} |</span>
            <span className="whitespace-nowrap">장비연번 {(deviceData?.equipment_serial || deviceData?.serial_number || '-') as React.ReactNode}</span>
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
              disabled={index > validatedStep || isBusy}
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
            disabled={isBusy}
            className="rounded px-4 py-2 text-sm font-medium transition-colors bg-gray-600 text-white hover:bg-gray-500 disabled:opacity-50"
          >
            닫기
          </button>
        ) : (
          <button
            type="button"
            onClick={handlePrevious}
            disabled={isBusy}
            className="rounded px-4 py-2 text-sm font-medium transition-colors bg-gray-600 text-white hover:bg-gray-500 disabled:opacity-50 whitespace-nowrap"
          >
            이전
          </button>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isBusy}
            className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 whitespace-nowrap"
          >
            {isSaving ? '저장 중...' : '중간저장'}
          </button>

          {isLastStep ? (
            <button
              type="button"
              onClick={handleComplete}
              disabled={isBusy}
              className="rounded bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 whitespace-nowrap"
            >
              {isCompleting ? '완료 처리 중...' : '완료'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              disabled={isBusy}
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