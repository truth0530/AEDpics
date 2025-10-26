'use client';

import React from 'react';
import { AEDInspectionRecord } from '../services/InspectionService';

interface InspectionContextInfoProps {
  record: AEDInspectionRecord;
  interpretation?: {
    batteryInterpretation?: string;
    padInterpretation?: string;
    deviceInterpretation?: string;
    contextNote?: string;
  };
  showDetailsButton?: boolean;
}

export const InspectionContextInfo: React.FC<InspectionContextInfoProps> = ({
  record,
  interpretation,
  showDetailsButton = false
}) => {
  const [showDetails, setShowDetails] = React.useState(false);

  const getStatusColor = (status: string, originalValue?: string, checkedValue?: string) => {
    if (!originalValue || !checkedValue) return 'text-gray-500';

    if (originalValue === checkedValue) {
      return 'text-green-600'; // 일치
    } else {
      return 'text-orange-600'; // 수정됨
    }
  };

  const getStatusIcon = (originalValue?: string, checkedValue?: string) => {
    if (!originalValue || !checkedValue) return '❓';

    if (originalValue === checkedValue) {
      return '✅'; // 일치
    } else {
      return '🔄'; // 수정됨
    }
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-gray-900">점검 맥락 정보</h4>
        {showDetailsButton && (
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {showDetails ? '간단히' : '자세히'} 보기
          </button>
        )}
      </div>

      {/* 기본 맥락 정보 */}
      <div className="space-y-2 text-sm">
        {interpretation?.contextNote && (
          <p className="text-gray-600 italic">
            💡 {interpretation.contextNote}
          </p>
        )}

        {/* 배터리 유효기간 맥락 */}
        {record.confirmed_battery_expiry && (
          <div className="flex items-start gap-2">
            <span className="text-lg">
              {getStatusIcon(record.confirmed_battery_expiry, record.battery_expiry_checked)}
            </span>
            <div className="flex-1">
              <span className="font-medium">배터리 유효기간:</span>
              <div className={getStatusColor('battery', record.confirmed_battery_expiry, record.battery_expiry_checked)}>
                {interpretation?.batteryInterpretation ||
                  `기준: ${record.confirmed_battery_expiry} → 현장: ${record.battery_expiry_checked || '확인안됨'}`
                }
              </div>
            </div>
          </div>
        )}

        {/* 패드 유효기간 맥락 */}
        {record.confirmed_pad_expiry && (
          <div className="flex items-start gap-2">
            <span className="text-lg">
              {getStatusIcon(record.confirmed_pad_expiry, record.pad_expiry_checked)}
            </span>
            <div className="flex-1">
              <span className="font-medium">패드 유효기간:</span>
              <div className={getStatusColor('pad', record.confirmed_pad_expiry, record.pad_expiry_checked)}>
                {interpretation?.padInterpretation ||
                  `기준: ${record.confirmed_pad_expiry} → 현장: ${record.pad_expiry_checked || '확인안됨'}`
                }
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 상세 정보 */}
      {showDetails && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h5 className="font-medium text-gray-700 mb-2">점검 시점 기준값</h5>
              <div className="space-y-1 text-gray-600">
                <div>제조사: {record.confirmed_manufacturer || '미확인'}</div>
                <div>모델: {record.confirmed_model_name || '미확인'}</div>
                <div>설치위치: {record.confirmed_location || '미확인'}</div>
              </div>
            </div>

            <div>
              <h5 className="font-medium text-gray-700 mb-2">현장 확인값</h5>
              <div className="space-y-1 text-gray-600">
                <div>배터리 상태: {record.battery_status}</div>
                <div>패드 상태: {record.pad_status}</div>
                <div>장치 상태: {record.device_status}</div>
              </div>
            </div>
          </div>

          {/* 메모 */}
          {record.notes && (
            <div className="mt-4">
              <h5 className="font-medium text-gray-700 mb-1">점검 메모</h5>
              <p className="text-gray-600 text-sm bg-white p-3 rounded border">
                {record.notes}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InspectionContextInfo;