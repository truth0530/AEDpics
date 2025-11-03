/**
 * AED 데이터 매핑 유틸리티
 * RPC 결과를 API 응답 형식으로 변환
 */

// 시도명을 지역 코드로 변환
export function getRegionCode(sido: string | null): string {
  if (!sido) return 'UNK';

  const mapping: Record<string, string> = {
    '서울특별시': 'SEO',
    '부산광역시': 'BUS',
    '대구광역시': 'DAE',
    '인천광역시': 'INC',
    '광주광역시': 'GWA',
    '대전광역시': 'DAJ',
    '울산광역시': 'ULS',
    '세종특별자치시': 'SEJ',
    '경기도': 'GYE',
    '강원특별자치도': 'GAN',
    '충청북도': 'CHB',
    '충청남도': 'CHN',
    '전라북도': 'JEB',
    '전북특별자치도': 'JEB',
    '전라남도': 'JEN',
    '경상북도': 'GYB',
    '경상남도': 'GYN',
    '제주특별자치도': 'JEJ',
    '서울': 'SEO',
    '부산': 'BUS',
    '대구': 'DAE',
    '인천': 'INC',
    '광주': 'GWA',
    '대전': 'DAJ',
    '울산': 'ULS',
    '세종': 'SEJ',
    '경기': 'GYE',
    '강원': 'GAN',
    '충북': 'CHB',
    '충남': 'CHN',
    '전북': 'JEB',
    '전남': 'JEN',
    '경북': 'GYB',
    '경남': 'GYN',
    '제주': 'JEJ'
  };

  if (mapping[sido]) {
    return mapping[sido];
  }

  const normalized = sido.trim().toUpperCase();
  const codePattern = /^[A-Z]{3}$/;
  if (codePattern.test(normalized)) {
    return normalized;
  }

  return 'UNK';
}

const REGION_CODE_TO_LABEL: Record<string, string> = {
  SEO: '서울특별시',
  BUS: '부산광역시',
  DAE: '대구광역시',
  INC: '인천광역시',
  GWA: '광주광역시',
  DAJ: '대전광역시',
  ULS: '울산광역시',
  SEJ: '세종특별자치시',
  GYE: '경기도',
  GAN: '강원특별자치도',
  CHB: '충청북도',
  CHN: '충청남도',
  JEB: '전북특별자치도',
  JEN: '전라남도',
  GYB: '경상북도',
  GYN: '경상남도',
  JEJ: '제주특별자치도',
  KR: '중앙'
};

function getRegionLabelFromCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  return REGION_CODE_TO_LABEL[normalized] || null;
}

function normalizeString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

function normalizeNumber(value: unknown): number | null {
  // null 또는 undefined 체크
  if (value === null || value === undefined) {
    return null;
  }

  // 1. 이미 number 타입인 경우
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  // 2. string 타입인 경우
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  // 3. Prisma Decimal 타입 처리 (decimal.js-light)
  if (typeof value === 'object') {
    // toNumber() 메서드 체크
    if ('toNumber' in value && typeof (value as any).toNumber === 'function') {
      try {
        const num = (value as any).toNumber();
        return Number.isFinite(num) ? num : null;
      } catch (error) {
        // toNumber() 실패 시 toString() 시도
      }
    }

    // toString() 메서드로 string 변환 후 파싱
    if ('toString' in value && typeof (value as any).toString === 'function') {
      try {
        const str = (value as any).toString();
        const parsed = Number(str);
        return Number.isFinite(parsed) ? parsed : null;
      } catch (error) {
        // toString() 실패
      }
    }
  }

  return null;
}

// 날짜 차이 계산 (일 단위)
export function getDaysUntil(date: Date | string | null): number | null {
  if (!date) return null;

  const targetDate = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);

  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

// 지난 일수 계산 (일 단위)
export function getDaysSince(date: Date | string | null): number | null {
  if (!date) return null;

  const targetDate = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - targetDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return diffDays >= 0 ? diffDays : null;
}

// display_allowed를 boolean으로 변환
export function isPublicVisible(displayAllowed: string | null): boolean {
  if (!displayAllowed) return true;

  const publicValues = ['표출허용', 'Y', 'YES', '1', 'TRUE'];
  const privateValues = ['미표출', '표출불가', '외부표출차단', 'N', 'NO', '0', 'FALSE'];

  if (publicValues.includes(displayAllowed.toUpperCase())) return true;
  if (privateValues.includes(displayAllowed)) return false;

  return true; // 기본값
}

// RPC 결과를 API 응답으로 매핑
 
export function mapAedData(item: any) {
  const idValue =
    item.id ??
    item.aed_id ??
    item.device_id ??
    item.equipment_serial ??
    item.device_serial ??
    item.management_number;

  const deviceId = typeof idValue === 'string' ? idValue : idValue?.toString();

  const providedSido = normalizeString(item.sido)
    ?? normalizeString(item.region_label)
    ?? normalizeString(item.region_name)
    ?? normalizeString(item.region_full_name)
    ?? normalizeString(item.region);

  const providedRegionCode = normalizeString(item.region_code)
    ?? normalizeString(item.regionCode)
    ?? (providedSido ? getRegionCode(providedSido) : null);

  const resolvedSido = providedSido ?? getRegionLabelFromCode(providedRegionCode);
  const regionCode = providedRegionCode ?? getRegionCode(resolvedSido ?? null);

  const providedCity = normalizeString(item.gugun)
    ?? normalizeString(item.city)
    ?? normalizeString(item.city_name)
    ?? normalizeString(item.city_label)
    ?? normalizeString(item.cityCode)
    ?? normalizeString(item.city_code);

  const cityCode = normalizeString(item.city_code)
    ?? normalizeString(item.cityCode)
    ?? providedCity;

  const installationInstitution = normalizeString(item.installation_institution)
    ?? normalizeString(item.installation_org)
    ?? normalizeString(item.installationOrganization);

  const installationOrg = normalizeString(item.installation_org)
    ?? installationInstitution;

  const installationAddress = normalizeString(item.installation_address)
    ?? normalizeString(item.installationAddress)
    ?? normalizeString(item.address);

  const locationAddress = normalizeString(item.installation_location_address)
    ?? installationAddress;

  const detailedAddress = normalizeString(item.installation_position)
    ?? normalizeString(item.installation_location)
    ?? normalizeString(item.detailed_address)
    ?? normalizeString(item.detailedAddress);

  const displayAllowed = normalizeString(item.display_allowed) ?? normalizeString(item.displayAllowed);
  const externalDisplay = normalizeString(item.external_display) ?? normalizeString(item.externalDisplay);
  const externalReasonRaw = normalizeString(item.external_non_display_reason)
    ?? normalizeString(item.non_display_reason)
    ?? normalizeString(item.externalNonDisplayReason);

  const batteryExpiryDate = normalizeString(item.battery_expiry_date)
    ?? normalizeString(item.batteryExpiryDate)
    ?? normalizeString(item.expiry_date);

  const patchExpiryDate = normalizeString(item.patch_expiry_date)
    ?? normalizeString(item.patchExpiryDate);

  const replacementDate = normalizeString(item.replacement_date)
    ?? normalizeString(item.replacementDate);

  const lastInspectionDate = normalizeString(item.last_inspection_date)
    ?? normalizeString(item.lastInspectionDate);

  const computedExpiryDate =
    replacementDate ??
    normalizeString(item.expiry_date) ??
    batteryExpiryDate ??
    patchExpiryDate ??
    null;

  const daysUntilBattery =
    normalizeNumber(item.days_until_battery_expiry ?? item.daysUntilBatteryExpiry)
    ?? (batteryExpiryDate ? getDaysUntil(batteryExpiryDate) : null);

  const daysUntilPatch =
    normalizeNumber(item.days_until_patch_expiry ?? item.daysUntilPatchExpiry)
    ?? (patchExpiryDate ? getDaysUntil(patchExpiryDate) : null);

  const daysUntilReplacement =
    normalizeNumber(item.days_until_replacement ?? item.daysUntilReplacement)
    ?? (replacementDate ? getDaysUntil(replacementDate) : null);

  const daysUntilExpiry =
    normalizeNumber(item.days_until_expiry ?? item.daysUntilExpiry)
    ?? daysUntilReplacement
    ?? daysUntilBattery
    ?? daysUntilPatch
    ?? (computedExpiryDate ? getDaysUntil(computedExpiryDate) : null);

  const daysSinceInspection =
    normalizeNumber(item.days_since_last_inspection ?? item.daysSinceLastInspection)
    ?? (lastInspectionDate ? getDaysSince(lastInspectionDate) : null);

  const operationStatus = normalizeString(item.operation_status)
    ?? normalizeString(item.device_status)
    ?? normalizeString(item.operationStatus);

  const operationStatusRaw = normalizeString(item.operation_status_raw)
    ?? operationStatus;

  const contactPhone = normalizeString(item.contact_phone)
    ?? normalizeString(item.institution_contact)
    ?? normalizeString(item.contactPhone);

  const institutionContact = normalizeString(item.institution_contact)
    ?? contactPhone;

  const contactEmail = normalizeString(item.contact_email)
    ?? normalizeString(item.contactEmail);

  const manager = normalizeString(item.manager);
  const modelName = normalizeString(item.model_name)
    ?? normalizeString(item.modelName);
  const manufacturer = normalizeString(item.manufacturer);

  // GPS 좌표 (Prisma Decimal 객체 처리)
  const latitude = normalizeNumber(item.latitude);
  const longitude = normalizeNumber(item.longitude);

  const isPublicVisibleValue =
    typeof item.is_public_visible === 'boolean'
      ? item.is_public_visible
      : isPublicVisible(displayAllowed);

  return {
    // 식별자
    id: deviceId,
    equipment_serial: normalizeString(item.equipment_serial) ?? normalizeString(item.device_serial) ?? null,
    device_serial: normalizeString(item.device_serial) ?? normalizeString(item.equipment_serial) ?? null,
    management_number: normalizeString(item.management_number) ?? null,

    // 위치 정보
    sido: resolvedSido ?? null,
    gugun: providedCity ?? null,
    region_code: regionCode ?? null,
    city_code: cityCode ?? null,
    latitude: latitude !== null && latitude !== undefined ? Number(latitude) : null,
    longitude: longitude !== null && longitude !== undefined ? Number(longitude) : null,

    // 분류
    category_1: normalizeString(item.category_1) ?? null,
    category_2: normalizeString(item.category_2) ?? null,
    category_3: normalizeString(item.category_3) ?? null,

    // 설치 정보
    installation_org: installationOrg ?? null,
    installation_institution: installationInstitution ?? installationOrg ?? null,
    address: installationAddress ?? null,
    installation_address: installationAddress ?? null,
    installation_location_address: locationAddress ?? null,
    detailed_address: detailedAddress ?? null,
    installation_position: detailedAddress ?? null,
    purchase_institution: normalizeString(item.purchase_institution) ?? null,

    // 만료일 정보
    battery_expiry_date: batteryExpiryDate ?? null,
    patch_expiry_date: patchExpiryDate ?? null,
    pad_expiry_date: patchExpiryDate ?? null,
    replacement_date: replacementDate ?? null,
    expiry_date: computedExpiryDate ?? null,

    // 만료일까지 남은 일수
    days_until_battery_expiry: daysUntilBattery,
    days_until_patch_expiry: daysUntilPatch,
    days_until_pad_expiry: daysUntilPatch,
    days_until_replacement: daysUntilReplacement,
    days_until_expiry: daysUntilExpiry,
    days_since_last_inspection: daysSinceInspection,

    // 상태 정보
    operation_status: operationStatus ?? null,
    operation_status_raw: operationStatusRaw ?? null,
    device_status: normalizeString(item.device_status) ?? operationStatus ?? null,
    external_display: externalDisplay ?? null,

    // 관리 정보
    jurisdiction_health_center: normalizeString(item.jurisdiction_health_center) ?? null,
    contact_phone: contactPhone ?? null,
    contact_email: contactEmail ?? null,
    institution_contact: institutionContact ?? null,
    manager,
    model_name: modelName ?? null,
    manufacturer,
    external_non_display_reason: externalReasonRaw,
    last_inspection_date: lastInspectionDate ?? null,
    installation_date: normalizeString(item.installation_date) ?? null,
    first_installation_date: normalizeString(item.first_installation_date) ?? null,
    last_use_date: normalizeString(item.last_use_date) ?? null,

    // 공개 여부 및 민감 정보
    is_public_visible: isPublicVisibleValue,
    has_sensitive_data: Boolean(
      typeof item.has_sensitive_data === 'boolean'
        ? item.has_sensitive_data
        : normalizeNumber(item.has_sensitive_data) === 1 || normalizeString(item.has_sensitive_data) === 'true'
    ),

    // 추가 정보 (모달에서 사용)
    display_allowed: displayAllowed ?? null,
    installation_method: normalizeString(item.installation_method) ?? null,
    registration_date: normalizeString(item.registration_date) ?? null,
    manufacturing_date: normalizeString(item.manufacturing_date) ?? null,
    manufacturing_country: normalizeString(item.manufacturing_country) ?? null,
    serial_number: normalizeString(item.serial_number) ?? null,
    establisher: normalizeString(item.establisher) ?? null,
    government_support: normalizeString(item.government_support) ?? null,
    patch_available: normalizeString(item.patch_available) ?? null,
    remarks: normalizeString(item.remarks) ?? null,

    // 시스템 정보
    updated_at: normalizeString(item.updated_at) ?? null,
  };
}
