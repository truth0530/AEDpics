'use client';

import { useState, useEffect, useMemo } from 'react';
import { useInspectionSessionStore } from '@/lib/state/inspection-session-store';
import { BatteryLifespanModal } from '../BatteryLifespanModal';
import { ValidationWarning } from '../ValidationWarning';
import { IssueNoteModal } from '../IssueNoteModal';
import { PhotoCaptureInput } from '../PhotoCaptureInput';
import { EditableSectionButtons } from '../EditableSectionButtons';

// 알려진 제조사-모델 매핑
const KNOWN_MANUFACTURER_MODELS: { [key: string]: string[] } = {
  '씨유메디칼': ['CU-SP1', 'CU-SP1 Plus', 'i-PAD CU-SP1', 'i-PAD NF1200'],
  '나눔테크': ['NT-381.C', 'ReHeart NT-381.C', 'NT-3000'],
  '라디안': ['HR-501', 'HR-501-B', 'HR-502', 'HR-503'],
  '필립스': ['HeartStart HS1', 'HeartStart FRx', 'HeartStart OnSite'],
  '메디아나': ['HeartSaver-A', 'Heart Saver-A', 'HeartOn A15', 'Hearton A15', 'HeartOn A10', 'Hearton A10'],
  '자일': ['CardioLife AED-3100', 'AED-2100K'],
  '프로젝트메드': ['HeartPlus NT-280', 'NT-180']
};

const DEVICE_FIELDS = [
  { key: 'manufacturer', label: '제조사', dbKey: 'manufacturer', placeholder: '예: 필립스, 나눔테크, 라디안 등' },
  { key: 'model_name', label: '모델명', dbKey: 'model_name', placeholder: '예: HeartStart FRx' },
  { key: 'serial_number', label: '제조번호(시리얼번호, SN)', dbKey: 'serial_number', placeholder: '장비 본체의 시리얼번호' },
];

const SUPPLY_FIELDS = [
  { key: 'battery_expiry_date', label: '배터리 유효기간', dbKey: 'battery_expiry_date', type: 'date' },
  { key: 'pad_expiry_date', label: '패드 유효기간', dbKey: 'patch_expiry_date', type: 'date' },
  { key: 'manufacturing_date', label: '제조일자', dbKey: 'manufacturing_date', type: 'date' },
];

// 날짜 포맷 헬퍼 함수: ISO 8601 → yyyy-mm-dd
function formatDateDisplay(isoDate: string): string {
  if (!isoDate) return '';
  // ISO 형식에서 날짜 부분만 추출 (2027-10-15T00:00:00.000Z → 2027-10-15)
  return isoDate.split('T')[0];
}

export function DeviceInfoStep() {
  const session = useInspectionSessionStore((state) => state.session);
  const stepData = useInspectionSessionStore((state) => state.stepData);
  const updateStepData = useInspectionSessionStore((state) => state.updateStepData);
  const updateFieldChange = useInspectionSessionStore((state) => state.updateFieldChange);

  const [isEditMode, setIsEditMode] = useState(false);
  const [showBatteryGuide, setShowBatteryGuide] = useState(false);
  const deviceInfo = (stepData.deviceInfo || {}) as Record<string, any>;
  // 🆕 Week 3: current_snapshot 우선 사용
  const sessionDeviceInfo = (session?.current_snapshot || session?.device_info || {}) as Record<string, any>;

  // 실시간 필수 항목 검증
  const missingFields = useMissingFields(deviceInfo);

  // 전체 일치 검증: DEVICE_FIELDS의 모든 필드가 원본과 일치하는지 확인
  const isActuallyMatching = useMemo(() => {
    return DEVICE_FIELDS.every((field) => {
      const originalValue = sessionDeviceInfo[field.dbKey] || '';
      const currentValue = deviceInfo[field.key] || '';
      return originalValue === currentValue;
    });
  }, [deviceInfo, sessionDeviceInfo]);

  // 초기 데이터 설정
  useEffect(() => {
    const snapshotData = session?.current_snapshot || session?.device_info;
    if (!deviceInfo.initialized && snapshotData && Object.keys(snapshotData).length > 0) {
      const initialData = {
        manufacturer: sessionDeviceInfo.manufacturer || '',
        model_name: sessionDeviceInfo.model_name || '',
        serial_number: sessionDeviceInfo.serial_number || sessionDeviceInfo.device_serial || '',
        device_status: sessionDeviceInfo.device_status || 'not_checked',
        indicator_status: sessionDeviceInfo.indicator_status || 'not_checked',
        battery_expiry_date: sessionDeviceInfo.battery_expiry_date || '',
        pad_expiry_date: sessionDeviceInfo.patch_expiry_date || '',
        manufacturing_date: sessionDeviceInfo.manufacturing_date || '',
        operation_status: sessionDeviceInfo.operation_status || '',
        initialized: true,
      };
      updateStepData('deviceInfo', initialData);
    }
  }, [sessionDeviceInfo, deviceInfo.initialized]);

  const handleChange = (field: string, value: string | string[]) => {
    updateStepData('deviceInfo', {
      ...deviceInfo,
      [field]: value,
    });
  };

  const handleMatchAll = () => {
    // 필수 필드가 비어있는지 확인
    const hasEmptyRequired = DEVICE_FIELDS.some((field) => {
      const value = sessionDeviceInfo[field.dbKey] || '';
      return !value.trim();
    });

    // 필수 필드가 비어있으면 경고하고 실행하지 않음
    if (hasEmptyRequired) {
      alert('등록된 정보에 비어있는 필수 항목이 있습니다. "수정" 버튼을 눌러 정보를 입력해주세요.');
      return;
    }

    // 원본 데이터를 deviceInfo에 복사하고 all_matched 플래그 설정
    const updatedInfo = { ...deviceInfo, all_matched: true };

    DEVICE_FIELDS.forEach((field) => {
      const originalValue = sessionDeviceInfo[field.dbKey] || '';
      updatedInfo[field.key] = originalValue;
    });

    updateStepData('deviceInfo', updatedInfo);
  };

  const handleEditAll = () => {
    if (isEditMode) {
      // 수정 모드에서 "저장" 버튼 클릭 - 저장 처리
      handleSaveEdit();
    } else if (deviceInfo.all_matched === 'edited') {
      // 이미 수정됨 상태에서 다시 수정 모드로
      setIsEditMode(true);
    } else {
      // 초기 상태에서 수정 모드로 - 원본 데이터를 먼저 복사
      const updatedInfo = { ...deviceInfo };
      DEVICE_FIELDS.forEach((field) => {
        // deviceInfo에 값이 없으면 원본 값을 복사
        if (!updatedInfo[field.key]) {
          const originalValue = sessionDeviceInfo[field.dbKey] || '';
          updatedInfo[field.key] = originalValue;
        }
      });
      updateStepData('deviceInfo', updatedInfo);
      setIsEditMode(true);
    }
  };

  const handleSaveEdit = () => {
    // ✅ 수정된 데이터를 all_matched: 'edited' 상태로 저장
    DEVICE_FIELDS.forEach((field) => {
      const originalValue = sessionDeviceInfo[field.dbKey] || '';
      const currentValue = deviceInfo[field.key] || '';

      if (currentValue !== originalValue && currentValue.trim() !== '') {
        updateFieldChange(field.key, {
          original: originalValue,
          corrected: currentValue,
          reason: '현장 확인 후 수정',
        });
      }
    });

    updateStepData('deviceInfo', { ...deviceInfo, all_matched: 'edited' });
    setIsEditMode(false);
  };

  const handleCancelEdit = () => {
    // 취소 시 원래 데이터로 복원
    const restoredInfo = { ...deviceInfo };
    DEVICE_FIELDS.forEach((field) => {
      const originalValue = sessionDeviceInfo[field.dbKey] || '';
      restoredInfo[field.key] = originalValue;
    });
    updateStepData('deviceInfo', restoredInfo);
    setIsEditMode(false);
  };

  // 제조사-모델 검증
  const validateManufacturerModel = () => {
    const manufacturer = deviceInfo.manufacturer || sessionDeviceInfo.manufacturer || '';
    const modelName = deviceInfo.model_name || sessionDeviceInfo.model_name || '';

    if (!manufacturer || !modelName) return null;

    const normalizedManufacturer = manufacturer
      .replace(/\(주\)/g, '')
      .replace(/주식회사/g, '')
      .trim();

    // ✅ 대소문자 무시 및 유연한 모델 매칭
    const normalizedModelName = modelName.toLowerCase().replace(/\s+/g, '');

    for (const [knownManufacturer, models] of Object.entries(KNOWN_MANUFACTURER_MODELS)) {
      if (normalizedManufacturer.includes(knownManufacturer)) {
        const modelMatched = models.some(model => {
          const normalizedKnownModel = model.toLowerCase().replace(/\s+/g, '');
          // 정확히 일치 또는 알려진 모델로 시작하는 경우 (예: HeartOn A15가 Hearton A15-G14에 매칭)
          return normalizedModelName === normalizedKnownModel || 
                 normalizedModelName.startsWith(normalizedKnownModel.replace(/-/g, ''));
        });
        
        if (!modelMatched) {
          return `⚠️ "${manufacturer}"의 알려지지 않은 모델: "${modelName}"`;
        }
        return null; // 정상
      }
    }

    return `ℹ️ 등록되지 않은 제조사: "${manufacturer}"`;
  };

  const renderField = (field: { key: string; label: string; dbKey: string; placeholder?: string; type?: string }) => {
    const originalValue = sessionDeviceInfo[field.dbKey] || '';
    const currentValue = deviceInfo[field.key] || '';

    // ✅ 수정됨 상태일 때는 currentValue를 표시
    const displayValue = (deviceInfo.all_matched === 'edited' && currentValue) ? currentValue : originalValue;

    // 수정된 필드인지 확인 (원본과 다른 경우)
    const isModified = deviceInfo.all_matched === 'edited' && currentValue && originalValue !== currentValue;

    return (
      <div key={field.key} className="space-y-1">
        <div className="text-xs font-medium text-gray-400">
          {field.label}
        </div>

        {!isEditMode ? (
          <div className={`text-sm font-medium truncate ${isModified ? 'text-yellow-300' : 'text-gray-100'}`}>
            {displayValue || '-'}
          </div>
        ) : (
          <input
            type={field.type || 'text'}
            value={currentValue}
            onChange={(e) => handleChange(field.key, e.target.value)}
            onFocus={(e) => {
              if (field.type !== 'date') {
                const len = e.target.value.length;
                e.target.setSelectionRange(len, len);
              }
            }}
            className="w-full rounded-lg px-3 py-1.5 bg-gray-800 border border-gray-600 text-sm text-white placeholder-gray-500 focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
            placeholder={field.placeholder || '현장 정보 입력'}
          />
        )}
      </div>
    );
  };

  return (
    <>
      {/* Battery Guide Modal */}
      {showBatteryGuide && (
        <BatteryLifespanModal onClose={() => setShowBatteryGuide(false)} />
      )}

      <div className="space-y-4">
        {/* 안내 메시지 */}
        <div className="rounded-lg bg-green-900/10 border border-green-600/20 p-3">
          <p className="text-xs sm:text-sm text-green-300">
            💡 등록된 장비 정보가 현장과 일치하면 <strong>"전체 일치"</strong>를, 수정이 필요하면 <strong>"수정"</strong> 버튼을 누르세요.
          </p>
        </div>

      {/* 장비 정보 필드 */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-4">
        <div className="space-y-4">
          {/* 첫 번째 행: 제조사, 모델명 (1:1 비율) */}
          <div className="grid grid-cols-2 gap-4">
            {renderField(DEVICE_FIELDS[0])} {/* 제조사 */}
            {renderField(DEVICE_FIELDS[1])} {/* 모델명 */}
          </div>

          {/* 제조사-모델 검증 경고 */}
          {validateManufacturerModel() && (
            <div className="rounded-lg bg-yellow-900/20 border border-yellow-600/30 px-3 py-2">
              <p className="text-xs text-yellow-300">
                {validateManufacturerModel()}
              </p>
            </div>
          )}

          {/* 두 번째 행: 시리얼번호 */}
          <div>
            {renderField(DEVICE_FIELDS[2])} {/* 시리얼번호 */}
          </div>
        </div>

        {/* 전체 일치/수정 버튼 */}
        <div className="mt-4 pt-4 border-t border-gray-700/50">
          <EditableSectionButtons
            isEditMode={isEditMode}
            isMatching={isActuallyMatching}
            matchedState={deviceInfo.all_matched}
            onLeftClick={() => {
              if (isEditMode) {
                handleCancelEdit();
              } else {
                handleEditAll();
              }
            }}
            onRightClick={() => {
              if (isEditMode) {
                handleSaveEdit();
              } else {
                handleMatchAll();
              }
            }}
            matchText="전체 일치"
            matchedText="전체 일치 확인됨"
          />
        </div>
      </div>

      {/* 표시등 경고 메시지 */}
      {(deviceInfo.indicator_status === 'red' || deviceInfo.indicator_status === 'blinking') && (
        <div className="rounded-lg bg-red-900/20 border border-red-600/30 p-3">
          <p className="text-xs text-red-300">
            ⚠️ 표시등이 적색이거나 깜빡이는 경우 즉시 조치가 필요합니다.
          </p>
        </div>
      )}

      {/* 소모품 정보 */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-4">
        <h4 className="font-semibold text-white text-sm mb-4">소모품 정보</h4>

        {/* 제조일자 심볼 안내 */}
        <div className="rounded-lg bg-blue-900/10 border border-blue-600/20 px-3 py-2 mb-4">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 flex-shrink-0 text-blue-300" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="8" strokeLinejoin="miter" strokeLinecap="square">
              <path d="M 10 90 L 10 50 L 20 40 L 30 50 L 40 40 L 50 50 L 60 40 L 70 50 L 70 20 L 90 20 L 90 90 Z" />
            </svg>
            <p className="text-[10px] text-blue-200 leading-relaxed">
              배터리 유효기간은 배터리 제조일로부터 4년 단, 제조사 마다 상이할 수 있음. 제조일자는 공장 건물 형태의 국제 표준 심볼마크와 함께 표기되어 있습니다.
            </p>
          </div>
        </div>

        {/* 배터리 유효기간 */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-gray-400">
              배터리 유효기간
            </div>
            <button
              type="button"
              onClick={() => setShowBatteryGuide(true)}
              className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              제조사별 유효기간 확인하기
            </button>
          </div>
          {(() => {
            const field = SUPPLY_FIELDS[0]; // battery_expiry_date
            const originalValue = sessionDeviceInfo[field.dbKey] || '';
            const currentValue = deviceInfo[field.key] || originalValue;
            const matchedState = deviceInfo[`${field.key}_matched`];
            const isEditMode = matchedState === false;
            const isMatched = matchedState === true;
            const isEdited = matchedState === 'edited';
            const isUnchecked = matchedState === undefined;

            // 날짜 포맷 적용
            const formattedOriginalValue = formatDateDisplay(originalValue);
            const formattedCurrentValue = formatDateDisplay(currentValue);
            const isActuallyMatching = formattedCurrentValue === formattedOriginalValue && formattedCurrentValue.trim() !== '';

            // 만료 여부 확인
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const originalIsExpired = formattedOriginalValue ? new Date(formattedOriginalValue) < today : false;
            const currentIsExpired = formattedCurrentValue ? new Date(formattedCurrentValue) < today : false;

            // 조치계획/수정사유 필드
            const actionPlan = deviceInfo.battery_action_plan || '';
            const actionCustomReason = deviceInfo.battery_action_custom_reason || '';
            const modificationReason = deviceInfo.battery_modification_reason || '';

            return (
              <div className="flex flex-col gap-2">
                {isUnchecked && (
                  <>
                    <div className={`w-full rounded-lg px-3 py-2 border text-sm flex items-center gap-2 ${
                      originalIsExpired
                        ? 'bg-red-900/20 border-red-600/50 text-red-300'
                        : 'bg-gray-800/50 border-gray-700 text-gray-300'
                    }`}>
                      {originalIsExpired && (
                        <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      )}
                      <span>{formattedOriginalValue || '등록 정보 없음'} {originalIsExpired && '(만료)'}</span>
                    </div>
                    {/* 초기 상태에서도 만료되면 즉시 조치계획 입력 가능 */}
                    {originalIsExpired && formattedOriginalValue && (
                      <div className="space-y-2 pl-3 border-l-2 border-red-500/50">
                        <div className="text-xs text-red-400 font-medium">유효기간 경과 - 조치계획 입력</div>
                        <select
                          value={actionPlan}
                          onChange={(e) => {
                            const newValue = e.target.value;
                            if (newValue !== '기타') {
                              // 기타가 아닌 경우, 조치계획과 커스텀 사유를 동시에 업데이트
                              updateStepData('deviceInfo', {
                                ...deviceInfo,
                                battery_action_plan: newValue,
                                battery_action_custom_reason: '',
                              });
                            } else {
                              handleChange('battery_action_plan', newValue);
                            }
                          }}
                          className="w-full rounded-lg px-3 py-2 bg-gray-800 border border-red-500/50 text-sm text-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                        >
                          <option value="">조치계획 선택</option>
                          <option value="구매신청서 확인 완료">구매신청서 확인 완료</option>
                          <option value="현장 관리자에게 교체 권고">현장 관리자에게 교체 권고</option>
                          <option value="과태료 부과 예정">과태료 부과 예정</option>
                          <option value="기타">기타</option>
                        </select>

                        {actionPlan === '기타' && (
                          <input
                            type="text"
                            value={actionCustomReason}
                            onChange={(e) => handleChange('battery_action_custom_reason', e.target.value)}
                            placeholder="기타 조치계획을 입력하세요"
                            className="w-full rounded-lg px-3 py-2 bg-gray-800 border border-red-500/50 text-sm text-white placeholder-gray-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                          />
                        )}
                      </div>
                    )}
                  </>
                )}

                {isMatched && (
                  <>
                    <div className="w-full rounded-lg px-3 py-2 bg-green-600/10 border border-green-600/50 text-sm text-green-300 flex items-center gap-2">
                      <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>{formattedCurrentValue || '정보 없음'}</span>
                    </div>
                    {/* 일치 확인했지만 만료 상태면 조치계획 필수 (언제든 변경 가능) */}
                    {currentIsExpired && formattedCurrentValue && (
                      <div className="space-y-2 pl-3 border-l-2 border-red-500/50">
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-red-400 font-medium">유효기간 경과 - 조치계획</div>
                          <div className="text-[10px] text-gray-500">변경 가능</div>
                        </div>
                        <select
                          value={actionPlan}
                          onChange={(e) => {
                            const newValue = e.target.value;
                            if (newValue !== '기타') {
                              // 기타가 아닌 경우, 조치계획과 커스텀 사유를 동시에 업데이트
                              updateStepData('deviceInfo', {
                                ...deviceInfo,
                                battery_action_plan: newValue,
                                battery_action_custom_reason: '',
                              });
                            } else {
                              handleChange('battery_action_plan', newValue);
                            }
                          }}
                          className="w-full rounded-lg px-3 py-2 bg-gray-800 border border-red-500/50 text-sm text-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                        >
                          <option value="">조치계획 선택</option>
                          <option value="구매신청서 확인 완료">구매신청서 확인 완료</option>
                          <option value="현장 관리자에게 교체 권고">현장 관리자에게 교체 권고</option>
                          <option value="과태료 부과 예정">과태료 부과 예정</option>
                          <option value="기타">기타</option>
                        </select>

                        {actionPlan === '기타' && (
                          <input
                            type="text"
                            value={actionCustomReason}
                            onChange={(e) => handleChange('battery_action_custom_reason', e.target.value)}
                            placeholder="기타 조치계획을 입력하세요"
                            className="w-full rounded-lg px-3 py-2 bg-gray-800 border border-red-500/50 text-sm text-white placeholder-gray-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                          />
                        )}
                      </div>
                    )}
                  </>
                )}

                {isEdited && (
                  <>
                    <div className="w-full text-sm text-yellow-300 flex items-center gap-2">
                      <span>{formattedCurrentValue || '정보 없음'}</span>
                    </div>
                    {/* 수정됨 상태에서도 수정사유 변경 가능 */}
                    {!currentIsExpired && formattedCurrentValue && originalIsExpired && (
                      <div className="space-y-2 pl-3 border-l-2 border-blue-500/50">
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-blue-400 font-medium">수정사유</div>
                          <div className="text-[10px] text-gray-500">변경 가능</div>
                        </div>
                        <select
                          value={modificationReason}
                          onChange={(e) => {
                            handleChange('battery_modification_reason', e.target.value);
                            if (e.target.value !== '기타') {
                              handleChange('battery_action_custom_reason', '');
                            }
                          }}
                          className="w-full rounded-lg px-3 py-2 bg-gray-800 border border-blue-500/50 text-sm text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        >
                          <option value="">수정사유 선택</option>
                          <option value="교체완료, 다음 점검시 반영예정">교체완료, 다음 점검시 반영예정</option>
                          <option value="기존정보 오류, 다음 점검시 반영예정">기존정보 오류, 다음 점검시 반영예정</option>
                          <option value="기타">기타</option>
                        </select>

                        {modificationReason === '기타' && (
                          <input
                            type="text"
                            value={actionCustomReason}
                            onChange={(e) => handleChange('battery_action_custom_reason', e.target.value)}
                            placeholder="기타 수정사유를 입력하세요"
                            className="w-full rounded-lg px-3 py-2 bg-gray-800 border border-blue-500/50 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                          />
                        )}
                      </div>
                    )}
                  </>
                )}

                {isEditMode && (
                  <div className="space-y-2">
                    <input
                      type="date"
                      value={formattedCurrentValue}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      className="w-full rounded-lg px-3 py-2 bg-gray-800 border-2 border-yellow-500/50 text-sm text-white focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20"
                    />

                    {/* 수정 중 만료된 경우에만 조치계획 선택 */}
                    {currentIsExpired && formattedCurrentValue && (
                      <div className="space-y-2 pl-3 border-l-2 border-red-500/50">
                        <div className="text-xs text-red-400 font-medium">
                          유효기간 경과 - 조치계획
                        </div>
                        <select
                          value={actionPlan}
                          onChange={(e) => {
                            const newValue = e.target.value;
                            if (newValue !== '기타') {
                              // 기타가 아닌 경우, 조치계획과 커스텀 사유를 동시에 업데이트
                              updateStepData('deviceInfo', {
                                ...deviceInfo,
                                battery_action_plan: newValue,
                                battery_action_custom_reason: '',
                              });
                            } else {
                              handleChange('battery_action_plan', newValue);
                            }
                          }}
                          className="w-full rounded-lg px-3 py-2 bg-gray-800 border border-red-500/50 text-sm text-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                        >
                          <option value="">조치계획 선택</option>
                          <option value="구매신청서 확인 완료">구매신청서 확인 완료</option>
                          <option value="현장 관리자에게 교체 권고">현장 관리자에게 교체 권고</option>
                          <option value="과태료 부과 예정">과태료 부과 예정</option>
                          <option value="기타">기타</option>
                        </select>

                        {actionPlan === '기타' && (
                          <input
                            type="text"
                            value={actionCustomReason}
                            onChange={(e) => handleChange('battery_action_custom_reason', e.target.value)}
                            placeholder="기타 조치계획을 입력하세요"
                            className="w-full rounded-lg px-3 py-2 bg-gray-800 border border-red-500/50 text-sm text-white placeholder-gray-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                          />
                        )}
                      </div>
                    )}

                    {/* 수정 후 유효 → 수정사유 선택 */}
                    {!currentIsExpired && formattedCurrentValue && originalIsExpired && (
                      <div className="space-y-2 pl-3 border-l-2 border-blue-500/50">
                        <div className="text-xs text-blue-400 font-medium">수정사유 (월별 점검자에게 안내)</div>
                        <select
                          value={modificationReason}
                          onChange={(e) => {
                            handleChange('battery_modification_reason', e.target.value);
                            if (e.target.value !== '기타') {
                              handleChange('battery_action_custom_reason', '');
                            }
                          }}
                          className="w-full rounded-lg px-3 py-2 bg-gray-800 border border-blue-500/50 text-sm text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        >
                          <option value="">수정사유 선택</option>
                          <option value="교체완료, 다음 점검시 반영예정">교체완료, 다음 점검시 반영예정</option>
                          <option value="기존정보 오류, 다음 점검시 반영예정">기존정보 오류, 다음 점검시 반영예정</option>
                          <option value="기타">기타</option>
                        </select>

                        {modificationReason === '기타' && (
                          <input
                            type="text"
                            value={actionCustomReason}
                            onChange={(e) => handleChange('battery_action_custom_reason', e.target.value)}
                            placeholder="기타 수정사유를 입력하세요"
                            className="w-full rounded-lg px-3 py-2 bg-gray-800 border border-blue-500/50 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                          />
                        )}
                      </div>
                    )}

                    {formattedOriginalValue && (
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        등록 정보: {formattedOriginalValue} {originalIsExpired && '(만료)'}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (isEdited && !isActuallyMatching) {
                        // 수정됨 상태에서 다시 수정 모드 활성화 (원본과 다를 때만)
                        updateStepData('deviceInfo', { ...deviceInfo, [`${field.key}_matched`]: false });
                      } else if (isMatched || (!isEdited && !isMatched && !isEditMode)) {
                        // 일치 확인됨 상태 또는 초기 상태에서 수정 모드 활성화
                        updateStepData('deviceInfo', { ...deviceInfo, [`${field.key}_matched`]: false });
                      }
                    }}
                    disabled={isEditMode || (isEdited && isActuallyMatching)}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                      isEditMode
                        ? 'bg-gray-800/50 border border-gray-700/50 text-gray-500 cursor-not-allowed'
                        : isEdited
                        ? isActuallyMatching
                          ? 'bg-gray-800/50 border border-gray-700/50 text-gray-600 cursor-not-allowed'
                          : 'bg-green-600/30 border-2 border-green-500 text-green-200 cursor-default shadow-lg shadow-green-500/20'
                        : 'bg-gray-700 border border-gray-600 text-gray-300 hover:bg-gray-600 hover:border-yellow-500/50 active:bg-gray-500'
                    }`}
                  >
                    {isEdited ? (
                      isActuallyMatching ? (
                        '원본과 동일'
                      ) : (
                        <span className="flex items-center justify-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                          수정됨
                        </span>
                      )
                    ) : (
                      '수정'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (isEditMode && !isActuallyMatching) {
                        // 수정 모드에서 확인 - 변경사항 저장
                        // 만료 상태 검증
                        if (currentIsExpired && formattedCurrentValue) {
                          if (!actionPlan) {
                            alert('유효기간이 경과한 배터리에 대한 조치계획을 선택해주세요.');
                            return;
                          }
                          if (actionPlan === '기타' && !actionCustomReason.trim()) {
                            alert('기타 조치계획을 입력해주세요.');
                            return;
                          }
                        }

                        // 수정사유 검증 (만료 → 유효로 변경)
                        if (!currentIsExpired && formattedCurrentValue && originalIsExpired) {
                          if (!modificationReason.trim()) {
                            alert('유효기간을 수정한 사유를 입력해주세요.');
                            return;
                          }
                        }

                        updateStepData('deviceInfo', { ...deviceInfo, [`${field.key}_matched`]: 'edited' });
                      } else if (isActuallyMatching) {
                        // 일치 확인 시에도 만료 상태면 조치계획 필수
                        if (currentIsExpired && formattedCurrentValue) {
                          if (!actionPlan) {
                            alert('유효기간이 경과한 배터리에 대한 조치계획을 선택해주세요.');
                            return;
                          }
                          if (actionPlan === '기타' && !actionCustomReason.trim()) {
                            alert('기타 조치계획을 입력해주세요.');
                            return;
                          }
                        }
                        updateStepData('deviceInfo', { ...deviceInfo, [`${field.key}_matched`]: true });
                      }
                    }}
                    disabled={isMatched || (!isEditMode && !isActuallyMatching)}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                      isMatched
                        ? 'bg-green-600/30 border-2 border-green-500 text-green-200 cursor-default shadow-lg shadow-green-500/20'
                        : isEditMode && !isActuallyMatching
                        ? 'bg-yellow-600 hover:bg-yellow-700 border-2 border-yellow-500 text-white shadow-lg shadow-yellow-500/20'
                        : isActuallyMatching
                        ? 'bg-gray-700 border border-gray-600 text-gray-300 hover:bg-gray-600 hover:border-green-500/50 active:bg-gray-500'
                        : 'bg-gray-800/50 border border-gray-700/50 text-gray-600 cursor-not-allowed'
                    }`}
                  >
                    {isMatched ? (
                      <span className="flex items-center justify-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        일치 확인됨
                      </span>
                    ) : isEditMode && !isActuallyMatching ? (
                      <span className="flex items-center justify-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        확인
                      </span>
                    ) : isEdited && isActuallyMatching ? (
                      '일치로 변경'
                    ) : (
                      '일치'
                    )}
                  </button>
                </div>
              </div>
            );
          })()}
        </div>

        {/* 유효기간 심볼 안내 (반복) */}
        <div className="rounded-lg bg-blue-900/10 border border-blue-600/20 px-3 py-2 mb-4">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 flex-shrink-0 text-blue-300" viewBox="0 0 100 100">
              <defs>
                <clipPath id="sandClip2">
                  <rect x="0" y="73" width="100" height="50"/>
                </clipPath>
              </defs>
              <path
                d="M 35 10 L 25 10 L 25 30 L 45 52 L 45 58"
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinejoin="miter"
                strokeLinecap="butt"
              />
              <path
                d="M 65 10 L 75 10 L 75 30 L 55 52 L 55 58"
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinejoin="miter"
                strokeLinecap="butt"
              />
              <path
                d="M 35 10 H 65"
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="butt"
              />
              <path
                d="M 45 58 L 25 78 L 25 93"
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinejoin="miter"
                strokeLinecap="butt"
              />
              <path
                d="M 55 58 L 75 78 L 75 93"
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinejoin="miter"
                strokeLinecap="butt"
              />
              <path
                d="M 25 93 H 75"
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="butt"
              />
              <path
                d="M 45 58 L 25 78 L 25 93 H 75 L 75 78 L 55 58 Z"
                fill="currentColor"
                clipPath="url(#sandClip2)"
              />
            </svg>
            <p className="text-[10px] text-blue-200 leading-relaxed">
              <strong>유효기간:</strong> 모래시계 심볼, Expiry Date, EXP 등으로 표기되어 있습니다.
            </p>
          </div>
        </div>

        {/* 패드 유효기간 및 제조일자 */}
        <div className="grid grid-cols-1 gap-4">
          {[SUPPLY_FIELDS[1], SUPPLY_FIELDS[2]].map((field) => {
            const originalValue = sessionDeviceInfo[field.dbKey] || '';
            const currentValue = deviceInfo[field.key] || originalValue;
            const matchedState = deviceInfo[`${field.key}_matched`];
            const isEditMode = matchedState === false;
            const isMatched = matchedState === true;
            const isEdited = matchedState === 'edited';
            const isUnchecked = matchedState === undefined;

            // 날짜 포맷 적용
            const formattedOriginalValue = formatDateDisplay(originalValue);
            const formattedCurrentValue = formatDateDisplay(currentValue);
            const isActuallyMatching = formattedCurrentValue === formattedOriginalValue && formattedCurrentValue.trim() !== '';
            const displayLabel = field.key === 'manufacturing_date' ? '제조일자(본체)' : field.label;

            // 만료 여부 확인
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            let originalIsExpired = false;
            let currentIsExpired = false;

            if (field.key === 'manufacturing_date') {
              // 제조일자: 10년 경과 여부 확인
              if (formattedOriginalValue) {
                const originalDate = new Date(formattedOriginalValue);
                originalDate.setFullYear(originalDate.getFullYear() + 10);
                originalIsExpired = originalDate < today;
              }
              if (formattedCurrentValue) {
                const currentDate = new Date(formattedCurrentValue);
                currentDate.setFullYear(currentDate.getFullYear() + 10);
                currentIsExpired = currentDate < today;
              }
            } else {
              // 패드 유효기간: 날짜 경과 여부 확인
              originalIsExpired = formattedOriginalValue ? new Date(formattedOriginalValue) < today : false;
              currentIsExpired = formattedCurrentValue ? new Date(formattedCurrentValue) < today : false;
            }

            // 조치계획/수정사유 필드명 (필드별로 다름)
            const actionPlanKey = `${field.key}_action_plan`;
            const actionCustomReasonKey = `${field.key}_action_custom_reason`;
            const modificationReasonKey = `${field.key}_modification_reason`;

            const actionPlan = deviceInfo[actionPlanKey] || '';
            const actionCustomReason = deviceInfo[actionCustomReasonKey] || '';
            const modificationReason = deviceInfo[modificationReasonKey] || '';

            return (
              <div key={field.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-gray-400">
                    {displayLabel}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {isUnchecked && (
                    <>
                      <div className={`w-full rounded-lg px-3 py-2 border text-sm flex items-center gap-2 ${
                        originalIsExpired
                          ? 'bg-red-900/20 border-red-600/50 text-red-300'
                          : 'bg-gray-800/50 border-gray-700 text-gray-300'
                      }`}>
                        {originalIsExpired && (
                          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        )}
                        <span>
                          {formattedOriginalValue || '등록 정보 없음'}
                          {originalIsExpired && (field.key === 'manufacturing_date' ? ' (10년 경과)' : ' (만료)')}
                        </span>
                      </div>
                      {/* 초기 상태에서도 만료되면 즉시 조치계획 입력 가능 */}
                      {originalIsExpired && formattedOriginalValue && (
                        <div className="space-y-2 pl-3 border-l-2 border-red-500/50">
                          <div className="text-xs text-red-400 font-medium">
                            {field.key === 'manufacturing_date' ? '제조일 10년 경과 - 조치계획 입력' : '유효기간 경과 - 조치계획 입력'}
                          </div>
                          <select
                            value={actionPlan}
                            onChange={(e) => {
                              const newValue = e.target.value;
                              if (newValue !== '기타') {
                                // 기타가 아닌 경우, 조치계획과 커스텀 사유를 동시에 업데이트
                                updateStepData('deviceInfo', {
                                  ...deviceInfo,
                                  [actionPlanKey]: newValue,
                                  [actionCustomReasonKey]: '',
                                });
                              } else {
                                handleChange(actionPlanKey, newValue);
                              }
                            }}
                            className="w-full rounded-lg px-3 py-2 bg-gray-800 border border-red-500/50 text-sm text-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                          >
                            <option value="">조치계획 선택</option>
                            <option value="구매신청서 확인 완료">구매신청서 확인 완료</option>
                            <option value="현장 관리자에게 교체 권고">현장 관리자에게 교체 권고</option>
                            <option value="과태료 부과 예정">과태료 부과 예정</option>
                            <option value="기타">기타</option>
                          </select>

                          {actionPlan === '기타' && (
                            <input
                              type="text"
                              value={actionCustomReason}
                              onChange={(e) => handleChange(actionCustomReasonKey, e.target.value)}
                              placeholder="기타 조치계획을 입력하세요"
                              className="w-full rounded-lg px-3 py-2 bg-gray-800 border border-red-500/50 text-sm text-white placeholder-gray-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                            />
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {isMatched && (
                    <>
                      <div className="w-full rounded-lg px-3 py-2 bg-green-600/10 border border-green-600/50 text-sm text-green-300 flex items-center gap-2">
                        <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span>{formattedCurrentValue || '정보 없음'}</span>
                      </div>
                      {/* 일치 확인했지만 만료 상태면 조치계획 필수 (언제든 변경 가능) */}
                      {currentIsExpired && formattedCurrentValue && (
                        <div className="space-y-2 pl-3 border-l-2 border-red-500/50">
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-red-400 font-medium">
                              {field.key === 'manufacturing_date' ? '제조일 10년 경과 - 조치계획' : '유효기간 경과 - 조치계획'}
                            </div>
                            <div className="text-[10px] text-gray-500">변경 가능</div>
                          </div>
                          <select
                            value={actionPlan}
                            onChange={(e) => {
                              const newValue = e.target.value;
                              if (newValue !== '기타') {
                                // 기타가 아닌 경우, 조치계획과 커스텀 사유를 동시에 업데이트
                                updateStepData('deviceInfo', {
                                  ...deviceInfo,
                                  [actionPlanKey]: newValue,
                                  [actionCustomReasonKey]: '',
                                });
                              } else {
                                handleChange(actionPlanKey, newValue);
                              }
                            }}
                            className="w-full rounded-lg px-3 py-2 bg-gray-800 border border-red-500/50 text-sm text-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                          >
                            <option value="">조치계획 선택</option>
                            <option value="구매신청서 확인 완료">구매신청서 확인 완료</option>
                            <option value="현장 관리자에게 교체 권고">현장 관리자에게 교체 권고</option>
                            <option value="과태료 부과 예정">과태료 부과 예정</option>
                            <option value="기타">기타</option>
                          </select>

                          {actionPlan === '기타' && (
                            <input
                              type="text"
                              value={actionCustomReason}
                              onChange={(e) => handleChange(actionCustomReasonKey, e.target.value)}
                              placeholder="기타 조치계획을 입력하세요"
                              className="w-full rounded-lg px-3 py-2 bg-gray-800 border border-red-500/50 text-sm text-white placeholder-gray-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                            />
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {isEdited && (
                    <>
                      <div className="w-full text-sm text-yellow-300 flex items-center gap-2">
                        <span>{formattedCurrentValue || '정보 없음'}</span>
                      </div>
                      {/* 수정됨 상태에서도 수정사유 변경 가능 */}
                      {!currentIsExpired && formattedCurrentValue && originalIsExpired && (
                        <div className="space-y-2 pl-3 border-l-2 border-blue-500/50">
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-blue-400 font-medium">수정사유</div>
                            <div className="text-[10px] text-gray-500">변경 가능</div>
                          </div>
                          <select
                            value={modificationReason}
                            onChange={(e) => {
                              handleChange(modificationReasonKey, e.target.value);
                              if (e.target.value !== '기타') {
                                handleChange(actionCustomReasonKey, '');
                              }
                            }}
                            className="w-full rounded-lg px-3 py-2 bg-gray-800 border border-blue-500/50 text-sm text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                          >
                            <option value="">수정사유 선택</option>
                            <option value="교체완료, 다음 점검시 반영예정">교체완료, 다음 점검시 반영예정</option>
                            <option value="기존정보 오류, 다음 점검시 반영예정">기존정보 오류, 다음 점검시 반영예정</option>
                            <option value="기타">기타</option>
                          </select>

                          {modificationReason === '기타' && (
                            <input
                              type="text"
                              value={actionCustomReason}
                              onChange={(e) => handleChange(actionCustomReasonKey, e.target.value)}
                              placeholder="기타 수정사유를 입력하세요"
                              className="w-full rounded-lg px-3 py-2 bg-gray-800 border border-blue-500/50 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                            />
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {isEditMode && (
                    <div className="space-y-2">
                      <input
                        type="date"
                        value={formattedCurrentValue}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                        className="w-full rounded-lg px-3 py-2 bg-gray-800 border-2 border-yellow-500/50 text-sm text-white focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20"
                      />

                      {/* 만료 여부에 따른 추가 입력 필드 */}
                      {currentIsExpired && formattedCurrentValue && (
                        <div className="space-y-2 pl-3 border-l-2 border-red-500/50">
                          <div className="text-xs text-red-400 font-medium">
                            {field.key === 'manufacturing_date' ? '제조일 10년 경과 - 조치계획' : '유효기간 경과 - 조치계획'}
                          </div>
                          <select
                            value={actionPlan}
                            onChange={(e) => {
                              const newValue = e.target.value;
                              if (newValue !== '기타') {
                                // 기타가 아닌 경우, 조치계획과 커스텀 사유를 동시에 업데이트
                                updateStepData('deviceInfo', {
                                  ...deviceInfo,
                                  [actionPlanKey]: newValue,
                                  [actionCustomReasonKey]: '',
                                });
                              } else {
                                handleChange(actionPlanKey, newValue);
                              }
                            }}
                            className="w-full rounded-lg px-3 py-2 bg-gray-800 border border-red-500/50 text-sm text-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                          >
                            <option value="">조치계획 선택</option>
                            <option value="구매신청서 확인 완료">구매신청서 확인 완료</option>
                            <option value="현장 관리자에게 교체 권고">현장 관리자에게 교체 권고</option>
                            <option value="과태료 부과 예정">과태료 부과 예정</option>
                            <option value="기타">기타</option>
                          </select>

                          {actionPlan === '기타' && (
                            <input
                              type="text"
                              value={actionCustomReason}
                              onChange={(e) => handleChange(actionCustomReasonKey, e.target.value)}
                              placeholder="기타 조치계획을 입력하세요"
                              className="w-full rounded-lg px-3 py-2 bg-gray-800 border border-red-500/50 text-sm text-white placeholder-gray-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                            />
                          )}
                        </div>
                      )}

                      {/* 수정 후 유효 → 수정사유 선택 */}
                      {!currentIsExpired && formattedCurrentValue && originalIsExpired && (
                        <div className="space-y-2 pl-3 border-l-2 border-blue-500/50">
                          <div className="text-xs text-blue-400 font-medium">수정사유 (월별 점검자에게 안내)</div>
                          <select
                            value={modificationReason}
                            onChange={(e) => {
                              handleChange(modificationReasonKey, e.target.value);
                              if (e.target.value !== '기타') {
                                handleChange(actionCustomReasonKey, '');
                              }
                            }}
                            className="w-full rounded-lg px-3 py-2 bg-gray-800 border border-blue-500/50 text-sm text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                          >
                            <option value="">수정사유 선택</option>
                            <option value="교체완료, 다음 점검시 반영예정">교체완료, 다음 점검시 반영예정</option>
                            <option value="기존정보 오류, 다음 점검시 반영예정">기존정보 오류, 다음 점검시 반영예정</option>
                            <option value="기타">기타</option>
                          </select>

                          {modificationReason === '기타' && (
                            <input
                              type="text"
                              value={actionCustomReason}
                              onChange={(e) => handleChange(actionCustomReasonKey, e.target.value)}
                              placeholder="기타 수정사유를 입력하세요"
                              className="w-full rounded-lg px-3 py-2 bg-gray-800 border border-blue-500/50 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                            />
                          )}
                        </div>
                      )}

                      {formattedOriginalValue && (
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                          등록 정보: {formattedOriginalValue} {originalIsExpired && (field.key === 'manufacturing_date' ? '(10년 경과)' : '(만료)')}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (isEdited && !isActuallyMatching) {
                          updateStepData('deviceInfo', { ...deviceInfo, [`${field.key}_matched`]: false });
                        } else if (isMatched || (!isEdited && !isMatched && !isEditMode)) {
                          // 일치 확인됨 상태 또는 초기 상태에서 수정 모드 활성화
                          updateStepData('deviceInfo', { ...deviceInfo, [`${field.key}_matched`]: false });
                        }
                      }}
                      disabled={isEditMode || (isEdited && isActuallyMatching)}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                        isEditMode
                          ? 'bg-gray-800/50 border border-gray-700/50 text-gray-500 cursor-not-allowed'
                          : isEdited
                          ? isActuallyMatching
                            ? 'bg-gray-800/50 border border-gray-700/50 text-gray-600 cursor-not-allowed'
                            : 'bg-green-600/30 border-2 border-green-500 text-green-200 cursor-default shadow-lg shadow-green-500/20'
                          : 'bg-gray-700 border border-gray-600 text-gray-300 hover:bg-gray-600 hover:border-yellow-500/50 active:bg-gray-500'
                      }`}
                    >
                      {isEdited ? (
                        isActuallyMatching ? (
                          '원본과 동일'
                        ) : (
                          <span className="flex items-center justify-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                            수정됨
                          </span>
                        )
                      ) : (
                        '수정'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (isEditMode && !isActuallyMatching) {
                          // 수정 모드에서 확인 - 변경사항 저장
                          // 만료 상태 검증
                          if (currentIsExpired && formattedCurrentValue) {
                            if (!actionPlan) {
                              const fieldName = field.key === 'manufacturing_date' ? '제조일 10년 경과' : '유효기간 경과';
                              alert(`${fieldName}에 대한 조치계획을 선택해주세요.`);
                              return;
                            }
                            if (actionPlan === '기타' && !actionCustomReason.trim()) {
                              alert('기타 조치계획을 입력해주세요.');
                              return;
                            }
                          }

                          // 수정사유 검증 (만료 → 유효로 변경)
                          if (!currentIsExpired && formattedCurrentValue && originalIsExpired) {
                            if (!modificationReason.trim()) {
                              const fieldName = field.key === 'manufacturing_date' ? '제조일자' : '유효기간';
                              alert(`${fieldName}을 수정한 사유를 입력해주세요.`);
                              return;
                            }
                          }

                          updateStepData('deviceInfo', { ...deviceInfo, [`${field.key}_matched`]: 'edited' });
                        } else if (isActuallyMatching) {
                          // 일치 확인 시에도 만료 상태면 조치계획 필수
                          if (currentIsExpired && formattedCurrentValue) {
                            if (!actionPlan) {
                              const fieldName = field.key === 'manufacturing_date' ? '제조일 10년 경과' : '유효기간 경과';
                              alert(`${fieldName}에 대한 조치계획을 선택해주세요.`);
                              return;
                            }
                            if (actionPlan === '기타' && !actionCustomReason.trim()) {
                              alert('기타 조치계획을 입력해주세요.');
                              return;
                            }
                          }
                          updateStepData('deviceInfo', { ...deviceInfo, [`${field.key}_matched`]: true });
                        }
                      }}
                      disabled={isMatched || (!isEditMode && !isActuallyMatching)}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                        isMatched
                          ? 'bg-green-600/30 border-2 border-green-500 text-green-200 cursor-default shadow-lg shadow-green-500/20'
                          : isEditMode && !isActuallyMatching
                          ? 'bg-yellow-600 hover:bg-yellow-700 border-2 border-yellow-500 text-white shadow-lg shadow-yellow-500/20'
                          : isActuallyMatching
                          ? 'bg-gray-700 border border-gray-600 text-gray-300 hover:bg-gray-600 hover:border-green-500/50 active:bg-gray-500'
                          : 'bg-gray-800/50 border border-gray-700/50 text-gray-600 cursor-not-allowed'
                      }`}
                    >
                      {isMatched ? (
                        <span className="flex items-center justify-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          일치 확인됨
                        </span>
                      ) : isEditMode && !isActuallyMatching ? (
                        <span className="flex items-center justify-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          확인
                        </span>
                      ) : isEdited && isActuallyMatching ? (
                        '일치로 변경'
                      ) : (
                        '일치'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 장비정상 작동 여부 */}
        <div className="mt-4 pt-4 border-t border-gray-700/50 space-y-2">
          <div className="text-xs font-medium text-gray-400">
            장비정상 작동 여부
          </div>
          {(() => {
            const originalValue = sessionDeviceInfo.operation_status || '';
            const currentValue = deviceInfo.operation_status || originalValue;

            // ✅ 원본 값이 "정상"이나 "불량"이 아니면 자동으로 편집 모드 시작
            const isValidOriginalValue = originalValue === '정상' || originalValue === '불량';
            const matchedState = deviceInfo.operation_status_matched ?? (isValidOriginalValue ? undefined : false);

            const isEditMode = matchedState === false;
            const isMatched = matchedState === true;
            const isEdited = matchedState === 'edited';
            const isUnchecked = matchedState === undefined;
            const isActuallyMatching = currentValue === originalValue && currentValue.trim() !== '';

            // ✅ Issue #2: 불량 사유 필드를 배열로 변경 (다중 선택 지원)
            const failureReasons = deviceInfo.operation_failure_reasons || [];
            const customReason = deviceInfo.operation_custom_reason || '';

            return (
              <div className="flex flex-col gap-2">
                {isUnchecked && (
                  <div className="w-full rounded-lg px-3 py-2 bg-gray-800/50 border border-gray-700 text-sm text-gray-300">
                    {originalValue === '정상' ? '정상' : originalValue === '불량' ? '불량' : originalValue || '확인 필요'}
                  </div>
                )}

                {isMatched && (
                  <>
                    <div className="w-full rounded-lg px-3 py-2 bg-green-600/10 border border-green-600/50 text-sm text-green-300 flex items-center gap-2">
                      <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>{currentValue === '정상' ? '정상' : currentValue === '불량' ? '불량' : currentValue || '확인 필요'}</span>
                    </div>
                    {/* 일치 확인했지만 불량 상태면 조치계획 필수 */}
                    {currentValue === '불량' && (
                      <div className="space-y-2 pl-3 border-l-2 border-red-500/50">
                        <div className="text-xs text-red-400 font-medium">불량 확인 - 불량 사유 (다중선택 가능)</div>
                        <div className="space-y-2">
                          {/* ✅ Issue #2: 다중 선택 체크박스로 변경 */}
                          {[
                            { value: '배터리 부족', label: '배터리 부족' },
                            { value: '패드 만료', label: '패드 만료' },
                            { value: '외관 손상', label: '외관 손상' },
                            { value: '작동 불가', label: '작동 불가' },
                            { value: 'AS 요청', label: 'AS 요청' },
                            { value: '장비 교체 예정', label: '장비 교체 예정' },
                            { value: '기타', label: '기타' }
                          ].map((reason) => (
                            <label
                              key={reason.value}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-600 bg-gray-700/30 hover:border-gray-500 cursor-pointer transition-all"
                            >
                              <input
                                type="checkbox"
                                checked={failureReasons.includes(reason.value)}
                                onChange={(e) => {
                                  const newReasons = e.target.checked
                                    ? [...failureReasons, reason.value]
                                    : failureReasons.filter((r: string) => r !== reason.value);

                                  handleChange('operation_failure_reasons', newReasons);

                                  // 기타가 선택 해제되면 커스텀 사유 초기화
                                  if (reason.value === '기타' && !e.target.checked) {
                                    handleChange('operation_custom_reason', '');
                                  }
                                }}
                                className="w-4 h-4 rounded border-gray-600 text-red-600 focus:ring-red-500 focus:ring-offset-gray-800"
                              />
                              <span className="text-sm text-gray-300">{reason.label}</span>
                            </label>
                          ))}
                        </div>

                        {/* 기타 선택 시 텍스트 입력 */}
                        {failureReasons.includes('기타') && (
                          <input
                            type="text"
                            value={customReason}
                            onChange={(e) => handleChange('operation_custom_reason', e.target.value)}
                            placeholder="기타 사유를 입력하세요"
                            className="w-full rounded-lg px-3 py-2 bg-gray-800 border border-red-500/50 text-sm text-white placeholder-gray-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                          />
                        )}
                      </div>
                    )}
                  </>
                )}

                {isEdited && (
                  <div className="w-full text-sm text-yellow-300 flex items-center gap-2">
                    <span>{currentValue === '정상' ? '정상' : currentValue === '불량' ? '불량' : currentValue}</span>
                  </div>
                )}

                {isEditMode && (
                  <div className="space-y-3">
                    {/* 정상/불량 선택 (라디오 버튼 방식) */}
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          // ✅ 정상 선택 시 모든 불량 사유 필드 초기화 (배열은 updateStepData로 직접 처리)
                          updateStepData('deviceInfo', {
                            ...deviceInfo,
                            operation_status: '정상',
                            operation_failure_reason: '',
                            operation_custom_reason: '',
                            operation_failure_reasons: []
                          });
                        }}
                        className={`py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${
                          currentValue === '정상'
                            ? 'border-green-500 bg-green-600/20 text-green-300'
                            : 'border-gray-600 bg-gray-700/30 text-gray-400 hover:border-gray-500'
                        }`}
                      >
                        정상
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChange('operation_status', '불량')}
                        className={`py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${
                          currentValue === '불량'
                            ? 'border-red-500 bg-red-600/20 text-red-300'
                            : 'border-gray-600 bg-gray-700/30 text-gray-400 hover:border-gray-500'
                        }`}
                      >
                        불량
                      </button>
                    </div>

                    {/* ✅ Issue #2: 불량 선택 시 다중 선택 체크박스 */}
                    {currentValue === '불량' && (
                      <div className="space-y-2 pl-3 border-l-2 border-red-500/50">
                        <div className="text-xs text-red-400 font-medium">불량 사유 (다중선택 가능)</div>
                        <div className="space-y-2">
                          {[
                            { value: '배터리 부족', label: '배터리 부족' },
                            { value: '패드 만료', label: '패드 만료' },
                            { value: '외관 손상', label: '외관 손상' },
                            { value: '작동 불가', label: '작동 불가' },
                            { value: 'AS 요청', label: 'AS 요청' },
                            { value: '장비 교체 예정', label: '장비 교체 예정' },
                            { value: '기타', label: '기타' }
                          ].map((reason) => (
                            <label
                              key={reason.value}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-600 bg-gray-700/30 hover:border-gray-500 cursor-pointer transition-all"
                            >
                              <input
                                type="checkbox"
                                checked={failureReasons.includes(reason.value)}
                                onChange={(e) => {
                                  const newReasons = e.target.checked
                                    ? [...failureReasons, reason.value]
                                    : failureReasons.filter((r: string) => r !== reason.value);

                                  handleChange('operation_failure_reasons', newReasons);

                                  // 기타가 선택 해제되면 커스텀 사유 초기화
                                  if (reason.value === '기타' && !e.target.checked) {
                                    handleChange('operation_custom_reason', '');
                                  }
                                }}
                                className="w-4 h-4 rounded border-gray-600 text-red-600 focus:ring-red-500 focus:ring-offset-gray-800"
                              />
                              <span className="text-sm text-gray-300">{reason.label}</span>
                            </label>
                          ))}
                        </div>

                        {/* 기타 선택 시 텍스트 입력 */}
                        {failureReasons.includes('기타') && (
                          <input
                            type="text"
                            value={customReason}
                            onChange={(e) => handleChange('operation_custom_reason', e.target.value)}
                            placeholder="기타 사유를 입력하세요"
                            className="w-full rounded-lg px-3 py-2 bg-gray-800 border border-red-500/50 text-sm text-white placeholder-gray-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                          />
                        )}
                      </div>
                    )}

                    {originalValue && (
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        등록 정보: {originalValue === '정상' ? '정상' : originalValue === '불량' ? '불량' : originalValue}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (isEdited && !isActuallyMatching) {
                        updateStepData('deviceInfo', { ...deviceInfo, operation_status_matched: false });
                      } else if (isEdited && isActuallyMatching) {
                        // isEdited 상태에서 원본과 일치해도 수정 모드로 전환 가능
                        updateStepData('deviceInfo', { ...deviceInfo, operation_status_matched: false });
                      } else if (isMatched || (!isEdited && !isMatched && !isEditMode)) {
                        updateStepData('deviceInfo', { ...deviceInfo, operation_status_matched: false });
                      }
                    }}
                    disabled={isEditMode}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                      isEditMode
                        ? 'bg-gray-800/50 border border-gray-700/50 text-gray-500 cursor-not-allowed'
                        : isEdited
                        ? 'bg-green-600/30 border-2 border-green-500 text-green-200 hover:bg-green-600/40 cursor-pointer shadow-lg shadow-green-500/20'
                        : 'bg-gray-700 border border-gray-600 text-gray-300 hover:bg-gray-600 hover:border-yellow-500/50 active:bg-gray-500'
                    }`}
                  >
                    {isEdited ? (
                      isActuallyMatching ? (
                        '원본과 동일'
                      ) : (
                        <span className="flex items-center justify-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                          수정됨
                        </span>
                      )
                    ) : (
                      '수정'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (isEditMode && !isActuallyMatching) {
                        // 수정 모드에서 확인 - 변경사항 저장
                        // ✅ Issue #2: 불량 상태이지만 사유가 없으면 경고 (배열 체크)
                        if (currentValue === '불량') {
                          if (!failureReasons || failureReasons.length === 0) {
                            alert('불량 사유를 최소 1개 이상 선택해주세요.');
                            return;
                          }
                          if (failureReasons.includes('기타') && !customReason.trim()) {
                            alert('기타 사유를 입력해주세요.');
                            return;
                          }
                        }
                        updateStepData('deviceInfo', { ...deviceInfo, operation_status_matched: 'edited' });
                      } else if (isActuallyMatching) {
                        // ✅ Issue #2: 일치 확인 시 불량 상태면 불량 사유 필수 (배열 체크)
                        if (currentValue === '불량') {
                          if (!failureReasons || failureReasons.length === 0) {
                            alert('불량 사유를 최소 1개 이상 선택해주세요.');
                            return;
                          }
                          if (failureReasons.includes('기타') && !customReason.trim()) {
                            alert('기타 사유를 입력해주세요.');
                            return;
                          }
                        }
                        updateStepData('deviceInfo', { ...deviceInfo, operation_status_matched: true });
                      }
                    }}
                    disabled={isMatched || (!isEditMode && !isActuallyMatching)}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                      isMatched
                        ? 'bg-green-600/30 border-2 border-green-500 text-green-200 cursor-default shadow-lg shadow-green-500/20'
                        : isEditMode && !isActuallyMatching
                        ? 'bg-yellow-600 hover:bg-yellow-700 border-2 border-yellow-500 text-white shadow-lg shadow-yellow-500/20'
                        : isActuallyMatching
                        ? 'bg-gray-700 border border-gray-600 text-gray-300 hover:bg-gray-600 hover:border-green-500/50 active:bg-gray-500'
                        : 'bg-gray-800/50 border border-gray-700/50 text-gray-600 cursor-not-allowed'
                    }`}
                  >
                    {isMatched ? (
                      <span className="flex items-center justify-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        일치 확인됨
                      </span>
                    ) : isEditMode && !isActuallyMatching ? (
                      <span className="flex items-center justify-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        확인
                      </span>
                    ) : isEdited && isActuallyMatching ? (
                      '일치로 변경'
                    ) : (
                      '일치'
                    )}
                  </button>
                </div>
              </div>
            );
          })()}
        </div>

        {/* 사진 촬영 (선택) - 주석처리 (향후 복구 가능하도록 보관) */}
        {/*
        <div className="mt-4 pt-4 border-t border-gray-700/50 space-y-2">
          <div className="text-xs font-medium text-gray-400">
            사진 촬영 <span className="text-gray-500">(선택사항)</span>
          </div>

          {/* 시리얼번호 사진 */}
          {/*
          <div className="space-y-1">
            <PhotoCaptureInput
              label="1. 시리얼번호"
              value={deviceInfo.serial_number_photo || ''}
              onChange={(photo) => handleChange('serial_number_photo', photo)}
              placeholder="시리얼번호가 표시된 부분 초영"
              hideLabel={false}
              sessionId={session?.id}
              photoType="serial_number"
            />
          </div>
          */}

          {/* 배터리 제조일자 사진 */}
          {/*
          <div className="space-y-1">
            <PhotoCaptureInput
              label="2. 배터리 제조일자"
              value={deviceInfo.battery_mfg_date_photo || ''}
              onChange={(photo) => handleChange('battery_mfg_date_photo', photo)}
              placeholder="배터리 제조일자 심본 초영"
              hideLabel={false}
              sessionId={session?.id}
              photoType="battery_date"
            />
          </div>
          */}

          {/* 본체 제조일자 사진 */}
          {/*
          <div className="space-y-1">
            <PhotoCaptureInput
              label="3. 본체 제조일자"
              value={deviceInfo.device_mfg_date_photo || ''}
              onChange={(photo) => handleChange('device_mfg_date_photo', photo)}
              placeholder="본체 제조일자 초영"
              hideLabel={false}
              sessionId={session?.id}
              photoType="device_date"
            />
          </div>
          */}
        {/*
        </div>
        */}
      </div>
      </div>

      {/* 실시간 필수항목 검증 경고 */}
      <ValidationWarning missingFields={missingFields} />
    </>
  );
}

function useMissingFields(deviceInfo: Record<string, any>) {
  return useMemo(() => {
    const missing: string[] = [];

    // ✅ all_matched가 true 또는 'edited' 상태이면 모든 필수 항목이 확인된 것으로 간주
    if (deviceInfo.all_matched === true || deviceInfo.all_matched === 'edited') {
      return missing; // 빈 배열 반환 (필수 항목 없음)
    }

    // all_matched가 false 또는 undefined인 경우에만 개별 필드 검증
    if (!deviceInfo.serial_number?.trim()) {
      missing.push('장비 일련번호(시리얼번호)');
    }

    return missing;
  }, [deviceInfo.serial_number, deviceInfo.all_matched]);
}
