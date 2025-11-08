/**
 * 보건소 관련 스크립트를 위한 통합 유틸리티
 * 중앙 관리 시스템(lib/constants/regions.ts)을 활용한 표준화된 함수 모음
 */

import {
  mapCityCodeToGugun,
  mapGugunToCityCode,
  normalizeJurisdictionName,
  getGugunListByRegionCode,
  REGIONS,
  REGION_CODE_TO_GUGUNS
} from '@/lib/constants/regions';
import { OrganizationType } from '@prisma/client';

// 보건소 타입 정의
export interface HealthCenter {
  id: string;
  name: string;
  region_code?: string | null;
  city_code?: string | null;
  address?: string | null;
  type: OrganizationType;
}

// 보건소 분류 함수
export function categorizeHealthCenters(centers: HealthCenter[]) {
  const result = {
    withValidCityCode: [] as HealthCenter[],
    withMissingCityCode: [] as HealthCenter[],
    withInvalidCityCode: [] as HealthCenter[],
    byRegion: {} as Record<string, HealthCenter[]>,
    byGugun: {} as Record<string, HealthCenter[]>
  };

  for (const center of centers) {
    // 시도별 분류
    const regionCode = center.region_code || 'UNKNOWN';
    if (!result.byRegion[regionCode]) {
      result.byRegion[regionCode] = [];
    }
    result.byRegion[regionCode].push(center);

    // city_code 검증
    if (!center.city_code) {
      result.withMissingCityCode.push(center);
    } else {
      const gugun = mapCityCodeToGugun(center.city_code);
      if (gugun) {
        result.withValidCityCode.push(center);

        // 구군별 분류
        if (!result.byGugun[gugun]) {
          result.byGugun[gugun] = [];
        }
        result.byGugun[gugun].push(center);
      } else {
        result.withInvalidCityCode.push(center);
      }
    }
  }

  return result;
}

// 보건소명에서 지역 정보 추출
export function extractRegionInfoFromHealthCenter(name: string): {
  gugun: string | null;
  cityCode: string | null;
} {
  const normalized = normalizeJurisdictionName(name);

  // 패턴: "XX구보건소", "XX시보건소", "XX군보건소"
  const patterns = [
    /^(.+?)(구|시|군)보건소/,
    /^(.+?)(구|시|군)\s*보건/,
    /^(.+?)보건소/
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      const gugun = match[1] + (match[2] || '');
      const cityCode = mapGugunToCityCode(gugun);
      return { gugun, cityCode };
    }
  }

  return { gugun: null, cityCode: null };
}

// 보건소 이름 정규화 (중복 제거, 표준화)
export function normalizeHealthCenterName(name: string): string {
  let normalized = normalizeJurisdictionName(name);

  // 추가 정규화 규칙
  normalized = normalized
    .replace(/보건소.*보건소/, '보건소')  // 중복 제거
    .replace(/\s+/g, ' ')  // 공백 정규화
    .trim();

  return normalized;
}

// 시도별 기대 보건소 개수 (2024년 기준)
export const EXPECTED_HEALTH_CENTERS_BY_REGION: Record<string, number> = {
  'SEO': 25,  // 서울특별시 25개 구
  'BUS': 16,  // 부산광역시 15개 구/군 + 본청
  'DAG': 8,   // 대구광역시 7개 구/군 + 본청
  'INC': 10,  // 인천광역시 8개 구/군 + 2개 군
  'GWJ': 5,   // 광주광역시 5개 구
  'DAJ': 5,   // 대전광역시 5개 구
  'ULS': 5,   // 울산광역시 4개 구 + 1개 군
  'SEJ': 1,   // 세종특별자치시 1개
  'GYG': 42,  // 경기도 31개 시/군 + 분소
  'GAN': 18,  // 강원특별자치도 18개 시/군
  'CHB': 13,  // 충청북도 11개 시/군 + 분소
  'CHN': 16,  // 충청남도 15개 시/군 + 본청
  'JEB': 14,  // 전북특별자치도 14개 시/군
  'JEN': 22,  // 전라남도 22개 시/군
  'GYB': 23,  // 경상북도 23개 시/군
  'GYN': 20,  // 경상남도 18개 시/군 + 분소
  'JEJ': 6    // 제주특별자치도 2개 시 + 보건지소
};

// 보건소 통계 생성
export function generateHealthCenterStats(centers: HealthCenter[]) {
  const categorized = categorizeHealthCenters(centers);
  const stats = {
    total: centers.length,
    byRegion: {} as Record<string, { count: number; expected: number; diff: number }>,
    missingCityCode: categorized.withMissingCityCode.length,
    invalidCityCode: categorized.withInvalidCityCode.length,
    validCityCode: categorized.withValidCityCode.length
  };

  // 시도별 통계
  for (const regionCode of Object.keys(EXPECTED_HEALTH_CENTERS_BY_REGION)) {
    const count = categorized.byRegion[regionCode]?.length || 0;
    const expected = EXPECTED_HEALTH_CENTERS_BY_REGION[regionCode];
    stats.byRegion[regionCode] = {
      count,
      expected,
      diff: count - expected
    };
  }

  return stats;
}

// 보건소 데이터 검증
export function validateHealthCenter(center: HealthCenter): {
  isValid: boolean;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // 1. city_code 검증
  if (!center.city_code) {
    issues.push('city_code가 없음');

    // 조직명에서 추출 시도
    const extracted = extractRegionInfoFromHealthCenter(center.name);
    if (extracted.cityCode) {
      suggestions.push(`city_code를 '${extracted.cityCode}'로 설정 (${extracted.gugun}에서 추출)`);
    }
  } else {
    const gugun = mapCityCodeToGugun(center.city_code);
    if (!gugun) {
      issues.push(`유효하지 않은 city_code: ${center.city_code}`);
    }
  }

  // 2. region_code 검증
  if (!center.region_code) {
    issues.push('region_code가 없음');
  } else if (!REGIONS.find(r => r.code === center.region_code)) {
    issues.push(`유효하지 않은 region_code: ${center.region_code}`);
  }

  // 3. 이름 표준화 체크
  const normalizedName = normalizeHealthCenterName(center.name);
  if (normalizedName !== center.name) {
    suggestions.push(`이름을 '${normalizedName}'로 정규화`);
  }

  return {
    isValid: issues.length === 0,
    issues,
    suggestions
  };
}

// 보건소 city_code 일괄 수정 제안
export function suggestCityCodeFixes(centers: HealthCenter[]): Array<{
  center: HealthCenter;
  currentCityCode: string | null;
  suggestedCityCode: string;
  reason: string;
}> {
  const fixes = [];

  for (const center of centers) {
    // city_code가 없거나 유효하지 않은 경우
    if (!center.city_code || !mapCityCodeToGugun(center.city_code)) {
      const extracted = extractRegionInfoFromHealthCenter(center.name);

      if (extracted.cityCode) {
        fixes.push({
          center,
          currentCityCode: center.city_code,
          suggestedCityCode: extracted.cityCode,
          reason: `조직명 '${center.name}'에서 '${extracted.gugun}' 추출`
        });
      }
    }
  }

  return fixes;
}