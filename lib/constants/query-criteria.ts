/**
 * AED 데이터 조회 기준 정의
 * 물리적 위치와 관할보건소 기준을 분리하여 관리
 */

// 조회 기준 타입
export type QueryCriteria = 'address' | 'jurisdiction';

// 조회 기준 레이블
export const QUERY_CRITERIA_LABELS: Record<QueryCriteria, string> = {
  address: '주소 기준',
  jurisdiction: '관할보건소 기준'
};

// 조회 기준 설명
export const QUERY_CRITERIA_DESCRIPTIONS: Record<QueryCriteria, string> = {
  address: '선택한 지역에 물리적으로 설치된 모든 AED',
  jurisdiction: '선택한 지역의 보건소들이 관리하는 모든 AED (타 지역 설치분 포함)'
};

// 권한별 조회 기준 사용 가능 여부
export interface QueryCriteriaPermission {
  canUseAddressCriteria: boolean;
  canUseJurisdictionCriteria: boolean;
  defaultCriteria: QueryCriteria;
}

// 역할별 조회 기준 권한
export const ROLE_QUERY_CRITERIA: Record<string, QueryCriteriaPermission> = {
  master: {
    canUseAddressCriteria: true,
    canUseJurisdictionCriteria: true,
    defaultCriteria: 'address'
  },
  emergency_center_admin: {
    canUseAddressCriteria: true,
    canUseJurisdictionCriteria: true,
    defaultCriteria: 'address'
  },
  ministry_admin: {
    canUseAddressCriteria: true,
    canUseJurisdictionCriteria: true,
    defaultCriteria: 'address'
  },
  regional_admin: {
    canUseAddressCriteria: true,
    canUseJurisdictionCriteria: true,
    defaultCriteria: 'address'
  },
  local_admin: {
    canUseAddressCriteria: true,
    canUseJurisdictionCriteria: true,
    defaultCriteria: 'jurisdiction' // 보건소는 관할 기준이 기본
  },
  temporary_inspector: {
    canUseAddressCriteria: false,
    canUseJurisdictionCriteria: false,
    defaultCriteria: 'address'
  },
  pending_approval: {
    canUseAddressCriteria: false,
    canUseJurisdictionCriteria: false,
    defaultCriteria: 'address'
  },
  email_verified: {
    canUseAddressCriteria: false,
    canUseJurisdictionCriteria: false,
    defaultCriteria: 'address'
  }
};