/**
 * 회원가입/조직 생성 시 지역 정보 검증 및 정규화
 * 통합 관리 시스템(lib/constants/regions.ts) 기반
 */

import {
  REGIONS,
  mapCityCodeToGugun,
  mapGugunToCityCode,
  normalizeJurisdictionName,
  extractRegionFromOrgName,
  getRegionCode,
  getGugunListByRegionCode
} from '@/lib/constants/regions';

// 검증 결과 타입
export interface RegionValidationResult {
  isValid: boolean;
  errors: string[];
  suggestions: {
    regionCode?: string;
    cityCode?: string;
    normalizedOrgName?: string;
  };
}

// 조직 정보 타입
export interface OrganizationInfo {
  organizationName?: string;
  regionCode?: string;
  cityCode?: string;
  email?: string;
}

/**
 * 회원가입 시 지역 정보 검증
 */
export function validateRegionInfo(info: OrganizationInfo): RegionValidationResult {
  const errors: string[] = [];
  const suggestions: RegionValidationResult['suggestions'] = {};

  // 1. 조직명 정규화
  if (info.organizationName) {
    const normalizedName = normalizeJurisdictionName(info.organizationName);
    if (normalizedName !== info.organizationName) {
      suggestions.normalizedOrgName = normalizedName;
    }

    // 조직명에서 지역 추출 시도
    const extractedRegion = extractRegionFromOrgName(info.organizationName);
    if (extractedRegion && extractedRegion.gugun) {
      // 추출된 지역으로 city_code 제안
      const suggestedCityCode = mapGugunToCityCode(extractedRegion.gugun);
      if (suggestedCityCode) {
        suggestions.cityCode = suggestedCityCode;
      }

      // region_code 제안 (조직명 기반)
      const suggestedRegionCode = getRegionCode(info.organizationName);
      if (suggestedRegionCode) {
        suggestions.regionCode = suggestedRegionCode;
      }
    }
  }

  // 2. region_code 검증
  if (info.regionCode) {
    const validRegion = REGIONS.find(r => r.code === info.regionCode);
    if (!validRegion) {
      errors.push(`유효하지 않은 region_code: ${info.regionCode}`);
    }
  } else if (suggestions.regionCode) {
    // region_code가 없으면 제안된 값 사용 가능
  } else {
    errors.push('region_code가 필요합니다');
  }

  // 3. city_code 검증 (보건소의 경우)
  if (info.organizationName?.includes('보건소')) {
    if (info.cityCode) {
      const gugun = mapCityCodeToGugun(info.cityCode);
      if (!gugun) {
        errors.push(`유효하지 않은 city_code: ${info.cityCode}`);
      }
    } else if (suggestions.cityCode) {
      // city_code가 없으면 제안된 값 사용 가능
    } else {
      errors.push('보건소는 city_code가 필요합니다');
    }

    // 4. region_code와 city_code 일치성 검증
    const finalRegionCode = info.regionCode || suggestions.regionCode;
    const finalCityCode = info.cityCode || suggestions.cityCode;

    if (finalRegionCode && finalCityCode) {
      const gugunList = getGugunListByRegionCode(finalRegionCode);
      const gugun = mapCityCodeToGugun(finalCityCode);

      if (gugun && gugunList && !gugunList.includes(gugun)) {
        errors.push(`city_code '${finalCityCode}' (${gugun})가 region_code '${finalRegionCode}'에 속하지 않습니다`);
      }
    }
  }

  // 5. 이메일 도메인과 조직 일치성 검증 (korea.kr 도메인)
  if (info.email?.endsWith('@korea.kr')) {
    if (info.organizationName) {
      // 이메일 도메인이 korea.kr인 경우 보건소 또는 공공기관이어야 함
      const isPublicOrg = info.organizationName.includes('보건소') ||
                         info.organizationName.includes('시청') ||
                         info.organizationName.includes('도청') ||
                         info.organizationName.includes('군청') ||
                         info.organizationName.includes('구청');

      if (!isPublicOrg) {
        errors.push('korea.kr 이메일은 공공기관만 사용 가능합니다');
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    suggestions
  };
}

/**
 * 조직 생성 시 지역 정보 자동 완성
 */
export function autocompleteRegionInfo(info: OrganizationInfo): {
  regionCode: string | null;
  cityCode: string | null;
  normalizedOrgName: string | null;
} {
  const result = {
    regionCode: info.regionCode || null,
    cityCode: info.cityCode || null,
    normalizedOrgName: info.organizationName || null
  };

  // 조직명 정규화
  if (info.organizationName) {
    result.normalizedOrgName = normalizeJurisdictionName(info.organizationName);

    // region_code가 없으면 조직명에서 추출
    if (!result.regionCode) {
      const extractedRegionCode = getRegionCode(info.organizationName);
      if (extractedRegionCode) {
        result.regionCode = extractedRegionCode;
      }
    }

    // city_code가 없으면 조직명에서 추출
    if (!result.cityCode && info.organizationName.includes('보건소')) {
      const extractedRegion = extractRegionFromOrgName(info.organizationName);
      if (extractedRegion && extractedRegion.gugun) {
        const suggestedCityCode = mapGugunToCityCode(extractedRegion.gugun);
        if (suggestedCityCode) {
          result.cityCode = suggestedCityCode;
        }
      }
    }
  }

  return result;
}

/**
 * 보건소 조직인지 확인
 */
export function isHealthCenterOrganization(organizationName: string): boolean {
  const normalized = normalizeJurisdictionName(organizationName);
  return normalized.includes('보건소') || normalized.includes('보건지소');
}

/**
 * 시도/시군구 관청인지 확인
 */
export function isGovernmentOrganization(organizationName: string): boolean {
  const normalized = normalizeJurisdictionName(organizationName);
  return normalized.includes('시청') ||
         normalized.includes('도청') ||
         normalized.includes('군청') ||
         normalized.includes('구청') ||
         normalized.includes('보건복지부');
}

/**
 * 조직 타입 추론
 */
export function inferOrganizationType(organizationName: string): string {
  if (isHealthCenterOrganization(organizationName)) {
    return 'health_center';
  }
  if (isGovernmentOrganization(organizationName)) {
    return 'government';
  }
  if (organizationName.includes('응급의료') || organizationName.includes('중앙응급')) {
    return 'emergency_center';
  }
  if (organizationName.includes('병원') || organizationName.includes('의원')) {
    return 'hospital';
  }
  return 'other';
}