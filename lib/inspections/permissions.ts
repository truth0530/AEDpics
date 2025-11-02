/**
 * 점검 기록 권한 관리
 * 역할별 점검 기록 조회/수정/삭제 권한을 정의합니다
 */

import { UserRole } from '@/packages/types';

export type InspectionPermission = 'view' | 'edit' | 'delete';

export interface InspectionPermissionResult {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  reason?: string;
}

/**
 * 점검 기록에 대한 권한 체크
 *
 * 권한 규칙:
 * - temporary_inspector: 본인의 점검 기록만 수정 가능
 * - local_admin: 관할지역의 점검기록 모두 수정 가능
 * - ministry_admin, regional_admin: 열람만 가능 (뷰어 모드)
 * - emergency_center_admin, regional_emergency_center_admin: 모든 지역 수정 가능
 * - master: 삭제 가능
 */
export function checkInspectionPermission(
  userRole: UserRole,
  userId: string,
  inspectorId: string,
  userRegionCode?: string | null,
  inspectionRegionCode?: string | null
): InspectionPermissionResult {
  // Master: 모든 권한 (삭제 포함)
  if (userRole === 'master') {
    return {
      canView: true,
      canEdit: true,
      canDelete: true,
    };
  }

  // 중앙응급의료센터, 응급의료지원센터: 전국 모든 기록 수정 가능 (삭제 불가)
  if (userRole === 'emergency_center_admin' || userRole === 'regional_emergency_center_admin') {
    return {
      canView: true,
      canEdit: true,
      canDelete: false,
    };
  }

  // 보건복지부, 시도청: 열람만 가능 (뷰어 모드)
  if (userRole === 'ministry_admin' || userRole === 'regional_admin') {
    return {
      canView: true,
      canEdit: false,
      canDelete: false,
      reason: '열람 전용 권한입니다',
    };
  }

  // 보건소 담당자: 관할지역의 점검기록 모두 수정 가능
  if (userRole === 'local_admin') {
    const isSameRegion = userRegionCode && inspectionRegionCode &&
                          userRegionCode === inspectionRegionCode;

    return {
      canView: true,
      canEdit: isSameRegion,
      canDelete: false,
      reason: isSameRegion ? undefined : '관할 지역의 점검 기록만 수정할 수 있습니다',
    };
  }

  // 임시점검원: 본인의 점검 기록만 수정 가능
  if (userRole === 'temporary_inspector') {
    const isOwnInspection = userId === inspectorId;

    return {
      canView: true,
      canEdit: isOwnInspection,
      canDelete: false,
      reason: isOwnInspection ? undefined : '본인의 점검 기록만 수정할 수 있습니다',
    };
  }

  // 기타 역할: 조회만 가능
  return {
    canView: true,
    canEdit: false,
    canDelete: false,
    reason: '권한이 없습니다',
  };
}

/**
 * 역할별 수정 가능 여부 (간단 체크)
 */
export function canEditInspection(
  userRole: UserRole,
  userId: string,
  inspectorId: string,
  userRegionCode?: string | null,
  inspectionRegionCode?: string | null
): boolean {
  const permission = checkInspectionPermission(
    userRole,
    userId,
    inspectorId,
    userRegionCode,
    inspectionRegionCode
  );
  return permission.canEdit;
}

/**
 * 역할별 삭제 가능 여부 (마스터 계정만)
 */
export function canDeleteInspection(userRole: UserRole): boolean {
  return userRole === 'master';
}

/**
 * 점검 기록 액션 버튼 표시 여부 결정
 */
export interface InspectionActionButtons {
  showView: boolean;
  showEdit: boolean;
  showDelete: boolean;
}

export function getInspectionActionButtons(
  userRole: UserRole,
  userId: string,
  inspectorId: string,
  userRegionCode?: string | null,
  inspectionRegionCode?: string | null
): InspectionActionButtons {
  const permission = checkInspectionPermission(
    userRole,
    userId,
    inspectorId,
    userRegionCode,
    inspectionRegionCode
  );

  return {
    showView: permission.canView,
    showEdit: permission.canEdit,
    showDelete: permission.canDelete,
  };
}
