'use client';

import { useEffect, useMemo, useState, memo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { TouchEvent } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { useAEDData } from './AEDDataProvider';
import { AEDDevice } from '@/packages/types/aed';
import { shouldShowSensitiveDataIcon } from '@/lib/data/masking';
import { DEVICE_STATUS_COLORS, DEVICE_STATUS_LABELS } from '@/lib/constants/aed-filters';
import { AEDDeviceModal } from './AEDDeviceModal';
import { UserAccessScope } from '@/lib/auth/access-control';
import {
  ActionButtons,
  canQuickInspect as canQuickInspectForRole,
  canSchedule as canScheduleForRole,
} from './ActionButtons';
import { QuickInspectPanel } from './QuickInspectPanel';
import { ScheduleModal } from './ScheduleModal';
import { UnavailableStatusModal } from './UnavailableStatusModal';
import { isFeatureEnabled } from '@/lib/config/feature-flags';
import { isReadOnlyAdmin } from '@/lib/auth/access-control';
import { getRegionLabel } from '@/lib/constants/regions';
import { cn } from '@/lib/utils';
import { HealthCenterMatcher } from '@/utils/healthCenterMatcher';
import { Pagination } from '@/components/Pagination';

function getDeviceId(device: AEDDevice): string {
  return (
    device.id ||
    device.equipment_serial ||
    device.management_number ||
    ''
  );
}

// 터치 타겟 최소 크기 보장 (접근성)
const TOUCH_TARGET_BUTTON = 'min-h-[40px] px-3 sm:min-h-[36px] touch-manipulation';

const getColumnTemplate = (enableSelection: boolean, showInspectionStatus: boolean = false) => {
  // 태블릿에서도 작업 버튼이 보이도록 컬럼 크기 최적화
  // 세부위치와 거리는 xl 해상도에서만 표시됨
  const baseColumns = showInspectionStatus
    ? "minmax(40px, 0.25fr) minmax(130px, 0.95fr) minmax(85px, 0.55fr) minmax(85px, 0.55fr) minmax(60px, 0.35fr) minmax(75px, 0.45fr) minmax(45px, 0.3fr) minmax(200px, 1.6fr) minmax(80px, 0.5fr) minmax(40px, 0.25fr) 120px"
    : "minmax(40px, 0.25fr) minmax(130px, 0.95fr) minmax(85px, 0.55fr) minmax(85px, 0.55fr) minmax(60px, 0.35fr) minmax(45px, 0.3fr) minmax(200px, 1.6fr) minmax(80px, 0.5fr) minmax(40px, 0.25fr) 120px";

  return enableSelection ? `35px ${baseColumns}` : baseColumns;
};

// 데스크톱 테이블 행 컴포넌트
const DesktopTableRow = memo(({
  device,
  accessScope,
  allowQuickInspect,
  allowSchedule,
  enableSelection,
  viewMode,
  isSelected,
  onToggleSelect,
  onViewDetails,
  onQuickInspect,
  onSchedule,
  scheduledEquipment,
  onCancelSchedule,
  showInspectionStatus,
  inspectionCompleted,
  inspectionSession,
  onInspectionInProgress,
  onViewInspectionHistory,
}: {
  device: AEDDevice;
  accessScope: UserAccessScope | undefined;
  allowQuickInspect: boolean;
  allowSchedule: boolean;
  enableSelection: boolean;
  viewMode: 'admin' | 'inspection';
  isSelected: boolean;
  onToggleSelect: (id: string, checked: boolean) => void;
  onViewDetails: (device: AEDDevice) => void;
  onQuickInspect: (device: AEDDevice) => void;
  onSchedule: (devices: AEDDevice[]) => void;
  scheduledEquipment?: Set<string>;
  onCancelSchedule?: (equipmentSerial: string) => void;
  showInspectionStatus?: boolean;
  inspectionCompleted?: Set<string>;
  onShowUnavailable?: (device: AEDDevice) => void;
  inspectionSession?: InspectionSession;
  onInspectionInProgress?: (equipmentSerial: string) => void;
  onViewInspectionHistory?: (equipmentSerial: string) => void;
}) => {
  const deviceId = getDeviceId(device);
  const statusKey = device.operation_status || 'unknown';
  const statusColor = DEVICE_STATUS_COLORS[statusKey as keyof typeof DEVICE_STATUS_COLORS] || 'bg-gray-500';
  const statusLabel = DEVICE_STATUS_LABELS[statusKey as keyof typeof DEVICE_STATUS_LABELS] || statusKey;
  const showSensitiveIcon = accessScope ? shouldShowSensitiveDataIcon(device, accessScope) : false;

  const regionLabel =
    device.sido || (device.region_code ? getRegionLabel(device.region_code) : null) || '미등록';
  const cityLabel = device.gugun || device.city_code || '미등록';
  const healthCenterLabel = HealthCenterMatcher.getAbbreviation(device.jurisdiction_health_center);

  const category1Label = device.category_1
    ? (device.category_1.includes('외') ? '비의무' : device.category_1.includes('구비의무기관') ? '의무' : device.category_1)
    : '-';

  // 외부표출 차단 경고 판단
  const isCriticalDevice = device.external_display === 'N' &&
    device.external_non_display_reason &&
    device.external_non_display_reason !== '구비의무기관(119구급차, 여객, 항공기, 객차(철도), 선박';

  const handleCheckChange = (checked: boolean | 'indeterminate') => {
    if (checked !== 'indeterminate') {
      onToggleSelect(deviceId, checked);
    }
  };

  const isScheduled = scheduledEquipment?.has(device.equipment_serial);

  return (
    <div
      className={`hidden lg:grid items-center py-1.5 px-2 hover:bg-gray-800/50 border-b border-gray-800 min-h-[30px] gap-2 ${
        isScheduled ? 'bg-gray-800/30' : ''
      }`}
      style={{ gridTemplateColumns: getColumnTemplate(enableSelection, showInspectionStatus) }}
    >
    {/* 데스크톱 테이블 행 */}
      {enableSelection && (
        <div className="flex items-center pl-2">
          <Checkbox
            checked={isSelected}
            onCheckedChange={handleCheckChange}
            aria-label={`${device.installation_institution || device.installation_institution || '미등록'} 선택`}
          />
        </div>
      )}

      {/* 1. 분류1 */}
      <div className="min-w-0 pl-2">
        <div className="text-[10px] lg:text-xs xl:text-sm text-gray-300 truncate" title={device.category_1 || '-'}>
          {category1Label}
        </div>
      </div>

      {/* 2. 설치기관 */}
      <div className="min-w-0 pl-2 flex items-center gap-1">
        {isScheduled && (
          <svg className="w-3.5 h-3.5 lg:w-4 lg:h-4 xl:w-5 xl:h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        )}
        <button
          onClick={() => onViewDetails(device)}
          className={`text-xs lg:text-sm xl:text-base font-medium hover:text-green-400 hover:underline text-left flex-1 whitespace-nowrap overflow-hidden text-ellipsis ${
            isScheduled ? 'text-gray-400' : 'text-gray-100'
          }`}
          title={device.installation_institution || '미등록'}
        >
          {device.installation_institution || '미등록'}
        </button>
        {isCriticalDevice && (
          <span className="text-[8px] lg:text-[9px] xl:text-[10px] px-1 py-[1px] bg-red-500 text-white rounded flex-shrink-0 font-semibold leading-tight">
            차단
          </span>
        )}
      </div>

      {/* 3. 관리번호 - 폰트 축소 */}
      <div className="min-w-0 pl-2">
        <div className="text-[10px] lg:text-xs xl:text-sm text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis" title={device.management_number || '없음'}>
          {device.management_number || '-'}
        </div>
      </div>

      {/* 4. 장비연번 */}
      <div className="min-w-0 pl-2">
        <div className="text-xs lg:text-sm xl:text-base text-gray-300 whitespace-nowrap overflow-hidden text-ellipsis" title={device.equipment_serial || '없음'}>
          {device.equipment_serial || '-'}
        </div>
      </div>

      {/* 5. 최근점검일 - 축소 */}
      <div className="min-w-0 pl-2">
        <div className="text-[10px] lg:text-xs xl:text-sm text-gray-300 truncate" title={device.last_inspection_date || '-'}>
          {device.last_inspection_date ? new Date(device.last_inspection_date).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, '') : '-'}
        </div>
      </div>

      {/* 6. 상태 (점검 모드일 때만) */}
      {showInspectionStatus && (
        <div className="flex justify-center">
          {device.inspection_status === 'unavailable' ? (
            <span className="px-2 py-0.5 text-xs lg:text-sm xl:text-base bg-red-500/20 text-red-400 rounded">
              점검불가
            </span>
          ) : device.inspection_status === 'completed' || inspectionCompleted?.has(device.equipment_serial) ? (
            <button
              onClick={() => onViewInspectionHistory?.(device.equipment_serial)}
              className="px-2 py-0.5 text-xs lg:text-sm xl:text-base bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition-colors cursor-pointer"
            >
              점검완료
            </button>
          ) : (
            <span className="px-2 py-0.5 text-xs lg:text-sm xl:text-base bg-yellow-500/20 text-yellow-400 rounded">
              점검진행중
            </span>
          )}
        </div>
      )}

      {/* 7. 표출 - 축소, N은 붉은색 */}
      <div className="min-w-0 pl-2">
        <div className={`text-[10px] lg:text-xs xl:text-sm truncate ${device.external_display === 'N' ? 'text-red-400 font-semibold' : 'text-gray-300'}`} title={device.external_display || '-'}>
          {device.external_display || '-'}
        </div>
      </div>

      {/* 8. 주소 - 폰트 축소 */}
      <div className="min-w-0 pl-2">
        <div className="text-[10px] lg:text-xs xl:text-sm text-gray-100 truncate" title={device.installation_address || device.installation_address || '주소 미등록'}>
          {device.installation_address || device.installation_address || device.installation_location_address || '주소 미등록'}
        </div>
      </div>

      {/* 9. 세부위치 */}
      <div className="min-w-0 pl-2">
        <div className="text-[10px] lg:text-xs xl:text-sm text-gray-400 truncate" title={device.installation_position || ''}>
          {device.installation_position || '-'}
        </div>
      </div>

      {/* 10. 거리 - 1km 미만은 소수점 1자리, 이상은 정수 */}
      <div className="min-w-0 pl-2">
        <div
          className="text-[10px] lg:text-xs xl:text-sm text-gray-400 truncate"
          title={device.distance_km ? `${device.distance_km.toFixed(2)}km` : '-'}
        >
          {device.distance_km !== undefined && device.distance_km !== null && device.distance_km < 999
            ? device.distance_km < 1
              ? `${device.distance_km.toFixed(1)}km`
              : `${Math.round(device.distance_km)}km`
            : '-'}
        </div>
      </div>

      {/* 11. 작업 - 우측 여백 추가 */}
      <div className="flex items-center justify-center gap-1 pr-3">
        {device.assignment_status === 'unavailable' ? (
          <button
            onClick={() => onShowUnavailable && onShowUnavailable(device)}
            className="text-[10px] lg:text-xs xl:text-sm px-2 py-1 h-6 lg:h-7 xl:h-8 bg-red-900/20 text-red-400 border border-red-800 rounded cursor-pointer hover:bg-red-900/30 transition-colors"
          >
            불가
          </button>
        ) : showInspectionStatus ? (
          // 점검진행목록 탭: 상태별 버튼 표시
          // 🔴 Phase A: 상태 우선순위 로직 - inspection_status 절대 우선
          device.inspection_status === 'unavailable' ? (
            <span className="text-[10px] lg:text-xs xl:text-sm px-2 py-1 h-6 lg:h-7 xl:h-8 text-red-400 flex items-center">
              점검불가
            </span>
          ) : device.inspection_status === 'completed' ? (
            // 🟢 inspection_status === 'completed': 항상 "수정" 버튼만 표시
            // (inspectionSession 존재 여부 무시)
            <Button
              size="sm"
              variant="default"
              onClick={() => {
                if (typeof onViewInspectionHistory === 'function') {
                  onViewInspectionHistory(device.equipment_serial);
                }
              }}
              disabled={typeof onViewInspectionHistory !== 'function'}
              className="text-[10px] lg:text-xs xl:text-sm px-2 py-1 h-6 lg:h-7 xl:h-8 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
            >
              수정
            </Button>
          ) : inspectionSession ? (
            // 점검진행중: 계속/보기 버튼 (inspection_status !== 'completed'인 경우만)
            <Button
              size="sm"
              variant="default"
              onClick={() => onInspectionInProgress?.(device.equipment_serial)}
              className="text-[10px] lg:text-xs xl:text-sm px-2 py-1 h-6 lg:h-7 xl:h-8 bg-yellow-600 hover:bg-yellow-700 text-white"
            >
              계속
            </Button>
          ) : null
        ) : viewMode === 'inspection' ? (
          // 점검대상목록 탭: 점검 버튼
          <Button
            size="sm"
            variant="default"
            onClick={() => onQuickInspect(device)}
            className="text-[10px] lg:text-xs xl:text-sm px-2 py-1 h-6 lg:h-7 xl:h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            점검
          </Button>
        ) : scheduledEquipment?.has(device.equipment_serial) ? (
          device.inspection_status === 'unavailable' ? (
            <span className="text-[10px] lg:text-xs xl:text-sm px-2 py-1 h-6 lg:h-7 xl:h-8 text-red-400 flex items-center">
              점검불가
            </span>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onCancelSchedule && onCancelSchedule(device.equipment_serial)}
              className="text-[10px] lg:text-xs xl:text-sm px-2 py-1 h-6 lg:h-7 xl:h-8 text-red-400 border-red-700 hover:bg-red-900/20"
            >
              취소
            </Button>
          )
        ) : (
          <Button
            size="sm"
            variant="default"
            onClick={() => onSchedule([device])}
            className="text-[10px] lg:text-xs xl:text-sm px-2 py-1 h-6 lg:h-7 xl:h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            추가
          </Button>
        )}
      </div>
    </div>
  );
});

DesktopTableRow.displayName = 'DesktopTableRow';

// 모바일 카드 컴포넌트 (데스크톱 중간 화면도 포함)
const MobileCard = memo(({
  device,
  accessScope,
  allowQuickInspect,
  allowSchedule,
  enableSelection,
  viewMode,
  isSelected,
  onToggleSelect,
  onViewDetails,
  onQuickInspect,
  onSchedule,
  scheduledEquipment,
  onCancelSchedule,
  showInspectionStatus,
  inspectionCompleted,
  inspectionSession,
  onInspectionInProgress,
  onViewInspectionHistory,
}: {
  device: AEDDevice;
  accessScope: UserAccessScope | undefined;
  allowQuickInspect: boolean;
  allowSchedule: boolean;
  enableSelection: boolean;
  viewMode: 'admin' | 'inspection';
  isSelected: boolean;
  onToggleSelect: (id: string, checked: boolean) => void;
  onViewDetails: (device: AEDDevice) => void;
  onQuickInspect: (device: AEDDevice) => void;
  onSchedule: (devices: AEDDevice[]) => void;
  scheduledEquipment?: Set<string>;
  onCancelSchedule?: (equipmentSerial: string) => void;
  showInspectionStatus?: boolean;
  inspectionCompleted?: Set<string>;
  onShowUnavailable?: (device: AEDDevice) => void;
  inspectionSession?: InspectionSession;
  onInspectionInProgress?: (equipmentSerial: string) => void;
  onViewInspectionHistory?: (equipmentSerial: string) => void;
}) => {
  const deviceId = getDeviceId(device);
  const statusKey = device.operation_status || 'unknown';
  const statusColor = DEVICE_STATUS_COLORS[statusKey as keyof typeof DEVICE_STATUS_COLORS] || 'bg-gray-500';
  const statusLabel = DEVICE_STATUS_LABELS[statusKey as keyof typeof DEVICE_STATUS_LABELS] || statusKey;
  const showSensitiveIcon = accessScope ? shouldShowSensitiveDataIcon(device, accessScope) : false;

  // 외부표출 차단 경고 판단
  const isCriticalDevice = device.external_display === 'N' &&
    device.external_non_display_reason &&
    device.external_non_display_reason !== '구비의무기관(119구급차, 여객, 항공기, 객차(철도), 선박';

  const [showActions, setShowActions] = useState(false);
  const touchStartRef = useRef<number | null>(null);
  const touchCurrentRef = useRef<number | null>(null);

  const closeActions = useCallback(() => setShowActions(false), []);

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    touchStartRef.current = touch.clientX;
    touchCurrentRef.current = touch.clientX;
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    touchCurrentRef.current = touch.clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartRef.current === null || touchCurrentRef.current === null) {
      return;
    }
    const deltaX = touchStartRef.current - touchCurrentRef.current;
    if (deltaX > 40) {
      setShowActions(true);
    } else if (deltaX < -30) {
      setShowActions(false);
    }
    touchStartRef.current = null;
    touchCurrentRef.current = null;
  };

  const handleCheckChange = (checked: boolean | 'indeterminate') => {
    if (checked !== 'indeterminate') {
      closeActions();
      onToggleSelect(deviceId, checked);
    }
  };

  const handleViewDetailsClick = () => {
    closeActions();
    onViewDetails(device);
  };

  const handleQuickInspectClick = () => {
    closeActions();
    onQuickInspect(device);
  };

  const handleScheduleClick = () => {
    closeActions();
    onSchedule([device]);
  };

  const handleContentClick = () => {
    if (showActions) {
      closeActions();
    }
  };

  const regionLabel =
    device.sido || (device.region_code ? getRegionLabel(device.region_code) : null) || '미등록';
  const cityLabel = device.gugun || device.city_code || '미등록';

  const isScheduled = scheduledEquipment?.has(device.equipment_serial);

  return (
    <div
      className={cn(
        'lg:hidden relative overflow-hidden rounded border transition-colors',
        isScheduled ? 'border-gray-700 bg-gray-800/30' : 'border-gray-800 bg-gray-900',
        showActions ? 'ring-1 ring-emerald-500/40' : 'hover:bg-gray-800/50'
      )}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className={cn(
          'p-1 transition-transform duration-200 ease-out flex gap-2.5',
          showActions ? '-translate-x-32' : 'translate-x-0'
        )}
        onClick={handleContentClick}
      >
        {/* 체크박스: 카드 세로 중앙 정렬 */}
        {enableSelection && (
          <Checkbox
            checked={isSelected}
            onCheckedChange={handleCheckChange}
            aria-label={`${device.installation_institution || '미등록'} 선택`}
            className="flex-shrink-0 h-5 w-5 sm:h-4 sm:w-4 self-center"
          />
        )}

        {/* 콘텐츠 영역 */}
        <div className="flex-1 space-y-0">
          {/* 첫 줄: 설치기관명 + 장비연번 + 버튼 */}
          <div className="flex items-center gap-1.5">
            <button
            onClick={handleViewDetailsClick}
            className={`font-medium text-lg sm:text-xs hover:text-green-400 hover:underline text-left min-w-0 flex items-baseline gap-1 flex-1 ${
              isScheduled ? 'text-gray-400' : 'text-gray-100'
            }`}
          >
            <span className="truncate">{device.installation_institution || '미등록'}</span>
            <span className="text-[9px] text-gray-500 flex-shrink-0">
              {device.equipment_serial || device.management_number || '-'}
            </span>
            {isCriticalDevice && (
              <span className="text-[8px] px-1 py-[1px] bg-red-500 text-white rounded flex-shrink-0 font-semibold leading-tight">
                차단
              </span>
            )}
          </button>
          {device.assignment_status === 'unavailable' ? (
            <button
              onClick={() => onShowUnavailable && onShowUnavailable(device)}
              className="text-[10px] px-1.5 py-0.5 h-5 bg-red-900/20 text-red-400 border border-red-800 rounded cursor-pointer hover:bg-red-900/30 transition-colors flex-shrink-0"
            >
              불가
            </button>
          ) : showInspectionStatus ? (
            device.inspection_status === 'unavailable' ? (
              <span className="px-2 py-0.5 text-[10px] bg-red-500/20 text-red-400 rounded flex-shrink-0">
                점검불가
              </span>
            ) : device.inspection_status === 'completed' || inspectionCompleted?.has(device.equipment_serial) ? (
              <button
                onClick={() => onViewInspectionHistory?.(device.equipment_serial)}
                className="px-2 py-0.5 text-[10px] bg-green-500/20 text-green-400 rounded flex-shrink-0 hover:bg-green-500/30 transition-colors cursor-pointer"
              >
                점검완료
              </button>
            ) : (
              <span className="px-2 py-0.5 text-[10px] bg-yellow-500/20 text-yellow-400 rounded flex-shrink-0">
                점검진행중
              </span>
            )
          ) : viewMode === 'inspection' ? (
            <Button
              size="sm"
              variant="default"
              onClick={handleQuickInspectClick}
              className="text-[10px] px-1.5 py-0.5 h-5 bg-emerald-600 hover:bg-emerald-700 text-white flex-shrink-0"
            >
              점검
            </Button>
          ) : scheduledEquipment?.has(device.equipment_serial) ? (
            device.inspection_status === 'unavailable' ? (
              <span className="text-[10px] px-1.5 py-0.5 h-5 text-red-400 flex items-center flex-shrink-0">
                점검불가
              </span>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onCancelSchedule && onCancelSchedule(device.equipment_serial)}
                className="text-[10px] px-1.5 py-0.5 h-5 text-red-400 border-red-700 hover:bg-red-900/20 flex-shrink-0"
              >
                취소
              </Button>
            )
          ) : (
            <Button
              size="sm"
              variant="default"
              onClick={handleScheduleClick}
              className="text-[10px] px-1.5 py-0.5 h-5 bg-emerald-600 hover:bg-emerald-700 text-white flex-shrink-0"
            >
              추가
            </Button>
          )}
          </div>

          {/* 둘째 줄: 주소 + 최종점검일 */}
          <div className="flex items-center justify-between gap-1.5 text-[10px]">
            <span className="text-gray-400 truncate flex-1">
              {device.installation_address || device.installation_location_address || '주소 미등록'}
            </span>
            {device.last_inspection_date && (
              <span className="text-gray-500 flex-shrink-0 text-[9px]">
                {new Date(device.last_inspection_date).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, '')}
              </span>
            )}
          </div>
        </div>
      </div>

      <div
        className={cn(
          'absolute inset-y-0 right-0 w-32 translate-x-full bg-gray-800/95 p-2 shadow-inner transition-transform duration-200 ease-out',
          'flex flex-col justify-center gap-1.5',
          showActions ? 'translate-x-0 pointer-events-auto' : 'pointer-events-none'
        )}
      >
        <Button
          size="sm"
          variant="outline"
          className="text-[10px] justify-center h-6 w-full px-1"
          onClick={handleViewDetailsClick}
        >
          상세
        </Button>
        {/* 개별 "일정추가" 버튼 제거: 체크박스 선택 후 "일정 예약 (N개)" 버튼 사용 */}
      </div>
    </div>
  );
});

MobileCard.displayName = 'MobileCard';

interface InspectionSession {
  id: string;
  equipment_serial: string;
  inspector_id: string;
  inspector_name?: string;
  status: 'active' | 'completed' | 'cancelled' | 'paused';
  current_step: number;
}

interface DataTableProps {
  scheduledEquipment?: Set<string>;
  onCancelSchedule?: (equipmentSerial: string) => void;
  isFetching?: boolean;
  filterData?: (device: any) => boolean;
  showInspectionStatus?: boolean;
  inspectionCompleted?: Set<string>;
  onQuickInspect?: (device: any) => void;
  selectedDeviceIds?: Set<string>;
  onDeviceSelect?: (deviceId: string, checked: boolean) => void;
  onSelectAll?: (checked: boolean) => void;
  scheduleFilter?: 'unscheduled' | 'scheduled';
  // 점검 세션 관련
  inspectionSessions?: Map<string, InspectionSession>;
  onInspectionInProgress?: (equipmentSerial: string) => void;
  // 점검 이력 보기
  onViewInspectionHistory?: (equipmentSerial: string) => void;
  // 배너 표시용
  totalDataCount?: number; // 전체 데이터 개수
  currentViewMode?: 'list' | 'completed' | 'map'; // 현재 탭 모드
  pageType?: 'inspection' | 'schedule'; // 페이지 타입 (현장점검 vs 일정관리)
}

export function DataTable({
  scheduledEquipment = new Set(),
  onCancelSchedule,
  isFetching = false,
  filterData,
  showInspectionStatus,
  inspectionCompleted = new Set(),
  onQuickInspect,
  selectedDeviceIds,
  onDeviceSelect,
  onSelectAll,
  scheduleFilter: propScheduleFilter,
  inspectionSessions = new Map(),
  onInspectionInProgress,
  onViewInspectionHistory,
  totalDataCount,
  currentViewMode,
  pageType = 'schedule'
}: DataTableProps = {}) {
  const router = useRouter();
  const {
    data: rawData,
    isLoading,
    error,
    pagination,
    filters,
    setFilters,
    nextPage,
    prevPage,
    accessScope,
    userProfile,
    summary,
    viewMode,
    refetch,
  } = useAEDData();

  // Apply external data filter if provided
  const data = filterData ? rawData?.filter(filterData) : rawData;

  const isInspectionView = viewMode === 'inspection';
  const enableSelection = !isInspectionView;

  // 서브 필터 상태 (미추가/추가완료) - prop으로 받은 값 우선 사용
  const scheduleFilter = propScheduleFilter || 'unscheduled';

  const flagQuickInspect = isFeatureEnabled('quickInspect');
  const flagSchedule = isFeatureEnabled('schedule');
  const role = userProfile?.role;
  const allowQuickInspect = flagQuickInspect && role ? canQuickInspectForRole(role) : false;
  const allowSchedule = !isInspectionView && flagSchedule && role ? canScheduleForRole(role) : false;

  const isReadOnlyAdminRole = role ? isReadOnlyAdmin(role) : false;

  const [selectedDevice, setSelectedDevice] = useState<AEDDevice | null>(null);
  const [quickInspectDevice, setQuickInspectDevice] = useState<AEDDevice | null>(null);
  const [scheduleDevices, setScheduleDevices] = useState<AEDDevice[] | null>(null);
  const [unavailableDevice, setUnavailableDevice] = useState<AEDDevice | null>(null);
  const [internalSelectedIds, setInternalSelectedIds] = useState<Set<string>>(new Set());
  const [isMobile, setIsMobile] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number } | null>(null);
  const hasAppliedStoredLimit = useRef(false);

  const currentPage = filters.page ?? pagination?.page ?? 1;
  const hasMore = pagination?.hasMore ?? false;

  // 페이지네이션 핸들러
  const handlePageChange = useCallback((page: number) => {
    if (page === currentPage + 1) {
      if (hasMore) {
        nextPage();
      }
      return;
    }

    if (page === currentPage - 1 && currentPage > 1) {
      prevPage();
    }
  }, [currentPage, hasMore, nextPage, prevPage]);

  const handlePageSizeChange = useCallback((limit: number) => {
    // ✅ 페이지 크기 변경 시 1페이지로 리셋 + 커서 초기화
    setFilters((prev) => ({
      ...prev,
      limit,
      page: 1,
      cursor: undefined
    }));

    // localStorage에 저장
    if (typeof window !== 'undefined') {
      localStorage.setItem('aed_page_size', String(limit));
    }
  }, [setFilters]);

  useEffect(() => {
    if (hasAppliedStoredLimit.current) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    const storedLimit = window.localStorage.getItem('aed_page_size');
    if (!storedLimit) {
      hasAppliedStoredLimit.current = true;
      return;
    }

    const parsed = Number(storedLimit);
    const allowedLimits = [30, 50, 100];
    if (!Number.isFinite(parsed) || !allowedLimits.includes(parsed)) {
      hasAppliedStoredLimit.current = true;
      return;
    }

    if (filters.limit === parsed) {
      hasAppliedStoredLimit.current = true;
      return;
    }

    hasAppliedStoredLimit.current = true;
    setFilters((prev) => ({ ...prev, limit: parsed }));
  }, [filters.limit, setFilters]);

  // 부모에서 전달된 selectedDeviceIds가 있으면 사용, 없으면 내부 상태 사용
  const selectedIds = selectedDeviceIds ?? internalSelectedIds;
  const setSelectedIds = onDeviceSelect ? (updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    // 부모 콜백이 있으면 변경사항을 부모에게 전달
    const newSet = typeof updater === 'function' ? updater(selectedIds) : updater;
    const added = [...newSet].filter(id => !selectedIds.has(id));
    const removed = [...selectedIds].filter(id => !newSet.has(id));
    added.forEach(id => onDeviceSelect(id, true));
    removed.forEach(id => onDeviceSelect(id, false));
  } : setInternalSelectedIds;

  // 거리 계산 기준 위치 가져오기
  // - viewMode='admin' (목록 탭): 보건소 위치 기준
  // - viewMode='inspection' (점검 탭): 현재 GPS 위치 기준
  useEffect(() => {
    if (viewMode === 'admin') {
      // 목록 탭: 보건소 위치 사용
      if (userProfile?.organization) {
        const org = userProfile.organization;
        if (org.latitude && org.longitude) {
          setCurrentPosition({
            lat: org.latitude,
            lng: org.longitude
          });
          console.log('[DataTable] Using health center position:', { lat: org.latitude, lng: org.longitude, name: org.name });
        }
      }
    } else {
      // 점검 탭: GPS 위치 사용
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setCurrentPosition({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
            console.log('[DataTable] Using GPS position:', { lat: position.coords.latitude, lng: position.coords.longitude });
          },
          (error) => {
            console.warn('[DataTable] Failed to get current position:', error);
          }
        );
      }
    }
  }, [viewMode, userProfile]);

  // 모바일 감지
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // ✅ 성능 최적화: calculateDistance 함수 제거
  // API가 이미 거리 계산을 수행하므로 클라이언트에서 중복 계산 불필요 (route.ts:711)

  // 카운트 계산
  const scheduleCounts = useMemo(() => {
    const rawDevices = data || [];
    const scheduledCount = rawDevices.filter(device => scheduledEquipment.has(device.equipment_serial)).length;
    const unscheduledCount = rawDevices.length - scheduledCount;

    return {
      scheduled: scheduledCount,
      unscheduled: unscheduledCount,
    };
  }, [data, scheduledEquipment]);

  const devices = useMemo(() => {
    const rawDevices = data || [];

    // ✅ 성능 최적화: API가 이미 distance_km을 계산하므로 클라이언트 중복 계산 제거
    // 거리 계산은 API 레벨에서 처리됨 (route.ts:711)

    // 서브 필터 적용
    if (scheduleFilter === 'unscheduled') {
      return rawDevices.filter(device => !scheduledEquipment.has(device.equipment_serial));
    } else {
      return rawDevices.filter(device => scheduledEquipment.has(device.equipment_serial));
    }
  }, [data, scheduleFilter, scheduledEquipment]);

  const deviceMap = useMemo(() => {
    const map = new Map<string, AEDDevice>();
    devices.forEach((device) => {
      const id = getDeviceId(device);
      if (id) {
        map.set(id, device);
      }
    });
    return map;
  }, [devices]);

  useEffect(() => {
    if (!enableSelection) {
      setSelectedIds((prev) => {
        if (prev.size === 0) return prev; // Already empty
        return new Set(); // Clear selection
      });
      return;
    }

    setSelectedIds((prev) => {
      const filtered = [...prev].filter((id) => deviceMap.has(id));
      // Only update if something was actually removed
      if (filtered.length === prev.size) {
        return prev; // No change, return same reference
      }
      return new Set(filtered);
    });
  }, [devices, enableSelection, deviceMap]);

  const selectedDevices = useMemo(() => {
    if (!enableSelection) {
      return [];
    }

    return [...selectedIds]
      .map((id) => deviceMap.get(id))
      .filter((device): device is AEDDevice => Boolean(device));
  }, [enableSelection, selectedIds, deviceMap]);

  const totalCount = summary?.totalCount ?? devices.length;
  const pageSize = filters.limit ?? pagination?.limit ?? 30;

  const selectedCount = enableSelection ? selectedIds.size : 0;
  const isAllSelected = enableSelection && devices.length > 0 && devices.every((device) => selectedIds.has(getDeviceId(device)));
  const isIndeterminate = enableSelection && selectedCount > 0 && !isAllSelected;

  const toggleSelect = useCallback((id: string, checked: boolean) => {
    if (!enableSelection || !id) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, [enableSelection]);

  const toggleSelectAll = useCallback((checked: boolean | 'indeterminate') => {
    console.log('[DataTable] toggleSelectAll called:', {
      checked,
      enableSelection,
      hasOnSelectAll: !!onSelectAll,
      hasOnDeviceSelect: !!onDeviceSelect,
      currentlyAllSelected: isAllSelected,
      currentlyIndeterminate: isIndeterminate,
      devicesCount: devices.length
    });

    if (!enableSelection) return;

    // 현재 전체 선택 상태이면 해제, 아니면 전체 선택
    const shouldSelectAll = !isAllSelected;

    console.log('[DataTable] Decision:', { shouldSelectAll, willAffectDevices: devices.length });

    // 부모의 onDeviceSelect가 있으면 각 장비를 개별적으로 선택/해제
    if (onDeviceSelect) {
      console.log('[DataTable] Using parent onDeviceSelect for each device');
      devices.forEach((device) => {
        const id = getDeviceId(device);
        if (id) {
          onDeviceSelect(id, shouldSelectAll);
        }
      });
      // 부모 onSelectAll 콜백도 호출 (통지용)
      if (onSelectAll) {
        onSelectAll(shouldSelectAll);
      }
      return;
    }

    // 부모 콜백이 있으면 부모에게 위임
    if (onSelectAll) {
      console.log('[DataTable] Delegating to parent onSelectAll');
      onSelectAll(shouldSelectAll);
      return;
    }

    // 내부 상태 사용
    if (!shouldSelectAll) {
      console.log('[DataTable] Clearing all selections');
      setSelectedIds(new Set());
      return;
    }
    const all = new Set<string>();
    devices.forEach((device) => {
      const id = getDeviceId(device);
      if (id) {
        all.add(id);
      }
    });
    console.log('[DataTable] Selecting all:', all.size, 'devices');
    setSelectedIds(all);
  }, [enableSelection, devices, onDeviceSelect, onSelectAll, isAllSelected, isIndeterminate]);

  const handleViewDetails = useCallback((device: AEDDevice) => {
    setSelectedDevice(device);
  }, []);

  const handleQuickInspect = useCallback((device: AEDDevice) => {
    setQuickInspectDevice(device);
  }, []);

  const handleSchedule = useCallback((devices: AEDDevice[]) => {
    setScheduleDevices(devices);
  }, []);

  const handleShowUnavailable = useCallback((device: AEDDevice) => {
    setUnavailableDevice(device);
  }, []);

  const handleScheduleSelected = useCallback(() => {
    if (!enableSelection || selectedCount === 0) {
      return;
    }
    handleSchedule(selectedDevices);
  }, [enableSelection, selectedCount, selectedDevices, handleSchedule]);

  const handleCancelSelected = useCallback(async () => {
    if (!enableSelection || selectedCount === 0) return;

    // 선택된 장비들의 일정을 취소
    for (const device of selectedDevices) {
      if (device.equipment_serial && onCancelSchedule) {
        await onCancelSchedule(device.equipment_serial);
      }
    }

    // 선택 해제
    setSelectedIds(new Set());
  }, [enableSelection, selectedCount, selectedDevices, onCancelSchedule]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">데이터를 불러오는 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-400">오류: {error}</div>
      </div>
    );
  }

  if (!devices || devices.length === 0) {
    // 점검진행목록(completed) 탭일 때는 다른 메시지 표시
    const emptyMessage = pageType === 'inspection' && currentViewMode === 'completed'
      ? '아직 점검을 시작한 장비가 없습니다.'
      : '일정관리에서 추가된 점검대상 장비가 없습니다.';

    // 임시점검원 역할 확인
    const isTemporaryInspector = userProfile?.role === 'temporary_inspector';

    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-gray-400 mb-4">{emptyMessage}</div>
          {!isTemporaryInspector && (
            <button
              onClick={() => router.push('/aed-data')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              점검일정 추가하기
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative">
      {/* 데이터 재조회 중 로딩 오버레이 */}
      {isFetching && (
        <div className="absolute inset-0 bg-gray-950/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3 mx-auto"></div>
            <p className="text-white text-sm">데이터를 불러오는 중...</p>
          </div>
        </div>
      )}

      {/* 서브 필터 탭 제거 - 상단 탭으로 통합됨 */}

      {/* 📊 결과 요약 배너 - 조건 수정 버튼 제거 (접기/펼치기 토글과 중복) */}
      {/* 상단 카운트 영역 제거 - 페이지네이션에 통합하여 1줄 절약 */}

      {/* 선택 바 - 모바일 최적화: 더 작고 컴팩트하게 */}
      {enableSelection && selectedCount > 0 && !isReadOnlyAdminRole && (
        <div className="bg-blue-900/20 border-b border-blue-800 px-1.5 py-1 sm:p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] leading-none sm:text-sm text-blue-300 font-medium">
              {selectedCount}개
            </span>
            <div className="flex items-center gap-0.5 sm:gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds(new Set())}
                className="text-blue-300 hover:text-blue-200 h-6 px-1.5 text-[11px] leading-none sm:h-8 sm:px-3 sm:text-sm"
              >
                해제
              </Button>
              {allowSchedule && scheduleFilter === 'unscheduled' && (
                <Button
                  size="sm"
                  onClick={handleScheduleSelected}
                  className="bg-blue-600 hover:bg-blue-700 h-6 px-1.5 text-[11px] leading-none sm:h-8 sm:px-3 sm:text-sm"
                >
                  일정예약 ({selectedCount})
                </Button>
              )}
              {allowSchedule && scheduleFilter === 'scheduled' && (
                <Button
                  size="sm"
                  onClick={handleCancelSelected}
                  className="bg-red-600 hover:bg-red-700 h-6 px-1.5 text-[11px] leading-none sm:h-8 sm:px-3 sm:text-sm"
                >
                  취소 ({selectedCount})
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 데이터 목록 및 헤더를 포함하는 스크롤 컨테이너 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 헤더 (데스크톱만, 고정) */}
        <div className="flex-shrink-0 hidden lg:block bg-gray-800 border-b border-gray-700">
          <div
            className="grid items-center py-1.5 px-2 text-xs font-medium text-gray-400 uppercase tracking-wide gap-2"
            style={{ gridTemplateColumns: getColumnTemplate(enableSelection, showInspectionStatus) }}
          >
            {enableSelection && (
              <div className="flex items-center pl-2">
                <Checkbox
                  checked={isIndeterminate ? 'indeterminate' : isAllSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="모두 선택"
                />
              </div>
            )}
            <div className="text-center text-xs lg:text-sm xl:text-base">분류1</div>
            <div className="text-center text-xs lg:text-sm xl:text-base">설치기관</div>
            <div className="text-center text-xs lg:text-sm xl:text-base">관리번호</div>
            <div className="text-center text-xs lg:text-sm xl:text-base">장비연번</div>
            <div className="text-center text-xs lg:text-sm xl:text-base whitespace-nowrap">최근점검일</div>
            {showInspectionStatus && <div className="text-center text-xs lg:text-sm xl:text-base">상태</div>}
            <div className="text-center text-xs lg:text-sm xl:text-base">표출</div>
            <div className="text-center text-xs lg:text-sm xl:text-base">주소</div>
            <div className="text-center text-xs lg:text-sm xl:text-base">세부위치</div>
            <div className="text-center text-xs lg:text-sm xl:text-base">거리</div>
            <div className="flex justify-center pr-3 text-xs lg:text-sm xl:text-base">작업</div>
          </div>
        </div>

        {/* 스크롤 가능한 데이터 영역 */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {/* 모바일 / 태블릿 뷰 */}
          <div className="lg:hidden p-1.5 space-y-1">
            {devices.map((device) => {
              const deviceId = getDeviceId(device);
              return (
                <MobileCard
                  key={deviceId}
                  device={device}
                  accessScope={accessScope}
                  allowQuickInspect={allowQuickInspect}
                  allowSchedule={allowSchedule}
                  enableSelection={enableSelection}
                  viewMode={viewMode}
                  isSelected={selectedIds.has(deviceId)}
                  onToggleSelect={toggleSelect}
                  onViewDetails={handleViewDetails}
                  onQuickInspect={handleQuickInspect}
                  onSchedule={handleSchedule}
                  scheduledEquipment={scheduledEquipment}
                  onCancelSchedule={onCancelSchedule}
                  showInspectionStatus={showInspectionStatus}
                  inspectionCompleted={inspectionCompleted}
                  onShowUnavailable={handleShowUnavailable}
                  inspectionSession={inspectionSessions.get(device.equipment_serial)}
                  onInspectionInProgress={onInspectionInProgress}
                  onViewInspectionHistory={onViewInspectionHistory}
                />
              );
            })}
          </div>

          {/* 데스크톱 뷰 */}
          <div className="hidden lg:block pr-4">
          {devices.map((device) => {
            const deviceId = getDeviceId(device);
            return (
              <DesktopTableRow
                key={deviceId}
                device={device}
                accessScope={accessScope}
                allowQuickInspect={allowQuickInspect}
                allowSchedule={allowSchedule}
                enableSelection={enableSelection}
                viewMode={viewMode}
                isSelected={selectedIds.has(deviceId)}
                onToggleSelect={toggleSelect}
                onViewDetails={handleViewDetails}
                onQuickInspect={handleQuickInspect}
                onSchedule={handleSchedule}
                scheduledEquipment={scheduledEquipment}
                onCancelSchedule={onCancelSchedule}
                showInspectionStatus={showInspectionStatus}
                inspectionCompleted={inspectionCompleted}
                onShowUnavailable={handleShowUnavailable}
                inspectionSession={inspectionSessions.get(device.equipment_serial)}
                onInspectionInProgress={onInspectionInProgress}
                onViewInspectionHistory={onViewInspectionHistory}
              />
            );
          })}
          </div>
        </div>
      </div>

      {/* 페이지네이션 - 하단 고정 (상단 카운트 정보 통합) */}
      {pagination && (
        <div className="flex-shrink-0">
          <Pagination
            currentPage={currentPage}
            hasMore={hasMore}
            onPageChange={handlePageChange}
            pageSize={pageSize}
            pageItemCount={devices.length}    // ✅ 현재 페이지 아이템 개수
            totalCount={totalCount}           // ✅ 전체 아이템 개수 (표시용)
            onPageSizeChange={handlePageSizeChange}
            summaryText={
              totalDataCount !== undefined && currentViewMode
                ? pageType === 'inspection'
                  ? `${
                      currentViewMode === 'list' ? '점검미시행' : currentViewMode === 'completed' ? '점검진행중' : '지도'
                    } ${devices.length.toLocaleString()} / ${totalDataCount.toLocaleString()}`
                  : `${
                      currentViewMode === 'list' ? '일정추가 필요' : currentViewMode === 'completed' ? '완료' : '전체'
                    } ${devices.length.toLocaleString()} / ${totalDataCount.toLocaleString()}`
                : undefined
            }
          />
        </div>
      )}

      {/* 모달들 */}
      {selectedDevice && (
        <AEDDeviceModal
          device={selectedDevice}
          accessScope={accessScope}
          onClose={() => setSelectedDevice(null)}
          viewMode={viewMode}
          allowQuickInspect={allowQuickInspect}
          onQuickInspect={handleQuickInspect}
          scheduledEquipment={scheduledEquipment}
          onCancelSchedule={onCancelSchedule}
        />
      )}

      {quickInspectDevice && (
        <QuickInspectPanel
          device={quickInspectDevice}
          onClose={() => setQuickInspectDevice(null)}
          onRefetch={refetch}
        />
      )}

      {scheduleDevices && (
        <ScheduleModal
          devices={scheduleDevices}
          onClose={() => setScheduleDevices(null)}
          onScheduled={refetch}
        />
      )}

      {unavailableDevice && (
        <UnavailableStatusModal
          device={unavailableDevice}
          onClose={() => setUnavailableDevice(null)}
          onSuccess={() => {
            setUnavailableDevice(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}
