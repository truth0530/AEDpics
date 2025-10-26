'use client';

import { useState, useEffect, useMemo } from 'react';
import { useInspectionSessionStore } from '@/lib/state/inspection-session-store';
import { BatteryLifespanModal } from '../BatteryLifespanModal';
import { ValidationWarning } from '../ValidationWarning';
import { IssueNoteModal } from '../IssueNoteModal';
import { PhotoCaptureInput } from '../PhotoCaptureInput';

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
        initialized: true,
      };
      updateStepData('deviceInfo', initialData);
    }
  }, [sessionDeviceInfo, deviceInfo.initialized]);

  const handleChange = (field: string, value: string) => {
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

    return (
      <div key={field.key} className="space-y-1">
        <div className="text-xs font-medium text-gray-400">
          {field.label}
        </div>

        {!isEditMode ? (
          <div className="text-sm font-medium text-gray-100 truncate">
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
          {!isEditMode ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleMatchAll}
                disabled={deviceInfo.all_matched === true}
                className={`flex-1 sm:flex-none sm:px-6 py-2.5 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 touch-manipulation ${
                  deviceInfo.all_matched === true
                    ? 'bg-green-600/30 border-2 border-green-500 text-green-200 cursor-default shadow-lg shadow-green-500/20'
                    : 'bg-gray-700 hover:bg-gray-600 active:bg-gray-500 border border-gray-600 text-gray-200'
                }`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {deviceInfo.all_matched === true ? '전체 일치 확인됨' : '전체 일치'}
              </button>
              <button
                type="button"
                onClick={handleEditAll}
                className={`flex-1 sm:flex-none sm:px-6 py-2.5 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 touch-manipulation ${
                  deviceInfo.all_matched === 'edited'
                    ? 'bg-yellow-600/30 border-2 border-yellow-500 text-yellow-200 cursor-default shadow-lg shadow-yellow-500/20'
                    : 'bg-gray-700 hover:bg-gray-600 active:bg-gray-500 border border-gray-600 text-gray-200'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                {deviceInfo.all_matched === 'edited' ? '수정됨' : '수정'}
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="flex-1 sm:flex-none sm:px-6 py-2.5 bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-300 text-sm font-medium rounded-lg transition-colors touch-manipulation"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="flex-1 sm:flex-none sm:px-6 py-2.5 bg-yellow-600 hover:bg-yellow-700 border-2 border-yellow-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 touch-manipulation shadow-lg shadow-yellow-500/20"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                확인
              </button>
            </div>
          )}
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
            const isActuallyMatching = currentValue === originalValue && currentValue.trim() !== '';

            return (
              <div className="flex flex-col gap-2">
                {isUnchecked && (
                  <div className="w-full rounded-lg px-3 py-2 bg-gray-800/50 border border-gray-700 text-sm text-gray-300">
                    {originalValue || '등록 정보 없음'}
                  </div>
                )}

                {isMatched && (
                  <div className="w-full rounded-lg px-3 py-2 bg-green-600/10 border border-green-600/50 text-sm text-green-300 flex items-center gap-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>{currentValue || '정보 없음'}</span>
                  </div>
                )}

                {isEdited && (
                  <div className="w-full rounded-lg px-3 py-2 bg-yellow-600/10 border border-yellow-600/50 text-sm text-yellow-300 flex items-center gap-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                    <span>{currentValue || '정보 없음'} (수정됨)</span>
                  </div>
                )}

                {isEditMode && (
                  <div className="space-y-2">
                    <input
                      type="date"
                      value={currentValue}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      className="w-full rounded-lg px-3 py-2 bg-gray-800 border-2 border-yellow-500/50 text-sm text-white focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20"
                    />
                    {originalValue && (
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        등록 정보: {originalValue}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (isActuallyMatching) {
                        updateStepData('deviceInfo', { ...deviceInfo, [`${field.key}_matched`]: true });
                      }
                    }}
                    disabled={isMatched || !isActuallyMatching}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                      isMatched
                        ? 'bg-green-600/30 border-2 border-green-500 text-green-200 cursor-default shadow-lg shadow-green-500/20'
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
                    ) : isEdited && isActuallyMatching ? (
                      '일치로 변경'
                    ) : (
                      '일치'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (isEditMode) {
                        // 수정 모드에서 확인 - 원본과 같으면 경고
                        if (isActuallyMatching) {
                          return; // 원본과 같으면 아무 것도 하지 않음 (버튼 비활성화됨)
                        }
                        updateStepData('deviceInfo', { ...deviceInfo, [`${field.key}_matched`]: 'edited' });
                      } else if (isEdited && !isActuallyMatching) {
                        // 수정됨 상태에서 다시 수정 모드 활성화 (원본과 다를 때만)
                        updateStepData('deviceInfo', { ...deviceInfo, [`${field.key}_matched`]: false });
                      } else if (isMatched || (!isEdited && !isMatched)) {
                        // 일치 확인됨 상태 또는 초기 상태에서 수정 모드 활성화
                        updateStepData('deviceInfo', { ...deviceInfo, [`${field.key}_matched`]: false });
                      }
                    }}
                    disabled={(isEditMode && isActuallyMatching) || (isEdited && isActuallyMatching)}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                      isEditMode
                        ? isActuallyMatching
                          ? 'bg-gray-800/50 border border-gray-700/50 text-gray-500 cursor-not-allowed'
                          : 'bg-yellow-600 hover:bg-yellow-700 border-2 border-yellow-500 text-white shadow-lg shadow-yellow-500/20'
                        : isEdited
                        ? isActuallyMatching
                          ? 'bg-gray-800/50 border border-gray-700/50 text-gray-600 cursor-not-allowed'
                          : 'bg-yellow-600/30 border-2 border-yellow-500 text-yellow-200 cursor-default shadow-lg shadow-yellow-500/20'
                        : 'bg-gray-700 border border-gray-600 text-gray-300 hover:bg-gray-600 hover:border-yellow-500/50 active:bg-gray-500'
                    }`}
                  >
                    {isEditMode ? (
                      isActuallyMatching ? (
                        '원본과 동일'
                      ) : (
                        <span className="flex items-center justify-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          확인
                        </span>
                      )
                    ) : isEdited ? (
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[SUPPLY_FIELDS[1], SUPPLY_FIELDS[2]].map((field) => {
            const originalValue = sessionDeviceInfo[field.dbKey] || '';
            const currentValue = deviceInfo[field.key] || originalValue;
            const matchedState = deviceInfo[`${field.key}_matched`];
            const isEditMode = matchedState === false;
            const isMatched = matchedState === true;
            const isEdited = matchedState === 'edited';
            const isUnchecked = matchedState === undefined;
            const isActuallyMatching = currentValue === originalValue && currentValue.trim() !== '';
            const displayLabel = field.key === 'manufacturing_date' ? '제조일자(본체)' : field.label;

            return (
              <div key={field.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-gray-400">
                    {displayLabel}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {isUnchecked && (
                    <div className="w-full rounded-lg px-3 py-2 bg-gray-800/50 border border-gray-700 text-sm text-gray-300">
                      {originalValue || '등록 정보 없음'}
                    </div>
                  )}

                  {isMatched && (
                    <div className="w-full rounded-lg px-3 py-2 bg-green-600/10 border border-green-600/50 text-sm text-green-300 flex items-center gap-2">
                      <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>{currentValue || '정보 없음'}</span>
                    </div>
                  )}

                  {isEdited && (
                    <div className="w-full rounded-lg px-3 py-2 bg-yellow-600/10 border border-yellow-600/50 text-sm text-yellow-300 flex items-center gap-2">
                      <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                      <span>{currentValue || '정보 없음'} (수정됨)</span>
                    </div>
                  )}

                  {isEditMode && (
                    <div className="space-y-2">
                      <input
                        type="date"
                        value={currentValue}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                        className="w-full rounded-lg px-3 py-2 bg-gray-800 border-2 border-yellow-500/50 text-sm text-white focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20"
                      />
                      {originalValue && (
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                          등록 정보: {originalValue}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (isActuallyMatching) {
                          updateStepData('deviceInfo', { ...deviceInfo, [`${field.key}_matched`]: true });
                        }
                      }}
                      disabled={isMatched || !isActuallyMatching}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                        isMatched
                          ? 'bg-green-600/30 border-2 border-green-500 text-green-200 cursor-default shadow-lg shadow-green-500/20'
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
                      ) : isEdited && isActuallyMatching ? (
                        '일치로 변경'
                      ) : (
                        '일치'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (isEditMode) {
                          if (isActuallyMatching) {
                            return;
                          }
                          updateStepData('deviceInfo', { ...deviceInfo, [`${field.key}_matched`]: 'edited' });
                        } else if (isEdited && !isActuallyMatching) {
                          updateStepData('deviceInfo', { ...deviceInfo, [`${field.key}_matched`]: false });
                        } else if (isMatched || (!isEdited && !isMatched)) {
                          // 일치 확인됨 상태 또는 초기 상태에서 수정 모드 활성화
                          updateStepData('deviceInfo', { ...deviceInfo, [`${field.key}_matched`]: false });
                        }
                      }}
                      disabled={(isEditMode && isActuallyMatching) || (isEdited && isActuallyMatching)}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                        isEditMode
                          ? isActuallyMatching
                            ? 'bg-gray-800/50 border border-gray-700/50 text-gray-500 cursor-not-allowed'
                            : 'bg-yellow-600 hover:bg-yellow-700 border-2 border-yellow-500 text-white shadow-lg shadow-yellow-500/20'
                          : isEdited
                          ? isActuallyMatching
                            ? 'bg-gray-800/50 border border-gray-700/50 text-gray-600 cursor-not-allowed'
                            : 'bg-yellow-600/30 border-2 border-yellow-500 text-yellow-200 cursor-default shadow-lg shadow-yellow-500/20'
                          : 'bg-gray-700 border border-gray-600 text-gray-300 hover:bg-gray-600 hover:border-yellow-500/50 active:bg-gray-500'
                      }`}
                    >
                      {isEditMode ? (
                        isActuallyMatching ? (
                          '원본과 동일'
                        ) : (
                          <span className="flex items-center justify-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            확인
                          </span>
                        )
                      ) : isEdited ? (
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
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 사진 촬영 (선택) */}
        <div className="mt-4 pt-4 border-t border-gray-700/50 space-y-2">
          <div className="text-xs font-medium text-gray-400">
            사진 촬영 <span className="text-gray-500">(선택사항)</span>
          </div>

          {/* 시리얼번호 사진 */}
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

          {/* 배터리 제조일자 사진 */}
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

          {/* 본체 제조일자 사진 */}
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
        </div>
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

    if (!deviceInfo.serial_number?.trim()) {
      missing.push('장비 일련번호(시리얼번호)');
    }

    return missing;
  }, [deviceInfo.serial_number]);
}
