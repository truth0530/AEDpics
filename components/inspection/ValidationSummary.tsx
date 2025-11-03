'use client';

import React, { useEffect, useState } from 'react';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';

interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  details?: string;
}

interface ValidationSummaryProps {
  deviceData?: Record<string, any>;
  onShowDetails?: () => void;
}

export function ValidationSummary({ deviceData, onShowDetails }: ValidationSummaryProps) {
  const [duplicateInfo, setDuplicateInfo] = useState<{
    isDuplicate: boolean;
    count: number;
    locationInfo?: string;
  } | null>(null);

  // 제조번호 중복 체크
  useEffect(() => {
    if (deviceData?.serial_number) {
      fetch(`/api/aed-data/check-duplicate-serial?serial=${encodeURIComponent(deviceData.serial_number)}`)
        .then((res) => res.json())
        .then((data) => {
          setDuplicateInfo({
            isDuplicate: data.is_duplicate,
            count: data.count,
            locationInfo: data.location_info,
          });
        })
        .catch((error) => {
          console.error('Failed to check duplicate serial:', error);
        });
    }
  }, [deviceData?.serial_number]);

  if (!deviceData) {
    return null;
  }

  const alerts: React.ReactNode[] = [];
  const today = new Date();

  // 이동식 장비 여부 확인 (정상 정책이므로 경고하지 않음)
  const isMobileEquipment = deviceData.external_non_display_reason?.includes('구비의무기관(119구급차, 여객, 항공기, 객차(철도), 선박');

  // 🔴 [최우선] 외부 미표출 사유 (이동식 장비 제외)
  if (deviceData.external_non_display_reason && !isMobileEquipment) {
    alerts.push(
      <span key="non-display" className="inline-flex items-center px-2.5 py-1.5 rounded-full text-xs font-semibold bg-red-900/70 text-red-200 border border-red-500/50">
        ⚠️ {deviceData.external_non_display_reason}
      </span>
    );
  }

  // 🔴 배터리 만료 확인
  if (deviceData.battery_expiry_date) {
    const batteryDate = new Date(deviceData.battery_expiry_date);
    const batteryDays = Math.ceil((batteryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (batteryDays <= 30) {
      alerts.push(
        <span key="battery" className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-900/50 text-red-300 border border-red-600/30">
          🔋 배터리 {batteryDays <= 0 ? '만료' : `${batteryDays}일`}
        </span>
      );
    }
  }

  // 🟠 패드 만료 확인
  if (deviceData.patch_expiry_date || deviceData.pad_expiry_date) {
    const padDate = new Date(deviceData.patch_expiry_date || deviceData.pad_expiry_date);
    const padDays = Math.ceil((padDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (padDays <= 30) {
      alerts.push(
        <span key="pad" className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-900/50 text-orange-300 border border-orange-600/30">
          패드 {padDays <= 0 ? '만료' : `${padDays}일`}
        </span>
      );
    }
  }

  // 🟡 마지막 점검일 확인 - 60일 이내 점검 이력이 없는 경우
  if (deviceData.last_inspection_date) {
    const lastCheckDate = new Date(deviceData.last_inspection_date);
    const daysSinceCheck = Math.ceil((today.getTime() - lastCheckDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceCheck > 60) {
      alerts.push(
        <span key="check" className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-900/50 text-yellow-300 border border-yellow-600/30">
          {daysSinceCheck}일 미점검
        </span>
      );
    }
  } else {
    // 점검 이력이 없는 경우
    alerts.push(
      <span key="check" className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-900/50 text-yellow-300 border border-yellow-600/30">
        점검 이력 없음
      </span>
    );
  }

  // 🔴 제조번호 중복 확인 (실제 DB 조회 결과 사용)
  if (duplicateInfo?.isDuplicate) {
    const locationLabel = duplicateInfo.locationInfo
      ? `${duplicateInfo.locationInfo} 등 `
      : '';
    alerts.push(
      <span key="duplicate" className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-900/50 text-red-300 border border-red-600/30">
        제조번호 중복({locationLabel}{duplicateInfo.count}개)
      </span>
    );
  }

  // 🟣 외부표출 N + 사유 없음 (이동식 제외)
  if (deviceData.external_display === 'N' && !deviceData.external_non_display_reason) {
    alerts.push(
      <span key="no-reason" className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-900/50 text-purple-300 border border-purple-600/30">
        미표출 사유 없음
      </span>
    );
  }

  // 상세 정보 섹션에 표시할 항목들 (문제가 있는 경우만)
  const detailItems: Array<{ label: string; value: string; shouldShow: boolean }> = [];

  // 교체 예정일 - replacement_date 사용, 문제 있을 때만 표시 (1년 미만 남았거나 데이터 없음)
  if (deviceData.replacement_date) {
    const replaceDate = new Date(deviceData.replacement_date);
    const daysUntilReplace = Math.ceil((replaceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilReplace < 365) {
      const monthsLeft = Math.floor(daysUntilReplace / 30);
      detailItems.push({
        label: '교체 예정일',
        value: `${deviceData.replacement_date} (${monthsLeft}개월 남음)`,
        shouldShow: true
      });
    }
  }

  // 제조번호 - 중복된 경우만 표시 (실제 DB 조회 결과 사용)
  if (duplicateInfo?.isDuplicate) {
    detailItems.push({
      label: '제조번호',
      value: `${deviceData.serial_number} (${duplicateInfo.count}개 중복)`,
      shouldShow: true
    });
  }

  // 외부표출 - 미표출 상태이고 이동식 장비가 아닐 때만 표시
  if (deviceData.external_display === 'N' && !isMobileEquipment) {
    const reason = deviceData.external_non_display_reason || '사유 미기재';
    detailItems.push({
      label: '외부표출',
      value: `미표출 (${reason})`,
      shouldShow: true
    });
  }

  // 최근 점검일 정보 추출
  const lastInspectionInfo = deviceData.last_inspection_date
    ? `최근 점검일: ${deviceData.last_inspection_date}`
    : '최근 점검일: 점검 이력 없음';

  return (
    <div className="bg-gradient-to-r from-gray-800/50 to-gray-900/50 border border-gray-700 rounded-2xl p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            점검 전 확인사항
          </h3>
          <span className="text-xs text-gray-400">{lastInspectionInfo}</span>
        </div>
        {onShowDetails && (
          <button
            onClick={onShowDetails}
            className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded-lg text-gray-300"
          >
            상세보기
          </button>
        )}
      </div>

      {/* 간략 요약 - 배지 형태 */}
      <div className="flex flex-wrap gap-2">
        {alerts.length > 0 ? alerts : (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-900/50 text-green-300 border border-green-600/30">
            이상 없음
          </span>
        )}
      </div>
    </div>
  );
}
