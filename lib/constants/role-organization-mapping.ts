/**
 * 역할별 조직 타입 매핑
 *
 * 각 역할이 선택할 수 있는 조직 타입을 정의합니다.
 * 이를 통해 역할과 조직의 일관성을 보장합니다.
 *
 * @nmc.or.kr (응급의료센터)
 *   - emergency_center_admin: emergency_center
 *   - regional_emergency_center_admin: emergency_center
 *
 * @korea.kr (정부 담당자)
 *   - ministry_admin: province
 *   - regional_admin: province
 *   - local_admin: health_center
 *
 * others (임시점검원)
 *   - temporary_inspector: health_center
 */

import { UserRole } from '@/packages/types';

export type OrganizationType = 'health_center' | 'province' | 'emergency_center';

/**
 * 역할에 따른 선택 가능한 조직 타입
 */
export const ROLE_ORGANIZATION_TYPE_MAP: Record<UserRole, OrganizationType[]> = {
  'emergency_center_admin': ['emergency_center'],
  'regional_emergency_center_admin': ['emergency_center'],
  'ministry_admin': ['province'],
  'regional_admin': ['province'],
  'local_admin': ['health_center'],
  'temporary_inspector': ['health_center'],
  'master': ['province', 'health_center', 'emergency_center'], // master는 모든 조직 선택 가능
  // 다음은 임시 상태로 조직 접근 권한이 없음
  'pending_approval': [],
  'email_verified': [],
  'rejected': []
};

/**
 * 주어진 역할에 대해 선택 가능한 조직 타입을 반환
 * @param role - 사용자 역할
 * @returns 선택 가능한 조직 타입 배열
 */
export function getAllowedOrganizationTypes(role: UserRole): OrganizationType[] {
  return ROLE_ORGANIZATION_TYPE_MAP[role] || [];
}

/**
 * 역할과 조직 타입이 일치하는지 검증
 * @param role - 사용자 역할
 * @param organizationType - 조직 타입
 * @returns 일치 여부
 */
export function isValidRoleOrganizationMatch(role: UserRole, organizationType: OrganizationType): boolean {
  const allowedTypes = getAllowedOrganizationTypes(role);
  return allowedTypes.includes(organizationType);
}

/**
 * 조직 타입에 따른 역할 레이블
 */
export const ORGANIZATION_TYPE_DISPLAY: Record<OrganizationType, string> = {
  'health_center': '보건소',
  'province': '시도',
  'emergency_center': '응급의료센터'
};

export function getOrganizationTypeLabel(type: OrganizationType): string {
  return ORGANIZATION_TYPE_DISPLAY[type] || type;
}
