'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, Trash2, ChevronRight, ChevronLeft } from 'lucide-react';
import type { InspectionHistory } from '@/lib/inspections/session-utils';
import { ReadOnlyBasicInfoStep } from './steps/ReadOnlyBasicInfoStep';
import { ReadOnlyDeviceInfoStep } from './steps/ReadOnlyDeviceInfoStep';
import { ReadOnlyStorageChecklistStep } from './steps/ReadOnlyStorageChecklistStep';
import { ReadOnlyInspectionSummaryStep } from './steps/ReadOnlyInspectionSummaryStep';

interface InspectionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  inspection: InspectionHistory | null;
  onUpdate?: (inspectionId: string, updates: Partial<InspectionHistory>) => Promise<void>;
  onDelete?: (inspectionId: string) => void;
  canEdit: boolean;
  canDelete: boolean;
}

const STEP_TABS = [
  { id: 0, label: '1단계: 기본정보', component: ReadOnlyBasicInfoStep },
  { id: 1, label: '2단계: 장비정보', component: ReadOnlyDeviceInfoStep },
  { id: 2, label: '3단계: 보관함', component: ReadOnlyStorageChecklistStep },
  { id: 3, label: '4단계: 점검요약', component: ReadOnlyInspectionSummaryStep },
];

export function InspectionHistoryModal({
  isOpen,
  onClose,
  inspection,
  onDelete,
  canEdit,
  canDelete,
}: InspectionHistoryModalProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!inspection) return null;

  // step_data 존재 확인
  const hasStepData = inspection.step_data && Object.keys(inspection.step_data).length > 0;
  const stepData = inspection.step_data || {};

  const handleDelete = async () => {
    if (onDelete && window.confirm('이 점검 이력을 삭제하시겠습니까?')) {
      setIsDeleting(true);
      try {
        onDelete(inspection.id);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const currentTab = STEP_TABS[activeTab];
  const StepComponent = currentTab.component;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-hidden bg-gray-900 text-gray-100 border-gray-700 flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-gray-100 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            점검 이력 상세
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            장비 연번: <span className="font-mono text-gray-300">{inspection.equipment_serial}</span>
          </DialogDescription>
        </DialogHeader>

        {/* 탭 네비게이션 */}
        <div className="flex gap-2 overflow-x-auto pb-2 border-b border-gray-700">
          {STEP_TABS.map((tab, idx) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(idx)}
              className={`px-4 py-2 whitespace-nowrap text-sm font-medium rounded-t transition ${
                activeTab === idx
                  ? 'bg-gray-700 text-gray-100 border-b-2 border-green-500'
                  : 'bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-750'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 탭 콘텐츠 */}
        <div className="flex-1 overflow-y-auto py-4 px-4">
          {!hasStepData ? (
            <div className="text-center py-8 text-gray-400">
              <p>점검 당시 상세 데이터가 저장되지 않았습니다.</p>
            </div>
          ) : (
            <StepComponent stepData={stepData} inspection={inspection} />
          )}
        </div>

        {/* 하단: 네비게이션 + 버튼 */}
        <div className="border-t border-gray-700 pt-4 space-y-3">
          {/* 탭 네비게이션 버튼 */}
          <div className="flex justify-between">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setActiveTab(Math.max(0, activeTab - 1))}
              disabled={activeTab === 0}
              className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              이전
            </Button>

            <span className="text-sm text-gray-400 self-center">
              {activeTab + 1} / {STEP_TABS.length}
            </span>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setActiveTab(Math.min(STEP_TABS.length - 1, activeTab + 1))}
              disabled={activeTab === STEP_TABS.length - 1}
              className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50"
            >
              다음
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          {/* 액션 버튼 */}
          <DialogFooter className="flex justify-between">
            {canDelete && (
              <Button
                variant="outline"
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-red-900/20 text-red-400 border-red-700 hover:bg-red-900/30 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {isDeleting ? '삭제 중...' : '이력 삭제'}
              </Button>
            )}
            <Button onClick={onClose} className="bg-gray-700 hover:bg-gray-600">
              닫기
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
