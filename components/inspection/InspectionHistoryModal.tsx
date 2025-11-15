'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trash2, ChevronRight, ChevronLeft, Edit, Save, X } from 'lucide-react';
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

// 편집 폼 컴포넌트
interface EditFormProps {
  notes: string;
  visualStatus: string;
  batteryStatus: string;
  padStatus: string;
  operationStatus: string;
  overallStatus: string;
  onNotesChange: (value: string) => void;
  onVisualStatusChange: (value: string) => void;
  onBatteryStatusChange: (value: string) => void;
  onPadStatusChange: (value: string) => void;
  onOperationStatusChange: (value: string) => void;
  onOverallStatusChange: (value: string) => void;
}

function EditForm({
  notes,
  visualStatus,
  batteryStatus,
  padStatus,
  operationStatus,
  overallStatus,
  onNotesChange,
  onVisualStatusChange,
  onBatteryStatusChange,
  onPadStatusChange,
  onOperationStatusChange,
  onOverallStatusChange,
}: EditFormProps) {
  const statusOptions = [
    { value: '', label: '선택 안함' },
    { value: 'good', label: '양호' },
    { value: 'caution', label: '주의' },
    { value: 'problem', label: '문제' },
    { value: 'not_checked', label: '미확인' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 p-4 rounded-lg space-y-4">
        <h4 className="text-lg font-semibold text-gray-100 mb-4">점검 상태 수정</h4>

        {/* 외관 상태 */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            외관 상태
          </label>
          <select
            value={visualStatus}
            onChange={(e) => onVisualStatusChange(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 배터리 상태 */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            배터리 상태
          </label>
          <select
            value={batteryStatus}
            onChange={(e) => onBatteryStatusChange(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 패드 상태 */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            패드 상태
          </label>
          <select
            value={padStatus}
            onChange={(e) => onPadStatusChange(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 작동 상태 */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            작동 상태
          </label>
          <select
            value={operationStatus}
            onChange={(e) => onOperationStatusChange(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 종합 상태 */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            종합 상태
          </label>
          <select
            value={overallStatus}
            onChange={(e) => onOverallStatusChange(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 점검 메모 */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            점검 메모
          </label>
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={4}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100"
            placeholder="점검 시 특이사항이나 메모를 입력하세요..."
          />
        </div>
      </div>

      <div className="bg-blue-900/20 border border-blue-700 rounded p-4">
        <p className="text-sm text-blue-300">
          점검 당시 기록된 4단계 상세 데이터는 수정할 수 없습니다.
          점검 상태와 메모만 수정 가능합니다.
        </p>
      </div>
    </div>
  );
}

export function InspectionHistoryModal({
  isOpen,
  onClose,
  inspection,
  onUpdate,
  onDelete,
  canEdit,
  canDelete,
}: InspectionHistoryModalProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 편집 가능한 필드 상태
  const [editedNotes, setEditedNotes] = useState('');
  const [editedVisualStatus, setEditedVisualStatus] = useState('');
  const [editedBatteryStatus, setEditedBatteryStatus] = useState('');
  const [editedPadStatus, setEditedPadStatus] = useState('');
  const [editedOperationStatus, setEditedOperationStatus] = useState('');
  const [editedOverallStatus, setEditedOverallStatus] = useState('');

  if (!inspection) return null;

  // step_data 존재 확인
  const hasStepData = inspection.step_data && Object.keys(inspection.step_data).length > 0;
  const stepData = inspection.step_data || {};

  // 편집 모드 진입
  const handleEnterEditMode = () => {
    setEditedNotes(inspection.notes || '');
    setEditedVisualStatus(inspection.visual_status || '');
    setEditedBatteryStatus(inspection.battery_status || '');
    setEditedPadStatus(inspection.pad_status || '');
    setEditedOperationStatus(inspection.operation_status || '');
    setEditedOverallStatus(inspection.overall_status || '');
    setIsEditMode(true);
  };

  // 편집 취소
  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditedNotes('');
    setEditedVisualStatus('');
    setEditedBatteryStatus('');
    setEditedPadStatus('');
    setEditedOperationStatus('');
    setEditedOverallStatus('');
  };

  // 저장
  const handleSave = async () => {
    if (!onUpdate) return;

    setIsSaving(true);
    try {
      const updates: Partial<InspectionHistory> = {
        notes: editedNotes,
        visual_status: editedVisualStatus,
        battery_status: editedBatteryStatus,
        pad_status: editedPadStatus,
        operation_status: editedOperationStatus,
        overall_status: editedOverallStatus,
      };

      await onUpdate(inspection.id, updates);
      setIsEditMode(false);
    } catch (error) {
      console.error('[InspectionHistoryModal] Save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

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
          <DialogTitle className="text-xl font-semibold text-gray-100">
            점검 이력 상세
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            장비 연번: <span className="font-mono text-gray-300">{inspection.equipment_serial}</span>
          </DialogDescription>
        </DialogHeader>

        {/* 탭 네비게이션 */}
        {!isEditMode && (
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
        )}

        {/* 탭 콘텐츠 */}
        <div className="flex-1 overflow-y-auto py-4 px-4">
          {!hasStepData ? (
            <div className="text-center py-8 text-gray-400">
              <p>점검 당시 상세 데이터가 저장되지 않았습니다.</p>
            </div>
          ) : isEditMode ? (
            <EditForm
              notes={editedNotes}
              visualStatus={editedVisualStatus}
              batteryStatus={editedBatteryStatus}
              padStatus={editedPadStatus}
              operationStatus={editedOperationStatus}
              overallStatus={editedOverallStatus}
              onNotesChange={setEditedNotes}
              onVisualStatusChange={setEditedVisualStatus}
              onBatteryStatusChange={setEditedBatteryStatus}
              onPadStatusChange={setEditedPadStatus}
              onOperationStatusChange={setEditedOperationStatus}
              onOverallStatusChange={setEditedOverallStatus}
            />
          ) : (
            <StepComponent stepData={stepData} inspection={inspection} />
          )}
        </div>

        {/* 하단: 네비게이션 + 버튼 */}
        <div className="border-t border-gray-700 pt-4 space-y-3">
          {/* 탭 네비게이션 버튼 */}
          {!isEditMode && (
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
          )}

          {/* 액션 버튼 */}
          <DialogFooter className="flex justify-between">
            <div className="flex gap-2">
              {canDelete && !isEditMode && (
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
            </div>
            <div className="flex gap-2">
              {isEditMode ? (
                <>
                  <Button
                    variant="outline"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="bg-gray-800 hover:bg-gray-700"
                  >
                    <X className="w-4 h-4 mr-2" />
                    취소
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {isSaving ? '저장 중...' : '저장'}
                  </Button>
                </>
              ) : (
                <>
                  {canEdit && (
                    <Button
                      variant="outline"
                      onClick={handleEnterEditMode}
                      className="bg-blue-900/20 text-blue-400 border-blue-700 hover:bg-blue-900/30"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      수정
                    </Button>
                  )}
                  <Button onClick={onClose} className="bg-gray-700 hover:bg-gray-600">
                    닫기
                  </Button>
                </>
              )}
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
