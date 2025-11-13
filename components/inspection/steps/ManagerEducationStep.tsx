'use client';

import { useInspectionSessionStore } from '@/lib/state/inspection-session-store';
import type { ManagerEducationData } from '@/lib/state/inspection-session-store';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ValidationWarning } from '../ValidationWarning';

export function ManagerEducationStep() {
  const { stepData, updateStepData } = useInspectionSessionStore();
  const managerEducation = (stepData.managerEducation || {}) as ManagerEducationData;

  // 필수 항목 체크
  const missingFields: string[] = [];
  if (!managerEducation.education_status) {
    missingFields.push('관리책임자 교육 이수 현황을 선택해주세요');
  }
  if (managerEducation.education_status === 'not_completed' && !managerEducation.not_completed_reason) {
    missingFields.push('미이수 사유를 선택해주세요');
  }
  if (managerEducation.not_completed_reason === 'other' && !managerEducation.not_completed_other_text) {
    missingFields.push('미이수 기타 사유를 입력해주세요');
  }
  if (managerEducation.education_status === 'other' && !managerEducation.education_other_text) {
    missingFields.push('교육 이수 현황 기타 내용을 입력해주세요');
  }

  return (
    <div className="space-y-4">
      {/* 관리책임자 교육 이수 현황 */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-3">
        <div className="mb-3">
          <Label className="text-sm font-semibold text-white">
            관리책임자 교육 이수 현황 <span className="text-red-500">*</span>
          </Label>
        </div>

        <div className="space-y-3">
          {/* 메인 선택 버튼들 */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                // 선택 변경 시 관련 필드 초기화 (명시적 undefined 대신 필드 생략)
                const updated = {
                  ...(managerEducation as Record<string, unknown>),
                  education_status: 'manager_education'
                } as Record<string, unknown>;
                // 불필요한 필드 제거
                delete updated.not_completed_reason;
                delete updated.not_completed_other_text;
                delete updated.education_other_text;
                updateStepData('managerEducation', updated);
              }}
              className={`px-3 py-2 text-xs font-medium rounded-lg transition-all ${
                managerEducation.education_status === 'manager_education'
                  ? 'bg-green-600 text-white border-2 border-green-500 shadow-lg shadow-green-500/20'
                  : 'bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600'
              }`}
            >
              관리책임자 교육(100분)
            </button>

            <button
              type="button"
              onClick={() => {
                const updated = {
                  ...(managerEducation as Record<string, unknown>),
                  education_status: 'legal_mandatory_education'
                } as Record<string, unknown>;
                delete updated.not_completed_reason;
                delete updated.not_completed_other_text;
                delete updated.education_other_text;
                updateStepData('managerEducation', updated);
              }}
              className={`px-3 py-2 text-xs font-medium rounded-lg transition-all ${
                managerEducation.education_status === 'legal_mandatory_education'
                  ? 'bg-blue-600 text-white border-2 border-blue-500 shadow-lg shadow-blue-500/20'
                  : 'bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600'
              }`}
            >
              법정의무교육(4시간)
            </button>

            <button
              type="button"
              onClick={() => {
                const updated = {
                  ...(managerEducation as Record<string, unknown>),
                  education_status: 'not_completed'
                } as Record<string, unknown>;
                delete updated.education_other_text;
                updateStepData('managerEducation', updated);
              }}
              className={`px-3 py-2 text-xs font-medium rounded-lg transition-all ${
                managerEducation.education_status === 'not_completed'
                  ? 'bg-yellow-600 text-white border-2 border-yellow-500 shadow-lg shadow-yellow-500/20'
                  : 'bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600'
              }`}
            >
              미이수
            </button>

            <button
              type="button"
              onClick={() => {
                const updated = {
                  ...(managerEducation as Record<string, unknown>),
                  education_status: 'other'
                } as Record<string, unknown>;
                delete updated.not_completed_reason;
                delete updated.not_completed_other_text;
                updateStepData('managerEducation', updated);
              }}
              className={`px-3 py-2 text-xs font-medium rounded-lg transition-all ${
                managerEducation.education_status === 'other'
                  ? 'bg-purple-600 text-white border-2 border-purple-500 shadow-lg shadow-purple-500/20'
                  : 'bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600'
              }`}
            >
              기타
            </button>
          </div>

          {/* 미이수 선택 시 세부 사유 */}
          {managerEducation.education_status === 'not_completed' && (
            <div className="pl-2 space-y-2 border-l-2 border-yellow-600">
              <Label className="text-xs font-medium text-yellow-400">미이수 사유</Label>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    updateStepData('managerEducation', {
                      ...(managerEducation as Record<string, unknown>),
                      not_completed_reason: 'new_manager',
                      not_completed_other_text: undefined
                    });
                  }}
                  className={`w-full px-3 py-1.5 text-xs font-medium rounded-lg transition-all text-left ${
                    managerEducation.not_completed_reason === 'new_manager'
                      ? 'bg-yellow-700 text-white border border-yellow-600'
                      : 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700'
                  }`}
                >
                  관리책임자 신규지정
                </button>

                <button
                  type="button"
                  onClick={() => {
                    updateStepData('managerEducation', {
                      ...(managerEducation as Record<string, unknown>),
                      not_completed_reason: 'recent_installation',
                      not_completed_other_text: undefined
                    });
                  }}
                  className={`w-full px-3 py-1.5 text-xs font-medium rounded-lg transition-all text-left ${
                    managerEducation.not_completed_reason === 'recent_installation'
                      ? 'bg-yellow-700 text-white border border-yellow-600'
                      : 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700'
                  }`}
                >
                  최근 설치로 교육 이수 예정
                </button>

                <button
                  type="button"
                  onClick={() => {
                    updateStepData('managerEducation', {
                      ...(managerEducation as Record<string, unknown>),
                      not_completed_reason: 'other'
                    });
                  }}
                  className={`w-full px-3 py-1.5 text-xs font-medium rounded-lg transition-all text-left ${
                    managerEducation.not_completed_reason === 'other'
                      ? 'bg-yellow-700 text-white border border-yellow-600'
                      : 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700'
                  }`}
                >
                  기타
                </button>

                {/* 미이수 기타 사유 입력 */}
                {managerEducation.not_completed_reason === 'other' && (
                  <input
                    type="text"
                    placeholder="미이수 사유를 입력하세요"
                    value={managerEducation.not_completed_other_text || ''}
                    onChange={(e) => {
                      updateStepData('managerEducation', {
                        ...(managerEducation as Record<string, unknown>),
                        not_completed_other_text: e.target.value
                      });
                    }}
                    className="w-full px-3 py-2 text-xs bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/20"
                  />
                )}
              </div>
            </div>
          )}

          {/* 기타 선택 시 텍스트 입력 */}
          {managerEducation.education_status === 'other' && (
            <div className="pl-2 space-y-2 border-l-2 border-purple-600">
              <Label className="text-xs font-medium text-purple-400">교육 이수 현황 기타 내용</Label>
              <input
                type="text"
                placeholder="기타 교육 이수 현황을 입력하세요"
                value={managerEducation.education_other_text || ''}
                onChange={(e) => {
                  updateStepData('managerEducation', {
                    ...(managerEducation as Record<string, unknown>),
                    education_other_text: e.target.value
                  });
                }}
                className="w-full px-3 py-2 text-xs bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20"
              />
            </div>
          )}
        </div>
      </div>

      {/* 보건복지부 재난의료대응과 전달사항 */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-3">
        <div className="mb-3">
          <Label className="text-sm font-semibold text-white">
            보건복지부 재난의료대응과로 전달할 사항
          </Label>
          <p className="text-xs text-gray-400 mt-1">필요 시 자유롭게 기술해주세요</p>
        </div>

        <Textarea
          placeholder="전달할 사항을 입력하세요..."
          value={managerEducation.message_to_mohw || ''}
          onChange={(e) => {
            updateStepData('managerEducation', {
              ...managerEducation,
              message_to_mohw: e.target.value
            });
          }}
          className="min-h-[100px] bg-gray-900 border-gray-700 text-white placeholder-gray-500 text-xs"
        />
      </div>

      {/* 실시간 필수항목 검증 경고 */}
      <ValidationWarning missingFields={missingFields} />
    </div>
  );
}