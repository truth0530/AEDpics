'use client';
import { useEffect, ReactNode, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AEDDevice } from '@/packages/types/aed';
import { getMaskedFieldLabels } from '@/lib/data/masking';
import { DEVICE_STATUS_LABELS } from '@/lib/constants/aed-filters';
import { getRegionLabel } from '@/lib/constants/regions';
import { UserAccessScope } from '@/lib/auth/access-control';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

// \ub0a0\uc9dc \ud3ec\ub9f7\ud305 \ud568\uc218
function formatDate(dateValue: string | null | undefined): string | undefined {
  if (!dateValue || dateValue === 'null' || dateValue === 'undefined' || dateValue === '') {
    return undefined;
  }

  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
      return undefined;
    }
    return date.toLocaleDateString('ko-KR');
  } catch {
    return undefined;
  }
}

function formatDateTime(dateValue: string | null | undefined): string | undefined {
  if (!dateValue || dateValue === 'null' || dateValue === 'undefined' || dateValue === '') {
    return undefined;
  }

  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
      return undefined;
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  } catch {
    return undefined;
  }
}

interface AEDDeviceModalProps {
  device: AEDDevice;
  accessScope: UserAccessScope | undefined;
  onClose: () => void;
  viewMode?: 'admin' | 'inspection';
  allowQuickInspect?: boolean;
  onQuickInspect?: (device: AEDDevice) => void;
  scheduledEquipment?: Set<string>;
  onCancelSchedule?: (equipmentSerial: string) => void;
  onSchedule?: (devices: AEDDevice[]) => void;
}

export function AEDDeviceModal({ device, accessScope, onClose, viewMode, allowQuickInspect, onQuickInspect, scheduledEquipment, onCancelSchedule, onSchedule }: AEDDeviceModalProps) {
  const maskedFields = accessScope ? getMaskedFieldLabels(device, accessScope) : [];
  const [isInspectionMode, setIsInspectionMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assignmentStatus, setAssignmentStatus] = useState<'pending' | 'in_progress' | 'completed' | null>(null);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showInProgressConfirm, setShowInProgressConfirm] = useState(false);
  const router = useRouter();
  const { showSuccess, showError } = useToast();

  // 일정 추가 여부 확인
  const isScheduled = scheduledEquipment?.has(device.equipment_serial) || false;

  // Assignment 상태 조회
  const [assignmentInfo, setAssignmentInfo] = useState<any>(null);

  useEffect(() => {
    async function fetchAssignmentStatus() {
      if (!device.equipment_serial) return;

      try {
        const response = await fetch(
          `/api/inspections/assignments?equipmentSerial=${device.equipment_serial}`
        );

        if (!response.ok) {
          // 404나 다른 오류는 일정이 없을 수 있으므로 무시
          if (response.status === 404) {
            console.log('[AEDDeviceModal] No assignments found for this equipment');
            return;
          }
          console.warn('[AEDDeviceModal] API error:', response.status);
          return;
        }

        const result = await response.json();
        const data = result?.data;

        if (data && Array.isArray(data) && data.length > 0) {
          const activeAssignment = data.find(
            (a: any) => a.status !== 'cancelled' && a.status !== 'completed'
          ) || data[0];

          if (activeAssignment) {
            setAssignmentStatus(activeAssignment.status);
            setAssignmentId(activeAssignment.id);
            // 추가: 할당 정보 저장 (생성자, 생성일시)
            setAssignmentInfo(activeAssignment);

            console.log('[AEDDeviceModal] Assignment info:', {
              id: activeAssignment.id,
              status: activeAssignment.status,
              created_at: activeAssignment.created_at,
              assigned_by: activeAssignment.user_profiles_inspection_assignments_assigned_byTouser_profiles?.full_name
            });
          }
        }
      } catch (error) {
        console.error('[AEDDeviceModal] Failed to fetch assignment status:', error);
      }
    }

    fetchAssignmentStatus();
  }, [device.equipment_serial]);

  // \ub514\ubc84\uae45\uc744 \uc704\ud55c \ub85c\uadf8
  console.log('AEDDeviceModal - device data:', device);
  console.log('AEDDeviceModal - installation_date:', device.installation_date);
  console.log('AEDDeviceModal - battery_expiry_date:', device.battery_expiry_date);
  console.log('AEDDeviceModal - patch_expiry_date:', device.patch_expiry_date);
  console.log('AEDDeviceModal - last_inspection_date:', device.last_inspection_date);
  console.log('AEDDeviceModal - external_display:', device.external_display, typeof device.external_display);
  console.log('AEDDeviceModal - display_allowed:', device.display_allowed);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const handleCancelAssignment = async () => {
    if (!assignmentId) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/inspections/assignments?id=${assignmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || '일정 취소에 실패했습니다.');
      }

      showSuccess('일정이 취소되었습니다.');

      if (onCancelSchedule) {
        onCancelSchedule(device.equipment_serial);
      }

      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      showError('일정 취소 실패', { message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartInspection = async () => {
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/inspections/quick', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceId: device.id,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || '즉시 점검을 시작하지 못했습니다.');
      }

      await response.json().catch(() => null);
      const serial = device.equipment_serial || device.management_number || device.id;

      showSuccess('즉시 점검이 생성되었습니다.', { message: '점검 화면으로 이동합니다.' });

      setTimeout(() => {
        onClose();
        if (serial) {
          router.push(`/inspection/${encodeURIComponent(serial)}`);
        } else {
          router.push('/inspection');
        }
      }, 500);
    } catch (err) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      showError('점검 시작에 실패했습니다.', { message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!device) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-2 border-b border-gray-700">
          <div className="flex justify-between items-start mb-0.5">
            <div className="flex-1 min-w-0 mr-2">
              <h2 className="text-base font-semibold text-white mb-1 whitespace-nowrap overflow-hidden text-ellipsis">
                {device.installation_institution || '-'}
              </h2>
              <div className="text-sm font-semibold text-gray-300 tracking-wide whitespace-nowrap overflow-hidden text-ellipsis">
                {device.management_number || '-'} <span className="text-gray-600 mx-2">|</span> {device.equipment_serial || '-'}
              </div>
            </div>
            <div className="flex items-center gap-2 ml-2 flex-shrink-0">
              {viewMode === 'inspection' && allowQuickInspect && (
                <Button
                  onClick={handleStartInspection}
                  disabled={isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-2 py-1 h-7"
                >
                  {isSubmitting ? '처리 중...' : '점검'}
                </Button>
              )}
              {viewMode === 'admin' && (
                <>
                  {!isScheduled && onSchedule && (
                    <Button
                      onClick={() => {
                        onSchedule([device]);
                        onClose();
                      }}
                      disabled={isSubmitting}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-2 py-1 h-7"
                    >
                      {isSubmitting ? '처리 중...' : '추가'}
                    </Button>
                  )}

                  {isScheduled && assignmentStatus === 'pending' && (
                    <Button
                      onClick={handleCancelAssignment}
                      disabled={isSubmitting}
                      className="bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1 h-7"
                    >
                      {isSubmitting ? '처리 중...' : '취소'}
                    </Button>
                  )}

                  {isScheduled && assignmentStatus === 'in_progress' && (
                    <Button
                      disabled
                      className="bg-blue-600 text-white text-xs px-2 py-1 h-7 cursor-default"
                    >
                      점검진행중
                    </Button>
                  )}

                  {isScheduled && assignmentStatus === 'completed' && (
                    <Button
                      disabled
                      className="bg-gray-600 text-white text-xs px-2 py-1 h-7 cursor-default"
                    >
                      점검완료
                    </Button>
                  )}
                </>
              )}
              <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        <div className="p-2.5 space-y-1.5">
          {/* 외부표출 차단 경고 */}
          {device.external_non_display_reason &&
           device.external_non_display_reason !== '구비의무기관(119구급차, 여객, 항공기, 객차(철도), 선박' && (
            <div className="pb-1.5 mb-1.5 border-b border-red-500/30">
              <div className="text-xs font-medium text-red-400 mb-0.5">{device.external_non_display_reason}</div>
            </div>
          )}

          {/* 설치 위치 */}
          <div className="pb-1.5 mb-1.5 border-b border-gray-700">
            <div className="grid grid-cols-3 gap-x-2 gap-y-1 mb-1">
              <InfoField
                label="시도"
                value={device.sido || (device.region_code ? getRegionLabel(device.region_code) : undefined)}
              />
              <InfoField label="시군구" value={device.gugun || device.city_code} />
              <InfoField
                label="장비상태"
                value={device.operation_status}
                valueClassName="text-sm font-medium text-emerald-400"
              />
            </div>
            <InfoField
              label="주소"
              value={device.installation_address || device.installation_location_address}
              fullWidth
            />
          </div>

          {/* 유효기간 및 점검 */}
          <div className="pb-1.5 mb-1.5 border-b border-gray-700">
            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
              <InfoField
                label="배터리"
                value={formatDate(device.battery_expiry_date)}
              />
              <InfoField
                label="패드"
                value={formatDate(device.patch_expiry_date)}
              />
              <InfoField
                label="교체예정"
                value={formatDate(device.replacement_date)}
              />
              <InfoField
                label="최종점검"
                value={formatDate(device.last_inspection_date)}
              />
            </div>
          </div>

          {/* 관리 정보 */}
          <div className="pb-1.5 mb-1.5 border-b border-gray-700">
            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
              <InfoField label="관리자" value={device.manager} />
              <InfoField label="설치자" value={device.establisher} />
              {device.institution_contact && (
                <InfoField
                  label="연락처"
                  value={device.institution_contact}
                  isSensitive={maskedFields.includes('연락처')}
                />
              )}
              <InfoField
                label="설치일"
                value={formatDate(device.installation_date)}
              />
            </div>
          </div>

          {/* 제조 정보 */}
          <div className="pb-1.5 mb-1.5 border-b border-gray-700">
            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
              <InfoField label="제조사" value={device.manufacturer} />
              <InfoField label="모델명" value={device.model_name} />
              <InfoField label="제조국가" value={device.manufacturing_country} />
              <InfoField label="시리얼" value={device.serial_number} />
            </div>
          </div>

          {/* 일정 정보 */}
          {assignmentInfo && (
            <div className="pb-1.5 mb-1.5 border-b border-gray-700">
              <div className="text-xs text-yellow-400 text-right space-y-1">
                <div>
                  추가일시: {assignmentInfo.created_at ? formatDateTime(assignmentInfo.created_at) : '-'}({assignmentInfo.user_profiles_inspection_assignments_assigned_byTouser_profiles?.full_name || '-'})
                </div>
                <div>
                  담당: {assignmentInfo.user_profiles_inspection_assignments_assigned_toTouser_profiles?.full_name || '-'}
                </div>
              </div>

              {/* 점검 진행 중일 때 현장점검으로 이동 링크 */}
              {assignmentStatus === 'in_progress' && (
                <div className="mt-2 pt-2 border-t border-gray-700 text-right">
                  <button
                    onClick={() => setShowInProgressConfirm(true)}
                    className="text-xs text-blue-400 hover:text-blue-300 underline cursor-pointer"
                  >
                    현장점검으로 이동 →
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* 점검 진행중 취소 확인 다이얼로그 */}
      <ConfirmDialog
        isOpen={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        onConfirm={handleCancelAssignment}
        type="warning"
        title="점검 진행 중 취소 확인"
        message="이 장비는 현재 점검이 진행 중입니다. 일정을 취소하시겠습니까?"
        details={[
          '❌ 진행 중인 점검 세션이 삭제됩니다',
          '❌ 입력한 모든 점검 데이터가 삭제됩니다',
          '✅ 이전에 완료된 점검 기록은 보존됩니다'
        ]}
        confirmText="예, 취소합니다"
        cancelText="아니오"
      />

      {/* 점검 진행 중 안내 다이얼로그 */}
      <ConfirmDialog
        isOpen={showInProgressConfirm}
        onClose={() => setShowInProgressConfirm(false)}
        onConfirm={() => {
          setShowInProgressConfirm(false);
          onClose();
          router.push('/inspection');
        }}
        type="info"
        title="점검 진행 중"
        message="이미 점검이 시작되어 일정을 취소할 수 없습니다."
        details={[
          '점검 세션으로 이동하여 점검 세션을 관리할 수 있습니다.'
        ]}
        confirmText="예, 현장점검으로 이동"
        cancelText="아니오"
      />
    </div>
  );
}


interface InfoFieldProps {
  label: string;
  value: string | undefined;
  fullWidth?: boolean;
  isSensitive?: boolean;
  valueClassName?: string;
}

function InfoField({ label, value, fullWidth, isSensitive, valueClassName }: InfoFieldProps) {
  // 값이 null, undefined, 빈 문자열, 'null', 'undefined' 인 경우 '-' 표시
  const displayValue = value && value !== 'null' && value !== 'undefined' ? value : '-';

  return (
    <div className={fullWidth ? 'col-span-full' : ''}>
      <div className="text-[11px] text-gray-500 mb-0.5">{label}</div>
      <div className={`text-sm whitespace-nowrap overflow-hidden text-ellipsis ${valueClassName || 'text-white'}`}>
        <span className={displayValue === '-' ? 'text-gray-600' : ''}>{displayValue}</span>
      </div>
    </div>
  );
}

function getExpiryClassName(days: number | undefined): string {
  if (days === undefined || days === -999) return 'text-gray-500';
  if (days < 0) return 'text-red-400';
  if (days <= 30) return 'text-yellow-400';
  return 'text-green-400';
}

function getExpiryDescription(days: number | undefined): string {
  if (days === undefined || days === null || days === -999) return '-';
  if (days < 0) return `${Math.abs(days)}일 만료됨`;
  if (days === 0) return '오늘 만료';
  if (days <= 30) return `${days}일 남음 (주의)`;
  if (days <= 90) return `${days}일 남음`;
  return `${days}일 남음`;
}
