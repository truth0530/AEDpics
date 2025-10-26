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

interface AEDDeviceModalProps {
  device: AEDDevice;
  accessScope: UserAccessScope | undefined;
  onClose: () => void;
  viewMode?: 'admin' | 'inspection';
  allowQuickInspect?: boolean;
  onQuickInspect?: (device: AEDDevice) => void;
  scheduledEquipment?: Set<string>;
  onCancelSchedule?: (equipmentSerial: string) => void;
}

export function AEDDeviceModal({ device, accessScope, onClose, viewMode, allowQuickInspect, onQuickInspect, scheduledEquipment, onCancelSchedule }: AEDDeviceModalProps) {
  const maskedFields = accessScope ? getMaskedFieldLabels(device, accessScope) : [];
  const [isInspectionMode, setIsInspectionMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assignmentStatus, setAssignmentStatus] = useState<'pending' | 'in_progress' | 'completed' | null>(null);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const router = useRouter();
  const { showSuccess, showError } = useToast();

  // 일정 추가 여부 확인
  const isScheduled = scheduledEquipment?.has(device.equipment_serial) || false;

  // Assignment 상태 조회
  useEffect(() => {
    async function fetchAssignmentStatus() {
      if (!isScheduled || !device.equipment_serial) return;

      try {
        const response = await fetch(
          `/api/inspections/assignments?equipmentSerial=${device.equipment_serial}`
        );
        if (response.ok) {
          const { data } = await response.json();
          const activeAssignment = data?.find(
            (a: any) => a.status !== 'cancelled' && a.status !== 'completed'
          ) || data?.[0];

          if (activeAssignment) {
            setAssignmentStatus(activeAssignment.status);
            setAssignmentId(activeAssignment.id);
          }
        }
      } catch (error) {
        console.error('Failed to fetch assignment status:', error);
      }
    }

    fetchAssignmentStatus();
  }, [isScheduled, device.equipment_serial]);

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
        <div className="p-2 sm:p-4 border-b border-gray-700">
          <div className="flex justify-between items-start mb-1 sm:mb-2">
            <div className="flex-1 flex items-baseline gap-2">
              <h2 className="text-lg font-semibold text-white">
                {device.installation_institution || '-'}
              </h2>
              <span className="text-sm text-gray-500">
                {device.management_number || '-'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {viewMode === 'inspection' && allowQuickInspect && (
                <Button
                  onClick={handleStartInspection}
                  disabled={isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isSubmitting ? '처리 중...' : '점검 시작'}
                </Button>
              )}
              {viewMode === 'admin' && (
                <>
                  {/* "일정 추가" 버튼 제거: 체크박스 선택 후 "일정 예약 (N개)" 버튼 사용 */}

                  {isScheduled && assignmentStatus === 'pending' && (
                    <Button
                      onClick={handleCancelAssignment}
                      disabled={isSubmitting}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      {isSubmitting ? '처리 중...' : '일정 취소'}
                    </Button>
                  )}

                  {isScheduled && assignmentStatus === 'in_progress' && (
                    <Button
                      onClick={() => setShowCancelConfirm(true)}
                      disabled={isSubmitting}
                      className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-1"
                    >
                      {isSubmitting ? '처리 중...' : (
                        <>
                          <span>일정 취소</span>
                          <span className="text-yellow-300">⚠️</span>
                        </>
                      )}
                    </Button>
                  )}

                  {isScheduled && assignmentStatus === 'completed' && (
                    <Button
                      onClick={() => {
                        // TODO: 점검 기록 보기
                        showSuccess('기록 보기 기능은 곧 추가됩니다.');
                      }}
                      className="bg-gray-600 hover:bg-gray-700 text-white"
                    >
                      기록 보기
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
          <div className="text-xs text-gray-500">
            {device.equipment_serial || '-'}
          </div>
        </div>
        <div className="p-2 sm:p-6 space-y-0">
          {/* 외부표출 차단 경고 */}
          {device.external_non_display_reason &&
           device.external_non_display_reason !== '구비의무기관(119구급차, 여객, 항공기, 객차(철도), 선박' && (
            <div className="pb-2 mb-2 sm:pb-5 sm:mb-5 border-b border-red-500/30">
              <div className="text-sm font-medium text-red-400 mb-1 sm:mb-2">외부표출 차단</div>
              <div className="text-sm text-red-300/90">{device.external_non_display_reason}</div>
            </div>
          )}

          {/* 설치 위치 */}
          <div className="pb-2 mb-2 sm:pb-5 sm:mb-5 border-b border-gray-800">
            <InfoField
              label="주소"
              value={device.installation_address || device.installation_location_address}
              fullWidth
            />
            <div className="mt-1.5 sm:mt-3 grid grid-cols-2 gap-x-6 gap-y-1 sm:gap-y-3">
              {device.installation_position && (
                <InfoField
                  label="상세주소"
                  value={device.installation_position}
                  isSensitive={maskedFields.includes('상세주소')}
                />
              )}
              <InfoField
                label="외부표출"
                value={device.external_display}
              />
            </div>
            <div className="mt-1.5 sm:mt-3 grid gap-x-6 gap-y-1 sm:gap-y-3" style={{ gridTemplateColumns: '80px 100px 1fr' }}>
              <InfoField
                label="시도"
                value={device.sido || (device.region_code ? getRegionLabel(device.region_code) : undefined)}
              />
              <InfoField label="시군구" value={device.gugun || device.city_code} />
              <InfoField label="관할보건소" value={device.jurisdiction_health_center} />
            </div>
          </div>

          {/* 유효기간 */}
          <div className="pb-2 mb-2 sm:pb-5 sm:mb-5 border-b border-gray-800">
            <div className="text-sm font-medium text-gray-400 mb-1.5 sm:mb-3">유효기간</div>
            <div className="grid grid-cols-3 gap-x-6 gap-y-1 sm:gap-y-3">
              <InfoField
                label="배터리"
                value={formatDate(device.battery_expiry_date)}
              />
              <InfoField
                label="패드"
                value={formatDate(device.patch_expiry_date)}
              />
              <InfoField
                label="교체예정일"
                value={formatDate(device.replacement_date)}
              />
            </div>
          </div>

          {/* 점검 이력 */}
          <div className="pb-2 mb-2 sm:pb-5 sm:mb-5 border-b border-gray-800">
            <div className="text-sm font-medium text-gray-400 mb-1.5 sm:mb-3">점검 이력</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 sm:gap-y-3">
              <InfoField
                label="최종점검일"
                value={formatDate(device.last_inspection_date)}
              />
              <InfoField
                label="최근사용일"
                value={formatDate(device.last_use_date)}
              />
              <InfoField
                label="장비상태"
                value={device.operation_status}
              />
            </div>
          </div>

          {/* 관리 */}
          <div className="pb-2 mb-2 sm:pb-5 sm:mb-5 border-b border-gray-800">
            <div className="text-sm font-medium text-gray-400 mb-1.5 sm:mb-3">관리</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 sm:gap-y-3">
              <InfoField label="관리자" value={device.manager} />
              <InfoField label="설치자" value={device.establisher} />
              {device.institution_contact && (
                <InfoField
                  label="연락처"
                  value={device.institution_contact}
                  isSensitive={maskedFields.includes('연락처')}
                />
              )}
            </div>
          </div>

          {/* 제조 정보 */}
          <div className="pb-2 mb-2 sm:pb-5 sm:mb-5 border-b border-gray-800">
            <div className="text-sm font-medium text-gray-400 mb-1.5 sm:mb-3">제조 정보</div>
            <div className="space-y-1.5 sm:space-y-3">
              <div className="grid grid-cols-3 gap-x-6 gap-y-1 sm:gap-y-3">
                <InfoField label="제조사" value={device.manufacturer} />
                <InfoField label="모델명" value={device.model_name} />
                <InfoField label="제조국가" value={device.manufacturing_country} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 sm:gap-y-3">
                <InfoField label="시리얼번호" value={device.serial_number} />
                <InfoField
                  label="설치일"
                  value={formatDate(device.installation_date)}
                />
                <InfoField
                  label="설치방법"
                  value={device.installation_method}
                />
                <InfoField label="정부지원" value={device.government_support} />
              </div>
            </div>
          </div>

          {/* 추가 정보 */}
          {(device.external_non_display_reason || device.remarks) && (
            <div className="pb-2 mb-2 sm:pb-5 sm:mb-5 border-b border-gray-800">
              <div className="text-sm font-medium text-gray-400 mb-1.5 sm:mb-3">추가 정보</div>
              <div className="space-y-1.5 sm:space-y-3">
                {device.external_non_display_reason && (
                  <InfoField
                    label="외부표출 차단 사유"
                    value={device.external_non_display_reason}
                    fullWidth
                  />
                )}
                {device.remarks && (
                  <InfoField
                    label="비고"
                    value={device.remarks}
                    fullWidth
                  />
                )}
              </div>
            </div>
          )}

          {/* 마스킹 정보 */}
          {maskedFields.length > 0 && (
            <div className="pt-2">
              <div className="text-xs text-gray-500">
                마스킹 처리: {maskedFields.join(', ')}
              </div>
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
      <div className="text-xs text-gray-500 mb-0.5 sm:mb-1">{label}</div>
      <div className={`text-sm flex items-center gap-2 ${valueClassName || 'text-white'}`}>
        <span className={displayValue === '-' ? 'text-gray-600' : ''}>{displayValue}</span>
        {isSensitive && <span className="text-yellow-400 text-xs" title="마스킹된 정보">[마스킹]</span>}
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
