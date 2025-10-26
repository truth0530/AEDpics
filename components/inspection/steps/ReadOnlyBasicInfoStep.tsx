'use client';

import type { InspectionHistory } from '@/lib/inspections/session-utils';

interface ReadOnlyBasicInfoStepProps {
  stepData: Record<string, any>;
  inspection: InspectionHistory;
}

/**
 * 읽기 전용 1단계: 기본정보 표시
 * InspectionHistoryModal에서 사용되는 래퍼 컴포넌트
 * BasicInfoStep과 완전히 동일한 레이아웃으로 표시
 */
export function ReadOnlyBasicInfoStep({ stepData, inspection }: ReadOnlyBasicInfoStepProps) {
  const basicInfo = stepData.basicInfo || {};

  const FIELDS = [
    { key: 'manager', label: '관리책임자', dbKey: 'manager' },
    { key: 'contact_info', label: '담당자 연락처', dbKey: 'institution_contact' },
    { key: 'address', label: '주소', dbKey: 'installation_address' },
    { key: 'installation_position', label: '설치위치', dbKey: 'installation_position' },
    { key: 'category_1', label: '대분류', dbKey: 'category_1' },
    { key: 'category_2', label: '중분류', dbKey: 'category_2' },
    { key: 'category_3', label: '소분류', dbKey: 'category_3' },
  ];

  const formatCoordinate = (value: number | undefined): string => {
    if (typeof value === 'number' && !isNaN(value)) {
      return value.toFixed(7);
    }
    return '-';
  };

  const getDisplayValue = (key: string): string => {
    const value = basicInfo[key];
    return value ? String(value) : '-';
  };

  return (
    <div className="space-y-2">
      {/* 기본 정보 */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-3">
        <div className="space-y-2">
          {/* 첫 번째 행: 관리책임자, 담당자 연락처, 외부표출 */}
          <div className="grid gap-4" style={{ gridTemplateColumns: '2fr 3.1fr 2.9fr' }}>
            {/* 관리책임자 */}
            <div className="space-y-1">
              <div className="text-[10px] font-medium text-gray-400">관리책임자</div>
              <div className="text-xs font-medium text-gray-100 truncate">
                {getDisplayValue('manager')}
              </div>
            </div>

            {/* 담당자 연락처 */}
            <div className="space-y-1">
              <div className="text-[10px] font-medium text-gray-400">담당자 연락처</div>
              <div className="text-xs font-medium text-gray-100 truncate">
                {getDisplayValue('contact_info')}
              </div>
            </div>

            {/* 외부표출 */}
            <div className="space-y-1">
              <div className="text-[10px] font-medium text-gray-400 whitespace-nowrap">외부표출</div>
              <div className="text-xs font-medium text-gray-100 whitespace-nowrap">
                {inspection.step_data?.['basicInfo']?.external_display || '-'}
              </div>
            </div>
          </div>

          {/* 두 번째 행: 분류체계 (대분류, 중분류, 소분류) */}
          <div className="grid gap-4" style={{ gridTemplateColumns: '2fr 3fr 3fr' }}>
            {/* 대분류 */}
            <div className="space-y-1">
              <div className="text-[10px] font-medium text-gray-400">대분류</div>
              <div className="text-xs font-medium text-gray-100">
                {getDisplayValue('category_1')}
              </div>
            </div>

            {/* 중분류 */}
            <div className="space-y-1">
              <div className="text-[10px] font-medium text-gray-400">중분류</div>
              <div className="text-xs font-medium text-gray-100">
                {getDisplayValue('category_2')}
              </div>
            </div>

            {/* 소분류 */}
            <div className="space-y-1">
              <div className="text-[10px] font-medium text-gray-400">소분류</div>
              <div className="text-xs font-medium text-gray-100">
                {getDisplayValue('category_3')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 위치 정보 (GPS) */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold text-white text-sm">위치 정보</h4>
        </div>

        {/* GPS 좌표 정보 */}
        <div className="flex items-center gap-1 mb-2">
          <div className="text-[10px] sm:text-xs font-medium text-gray-400">GPS 위도</div>
          <div className="text-[10px] sm:text-sm font-medium text-gray-300 font-mono">
            {formatCoordinate(inspection.inspection_latitude)}
          </div>
          <div className="text-[10px] sm:text-xs font-medium text-gray-400 ml-3 sm:ml-4">GPS 경도</div>
          <div className="text-[10px] sm:text-sm font-medium text-gray-300 font-mono">
            {formatCoordinate(inspection.inspection_longitude)}
          </div>
        </div>

        {/* GPS 확인 상태 */}
        {basicInfo.gps_verified && (
          <div className="rounded-lg px-2.5 py-1.5 bg-green-600/10 border border-green-600/50 text-sm text-green-300 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>위치 확인됨</span>
          </div>
        )}
      </div>

      {/* 주소 및 설치위치 */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* 주소 */}
          <div className="space-y-1">
            <div className="text-[10px] font-medium text-gray-400">주소</div>
            <div className="text-xs font-medium text-gray-100">
              {getDisplayValue('address')}
            </div>
          </div>

          {/* 설치위치 */}
          <div className="space-y-1">
            <div className="text-[10px] font-medium text-gray-400">설치위치</div>
            <div className="text-xs font-medium text-gray-100">
              {getDisplayValue('installation_position')}
            </div>
          </div>
        </div>

        {/* 위치 일치 상태 */}
        {basicInfo.location_matched === true && (
          <div className="mt-3 rounded-lg px-2.5 py-1.5 bg-green-600/10 border border-green-600/50 text-sm text-green-300 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>위치 일치 확인됨</span>
          </div>
        )}

        {basicInfo.location_matched === 'edited' && (
          <div className="mt-3 rounded-lg px-2.5 py-1.5 bg-yellow-600/10 border border-yellow-600/50 text-sm text-yellow-300 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
            <span>위치 정보 수정됨</span>
          </div>
        )}
      </div>
    </div>
  );
}
