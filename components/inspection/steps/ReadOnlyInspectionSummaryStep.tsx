'use client';

import type { InspectionHistory } from '@/lib/inspections/session-utils';

interface ReadOnlyInspectionSummaryStepProps {
  stepData: Record<string, any>;
  inspection: InspectionHistory;
}

/**
 * 읽기 전용 4단계: 점검요약 표시
 * InspectionHistoryModal에서 사용되는 래퍼 컴포넌트
 * InspectionSummaryStep과 완전히 동일한 레이아웃으로 표시
 */
export function ReadOnlyInspectionSummaryStep({ stepData, inspection }: ReadOnlyInspectionSummaryStepProps) {
  const documentation = stepData.documentation || {};

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good':
        return 'text-green-400 bg-green-900/20';
      case 'warning':
        return 'text-yellow-400 bg-yellow-900/20';
      case 'bad':
        return 'text-red-400 bg-red-900/20';
      default:
        return 'text-gray-400 bg-gray-900/20';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'good':
        return '정상';
      case 'warning':
        return '주의';
      case 'bad':
        return '불량';
      case 'not_checked':
        return '미확인';
      default:
        return status || '-';
    }
  };

  const getIssueText = (issue: any): string => {
    if (!issue) return '-';
    if (typeof issue === 'string') return issue;
    if (issue.label) return issue.label;
    if (issue.text) return issue.text;
    if (issue.name) return issue.name;
    return '-';
  };

  const hasValidGPS = (lat: any, lng: any): boolean => {
    return typeof lat === 'number' &&
           typeof lng === 'number' &&
           !isNaN(lat) &&
           !isNaN(lng) &&
           lat !== null &&
           lng !== null;
  };

  return (
    <div className="space-y-3">
      {/* 점검 기본 정보 */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-400 mb-1">점검 일시</p>
            <p className="text-sm text-gray-100">
              {inspection.inspection_date ? formatDate(inspection.inspection_date) : '-'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">점검자</p>
            <p className="text-sm text-gray-100">{inspection.inspector_name || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">장비 연번</p>
            <p className="text-sm text-gray-100 font-mono">{inspection.equipment_serial || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">점검 유형</p>
            <p className="text-sm text-gray-100">
              {inspection.inspection_type === 'monthly' && '월정기'}
              {inspection.inspection_type === 'special' && '특별'}
              {inspection.inspection_type === 'emergency' && '긴급'}
              {!inspection.inspection_type && '-'}
            </p>
          </div>
        </div>
      </div>

      {/* 점검 결과 */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-3">
        <h4 className="text-sm font-semibold text-gray-200 mb-3">점검 결과</h4>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="flex justify-between items-center p-2 rounded bg-gray-800">
            <span className="text-sm text-gray-400">외관 상태:</span>
            <span className={`text-sm px-2 py-0.5 rounded ${getStatusColor(inspection.visual_status)}`}>
              {getStatusLabel(inspection.visual_status)}
            </span>
          </div>
          <div className="flex justify-between items-center p-2 rounded bg-gray-800">
            <span className="text-sm text-gray-400">배터리:</span>
            <span className={`text-sm px-2 py-0.5 rounded ${getStatusColor(inspection.battery_status)}`}>
              {getStatusLabel(inspection.battery_status)}
            </span>
          </div>
          <div className="flex justify-between items-center p-2 rounded bg-gray-800">
            <span className="text-sm text-gray-400">패드:</span>
            <span className={`text-sm px-2 py-0.5 rounded ${getStatusColor(inspection.pad_status)}`}>
              {getStatusLabel(inspection.pad_status)}
            </span>
          </div>
          <div className="flex justify-between items-center p-2 rounded bg-gray-800">
            <span className="text-sm text-gray-400">작동 상태:</span>
            <span className={`text-sm px-2 py-0.5 rounded ${getStatusColor(inspection.operation_status)}`}>
              {getStatusLabel(inspection.operation_status)}
            </span>
          </div>
        </div>

        <div className="flex justify-between items-center p-3 rounded bg-gray-800 border border-gray-700">
          <span className="text-sm font-medium text-gray-300">종합 평가:</span>
          <span className={`text-base px-3 py-1 rounded font-semibold ${getStatusColor(inspection.overall_status)}`}>
            {getStatusLabel(inspection.overall_status)}
          </span>
        </div>
      </div>

      {/* 발견된 문제 */}
      {inspection.issues_found && Array.isArray(inspection.issues_found) && inspection.issues_found.length > 0 && (
        <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-3">
          <h4 className="text-sm font-semibold text-gray-200 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            발견된 문제
          </h4>
          <ul className="list-disc list-inside text-sm text-gray-400 space-y-1 bg-gray-800 p-3 rounded">
            {inspection.issues_found.filter(Boolean).map((issue, index) => (
              <li key={index}>{getIssueText(issue)}</li>
            ))}
          </ul>
        </div>
      )}

      {/* GPS 좌표 */}
      {hasValidGPS(inspection.inspection_latitude, inspection.inspection_longitude) && (
        <div className="flex items-center gap-2 text-sm text-gray-400 bg-gray-800 p-3 rounded">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
          </svg>
          <span>
            위도: {inspection.inspection_latitude!.toFixed(6)}, 경도: {inspection.inspection_longitude!.toFixed(6)}
          </span>
        </div>
      )}

      {/* 점검 메모 */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-3">
        <h4 className="text-sm font-semibold text-gray-200 mb-2">점검 메모</h4>
        <div className="text-sm text-gray-300 bg-gray-800 p-3 rounded min-h-[60px] whitespace-pre-wrap">
          {(inspection.notes && inspection.notes.trim()) ? inspection.notes : '메모 없음'}
        </div>
      </div>

      {/* 사진 */}
      {inspection.photos && Array.isArray(inspection.photos) && inspection.photos.length > 0 && (
        <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-3">
          <h4 className="text-sm font-semibold text-gray-200 mb-2">첨부 사진</h4>
          <div className="text-xs text-gray-400">
            {inspection.photos.length}개의 사진 첨부됨
          </div>
        </div>
      )}

      {/* 점검 완료 정보 */}
      {documentation.completed_time && (
        <div className="rounded-lg border border-green-600/50 bg-green-600/10 p-3">
          <div className="flex items-center gap-2 text-green-300">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm">점검 완료: {formatDate(documentation.completed_time)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
