'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ContextualInput from './ContextualInput';
import InspectionProgress from './InspectionProgress';
import { inspectionService } from '../../services/InspectionService';

interface EnhancedBatteryPadSectionProps {
  equipmentSerial: string;
  onBatteryUpdate: (data: {
    status: 'normal' | 'warning' | 'expired' | 'missing' | 'damaged';
    expiryChecked?: string;
    comparison?: 'match' | 'different' | 'missing';
  }) => void;
  onPadUpdate: (data: {
    status: 'normal' | 'warning' | 'expired' | 'missing' | 'damaged';
    expiryChecked?: string;
    comparison?: 'match' | 'different' | 'missing';
  }) => void;
  className?: string;
}

export const EnhancedBatteryPadSection: React.FC<EnhancedBatteryPadSectionProps> = ({
  equipmentSerial,
  onBatteryUpdate,
  onPadUpdate,
  className = ''
}) => {
  const [snapshot, setSnapshot] = useState<{
    confirmed_manufacturer: string;
    confirmed_model_name: string;
    confirmed_location: string;
    confirmed_battery_expiry: string | null;
    confirmed_pad_expiry: string | null;
    confirmed_device_expiry: string | null;
    snapshot_timestamp: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 배터리 상태 - 초기값을 null로 변경하여 실제 비교 후에만 상태 설정
  const [batteryStatus, setBatteryStatus] = useState<'normal' | 'warning' | 'expired' | 'missing' | 'damaged'>('normal');
  const [batteryExpiry, setBatteryExpiry] = useState('');
  const [batteryComparison, setBatteryComparison] = useState<'match' | 'different' | 'missing' | null>(null);

  // 패드 상태 - 초기값을 null로 변경하여 실제 비교 후에만 상태 설정
  const [padStatus, setPadStatus] = useState<'normal' | 'warning' | 'expired' | 'missing' | 'damaged'>('normal');
  const [padExpiry, setPadExpiry] = useState('');
  const [padComparison, setPadComparison] = useState<'match' | 'different' | 'missing' | null>(null);

  // 진행률 계산을 위한 단계 정의
  const inspectionSteps = [
    '장비 정보 로드',
    '배터리 상태 확인',
    '배터리 유효기간 입력',
    '패드 상태 확인',
    '패드 유효기간 입력',
    '점검 완료'
  ];

  // 현재 진행 단계 계산
  const calculateCurrentStep = (): number => {
    if (loading) return 1;
    if (error) return 1;
    if (!snapshot) return 1;

    let step = 2; // 장비 정보 로드 완료

    if (batteryStatus !== 'normal' || batteryExpiry || batteryComparison !== null) {
      step = Math.max(step, 3); // 배터리 상태 확인 완료
    }

    if (batteryExpiry && batteryComparison !== null) {
      step = Math.max(step, 4); // 배터리 유효기간 입력 완료
    }

    if (padStatus !== 'normal' || padExpiry || padComparison !== null) {
      step = Math.max(step, 5); // 패드 상태 확인 완료
    }

    if (padExpiry && padComparison !== null && batteryExpiry && batteryComparison !== null) {
      step = Math.max(step, 6); // 모든 점검 완료
    }

    return step;
  };

  const currentStep = calculateCurrentStep();

  const loadSnapshot = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const snapshotData = await inspectionService.getOrCreateInspectionSnapshot(equipmentSerial);

      if (snapshotData) {
        setSnapshot(snapshotData);
        // 기존 스냅샷이 있다면 비교 상태 초기화 안함 (진행 중인 점검)
        if (snapshotData.snapshot_timestamp !== snapshotData.confirmed_battery_expiry && batteryComparison === null) {
          setBatteryComparison('missing');
        }
        if (snapshotData.snapshot_timestamp !== snapshotData.confirmed_pad_expiry && padComparison === null) {
          setPadComparison('missing');
        }
      } else {
        setError('장비 정보를 불러올 수 없습니다. 장비 시리얼 번호를 확인해주세요.');
      }
    } catch (err: unknown) {
      let errorMessage = '장비 정보 로드 실패';

      if (err && typeof err === 'object' && 'message' in err) {
        const message = (err as { message: string }).message;
        if (message.includes('찾을 수 없습니다')) {
          errorMessage = '해당 장비가 시스템에 등록되지 않았습니다.';
        } else if (message.includes('network')) {
          errorMessage = '네트워크 연결을 확인해주세요.';
        } else if (message.includes('permission')) {
          errorMessage = '접근 권한이 없습니다. 관리자에게 문의하세요.';
        }
      }

      setError(errorMessage);
      console.error('스냅샷 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  }, [equipmentSerial, batteryComparison, padComparison]);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  // useCallback으로 함수를 메모이제이션하여 의존성 순환 참조 방지
  const batteryUpdateCallback = useCallback(() => {
    if (batteryComparison !== null) {
      onBatteryUpdate({
        status: batteryStatus,
        expiryChecked: batteryExpiry,
        comparison: batteryComparison
      });
    }
  }, [batteryStatus, batteryExpiry, batteryComparison, onBatteryUpdate]);

  const padUpdateCallback = useCallback(() => {
    if (padComparison !== null) {
      onPadUpdate({
        status: padStatus,
        expiryChecked: padExpiry,
        comparison: padComparison
      });
    }
  }, [padStatus, padExpiry, padComparison, onPadUpdate]);

  useEffect(() => {
    batteryUpdateCallback();
  }, [batteryUpdateCallback]);

  useEffect(() => {
    padUpdateCallback();
  }, [padUpdateCallback]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal':
        return 'text-green-600';
      case 'warning':
        return 'text-yellow-600';
      case 'expired':
      case 'damaged':
        return 'text-red-600';
      case 'missing':
        return 'text-gray-600';
      default:
        return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg p-6 border ${className}`}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">장비 정보를 불러오는 중...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg p-6 border border-red-200 ${className}`}>
        <div className="text-red-600 text-center">
          <span>⚠️ {error}</span>
          <button
            onClick={loadSnapshot}
            className="ml-4 px-4 py-3 bg-red-100 text-red-700 text-base rounded hover:bg-red-200 min-h-[44px] min-w-[44px] active:bg-red-300 transition-colors touch-manipulation"
            aria-label="장비 정보 다시 로드"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 진행률 표시 */}
      <InspectionProgress
        currentStep={currentStep}
        totalSteps={inspectionSteps.length}
        stepNames={inspectionSteps}
      />

      <div className={`bg-white rounded-lg p-6 border ${className}`}>
        <h3 className="text-lg font-semibold text-gray-900 mb-6">배터리 및 패드 점검</h3>

        <div className="space-y-8">
        {/* 배터리 섹션 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-md font-medium text-gray-800">🔋 배터리 점검</h4>
            <div className="flex items-center gap-2">
              <label htmlFor="battery-status" className="text-sm text-gray-600">상태:</label>
              <select
                id="battery-status"
                value={batteryStatus}
                onChange={(e) => setBatteryStatus(e.target.value as 'normal' | 'warning' | 'expired' | 'missing' | 'damaged')}
                className={`px-4 py-3 text-base rounded border ${getStatusColor(batteryStatus)} bg-white min-h-[44px] touch-manipulation`}
                aria-label="배터리 상태 선택"
              >
                <option value="normal">정상</option>
                <option value="warning">주의</option>
                <option value="expired">만료</option>
                <option value="missing">누락</option>
                <option value="damaged">손상</option>
              </select>
            </div>
          </div>

          <ContextualInput
            label="배터리 유효기간"
            fieldName="battery_expiry"
            originalValue={snapshot?.confirmed_battery_expiry}
            currentValue={batteryExpiry}
            onValueChange={setBatteryExpiry}
            onStatusChange={setBatteryComparison}
            type="date"
            placeholder="YYYY-MM-DD"
            required
          />
        </div>

        {/* 패드 섹션 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-md font-medium text-gray-800">🩹 패드 점검</h4>
            <div className="flex items-center gap-2">
              <label htmlFor="pad-status" className="text-sm text-gray-600">상태:</label>
              <select
                id="pad-status"
                value={padStatus}
                onChange={(e) => setPadStatus(e.target.value as 'normal' | 'warning' | 'expired' | 'missing' | 'damaged')}
                className={`px-4 py-3 text-base rounded border ${getStatusColor(padStatus)} bg-white min-h-[44px] touch-manipulation`}
                aria-label="패드 상태 선택"
              >
                <option value="normal">정상</option>
                <option value="warning">주의</option>
                <option value="expired">만료</option>
                <option value="missing">누락</option>
                <option value="damaged">손상</option>
              </select>
            </div>
          </div>

          <ContextualInput
            label="패드 유효기간"
            fieldName="pad_expiry"
            originalValue={snapshot?.confirmed_pad_expiry}
            currentValue={padExpiry}
            onValueChange={setPadExpiry}
            onStatusChange={setPadComparison}
            type="date"
            placeholder="YYYY-MM-DD"
            required
          />
        </div>

        {/* 점검 요약 정보 */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h5 className="font-medium text-gray-700 mb-2">점검 요약</h5>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">배터리:</span>
              <span className={`ml-2 font-medium ${getStatusColor(batteryStatus)}`}>
                {batteryStatus}
                {batteryComparison === 'match' && ' ✅'}
                {batteryComparison === 'different' && ' 🔄'}
              </span>
            </div>
            <div>
              <span className="text-gray-600">패드:</span>
              <span className={`ml-2 font-medium ${getStatusColor(padStatus)}`}>
                {padStatus}
                {padComparison === 'match' && ' ✅'}
                {padComparison === 'different' && ' 🔄'}
              </span>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedBatteryPadSection;