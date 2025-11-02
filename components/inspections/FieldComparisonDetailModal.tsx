'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type FieldComparison = {
  id: string;
  inspection_id: string;
  equipment_serial: string;
  field_name: string;
  field_category: string;
  inspection_value: string | null;
  aed_data_value: string | null;
  inspection_time: string;
  status_at_inspection: string;
  issue_severity: string | null;
  current_aed_value: string | null;
  improvement_status: string | null;
  improved_at: string | null;
  days_since_inspection: number | null;
  inspection: {
    inspection_date: string;
    user_profiles: {
      full_name: string;
      email: string;
    };
  };
  aed_device: {
    installation_institution: string;
    sido: string;
    gugun: string;
  };
};

interface FieldComparisonDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: FieldComparison | null;
}

const FIELD_NAME_LABELS: Record<string, string> = {
  battery_expiry_date: '배터리 만료일',
  pad_expiry_date: '패드 만료일',
  manager: '관리자명',
  institution_contact: '연락처',
  installation_institution: '설치기관',
  installation_address: '설치주소',
  manufacturer: '제조사',
  model_name: '모델명',
  serial_number: '시리얼 번호',
};

const FIELD_CATEGORY_LABELS: Record<string, string> = {
  battery: '배터리',
  pad: '패드',
  manager: '관리자',
  installation: '설치정보',
  device: '장비정보',
};

export default function FieldComparisonDetailModal({
  isOpen,
  onClose,
  record,
}: FieldComparisonDetailModalProps) {
  if (!record) return null;

  const inspectionDate = new Date(record.inspection_time);
  const improvedDate = record.improved_at ? new Date(record.improved_at) : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            필드 변화 상세 정보
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* 기본 정보 */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
              기본 정보
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">장비연번</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">
                  {record.equipment_serial}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">설치기관</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">
                  {record.aed_device.installation_institution}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">지역</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">
                  {record.aed_device.sido} {record.aed_device.gugun}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">점검자</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">
                  {record.inspection.user_profiles.full_name}
                </p>
              </div>
            </div>
          </div>

          {/* 필드 정보 */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-3">
              검사 필드
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-blue-700 dark:text-blue-400">필드명</p>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mt-1">
                  {FIELD_NAME_LABELS[record.field_name] || record.field_name}
                </p>
              </div>
              <div>
                <p className="text-xs text-blue-700 dark:text-blue-400">카테고리</p>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mt-1">
                  {FIELD_CATEGORY_LABELS[record.field_category] || record.field_category}
                </p>
              </div>
            </div>
          </div>

          {/* 타임라인 */}
          <div className="relative">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">
              변화 타임라인
            </h3>

            <div className="space-y-6">
              {/* 점검 이전 (원본 데이터) */}
              <div className="relative pl-8">
                <div className="absolute left-0 top-2 w-4 h-4 rounded-full bg-gray-400 dark:bg-gray-600"></div>
                <div className="absolute left-2 top-6 w-0.5 h-full bg-gray-300 dark:bg-gray-600"></div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      점검 이전 (원본)
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      ~ {inspectionDate.toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                  <div className="text-sm text-gray-900 dark:text-gray-100 font-mono bg-white dark:bg-gray-700 px-3 py-2 rounded">
                    {record.aed_data_value || '(없음)'}
                  </div>
                </div>
              </div>

              {/* 점검 시점 */}
              <div className="relative pl-8">
                <div className={`absolute left-0 top-2 w-4 h-4 rounded-full ${
                  record.status_at_inspection === 'good'
                    ? 'bg-green-500'
                    : 'bg-red-500'
                }`}></div>
                {record.improvement_status && (
                  <div className="absolute left-2 top-6 w-0.5 h-full bg-gray-300 dark:bg-gray-600"></div>
                )}
                <div className={`rounded-lg p-4 ${
                  record.status_at_inspection === 'good'
                    ? 'bg-green-50 dark:bg-green-900/20'
                    : 'bg-red-50 dark:bg-red-900/20'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-medium ${
                      record.status_at_inspection === 'good'
                        ? 'text-green-700 dark:text-green-400'
                        : 'text-red-700 dark:text-red-400'
                    }`}>
                      점검 시점 {record.status_at_inspection === 'good' ? '(양호)' : '(문제 발견)'}
                    </span>
                    <span className={`text-xs ${
                      record.status_at_inspection === 'good'
                        ? 'text-green-600 dark:text-green-500'
                        : 'text-red-600 dark:text-red-500'
                    }`}>
                      {inspectionDate.toLocaleString('ko-KR')}
                    </span>
                  </div>
                  <div className={`text-sm font-mono px-3 py-2 rounded ${
                    record.status_at_inspection === 'good'
                      ? 'text-green-900 dark:text-green-200 bg-white dark:bg-gray-700'
                      : 'text-red-900 dark:text-red-200 bg-white dark:bg-gray-700'
                  }`}>
                    {record.inspection_value || '(없음)'}
                  </div>
                  {record.status_at_inspection === 'problematic' && record.issue_severity && (
                    <div className="mt-2">
                      <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                        record.issue_severity === 'critical'
                          ? 'bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200'
                          : record.issue_severity === 'major'
                          ? 'bg-orange-200 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                          : 'bg-yellow-200 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      }`}>
                        심각도: {record.issue_severity.toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 개선 여부 */}
              {record.improvement_status && (
                <div className="relative pl-8">
                  <div className={`absolute left-0 top-2 w-4 h-4 rounded-full ${
                    record.improvement_status === 'improved'
                      ? 'bg-blue-500'
                      : 'bg-yellow-500'
                  }`}></div>
                  <div className={`rounded-lg p-4 ${
                    record.improvement_status === 'improved'
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : 'bg-yellow-50 dark:bg-yellow-900/20'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-medium ${
                        record.improvement_status === 'improved'
                          ? 'text-blue-700 dark:text-blue-400'
                          : 'text-yellow-700 dark:text-yellow-400'
                      }`}>
                        현재 상태 {record.improvement_status === 'improved' ? '(개선됨)' : '(방치됨)'}
                      </span>
                      {improvedDate ? (
                        <span className={`text-xs ${
                          record.improvement_status === 'improved'
                            ? 'text-blue-600 dark:text-blue-500'
                            : 'text-yellow-600 dark:text-yellow-500'
                        }`}>
                          {improvedDate.toLocaleString('ko-KR')}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          확인 중
                        </span>
                      )}
                    </div>
                    <div className={`text-sm font-mono px-3 py-2 rounded ${
                      record.improvement_status === 'improved'
                        ? 'text-blue-900 dark:text-blue-200 bg-white dark:bg-gray-700'
                        : 'text-yellow-900 dark:text-yellow-200 bg-white dark:bg-gray-700'
                    }`}>
                      {record.current_aed_value || '(없음)'}
                    </div>
                    {record.days_since_inspection !== null && (
                      <div className="mt-2">
                        <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                          record.improvement_status === 'improved'
                            ? 'bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                            : 'bg-yellow-200 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        }`}>
                          {record.days_since_inspection}일 경과
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 비교 요약 */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
              변화 요약
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400">원본 → 점검</p>
                <p className={`text-sm font-medium mt-1 ${
                  record.status_at_inspection === 'good'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {record.aed_data_value === record.inspection_value ? '일치' : '불일치'}
                </p>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400">점검 → 현재</p>
                <p className={`text-sm font-medium mt-1 ${
                  record.improvement_status === 'improved'
                    ? 'text-blue-600 dark:text-blue-400'
                    : record.improvement_status === 'neglected'
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {record.improvement_status === 'improved'
                    ? '개선'
                    : record.improvement_status === 'neglected'
                    ? '미개선'
                    : '확인 중'}
                </p>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400">경과 시간</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">
                  {record.days_since_inspection !== null
                    ? `${record.days_since_inspection}일`
                    : '-'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            닫기
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
