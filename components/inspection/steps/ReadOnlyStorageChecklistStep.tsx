'use client';

import type { InspectionHistory } from '@/lib/inspections/session-utils';

interface ReadOnlyStorageChecklistStepProps {
  stepData: Record<string, any>;
  inspection: InspectionHistory;
}

// StorageChecklistStep과 동일한 한글 레이블 매핑
const CHECKLIST_ITEMS_LABEL_MAP: Record<string, string> = {
  'alarm_functional': '도난경보장치 작동 여부',
  'instructions_status': '보관함 각종 안내문구 표시',
  'emergency_contact': '비상연락망 표시 여부',
  'cpr_manual': '심폐소생술 방법 안내책자, 그림 여부',
  'expiry_display': '패드 및 배터리 유효기간 표시 여부',
};

// 각 체크리스트 항목별 상태값 한글 매핑
const STATUS_VALUE_MAP: Record<string, Record<string, string>> = {
  'alarm_functional': {
    'needs_improvement': '개선필요',
    'normal': '정상작동',
  },
  'instructions_status': {
    'needs_improvement': '개선필요',
    'normal': '정상 기재',
  },
  'emergency_contact': {
    'needs_improvement': '개선필요',
    'normal': '정상 표기',
  },
  'cpr_manual': {
    'needs_improvement': '개선필요',
    'booklet': '책자 비치',
    'poster': '포스터형태',
    'other': '기타',
  },
  'expiry_display': {
    'needs_improvement': '개선필요',
    'displayed': '별도 표기',
  },
};

/**
 * 읽기 전용 3단계: 보관함 체크리스트 표시
 * InspectionHistoryModal에서 사용되는 래퍼 컴포넌트
 * StorageChecklistStep과 완전히 동일한 레이아웃으로 표시
 */
export function ReadOnlyStorageChecklistStep({ stepData, inspection }: ReadOnlyStorageChecklistStepProps) {
  const storage = stepData.storage || {};

  const getStatusLabel = (itemId: string, value: string): string => {
    // 먼저 해당 항목의 상태값 매핑 확인
    if (STATUS_VALUE_MAP[itemId]) {
      const statusMap = STATUS_VALUE_MAP[itemId];
      if (statusMap[value]) {
        return statusMap[value];
      }
    }

    // 상태값 매핑이 없으면 일반 상태값 확인 (storage-level)
    switch (value) {
      case 'good':
        return '양호';
      case 'warning':
        return '주의';
      case 'bad':
        return '불량';
      case 'not_applicable':
        return '해당없음';
      default:
        return value || '-';
    }
  };

  const getStatusColor = (value: string): string => {
    switch (value) {
      case 'good':
        return 'bg-green-600/20 text-green-300 border-green-600/50';
      case 'warning':
        return 'bg-yellow-600/20 text-yellow-300 border-yellow-600/50';
      case 'bad':
        return 'bg-red-600/20 text-red-300 border-red-600/50';
      case 'not_applicable':
        return 'bg-gray-600/20 text-gray-300 border-gray-600/50';
      default:
        return 'bg-gray-600/20 text-gray-300 border-gray-600/50';
    }
  };

  const renderChecklist = () => {
    if (!storage.checklist_items) return null;

    // Handle both array and object formats
    const entries = Array.isArray(storage.checklist_items)
      ? storage.checklist_items.map((item: any, idx: number) => [idx, item])
      : Object.entries(storage.checklist_items);

    if (entries.length === 0) return null;

    // Filter out empty entries
    const validEntries = entries.filter(([, value]) => {
      return value !== null && value !== undefined && value !== '';
    });

    if (validEntries.length === 0) return null;

    return (
      <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-3">
        <h4 className="text-sm font-semibold text-gray-200 mb-3">점검 항목</h4>
        <div className="space-y-2">
          {validEntries.map(([key, value]: [string | number, any]) => {
            // Extract display label and status
            let label = '';
            let status = '';
            const keyStr = String(key);

            if (typeof value === 'string') {
              // Simple string value: key is label, value is status
              label = CHECKLIST_ITEMS_LABEL_MAP[keyStr] || keyStr;
              status = value;
            } else if (typeof value === 'object' && value !== null) {
              // Object value: extract label and status
              label = value.label || value.name || CHECKLIST_ITEMS_LABEL_MAP[keyStr] || keyStr;
              status = value.value || value.status || String(value);
            } else {
              label = CHECKLIST_ITEMS_LABEL_MAP[keyStr] || keyStr;
              status = String(value);
            }

            // Skip if status is empty after extraction
            if (!status || status === 'undefined' || status === '[object Object]') {
              return null;
            }

            return (
              <div key={key} className="flex items-center justify-between p-2 rounded bg-gray-800/50">
                <span className="text-xs text-gray-300">{label}</span>
                <span className={`text-xs px-2 py-0.5 rounded border ${getStatusColor(status)}`}>
                  {getStatusLabel(keyStr, status)}
                </span>
              </div>
            );
          }).filter(Boolean)}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {/* 보관함 타입 */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-3">
        <h4 className="text-sm font-semibold text-gray-200 mb-2">보관함 형태</h4>
        <div className="text-xs font-medium text-gray-100">
          {storage.storage_type === 'cabinet' && '보안 캐비넷'}
          {storage.storage_type === 'wall_mount' && '벽면 설치형'}
          {storage.storage_type === 'none' && '보관함 없음'}
          {!storage.storage_type && '-'}
        </div>
      </div>

      {/* 체크리스트 항목 */}
      {renderChecklist()}

      {/* 메모 */}
      {storage.notes && storage.notes.trim() && (
        <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-3">
          <h4 className="text-sm font-semibold text-gray-200 mb-2">메모</h4>
          <div className="text-xs text-gray-300 whitespace-pre-wrap">
            {storage.notes}
          </div>
        </div>
      )}

      {/* 사진 */}
      {storage.photos && Array.isArray(storage.photos) && storage.photos.length > 0 && (
        <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-3">
          <h4 className="text-sm font-semibold text-gray-200 mb-2">첨부 사진</h4>
          <div className="text-xs text-gray-400">
            {storage.photos.length}개의 사진 첨부됨
          </div>
        </div>
      )}
    </div>
  );
}
