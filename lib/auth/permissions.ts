import { UserRole } from '@/packages/types';

// 통일된 권한 역할 정의
export const ROLES = {
  MASTER: 'master',
  EMERGENCY_CENTER_ADMIN: 'emergency_center_admin',
  REGIONAL_EMERGENCY_CENTER_ADMIN: 'regional_emergency_center_admin',
  MINISTRY_ADMIN: 'ministry_admin',
  REGIONAL_ADMIN: 'regional_admin',
  LOCAL_ADMIN: 'local_admin',
  TEMPORARY_INSPECTOR: 'temporary_inspector',
  PENDING_APPROVAL: 'pending_approval',
  EMAIL_VERIFIED: 'email_verified'
} as const;

// 권한 그룹 정의
export const PERMISSION_GROUPS = {
  // 시스템 전체 관리 권한 (Master만)
  SYSTEM_ADMIN: [ROLES.MASTER],

  // 고급 관리 권한 (Master, 중앙응급의료센터, 응급의료지원센터, 보건복지부)
  HIGH_ADMIN: [ROLES.MASTER, ROLES.EMERGENCY_CENTER_ADMIN, ROLES.REGIONAL_EMERGENCY_CENTER_ADMIN, ROLES.MINISTRY_ADMIN],

  // 일반 관리 권한 (고급 관리 + 응급의료지원센터 + 지역 관리자)
  ADMIN: [ROLES.MASTER, ROLES.EMERGENCY_CENTER_ADMIN, ROLES.REGIONAL_EMERGENCY_CENTER_ADMIN, ROLES.MINISTRY_ADMIN, ROLES.REGIONAL_ADMIN],

  // 모든 관리자 (응급의료지원센터 + 지역 관리자 + 로컬 관리자)
  ALL_ADMIN: [ROLES.MASTER, ROLES.EMERGENCY_CENTER_ADMIN, ROLES.REGIONAL_EMERGENCY_CENTER_ADMIN, ROLES.MINISTRY_ADMIN, ROLES.REGIONAL_ADMIN, ROLES.LOCAL_ADMIN],

  // 활성 사용자 (승인된 사용자들)
  ACTIVE_USERS: [ROLES.MASTER, ROLES.EMERGENCY_CENTER_ADMIN, ROLES.REGIONAL_EMERGENCY_CENTER_ADMIN, ROLES.MINISTRY_ADMIN, ROLES.REGIONAL_ADMIN, ROLES.LOCAL_ADMIN, ROLES.TEMPORARY_INSPECTOR]
} as const;

// 권한 검증 함수들
export function hasSystemAdminAccess(role: UserRole): boolean {
  return (PERMISSION_GROUPS.SYSTEM_ADMIN as readonly string[]).includes(role);
}

export function hasHighAdminAccess(role: UserRole): boolean {
  return (PERMISSION_GROUPS.HIGH_ADMIN as readonly string[]).includes(role);
}

export function hasAdminAccess(role: UserRole): boolean {
  return (PERMISSION_GROUPS.ADMIN as readonly string[]).includes(role);
}

export function hasAllAdminAccess(role: UserRole): boolean {
  return (PERMISSION_GROUPS.ALL_ADMIN as readonly string[]).includes(role);
}

export function hasActiveUserAccess(role: UserRole): boolean {
  return (PERMISSION_GROUPS.ACTIVE_USERS as readonly string[]).includes(role);
}

// 특정 작업별 권한 검증
export const PERMISSIONS = {
  // 데이터베이스 마이그레이션
  RUN_MIGRATION: (role: UserRole) => hasSystemAdminAccess(role),

  // 알림 생성
  CREATE_NOTIFICATION: (role: UserRole) => hasHighAdminAccess(role),

  // 사용자 승인/거부
  APPROVE_USERS: (role: UserRole) => hasHighAdminAccess(role),

  // 사용자 목록 조회
  LIST_USERS: (role: UserRole) => hasAdminAccess(role),

  // 대시보드 조회
  VIEW_DASHBOARD: (role: UserRole) => hasAdminAccess(role),

  // 보건소 데이터 동기화
  SYNC_HEALTH_CENTERS: (role: UserRole) => hasSystemAdminAccess(role),

  // 조직 관리
  MANAGE_ORGANIZATIONS: (role: UserRole) => hasHighAdminAccess(role),

  // AED 장치 관리
  MANAGE_AED_DEVICES: (role: UserRole) => hasActiveUserAccess(role),

  // 점검 기록 작성
  CREATE_INSPECTION: (role: UserRole) => hasActiveUserAccess(role),

  // 점검 기록 검증
  VERIFY_INSPECTION: (role: UserRole) => hasAdminAccess(role)
} as const;

// API 라우트에서 사용할 권한 검증 헬퍼
export function checkPermission(role: UserRole, permission: keyof typeof PERMISSIONS): boolean {
  return PERMISSIONS[permission](role);
}

// 에러 메시지 생성
export function getPermissionError(permission: keyof typeof PERMISSIONS): string {
  const messages = {
    RUN_MIGRATION: 'Master 관리자만 마이그레이션을 실행할 수 있습니다.',
    CREATE_NOTIFICATION: '알림 생성 권한이 없습니다.',
    APPROVE_USERS: '사용자 승인 권한이 없습니다.',
    LIST_USERS: '사용자 목록 조회 권한이 없습니다.',
    VIEW_DASHBOARD: '대시보드 조회 권한이 없습니다.',
    SYNC_HEALTH_CENTERS: '보건소 데이터 동기화 권한이 없습니다.',
    MANAGE_ORGANIZATIONS: '조직 관리 권한이 없습니다.',
    MANAGE_AED_DEVICES: 'AED 장치 관리 권한이 없습니다.',
    CREATE_INSPECTION: '점검 기록 작성 권한이 없습니다.',
    VERIFY_INSPECTION: '점검 기록 검증 권한이 없습니다.'
  };

  return messages[permission] || '권한이 없습니다.';
}