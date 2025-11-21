'use client';

import { useInspectionSessionStore } from '@/lib/state/inspection-session-store';

interface StorageData {
  storage_type?: string;
  checklist_items?: Record<string, boolean | string>;
  improvement_notes?: Record<string, string>;  // 개선필요 선택 시 상세 내용
  signage_checklist?: Record<string, boolean>;
  signage_selected?: string[];
  [key: string]: any;
}

interface StepData {
  storage?: StorageData;
  [key: string]: any;
}

const STORAGE_TYPES = [
  { id: 'none', label: '보관함 없음' },
  { id: 'working', label: '정상작동' },
  { id: 'not_working', label: '미작동' },
];

const CHECKLIST_ITEMS = [
  {
    id: 'alarm_functional',
    label: '도난경보장치 작동 여부',
    options: [
      { value: 'needs_improvement', label: '개선필요' },
      { value: 'normal', label: '정상작동' }
    ]
  },
  {
    id: 'instructions_status',
    label: '보관함 각종 안내문구 표시',
    options: [
      { value: 'needs_improvement', label: '개선필요' },
      { value: 'normal', label: '정상 기재' }
    ]
  },
  {
    id: 'emergency_contact',
    label: '비상연락망 표시 여부',
    options: [
      { value: 'needs_improvement', label: '개선필요' },
      { value: 'normal', label: '정상 표기' }
    ]
  },
  {
    id: 'cpr_manual',
    label: '심폐소생술 방법 안내책자, 그림 여부',
    options: [
      { value: 'needs_improvement', label: '개선필요' },
      { value: 'booklet', label: '책자 비치' },
      { value: 'poster', label: '포스터형태' },
      { value: 'other', label: '기타' }
    ]
  },
  {
    id: 'expiry_display',
    label: '패드 및 배터리 유효기간 표시 여부',
    options: [
      { value: 'needs_improvement', label: '개선필요' },
      { value: 'displayed', label: '별도 표기' }
    ]
  },
];

const SIGNAGE_ITEMS = [
  { id: 'none', label: '안내표지 없음' },
  { id: 'entrance', label: '출입구' },
  { id: 'interior', label: '내부' },
  { id: 'elevator', label: '엘리베이터' },
  { id: 'map', label: '안내지도' },
  { id: 'booklet', label: '책자/팸플릿' },
];

export function StorageChecklistStep() {
  const stepData = useInspectionSessionStore((state) => state.stepData) as StepData;
  const updateStepData = useInspectionSessionStore((state) => state.updateStepData);

  const storage: StorageData = stepData.storage || {};
  const checklist = storage.checklist_items || {};
  const improvementNotes = storage.improvement_notes || {};
  const signageChecklist = storage.signage_checklist || {};

  // ✅ 기본값을 설정하지 않음 - 사용자가 명시적으로 선택해야 함
  const storageType = storage.storage_type;
  const hasStorage = storageType && storageType !== 'none';

  const handleStorageTypeChange = (type: string) => {
    updateStepData('storage', {
      ...storage,
      storage_type: type,
    });
  };

  const handleChecklistChange = (itemId: string, status: boolean | string) => {
    // 개선필요가 아닌 다른 옵션 선택 시 해당 항목의 개선 노트 삭제
    const newImprovementNotes = { ...improvementNotes };
    if (status !== 'needs_improvement' && newImprovementNotes[itemId]) {
      delete newImprovementNotes[itemId];
    }

    updateStepData('storage', {
      ...storage,
      checklist_items: {
        ...checklist,
        [itemId]: status,
      },
      improvement_notes: newImprovementNotes,
    });
  };

  const handleImprovementNoteChange = (itemId: string, note: string) => {
    updateStepData('storage', {
      ...storage,
      improvement_notes: {
        ...improvementNotes,
        [itemId]: note,
      },
    });
  };

  const handleSignageToggle = (itemId: string) => {
    const currentSelected = storage.signage_selected || [];
    const isSelected = currentSelected.includes(itemId);

    let newSelected: string[];

    if (itemId === 'none') {
      // "안내표지 없음" 선택 시
      if (isSelected) {
        // 이미 선택되어 있으면 해제
        newSelected = [];
      } else {
        // 선택되지 않았으면 "안내표지 없음"만 선택
        newSelected = ['none'];
      }
    } else {
      // 다른 항목 선택 시
      if (isSelected) {
        // 이미 선택되어 있으면 해제
        newSelected = currentSelected.filter((id: string) => id !== itemId);
      } else {
        // "안내표지 없음"을 제거하고 새 항목 추가
        newSelected = [...currentSelected.filter((id: string) => id !== 'none'), itemId];
      }
    }

    // Only update if the selection actually changed
    if (JSON.stringify(currentSelected.sort()) !== JSON.stringify(newSelected.sort())) {
      updateStepData('storage', {
        ...storage,
        signage_selected: newSelected,
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* 보관함 도난경보장치 작동 여부 선택 (라디오 버튼 스타일) */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-4">
        <div className="flex items-center gap-2 mb-3">
          <h4 className="font-semibold text-white text-sm">보관함 도난경보장치 작동 여부</h4>
          {!storageType && (
            <span className="text-xs text-yellow-400 animate-pulse">← 선택 필요</span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {STORAGE_TYPES.map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => handleStorageTypeChange(type.id)}
              className={`py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${
                storageType === type.id
                  ? 'border-green-500 bg-green-600/20 text-green-300'
                  : 'border-gray-600 bg-gray-700/30 text-gray-400 hover:border-gray-500'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* 보관함 체크리스트 (주석처리 - 향후 복구 가능하도록 보관) */}
      {/*
      {hasStorage && (
        <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-4">
          <h4 className="font-semibold text-white text-sm mb-3">보관함 체크리스트</h4>
          <div className="space-y-3">
            {CHECKLIST_ITEMS.map((item) => {
              const status = checklist[item.id];
              const numOptions = item.options.length;
              const gridCols = numOptions === 3 ? 'grid-cols-3' : 'grid-cols-2';

              return (
                <div key={item.id} className="space-y-2">
                  <div className="text-sm text-gray-300">{item.label}</div>
                  <div className={`grid ${gridCols} gap-2`}>
                    {item.options.map((option) => {
                      const isSelected = status === option.value;
                      const isNeedsImprovement = option.value === 'needs_improvement';

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleChecklistChange(item.id, option.value)}
                          className={`py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                            isSelected
                              ? isNeedsImprovement
                                ? 'border-red-500 bg-red-600/20 text-red-300'
                                : 'border-green-500 bg-green-600/20 text-green-300'
                              : 'border-gray-600 bg-gray-700/30 text-gray-400 hover:border-gray-500'
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  // 개선필요 선택 시 상세 내용 입력 필드 표시
                  {status === 'needs_improvement' && (
                    <div className="mt-2">
                      <textarea
                        value={improvementNotes[item.id] || ''}
                        onChange={(e) => handleImprovementNoteChange(item.id, e.target.value)}
                        placeholder="개선이 필요한 구체적인 내용을 입력해주세요..."
                        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-600 bg-gray-800/50 text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                        rows={2}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      */}

      {/* 안내표지 설치 (다중선택) */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-4">
        <h4 className="font-semibold text-white text-sm mb-3">안내표지 설치 (다중선택 가능)</h4>
        <div className="grid grid-cols-2 gap-2">
          {SIGNAGE_ITEMS.map((item) => {
            const selectedItems = storage.signage_selected || [];
            const isSelected = selectedItems.includes(item.id);
            const hasNone = selectedItems.includes('none');
            const hasOthers = selectedItems.some((id: string) => id !== 'none');

            // "안내표지 없음"이 선택되면 다른 버튼들 비활성화
            // 다른 버튼이 선택되면 "안내표지 없음" 비활성화
            const isDisabled = (hasNone && item.id !== 'none') || (hasOthers && item.id === 'none');

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSignageToggle(item.id)}
                disabled={isDisabled}
                className={`py-2.5 px-2 sm:px-3 rounded-lg border text-xs font-medium transition-all whitespace-nowrap ${
                  isSelected
                    ? 'border-green-500 bg-green-600/20 text-green-300'
                    : isDisabled
                    ? 'border-gray-700 bg-gray-800/50 text-gray-600 cursor-not-allowed opacity-50'
                    : 'border-gray-600 bg-gray-700/30 text-gray-400 hover:border-gray-500'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
