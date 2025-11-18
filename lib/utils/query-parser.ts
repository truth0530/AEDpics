import {
  VALID_EXPIRY_FILTERS,
  VALID_DEVICE_STATUS,
  VALID_EXTERNAL_DISPLAY_FILTERS,
  ExpiryFilter,
  DeviceStatus,
  ExternalDisplayFilter,
} from '@/lib/constants/aed-filters';
import { QueryCriteria } from '@/lib/constants/query-criteria';
import { logger } from '@/lib/logger';

const PLACEHOLDER_FILTER_VALUES = new Set([
  '',
  '전체',
  '시도',
  '구군',
  'all',
  'ALL',
  'All',
  '선택',
  '선택안함',
  'none',
  'None'
]);

function normalizeFilterValue(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || PLACEHOLDER_FILTER_VALUES.has(trimmed)) {
    return null;
  }
  return trimmed;
}

function filterMeaningfulValues(values: string[]): string[] {
  const normalized = values
    .map(value => normalizeFilterValue(value))
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set(normalized));
}

export interface ParsedFilters {
  battery_expiry_date?: ExpiryFilter;
  patch_expiry_date?: ExpiryFilter;
  replacement_date?: ExpiryFilter;
  last_inspection_date?: ExpiryFilter;
  status?: DeviceStatus[];
  regionCodes?: string[];
  cityCodes?: string[];
  category_1?: string[];
  category_2?: string[];
  category_3?: string[];
  external_display?: ExternalDisplayFilter;
  matching_status?: 'all' | 'matched' | 'unmatched';
  search?: string;
  management_number?: string;  // 관리번호로 단일 장비 조회
  equipment_serial?: string;  // 장비연번으로 단일 장비 조회
  queryCriteria?: QueryCriteria;  // 조회 기준: 'address' | 'jurisdiction'
  page?: number;
  limit?: number;
  cursor?: string;
}

export function parseQueryParams(searchParams: URLSearchParams): ParsedFilters {
  const parsed: ParsedFilters = {};

  // 단일 값 파라미터 (화이트리스트 검증)
  const batteryExpiryDate = searchParams.get('battery_expiry_date');
  if (batteryExpiryDate && VALID_EXPIRY_FILTERS.has(batteryExpiryDate as ExpiryFilter)) {
    parsed.battery_expiry_date = batteryExpiryDate as ExpiryFilter;
  }

  const patchExpiryDate = searchParams.get('patch_expiry_date');
  if (patchExpiryDate && VALID_EXPIRY_FILTERS.has(patchExpiryDate as ExpiryFilter)) {
    parsed.patch_expiry_date = patchExpiryDate as ExpiryFilter;
  }

  const replacementDate = searchParams.get('replacement_date');
  if (replacementDate && VALID_EXPIRY_FILTERS.has(replacementDate as ExpiryFilter)) {
    parsed.replacement_date = replacementDate as ExpiryFilter;
  }

  const lastInspectionDate = searchParams.get('last_inspection_date');
  if (lastInspectionDate && VALID_EXPIRY_FILTERS.has(lastInspectionDate as ExpiryFilter)) {
    parsed.last_inspection_date = lastInspectionDate as ExpiryFilter;
  }

  // 다중 값 파라미터 (화이트리스트 검증)
  const statusValues = searchParams.getAll('status')
    .filter(status => VALID_DEVICE_STATUS.has(status as DeviceStatus)) as DeviceStatus[];
  if (statusValues.length > 0) {
    parsed.status = statusValues;
  }

  // 지역 코드 (기본 검증만 - 권한 검증은 API에서)
  // 'region' 파라미터 (레거시) 또는 'regionCodes' 파라미터 (현재) 모두 지원
  // 둘 다 있으면 합치되, 중복 제거
  const regionValuesLegacy = searchParams.getAll('region')
    .filter(region => region && region.length <= 10);
  const regionValuesCurrent = searchParams.getAll('regionCodes')
    .filter(region => region && region.length <= 10);

  const combinedRegionValues = filterMeaningfulValues([...regionValuesLegacy, ...regionValuesCurrent]);
  if (combinedRegionValues.length > 0) {
    parsed.regionCodes = combinedRegionValues;
  }

  // 시군구 코드 (기본 검증만 - 권한 검증은 API에서)
  // 'city' 파라미터 (레거시) 또는 'cityCodes' 파라미터 (현재) 모두 지원
  // 둘 다 있으면 합치되, 중복 제거
  const cityValuesLegacy = searchParams.getAll('city')
    .filter(city => city && city.length <= 10);
  const cityValuesCurrent = searchParams.getAll('cityCodes')
    .filter(city => city && city.length <= 10);

  const combinedCityValues = filterMeaningfulValues([...cityValuesLegacy, ...cityValuesCurrent]);
  if (combinedCityValues.length > 0) {
    parsed.cityCodes = combinedCityValues;
  }

  // 분류 1, 2, 3 필터
  const category1Values = searchParams.getAll('category_1').filter(Boolean);
  if (category1Values.length > 0) {
    parsed.category_1 = category1Values;
  }

  const category2Values = searchParams.getAll('category_2').filter(Boolean);
  if (category2Values.length > 0) {
    parsed.category_2 = category2Values;
  }

  const category3Values = searchParams.getAll('category_3').filter(Boolean);
  if (category3Values.length > 0) {
    parsed.category_3 = category3Values;
  }

  // 통합 검색
  const searchTerm = searchParams.get('search');
  if (searchTerm && searchTerm.trim().length > 0) {
    parsed.search = searchTerm.trim();
  }

  // 관리번호 검색 (단일 장비 조회용)
  const managementNumber = searchParams.get('management_number');
  if (managementNumber && managementNumber.trim().length > 0) {
    parsed.management_number = managementNumber.trim();
  }

  // 장비연번 검색 (단일 장비 조회용)
  const equipmentSerial = searchParams.get('equipment_serial');
  if (equipmentSerial && equipmentSerial.trim().length > 0) {
    parsed.equipment_serial = equipmentSerial.trim();
  }

  const externalDisplay = searchParams.get('external_display');
  if (externalDisplay && VALID_EXTERNAL_DISPLAY_FILTERS.has(externalDisplay as ExternalDisplayFilter)) {
    parsed.external_display = externalDisplay as ExternalDisplayFilter;
  }

  // 매칭 상태
  const matchingStatus = searchParams.get('matching_status');
  if (matchingStatus && ['all', 'matched', 'unmatched'].includes(matchingStatus)) {
    parsed.matching_status = matchingStatus as 'all' | 'matched' | 'unmatched';
  }

  // 조회 기준 (address | jurisdiction)
  const criteria = searchParams.get('criteria');
  if (criteria === 'address' || criteria === 'jurisdiction') {
    parsed.queryCriteria = criteria as QueryCriteria;
  }

  // 숫자 파라미터 (검증 포함)
  const pageStr = searchParams.get('page');
  if (pageStr) {
    const pageNum = parseInt(pageStr, 10);
    if (!isNaN(pageNum) && pageNum > 0 && pageNum <= 10000) {
      parsed.page = pageNum;
    }
  }

  const limitStr = searchParams.get('limit');
  if (limitStr) {
    const limitNum = parseInt(limitStr, 10);
    if (!isNaN(limitNum) && limitNum > 0 && limitNum <= 1000) {
      parsed.limit = limitNum;
    }
  }

  const cursor = searchParams.get('cursor');
  if (cursor && cursor.length <= 200) {
    parsed.cursor = cursor;
  }

  return parsed;
}

// 쿼리 문자열 빌드 (클라이언트용)
export function buildQueryString(filters: ParsedFilters): string {
  const params = new URLSearchParams();

  if (filters.battery_expiry_date) {
    params.set('battery_expiry_date', filters.battery_expiry_date);
  }

  if (filters.patch_expiry_date) {
    params.set('patch_expiry_date', filters.patch_expiry_date);
  }

  if (filters.replacement_date) {
    params.set('replacement_date', filters.replacement_date);
  }

  if (filters.last_inspection_date) {
    params.set('last_inspection_date', filters.last_inspection_date);
  }

  // 다중 값은 각각 추가
  filters.status?.forEach(status => {
    params.append('status', status);
  });

  filters.regionCodes?.forEach(region => {
    params.append('region', region);
  });

  filters.cityCodes?.forEach(city => {
    params.append('city', city);
  });

  filters.category_1?.forEach((category) => {
    params.append('category_1', category);
  });

  filters.category_2?.forEach((category) => {
    params.append('category_2', category);
  });

  filters.category_3?.forEach((category) => {
    params.append('category_3', category);
  });

  if (filters.search) {
    params.set('search', filters.search);
  }

  logger.info('QueryParser:buildQueryString', 'External display filter', { externalDisplay: filters.external_display });
  if (filters.external_display) {
    logger.info('QueryParser:buildQueryString', 'Adding external_display to params', { value: filters.external_display });
    params.set('external_display', filters.external_display);
  } else {
    logger.info('QueryParser:buildQueryString', 'Skipping external_display (falsy)');
  }

  if (filters.matching_status && filters.matching_status !== 'all') {
    params.set('matching_status', filters.matching_status);
  }

  if (filters.queryCriteria) {
    params.set('criteria', filters.queryCriteria);
  }

  if (filters.page && filters.page > 1) {
    params.set('page', filters.page.toString());
  }

  if (filters.limit && filters.limit !== 50) {
    params.set('limit', filters.limit.toString());
  }

  if (filters.cursor) {
    params.set('cursor', filters.cursor);
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}
