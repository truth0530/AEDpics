'use client';

import type { InspectionHistory } from '@/lib/inspections/session-utils';

interface ReadOnlyDeviceInfoStepProps {
  stepData: Record<string, any>;
  inspection: InspectionHistory;
}

/**
 * 읽기 전용 2단계: 장비정보 표시
 * InspectionHistoryModal에서 사용되는 래퍼 컴포넌트
 * DeviceInfoStep과 완전히 동일한 레이아웃으로 표시
 */
export function ReadOnlyDeviceInfoStep({ stepData, inspection }: ReadOnlyDeviceInfoStepProps) {
  const deviceInfo = stepData.deviceInfo || {};

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString || !dateString.trim()) return '-';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '-';
      return date.toLocaleDateString('ko-KR');
    } catch (error) {
      console.warn('[ReadOnlyDeviceInfoStep] Invalid date:', dateString);
      return '-';
    }
  };

  const getDisplayValue = (key: string): string => {
    const value = deviceInfo[key];
    return value ? String(value) : '-';
  };

  return (
    <div className="space-y-2">
      {/* 장비 정보 */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-3">
        <h4 className="text-sm font-semibold text-gray-200 mb-3">장비 정보</h4>

        {/* 제조사, 모델명, 제조번호 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {/* 제조사 */}
          <div className="space-y-1">
            <div className="text-[10px] font-medium text-gray-400">제조사</div>
            <div className="text-xs font-medium text-gray-100">
              {getDisplayValue('manufacturer')}
            </div>
          </div>

          {/* 모델명 */}
          <div className="space-y-1">
            <div className="text-[10px] font-medium text-gray-400">모델명</div>
            <div className="text-xs font-medium text-gray-100">
              {getDisplayValue('model_name')}
            </div>
          </div>

          {/* 제조번호 */}
          <div className="space-y-1">
            <div className="text-[10px] font-medium text-gray-400">제조번호(SN)</div>
            <div className="text-xs font-medium text-gray-100 font-mono">
              {getDisplayValue('serial_number')}
            </div>
          </div>
        </div>

        {/* 장비 상태 표시 */}
        {deviceInfo.all_matched === true && (
          <div className="rounded-lg px-2.5 py-1.5 bg-green-600/10 border border-green-600/50 text-sm text-green-300 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>장비 정보 일치 확인됨</span>
          </div>
        )}

        {deviceInfo.all_matched === 'edited' && (
          <div className="rounded-lg px-2.5 py-1.5 bg-yellow-600/10 border border-yellow-600/50 text-sm text-yellow-300 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
            <span>장비 정보 수정됨</span>
          </div>
        )}
      </div>

      {/* 소모품 정보 */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-3">
        <h4 className="text-sm font-semibold text-gray-200 mb-3">소모품 정보</h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* 배터리 유효기간 */}
          <div className="space-y-1">
            <div className="text-[10px] font-medium text-gray-400">배터리 유효기간</div>
            <div className="text-xs font-medium text-gray-100">
              {formatDate(deviceInfo.battery_expiry_date)}
            </div>
          </div>

          {/* 패드 유효기간 */}
          <div className="space-y-1">
            <div className="text-[10px] font-medium text-gray-400">패드 유효기간</div>
            <div className="text-xs font-medium text-gray-100">
              {formatDate(deviceInfo.pad_expiry_date)}
            </div>
          </div>

          {/* 제조일자 */}
          <div className="space-y-1">
            <div className="text-[10px] font-medium text-gray-400">제조일자</div>
            <div className="text-xs font-medium text-gray-100">
              {formatDate(deviceInfo.manufacturing_date)}
            </div>
          </div>
        </div>

        {/* 소모품 상태 표시 */}
        {(deviceInfo.battery_expiry_date_matched || deviceInfo.pad_expiry_date_matched || deviceInfo.manufacturing_date_matched) && (
          <div className="mt-3 rounded-lg px-2.5 py-1.5 bg-green-600/10 border border-green-600/50 text-sm text-green-300 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>소모품 일치 확인됨</span>
          </div>
        )}
      </div>

      {/* 발견된 문제 */}
      {deviceInfo.issues_found && deviceInfo.issues_found.length > 0 && (
        <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-3">
          <h4 className="text-sm font-semibold text-gray-200 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            발견된 문제
          </h4>
          <ul className="list-disc list-inside text-xs text-gray-300 space-y-1">
            {deviceInfo.issues_found.map((issue: string, idx: number) => (
              <li key={idx}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 사진 */}
      {deviceInfo.photos && deviceInfo.photos.length > 0 && (
        <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-3">
          <h4 className="text-sm font-semibold text-gray-200 mb-2">첨부 사진</h4>
          <div className="text-xs text-gray-400">
            {deviceInfo.photos.length}개의 사진 첨부됨
          </div>
        </div>
      )}
    </div>
  );
}
