/**
 * API 요청 검증 유틸리티
 * 모든 API 엔드포인트에서 지역 코드 검증을 위해 사용
 */

import {
  mapCityCodeToGugun,
  mapGugunToCityCode,
  REGIONS,
  CITY_CODE_TO_GUGUN_MAP
} from '@/lib/constants/regions';
import { logger } from '@/lib/logger';

/**
 * Region code 검증
 */
export function validateRegionCode(regionCode: string | null | undefined): {
  isValid: boolean;
  normalizedCode?: string;
  error?: string;
} {
  if (!regionCode) {
    return { isValid: false, error: 'Region code is required' };
  }

  const validRegion = REGIONS.find(r => r.code === regionCode);
  if (!validRegion) {
    return { isValid: false, error: `Invalid region code: ${regionCode}` };
  }

  return { isValid: true, normalizedCode: validRegion.code };
}

/**
 * City code 검증 및 정규화
 * 잘못된 형식(한글, 오타 등)을 올바른 city_code로 변환
 */
export function validateAndNormalizeCityCode(cityCode: string | null | undefined): {
  isValid: boolean;
  normalizedCode?: string;
  gugun?: string;
  error?: string;
} {
  if (!cityCode) {
    return { isValid: false, error: 'City code is required' };
  }

  // 이미 올바른 city_code인지 확인
  const gugun = mapCityCodeToGugun(cityCode);
  if (gugun) {
    return { isValid: true, normalizedCode: cityCode, gugun };
  }

  // 한글 구군명이 입력된 경우 city_code로 변환 시도
  const normalizedCode = mapGugunToCityCode(cityCode);
  if (normalizedCode) {
    const normalizedGugun = mapCityCodeToGugun(normalizedCode);
    return { isValid: true, normalizedCode, gugun: normalizedGugun || cityCode };
  }

  // 알려진 오타나 변형 처리
  const knownMappings: Record<string, string> = {
    '강남': 'gangnam-gu',
    '강동': 'gangdong-gu',
    '강북': 'gangbuk-gu',
    '강서': 'gangseo-gu',
    // ... 필요한 매핑 추가
  };

  const mapped = knownMappings[cityCode];
  if (mapped) {
    const mappedGugun = mapCityCodeToGugun(mapped);
    return { isValid: true, normalizedCode: mapped, gugun: mappedGugun || cityCode };
  }

  return { isValid: false, error: `Invalid city code: ${cityCode}` };
}

/**
 * API 요청에서 받은 지역 정보 검증
 */
export interface RegionValidationInput {
  regionCode?: string | null;
  cityCode?: string | null;
  sido?: string | null;
  gugun?: string | null;
}

export interface RegionValidationResult {
  isValid: boolean;
  errors: string[];
  normalized: {
    regionCode?: string;
    cityCode?: string;
    sido?: string;
    gugun?: string;
  };
}

export function validateRegionInfo(input: RegionValidationInput): RegionValidationResult {
  const errors: string[] = [];
  const normalized: RegionValidationResult['normalized'] = {};

  // Region code 검증
  if (input.regionCode) {
    const regionResult = validateRegionCode(input.regionCode);
    if (regionResult.isValid && regionResult.normalizedCode) {
      normalized.regionCode = regionResult.normalizedCode;
    } else {
      errors.push(regionResult.error || 'Invalid region code');
    }
  }

  // City code 검증 및 정규화
  if (input.cityCode) {
    const cityResult = validateAndNormalizeCityCode(input.cityCode);
    if (cityResult.isValid && cityResult.normalizedCode) {
      normalized.cityCode = cityResult.normalizedCode;
      normalized.gugun = cityResult.gugun;
    } else {
      errors.push(cityResult.error || 'Invalid city code');
    }
  }

  // 구군명으로 city_code 추론
  if (input.gugun && !normalized.cityCode) {
    const cityCode = mapGugunToCityCode(input.gugun);
    if (cityCode) {
      normalized.cityCode = cityCode;
      normalized.gugun = input.gugun;
    }
  }

  // 시도 정보 정규화
  if (input.sido) {
    normalized.sido = input.sido;
  }

  return {
    isValid: errors.length === 0,
    errors,
    normalized
  };
}

/**
 * API 응답 전 지역 코드 검증
 * 잘못된 데이터가 클라이언트로 전송되는 것을 방지
 */
export function sanitizeRegionData<T extends Record<string, any>>(data: T): T {
  const sanitized = { ...data };

  // region_code 검증
  if ('region_code' in sanitized && sanitized.region_code) {
    const regionResult = validateRegionCode(sanitized.region_code);
    if (!regionResult.isValid) {
      logger.warn('API:Sanitize', 'Invalid region_code in response', {
        original: sanitized.region_code,
        id: sanitized.id
      });
      delete sanitized.region_code;
    }
  }

  // city_code 검증
  if ('city_code' in sanitized && sanitized.city_code) {
    const cityResult = validateAndNormalizeCityCode(sanitized.city_code);
    if (!cityResult.isValid) {
      logger.warn('API:Sanitize', 'Invalid city_code in response', {
        original: sanitized.city_code,
        id: sanitized.id
      });
      delete sanitized.city_code;
    }
  }

  return sanitized;
}

/**
 * 배열 데이터 sanitize
 */
export function sanitizeRegionDataArray<T extends Record<string, any>>(data: T[]): T[] {
  return data.map(item => sanitizeRegionData(item));
}

/**
 * API 미들웨어로 사용할 수 있는 검증 함수
 */
export async function requireValidRegionCodes(request: Request): Promise<{
  isValid: boolean;
  errors?: string[];
  body?: any;
}> {
  try {
    const body = await request.json();

    // 지역 정보가 포함된 경우 검증
    if (body.regionCode || body.cityCode || body.region_code || body.city_code) {
      const validation = validateRegionInfo({
        regionCode: body.regionCode || body.region_code,
        cityCode: body.cityCode || body.city_code,
        sido: body.sido,
        gugun: body.gugun
      });

      if (!validation.isValid) {
        return { isValid: false, errors: validation.errors };
      }

      // 정규화된 값으로 body 업데이트
      if (validation.normalized.regionCode) {
        body.region_code = validation.normalized.regionCode;
        delete body.regionCode;
      }
      if (validation.normalized.cityCode) {
        body.city_code = validation.normalized.cityCode;
        delete body.cityCode;
      }

      return { isValid: true, body };
    }

    return { isValid: true, body };
  } catch (error) {
    return { isValid: false, errors: ['Invalid request body'] };
  }
}