import { ParsedFilters } from '@/lib/utils/query-parser';
import { UserProfile, UserRole } from '@/packages/types';
import { UserAccessScope } from '@/lib/auth/access-control';

export type FilterKey = 'sido' | 'gugun' | 'category_1' | 'category_2' | 'category_3';

interface FilterPolicy {
  required: FilterKey[];
  requireOneOf?: FilterKey[];
}

const DEFAULT_POLICY: FilterPolicy = {
  required: ['sido', 'gugun'],
};

const ROLE_FILTER_POLICY: Record<UserRole, FilterPolicy> = {
  master: {
    required: [],
    // master는 필터 없이도 조회 가능
  },
  emergency_center_admin: {
    required: [],
    // 응급의료센터 관리자도 필터 없이 조회 가능
  },
  regional_emergency_center_admin: {
    required: [],
    // 응급의료지원센터 관리자도 필터 없이 조회 가능
  },
  ministry_admin: {
    required: [],
    // 보건복지부 관리자도 필터 없이 조회 가능
  },
  regional_admin: {
    required: ['sido'],
  },
  local_admin: {
    required: ['sido', 'gugun'],
  },
  temporary_inspector: {
    required: ['sido', 'gugun'],
  },
  pending_approval: {
    required: ['sido', 'gugun'],
  },
  email_verified: {
    required: ['sido', 'gugun'],
  },
  rejected: {
    required: ['sido', 'gugun'],
  },
};

function hasFilter(
  key: FilterKey,
  {
    regionCodes,
    cityCodes,
    category_1,
    category_2,
    category_3,
  }: {
    regionCodes: string[] | null;
    cityCodes: string[] | null;
    category_1: string[] | null;
    category_2: string[] | null;
    category_3: string[] | null;
  },
) {
  if (key === 'sido') {
    return Array.isArray(regionCodes) && regionCodes.length > 0;
  }
  if (key === 'gugun') {
    return Array.isArray(cityCodes) && cityCodes.length > 0;
  }
  if (key === 'category_1') {
    return Array.isArray(category_1) && category_1.length > 0;
  }
  if (key === 'category_2') {
    return Array.isArray(category_2) && category_2.length > 0;
  }
  if (key === 'category_3') {
    return Array.isArray(category_3) && category_3.length > 0;
  }
  return false;
}

const FORBIDDEN_REGION_MESSAGE = '허용되지 않은 시도 코드가 포함되어 있습니다';
const FORBIDDEN_CITY_MESSAGE = '허용되지 않은 시군구 코드가 포함되어 있습니다';
const MISSING_FILTER_MESSAGE = '필수 검색 조건을 충족하지 못했습니다';
const REQUIRE_ONE_OF_MESSAGE = '시도/시군구 또는 기관 구분을 선택해주세요';
const MISSING_SCOPE_MESSAGE = '권한에 필요한 지역 정보가 설정되지 않았습니다';

export interface FilterEnforcementParams {
  userProfile: UserProfile;
  accessScope: UserAccessScope;
  requestedFilters: ParsedFilters;
}

export interface FilterEnforcementSuccess {
  success: true;
  filters: {
    regionCodes: string[] | null;
    cityCodes: string[] | null;
    category_1: string[] | null;
    category_2: string[] | null;
    category_3: string[] | null;
  };
  metadata: {
    appliedDefaults: FilterKey[];
    requiredFilters: FilterKey[];
    requireOneOf?: FilterKey[];
  };
}

export interface FilterEnforcementFailure {
  success: false;
  status: number;
  reason: string;
  missingFilters?: FilterKey[];
  unauthorizedRegions?: string[];
  unauthorizedCities?: string[];
  metadata: {
    appliedDefaults: FilterKey[];
    requiredFilters: FilterKey[];
    requireOneOf?: FilterKey[];
  };
}

export type FilterEnforcementResult = FilterEnforcementSuccess | FilterEnforcementFailure;

export function enforceFilterPolicy({
  userProfile,
  accessScope,
  requestedFilters,
}: FilterEnforcementParams): FilterEnforcementResult {
  const policy = ROLE_FILTER_POLICY[userProfile.role as UserRole] || DEFAULT_POLICY;
  const appliedDefaults: FilterKey[] = [];

  const allowedRegionCodes = accessScope.allowedRegionCodes;
  const allowedCityCodes = accessScope.allowedCityCodes;

  let regionCodes: string[] | null = null;
  let cityCodes: string[] | null = null;

  if (allowedRegionCodes === null) {
    regionCodes = requestedFilters.regionCodes?.length ? requestedFilters.regionCodes : null;
  } else if (allowedRegionCodes.length > 0) {
    if (requestedFilters.regionCodes?.length) {
      const unauthorized = requestedFilters.regionCodes.filter(
        (code) => !allowedRegionCodes.includes(code),
      );
      if (unauthorized.length > 0) {
        return {
          success: false,
          status: 403,
          reason: FORBIDDEN_REGION_MESSAGE,
          unauthorizedRegions: unauthorized,
          metadata: {
            appliedDefaults,
            requiredFilters: policy.required,
            requireOneOf: policy.requireOneOf,
          },
        };
      }
      regionCodes = requestedFilters.regionCodes;
    } else {
      regionCodes = allowedRegionCodes;
      appliedDefaults.push('sido');
    }
  } else {
    return {
      success: false,
      status: 403,
      reason: MISSING_SCOPE_MESSAGE,
      metadata: {
        appliedDefaults,
        requiredFilters: policy.required,
        requireOneOf: policy.requireOneOf,
      },
    };
  }

  if (allowedCityCodes === null) {
    cityCodes = requestedFilters.cityCodes?.length ? requestedFilters.cityCodes : null;
  } else if (allowedCityCodes.length > 0) {
    if (requestedFilters.cityCodes?.length) {
      const unauthorized = requestedFilters.cityCodes.filter(
        (code) => !allowedCityCodes.includes(code),
      );
      if (unauthorized.length > 0) {
        return {
          success: false,
          status: 403,
          reason: FORBIDDEN_CITY_MESSAGE,
          unauthorizedCities: unauthorized,
          metadata: {
            appliedDefaults,
            requiredFilters: policy.required,
            requireOneOf: policy.requireOneOf,
          },
        };
      }
      cityCodes = requestedFilters.cityCodes;
    } else {
      cityCodes = allowedCityCodes;
      appliedDefaults.push('gugun');
    }
  } else {
    return {
      success: false,
      status: 403,
      reason: MISSING_SCOPE_MESSAGE,
      metadata: {
        appliedDefaults,
        requiredFilters: policy.required,
        requireOneOf: policy.requireOneOf,
      },
    };
  }

  const category_1 = requestedFilters.category_1?.length ? requestedFilters.category_1 : null;
  const category_2 = requestedFilters.category_2?.length ? requestedFilters.category_2 : null;
  const category_3 = requestedFilters.category_3?.length ? requestedFilters.category_3 : null;

  const hasRegion = hasFilter('sido', { regionCodes, cityCodes, category_1, category_2, category_3 });
  const hasCity = hasFilter('gugun', { regionCodes, cityCodes, category_1, category_2, category_3 });
  const hasCategory1 = hasFilter('category_1', { regionCodes, cityCodes, category_1, category_2, category_3 });
  const hasCategory2 = hasFilter('category_2', { regionCodes, cityCodes, category_1, category_2, category_3 });
  const hasCategory3 = hasFilter('category_3', { regionCodes, cityCodes, category_1, category_2, category_3 });

  const missingFilters = policy.required.filter((key) => {
    if (key === 'sido') return !hasRegion;
    if (key === 'gugun') {
      // allowedCityCodes가 null이면 시도 전체 접근 가능 = gugun 조건 자동 충족
      if (allowedCityCodes === null) return false;
      return !hasCity;
    }
    if (key === 'category_1') return !hasCategory1;
    if (key === 'category_2') return !hasCategory2;
    if (key === 'category_3') return !hasCategory3;
    return true;
  });

  if (missingFilters.length > 0) {
    return {
      success: false,
      status: 400,
      reason: MISSING_FILTER_MESSAGE,
      missingFilters,
      metadata: {
        appliedDefaults,
        requiredFilters: policy.required,
        requireOneOf: policy.requireOneOf,
      },
    };
  }

  if (policy.requireOneOf && !policy.requireOneOf.some((key) => {
    if (key === 'sido') return hasRegion;
    if (key === 'gugun') return hasCity;
    if (key === 'category_1') return hasCategory1;
    if (key === 'category_2') return hasCategory2;
    if (key === 'category_3') return hasCategory3;
    return false;
  })) {
    return {
      success: false,
      status: 400,
      reason: REQUIRE_ONE_OF_MESSAGE,
      missingFilters: policy.requireOneOf,
      metadata: {
        appliedDefaults,
        requiredFilters: policy.required,
        requireOneOf: policy.requireOneOf,
      },
    };
  }

  return {
    success: true,
    filters: {
      regionCodes,
      cityCodes,
      category_1,
      category_2,
      category_3,
    },
    metadata: {
      appliedDefaults,
      requiredFilters: policy.required,
      requireOneOf: policy.requireOneOf,
    },
  };
}
