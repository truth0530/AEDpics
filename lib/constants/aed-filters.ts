// AED 데이터 필터링 상수 정의

export const VALID_EXPIRY_FILTERS = new Set([
  'expired',
  'in30',
  'in60',
  'in90',
  'in180',
  'in365',
  'no_expiry',
  'all_with_expiry',
  'never',
  'over365',
  'over180',
  'over90',
  'over60',
  'over30'
] as const);

export type ExpiryFilter = 'expired' | 'in30' | 'in60' | 'in90' | 'in180' | 'in365' | 'no_expiry' | 'all_with_expiry' | 'never' | 'over365' | 'over180' | 'over90' | 'over60' | 'over30';

export const VALID_EXTERNAL_DISPLAY_FILTERS = new Set([
  'Y',
  'N',
  'blocked'
] as const);

export type ExternalDisplayFilter = 'Y' | 'N' | 'blocked';

export const VALID_DEVICE_STATUS = new Set([
  'active',
  'inactive',
  'maintenance',
  'hidden',
  'normal',
  'error',
  'inspection_needed'
] as const);

export type DeviceStatus = 'active' | 'inactive' | 'maintenance' | 'hidden' | 'normal' | 'error' | 'inspection_needed';

export const EXPIRY_FILTER_LABELS: Record<ExpiryFilter, string> = {
  expired: '만료됨',
  in30: '30일 이내 만료',
  in60: '60일 이내 만료',
  in90: '90일 이내 만료',
  in180: '180일 이내 만료',
  in365: '365일 이내 만료',
  no_expiry: '만료일 미등록',
  all_with_expiry: '만료일 등록됨',
  never: '만료 없음',
  over365: '365일 초과',
  over180: '180일 초과',
  over90: '90일 초과',
  over60: '60일 초과',
  over30: '30일 초과'
};

export const EXTERNAL_DISPLAY_FILTER_LABELS: Record<ExternalDisplayFilter, string> = {
  Y: '외부표출 Y',
  N: '외부표출 N',
  blocked: '외부표출 차단',
};

export const DEVICE_STATUS_LABELS: Record<DeviceStatus, string> = {
  active: '정상',
  inactive: '비활성',
  maintenance: '점검중',
  hidden: '외부표출차단',
  normal: '일반',
  error: '오류',
  inspection_needed: '점검필요'
};

export const DEVICE_STATUS_COLORS: Record<DeviceStatus, string> = {
  active: 'bg-green-500',
  inactive: 'bg-gray-500',
  maintenance: 'bg-yellow-500',
  hidden: 'bg-red-500',
  normal: 'bg-blue-500',
  error: 'bg-red-600',
  inspection_needed: 'bg-orange-500'
};

export type InstitutionCategory = '구비의무기관' | '구비의무기관외';

const RAW_CATEGORY_MAP: Record<string, InstitutionCategory> = {
  구비의무기관: '구비의무기관',
  mandated: '구비의무기관',
  mandatory: '구비의무기관',
  공공: '구비의무기관',
  구비의무기관외: '구비의무기관외',
  '구비의무기관 외': '구비의무기관외',
  non_mandated: '구비의무기관외',
  optional: '구비의무기관외',
};

export const VALID_INSTITUTION_CATEGORIES = new Set<InstitutionCategory>([
  '구비의무기관',
  '구비의무기관외',
]);

export const INSTITUTION_CATEGORY_LABELS: Record<InstitutionCategory, string> = {
  구비의무기관: '구비의무기관',
  구비의무기관외: '구비의무기관외',
};

export function normalizeInstitutionCategory(value: string | null | undefined): InstitutionCategory | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  const normalizedKey = trimmed.toLowerCase();
  if (RAW_CATEGORY_MAP[trimmed]) {
    return RAW_CATEGORY_MAP[trimmed];
  }

  if (RAW_CATEGORY_MAP[normalizedKey]) {
    return RAW_CATEGORY_MAP[normalizedKey];
  }

  return undefined;
}
