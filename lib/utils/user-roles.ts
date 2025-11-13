import { user_role as UserRole } from '@prisma/client';
import { getRegionFullLabel, REGION_CODE_TO_LABEL } from '@/lib/constants/regions';

/**
 * 사용자 역할 관리 유틸리티
 * CLAUDE.md의 공식 권한 체계를 따름
 */

export interface RoleInfo {
  value: UserRole;
  label: string;
  description: string;
  accessLevel: 'national' | 'regional' | 'local';
  color: string;
  canApproveUsers: boolean;
}

/**
 * 공식 역할 정보
 * CLAUDE.md 1-1. 핵심 권한 체계 기준
 */
export const ROLE_INFO: Record<UserRole, RoleInfo> = {
  master: {
    value: 'master',
    label: '마스터 관리자',
    description: '시스템 전체 관리 권한',
    accessLevel: 'national',
    color: 'purple',
    canApproveUsers: true
  },
  emergency_center_admin: {
    value: 'emergency_center_admin',
    label: '중앙응급의료센터',
    description: '전국 AED 조회 및 관리 권한 (@nmc.or.kr)',
    accessLevel: 'national',
    color: 'blue',
    canApproveUsers: true
  },
  regional_emergency_center_admin: {
    value: 'regional_emergency_center_admin',
    label: '응급의료지원센터',
    description: '전국 AED 조회 및 관리 권한 (@nmc.or.kr)',
    accessLevel: 'national',
    color: 'cyan',
    canApproveUsers: true
  },
  ministry_admin: {
    value: 'ministry_admin',
    label: '보건복지부',
    description: '전국 AED 조회 및 관리 권한 (@korea.kr)',
    accessLevel: 'national',
    color: 'indigo',
    canApproveUsers: true
  },
  regional_admin: {
    value: 'regional_admin',
    label: '시도청 담당자',
    description: '해당 시/도 AED 조회 및 관리 (@korea.kr)',
    accessLevel: 'regional',
    color: 'green',
    canApproveUsers: false
  },
  local_admin: {
    value: 'local_admin',
    label: '보건소 담당자',
    description: '해당 시/군/구 AED 점검 및 관리 (@korea.kr)',
    accessLevel: 'local',
    color: 'emerald',
    canApproveUsers: false
  },
  temporary_inspector: {
    value: 'temporary_inspector',
    label: '임시 점검원',
    description: '임시 AED 점검 권한 (비정규직)',
    accessLevel: 'local',
    color: 'yellow',
    canApproveUsers: false
  },
  pending_approval: {
    value: 'pending_approval',
    label: '승인 대기',
    description: '가입 신청 후 승인 대기 중',
    accessLevel: 'local',
    color: 'gray',
    canApproveUsers: false
  },
  email_verified: {
    value: 'email_verified',
    label: '이메일 인증 완료',
    description: '이메일 인증 완료, 프로필 설정 대기',
    accessLevel: 'local',
    color: 'gray',
    canApproveUsers: false
  },
  rejected: {
    value: 'rejected',
    label: '승인 거부',
    description: '가입 신청이 거부됨',
    accessLevel: 'local',
    color: 'red',
    canApproveUsers: false
  }
};

/**
 * 승인 가능한 역할 목록 (승인 모달에서 선택 가능)
 * 상태 역할(pending_approval, email_verified, rejected)은 제외
 */
export const APPROVABLE_ROLES: UserRole[] = [
  'emergency_center_admin',
  'regional_emergency_center_admin',
  'ministry_admin',
  'regional_admin',
  'local_admin',
  'temporary_inspector'
];

/**
 * 역할 라벨 반환
 */
export function getRoleLabel(role: UserRole): string {
  return ROLE_INFO[role]?.label || role;
}

/**
 * 역할 설명 반환
 */
export function getRoleDescription(role: UserRole): string {
  return ROLE_INFO[role]?.description || '';
}

/**
 * 역할 색상 반환 (Tailwind 클래스용)
 */
export function getRoleColor(role: UserRole): string {
  return ROLE_INFO[role]?.color || 'gray';
}

/**
 * 역할 배지 클래스 반환
 */
export function getRoleBadgeClass(role: UserRole): string {
  const color = getRoleColor(role);
  const colorMap: Record<string, string> = {
    purple: 'bg-purple-900/30 text-purple-300 border-purple-500/30',
    blue: 'bg-blue-900/30 text-blue-300 border-blue-500/30',
    cyan: 'bg-cyan-900/30 text-cyan-300 border-cyan-500/30',
    indigo: 'bg-indigo-900/30 text-indigo-300 border-indigo-500/30',
    green: 'bg-green-900/30 text-green-300 border-green-500/30',
    emerald: 'bg-emerald-900/30 text-emerald-300 border-emerald-500/30',
    yellow: 'bg-yellow-900/30 text-yellow-300 border-yellow-500/30',
    red: 'bg-red-900/30 text-red-300 border-red-500/30',
    gray: 'bg-gray-700/30 text-gray-400 border-gray-600/30'
  };
  return colorMap[color] || colorMap.gray;
}

/**
 * 접근 레벨 라벨
 */
export function getAccessLevelLabel(role: UserRole): string {
  const level = ROLE_INFO[role]?.accessLevel;
  const labels = {
    national: '전국',
    regional: '시도',
    local: '시군구'
  };
  return labels[level] || '';
}

/**
 * 지역명 표시 (지역 코드 숨김)
 * 중앙 lib/constants/regions.ts에서 관리되는 지역 코드를 사용하여
 * 항상 일관된 지역명을 표시합니다.
 */
export function getRegionDisplay(regionCode: string | null): string {
  if (!regionCode) return '';

  // 1. 정식명칭(fullLabel) 먼저 시도 (예: '서울특별시')
  const fullLabel = getRegionFullLabel(regionCode);
  if (fullLabel !== regionCode) {
    return fullLabel;
  }

  // 2. 짧은 이름(label) 시도 (예: '서울')
  const shortLabel = REGION_CODE_TO_LABEL[regionCode];
  if (shortLabel) {
    return shortLabel;
  }

  // 3. 매핑 실패 시 원본 코드 반환
  return regionCode;
}

/**
 * 권한 체크 헬퍼 함수들
 * 하드코딩된 권한 배열 대신 ROLE_INFO의 accessLevel을 기반으로 동적 판단
 */

/**
 * 전국 권한 여부 확인
 * master, emergency_center_admin, regional_emergency_center_admin, ministry_admin
 */
export function hasNationalAccess(role: UserRole): boolean {
  return ROLE_INFO[role]?.accessLevel === 'national';
}

/**
 * 시도 권한 여부 확인
 * regional_admin
 */
export function hasRegionalAccess(role: UserRole): boolean {
  return ROLE_INFO[role]?.accessLevel === 'regional';
}

/**
 * 시군구 권한 여부 확인
 * local_admin, temporary_inspector 등
 */
export function hasLocalAccess(role: UserRole): boolean {
  return ROLE_INFO[role]?.accessLevel === 'local';
}

/**
 * 사용자 승인 권한 여부 확인
 */
export function canApprove(role: UserRole): boolean {
  return ROLE_INFO[role]?.canApproveUsers || false;
}

/**
 * 전국 권한 역할 목록 반환
 * 동적으로 accessLevel === 'national'인 역할들을 필터링
 */
export function getNationalRoles(): UserRole[] {
  return Object.keys(ROLE_INFO).filter(
    role => ROLE_INFO[role as UserRole].accessLevel === 'national'
  ) as UserRole[];
}

/**
 * 시도 권한 역할 목록 반환
 * 동적으로 accessLevel === 'regional'인 역할들을 필터링
 */
export function getRegionalRoles(): UserRole[] {
  return Object.keys(ROLE_INFO).filter(
    role => ROLE_INFO[role as UserRole].accessLevel === 'regional'
  ) as UserRole[];
}

/**
 * 시군구 권한 역할 목록 반환
 * 동적으로 accessLevel === 'local'인 역할들을 필터링
 */
export function getLocalRoles(): UserRole[] {
  return Object.keys(ROLE_INFO).filter(
    role => ROLE_INFO[role as UserRole].accessLevel === 'local'
  ) as UserRole[];
}

/**
 * 승인 가능 역할 목록 반환
 * 동적으로 canApproveUsers === true인 역할들을 필터링
 */
export function getApproverRoles(): UserRole[] {
  return Object.keys(ROLE_INFO).filter(
    role => ROLE_INFO[role as UserRole].canApproveUsers
  ) as UserRole[];
}
