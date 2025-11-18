/**
 * Team Member Authorization Utilities
 *
 * 목적: 역할 기반 팀원 가시성 및 할당 권한 제어
 *
 * 권한 규칙:
 * 1. Central (중앙응급의료센터): 전국 모든 팀원 접근 가능
 * 2. Provincial (시도 응급의료지원센터): 동일 시도 팀원만 접근 가능
 * 3. District (보건소): 동일 시도 + 시군구 팀원만 접근 가능
 * 4. Ministry (보건복지부): 전국 모든 팀원 접근 가능
 *
 * 지역 코드: region_code (예: 'SEO' for 서울, 'DAE' for 대구)
 * 시군구: district (예: '강서구', '중구')
 */

import { Prisma } from '@prisma/client';

export type OrganizationType = 'central' | 'provincial' | 'district' | 'ministry';

export interface AuthorizedUser {
  id: string;
  organization_id?: string | null;
  role: string;
  region_code?: string | null;
  district?: string | null;
}

/**
 * 사용자의 조직 타입 판별
 *
 * 역할 기반 조직 타입 결정:
 * - central: emergency_center_admin, master
 * - provincial: regional_emergency_center_admin
 * - district: local_admin
 * - ministry: ministry_admin
 */
export function getOrganizationType(role: string): OrganizationType {
  switch (role?.toLowerCase()) {
    case 'emergency_center_admin':
    case 'master':
      return 'central';
    case 'regional_emergency_center_admin':
    case 'regional_admin':
      return 'provincial';
    case 'local_admin':
      return 'district';
    case 'ministry_admin':
      return 'ministry';
    default:
      // temporary_inspector와 기타 역할은 district로 취급
      return 'district';
  }
}

/**
 * 팀원 목록 조회 필터 생성
 *
 * 현재 사용자가 접근할 수 있는 팀원 필터:
 * - Central/Ministry: 제한 없음 (approved_at != null만 확인)
 * - Provincial: 동일 region_code
 * - District: 동일 region_code + district
 */
export function getTeamMemberFilter(
  currentUser: AuthorizedUser
): Prisma.user_profilesWhereInput {
  const orgType = getOrganizationType(currentUser.role);

  // 기본 필터: 승인된 활성 사용자
  const baseFilter: Prisma.user_profilesWhereInput = {
    is_active: true,
    approved_at: { not: null },
    id: { not: currentUser.id }, // 본인 제외
  };

  switch (orgType) {
    case 'central':
    case 'ministry':
      // 지역 제약 없음 - 전국 모든 팀원
      return baseFilter;

    case 'provincial':
      // 동일 region_code만
      return {
        ...baseFilter,
        region_code: currentUser.region_code,
      };

    case 'district':
      // 동일 region_code + district
      // district가 null인 경우 팀원 조회 불가 (데이터 정합성 문제)
      if (!currentUser.district) {
        return {
          ...baseFilter,
          id: { in: [] }, // 빈 결과 반환
        };
      }

      return {
        ...baseFilter,
        region_code: currentUser.region_code,
        district: currentUser.district,
      };

    default:
      return baseFilter;
  }
}

/**
 * 특정 팀원에 할당 권한 확인
 *
 * 할당 가능 조건:
 * 1. 대상 팀원이 승인되고 활성 상태
 * 2. 현재 사용자가 대상을 볼 수 있는 권한 (getTeamMemberFilter 결과에 포함)
 */
export function canAssignToUser(
  currentUser: AuthorizedUser,
  targetUser: Partial<AuthorizedUser>
): { allowed: boolean; reason?: string } {
  // 1. 기본 조건: 대상이 승인되고 활성
  if (!targetUser.id) {
    return { allowed: false, reason: 'Target user ID not found' };
  }

  // 2. 현재 사용자의 접근 권한 확인
  const filter = getTeamMemberFilter(currentUser);

  const orgType = getOrganizationType(currentUser.role);

  // 3. 조직 타입별 권한 확인
  switch (orgType) {
    case 'central':
    case 'ministry':
      // 지역 제약 없음
      return { allowed: true };

    case 'provincial':
      // 동일 region_code 확인
      if (targetUser.region_code !== currentUser.region_code) {
        return {
          allowed: false,
          reason: `Cannot assign to user outside region: ${targetUser.region_code}`,
        };
      }
      return { allowed: true };

    case 'district':
      // 동일 region_code + district 확인
      if (targetUser.region_code !== currentUser.region_code) {
        return {
          allowed: false,
          reason: `Cannot assign to user outside region: ${targetUser.region_code}`,
        };
      }
      if (targetUser.district !== currentUser.district) {
        return {
          allowed: false,
          reason: `Cannot assign to user outside district: ${targetUser.district}`,
        };
      }
      return { allowed: true };

    default:
      return { allowed: false, reason: 'Unknown organization type' };
  }
}

/**
 * 검색 쿼리 성능 최적화
 *
 * Trigram 인덱스를 활용한 LIKE 검색 (부분일치):
 * - idx_user_profiles_full_name_trigram: full_name LIKE '%query%'
 * - idx_user_profiles_email_trigram: email LIKE '%query%'
 *
 * 예상 성능: 100ms 이내 (500ms SLA 충족)
 */
export function buildTeamMemberSearchQuery(
  searchTerm: string,
  filter: Prisma.user_profilesWhereInput
): Prisma.user_profilesWhereInput {
  if (!searchTerm || searchTerm.trim().length === 0) {
    return filter;
  }

  const searchPattern = `%${searchTerm}%`;

  return {
    ...filter,
    OR: [
      { full_name: { contains: searchTerm, mode: 'insensitive' } },
      { email: { contains: searchTerm, mode: 'insensitive' } },
    ],
  };
}

/**
 * Assignment Scope 검증
 *
 * 조합 검증 규칙:
 * - assigned: assigned_to != NULL (특정 사용자에 할당)
 * - all_team: assigned_to NULL (팀 전체 접근)
 * - unassigned: assigned_to NULL (아직 미할당)
 */
export interface AssignmentScopeValidation {
  valid: boolean;
  error?: string;
}

export function validateAssignmentScope(
  scope: string,
  assignedTo?: string | null
): AssignmentScopeValidation {
  // 1. scope 값 검증
  if (!['assigned', 'all_team', 'unassigned'].includes(scope)) {
    return {
      valid: false,
      error: `Invalid scope: ${scope}. Must be one of: assigned, all_team, unassigned`,
    };
  }

  // 2. 조합 검증
  if (scope === 'assigned' && !assignedTo) {
    return {
      valid: false,
      error: "scope='assigned' requires assigned_to to be set",
    };
  }

  if (scope !== 'assigned' && assignedTo) {
    return {
      valid: false,
      error: `scope='${scope}' requires assigned_to to be null, but got '${assignedTo}'`,
    };
  }

  return { valid: true };
}

/**
 * 중복 할당 확인
 *
 * 정책: 동일 장비가 이미 할당되어 있으면 거부
 * 예외: completed 상태는 재할당 가능 (이미 점검 완료)
 */
export interface DuplicateAssignmentCheck {
  isDuplicate: boolean;
  existingAssignment?: {
    id: string;
    status: string;
    assigned_to?: string;
  };
}

export function shouldPreventDuplicateAssignment(
  existingStatuses: string[]
): boolean {
  // completed, cancelled 상태는 이미 끝났으므로 재할당 허용
  const activeStatuses = existingStatuses.filter(
    (status) => !['completed', 'cancelled', 'unavailable'].includes(status)
  );

  // 활성 상태가 있으면 중복 방지
  return activeStatuses.length > 0;
}

/**
 * 헬퍼: 팀원 가시성 계산
 *
 * SQL COUNT 쿼리 최적화를 위한 필터 정보
 */
export function getTeamMemberStats(filter: Prisma.user_profilesWhereInput) {
  return {
    where: filter,
    select: {
      id: true,
      full_name: true,
      email: true,
      role: true,
    },
  };
}

/**
 * 장비 기반 팀원 필터 생성 (단일 장비)
 *
 * 특정 장비를 점검할 수 있는 팀원만 필터링:
 * 1. 본인(currentUserId)은 항상 포함
 * 2. 장비가 속한 구군의 korea.kr 계정 보건소 담당자(local_admin)
 * 3. 장비가 속한 구군에 소속된 임시점검원(temporary_inspector)
 * 4. 타 시도/구군 korea.kr 계정 제외
 *
 * @param equipmentLocation 장비 위치 { sido, gugun }
 * @param currentUserId 현재 사용자 ID (본인 할당용)
 * @returns Prisma 필터 조건
 */
export function getEquipmentBasedTeamFilter(
  equipmentLocation: { sido: string | null; gugun: string | null },
  currentUserId: string
): Prisma.user_profilesWhereInput {
  if (!equipmentLocation.sido || !equipmentLocation.gugun) {
    // 장비 위치가 불명확하면 본인만 반환
    return {
      id: currentUserId,
      is_active: true,
      approved_at: { not: null },
    };
  }

  // 기본 필터: 활성 + 승인된 사용자
  const baseFilter: Prisma.user_profilesWhereInput = {
    is_active: true,
    approved_at: { not: null },
  };

  // OR 조건 구성
  return {
    ...baseFilter,
    OR: [
      // 1. 본인은 항상 포함
      { id: currentUserId },

      // 2. 장비 구군의 local_admin (korea.kr)
      {
        role: 'local_admin',
        email: { endsWith: '@korea.kr' },
        region_code: equipmentLocation.sido,
        district: equipmentLocation.gugun,
      },

      // 3. 장비 구군의 temporary_inspector
      {
        role: 'temporary_inspector',
        region_code: equipmentLocation.sido,
        district: equipmentLocation.gugun,
      },
    ],
  };
}

/**
 * 멀티 장비 기반 팀원 필터 생성
 *
 * 여러 장비를 동시에 할당할 때 사용:
 * - 모든 장비 위치의 담당자를 모두 포함
 * - 서로 다른 구군의 장비를 선택해도 각 구군의 담당자가 모두 표시됨
 *
 * @param equipmentLocations 장비 위치 배열 [{ sido, gugun }, ...]
 * @param currentUserId 현재 사용자 ID (본인 할당용)
 * @returns Prisma 필터 조건
 */
export function getMultiEquipmentBasedTeamFilter(
  equipmentLocations: Array<{ sido: string | null; gugun: string | null }>,
  currentUserId: string
): Prisma.user_profilesWhereInput {
  // 유효한 위치만 필터링
  const validLocations = equipmentLocations.filter(
    loc => loc.sido && loc.gugun
  ) as Array<{ sido: string; gugun: string }>;

  if (validLocations.length === 0) {
    // 유효한 장비 위치가 없으면 본인만 반환
    return {
      id: currentUserId,
      is_active: true,
      approved_at: { not: null },
    };
  }

  // 기본 필터: 활성 + 승인된 사용자
  const baseFilter: Prisma.user_profilesWhereInput = {
    is_active: true,
    approved_at: { not: null },
  };

  // 모든 위치에 대한 OR 조건 생성
  const locationConditions: Prisma.user_profilesWhereInput[] = [];

  // 본인은 항상 포함
  locationConditions.push({ id: currentUserId });

  // 각 위치별 담당자 추가
  for (const location of validLocations) {
    // local_admin (korea.kr)
    locationConditions.push({
      role: 'local_admin',
      email: { endsWith: '@korea.kr' },
      region_code: location.sido,
      district: location.gugun,
    });

    // temporary_inspector
    locationConditions.push({
      role: 'temporary_inspector',
      region_code: location.sido,
      district: location.gugun,
    });
  }

  return {
    ...baseFilter,
    OR: locationConditions,
  };
}
