'use client';

import React, { useEffect, useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  details?: string;
}

interface ValidationSummaryProps {
  deviceData?: Record<string, any>;
  onShowDetails?: () => void;
  noBorder?: boolean;
}

export function ValidationSummary({ deviceData, onShowDetails, noBorder = false }: ValidationSummaryProps) {
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

  // 🔴 [최우선] 외부 미표출 (이동식 장비 제외)
  if (deviceData.external_display === 'N' && !isMobileEquipment) {
    if (deviceData.external_non_display_reason) {
      // 사유가 있는 경우 사유 표시
      alerts.push(
        <span key="non-display" className="text-xs font-semibold text-red-300">
          외부 미표출: {deviceData.external_non_display_reason}
        </span>
      );
    } else {
      // 사유가 없는 경우
      alerts.push(
        <span key="non-display" className="text-xs font-semibold text-red-300">
          외부 미표출 (사유 없음)
        </span>
      );
    }
  }

  // 🔴 배터리 만료 확인
  if (deviceData.battery_expiry_date) {
    const batteryDate = new Date(deviceData.battery_expiry_date);
    const batteryDays = Math.ceil((batteryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (batteryDays <= 30) {
      alerts.push(
        <span key="battery" className="text-xs font-medium text-red-300">
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
        <span key="pad" className="text-xs font-medium text-orange-300">
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
        <span key="check" className="text-xs font-medium text-yellow-300">
          {daysSinceCheck}일 미점검
        </span>
      );
    }
  } else {
    // 점검 이력이 없는 경우
    alerts.push(
      <span key="check" className="text-xs font-medium text-yellow-300">
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
      <span key="duplicate" className="text-xs font-medium text-red-300">
        제조번호 중복({locationLabel}{duplicateInfo.count}개)
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
    <div className={noBorder ? '' : 'bg-gradient-to-r from-gray-800/50 to-gray-900/50 border border-gray-700 rounded-2xl p-3'}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Tooltip>
            <TooltipTrigger asChild>
              <h3 className="font-semibold text-white cursor-help">
                점검 전 확인사항
              </h3>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs bg-gray-800 text-gray-100 border border-gray-600">
              <div className="space-y-1 text-xs">
                <p className="font-semibold mb-2">표시 항목 안내</p>
                <p><span className="text-red-300">외부 미표출</span> - 외부 표출 N (사유 포함)</p>
                <p><span className="text-red-300">배터리 만료</span> - 30일 이내 만료/초과</p>
                <p><span className="text-orange-300">패드 만료</span> - 30일 이내 만료/초과</p>
                <p><span className="text-yellow-300">미점검 일수</span> - 60일 이상 미점검</p>
                <p><span className="text-yellow-300">점검 이력 없음</span> - 점검 기록 없음</p>
                <p><span className="text-red-300">제조번호 중복</span> - 동일 제조번호 존재</p>
                <p><span className="text-green-300">특이사항 없음</span> - 모든 항목 정상</p>
              </div>
            </TooltipContent>
          </Tooltip>
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
          <span className="text-xs font-medium text-green-300">
            특이사항 없음
          </span>
        )}
      </div>
    </div>
  );
}
