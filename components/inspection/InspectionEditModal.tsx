'use client';

import { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useInspectionSessionStore } from '@/lib/state/inspection-session-store';
import { BasicInfoStep } from './steps/BasicInfoStep';
import { DeviceInfoStep } from './steps/DeviceInfoStep';
import { StorageChecklistStep } from './steps/StorageChecklistStep';
import { ManagerEducationStep } from './steps/ManagerEducationStep';
import { InspectionSummaryStep } from './steps/InspectionSummaryStep';
import type { InspectionHistory } from '@/lib/inspections/session-utils';

interface InspectionEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  inspection: InspectionHistory | null;
  onSave?: (inspectionId: string, updates: Partial<InspectionHistory>) => Promise<void>;
}

const STEP_COMPONENTS = [
  BasicInfoStep,
  DeviceInfoStep,
  StorageChecklistStep,
  ManagerEducationStep,
  InspectionSummaryStep,
];

const STEP_TITLES = [
  '1단계: 기본정보',
  '2단계: 장비정보',
  '3단계: 보관함',
  '4단계: 관리책임자 교육',
  '5단계: 점검요약',
];

export function InspectionEditModal({
  isOpen,
  onClose,
  inspection,
  onSave,
}: InspectionEditModalProps) {
  const currentStep = useInspectionSessionStore((state) => state.currentStep);
  const setCurrentStep = useInspectionSessionStore((state) => state.setCurrentStep);
  const stepData = useInspectionSessionStore((state) => state.stepData);
  const updateStepData = useInspectionSessionStore((state) => state.updateStepData);

  // inspection 데이터를 store에 로드
  useEffect(() => {
    if (isOpen && inspection?.step_data) {
      // step_data의 각 key별로 updateStepData 호출
      const data = inspection.step_data as Record<string, unknown>;
      Object.keys(data).forEach((stepKey) => {
        updateStepData(stepKey, data[stepKey] as Record<string, unknown>);
      });
      setCurrentStep(0); // 첫 번째 스텝부터 시작
    }
  }, [isOpen, inspection, updateStepData, setCurrentStep]);

  // 모달 닫을 때 store 초기화
  useEffect(() => {
    if (!isOpen) {
      // 약간의 지연을 두고 초기화 (애니메이션 완료 후)
      const timer = setTimeout(() => {
        setCurrentStep(0);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, setCurrentStep]);

  if (!inspection) return null;

  const handleNext = () => {
    if (currentStep < STEP_COMPONENTS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSave = async () => {
    if (!onSave) return;

    try {
      const updates: Partial<InspectionHistory> = {
        step_data: stepData as any,
        // step_data에서 상태 정보 추출
        visual_status: (stepData as any).deviceInfo?.visual_status,
        battery_status: (stepData as any).deviceInfo?.battery_status,
        pad_status: (stepData as any).deviceInfo?.pad_status,
        operation_status: (stepData as any).deviceInfo?.operation_status,
        overall_status: (stepData as any).deviceInfo?.overall_status,
      };

      await onSave(inspection.id, updates);
      onClose();
    } catch (error) {
      console.error('[InspectionEditModal] Save error:', error);
    }
  };

  const CurrentStepComponent = STEP_COMPONENTS[currentStep];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[95vw] md:max-w-[900px] max-h-[95vh] overflow-hidden bg-gray-900 text-gray-100 border-gray-700 flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between border-b border-gray-700 pb-4">
          <div className="flex-1">
            <DialogTitle className="text-xl font-semibold text-gray-100">
              점검 이력 수정
            </DialogTitle>
            <p className="text-sm text-gray-400 mt-1">
              장비 연번: <span className="font-mono text-gray-300">{inspection.equipment_serial}</span>
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="hover:bg-gray-800"
          >
            <X className="w-5 h-5" />
          </Button>
        </DialogHeader>

        {/* 스텝 인디케이터 */}
        <div className="flex gap-2 overflow-x-auto pb-2 border-b border-gray-700">
          {STEP_TITLES.map((title, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentStep(idx)}
              className={`px-4 py-2 whitespace-nowrap text-sm font-medium rounded-t transition ${
                currentStep === idx
                  ? 'bg-gray-700 text-gray-100 border-b-2 border-green-500'
                  : 'bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-750'
              }`}
            >
              {title}
            </button>
          ))}
        </div>

        {/* 스텝 콘텐츠 */}
        <div className="flex-1 overflow-y-auto py-4 px-4">
          <CurrentStepComponent />
        </div>

        {/* 하단 네비게이션 및 저장 버튼 */}
        <div className="border-t border-gray-700 pt-4 flex justify-between items-center">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50"
          >
            이전
          </Button>

          <span className="text-sm text-gray-400">
            {currentStep + 1} / {STEP_COMPONENTS.length}
          </span>

          <div className="flex gap-2">
            {currentStep < STEP_COMPONENTS.length - 1 ? (
              <Button
                onClick={handleNext}
                className="bg-blue-600 hover:bg-blue-700"
              >
                다음
              </Button>
            ) : (
              <Button
                onClick={handleSave}
                className="bg-green-600 hover:bg-green-700"
              >
                저장
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
