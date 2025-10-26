import { UserAccessScope } from '@/lib/auth/access-control';

export interface AEDDevice {
  id: string;
  device_serial?: string;
  equipment_serial?: string;
  management_number?: string;
  installation_org?: string;
  address?: string;
  detailed_address?: string;
  region_code?: string;
  city_code?: string;
  jurisdiction_health_center?: string;
  health_center_id?: string;
  expiry_date?: string;
  days_until_expiry?: number;
  replacement_date?: string;
  days_until_replacement?: number;
  days_since_last_inspection?: number;
  device_status?: string;
  is_public_visible?: boolean;
  contact_phone?: string;
  contact_email?: string;
  has_sensitive_data?: boolean;
  external_non_display_reason?: string | null;
  last_inspection_date?: string;
  installation_date?: string;
  manufacturer?: string;
  model_name?: string;
  sido?: string;
  gugun?: string;
}

export function maskSensitiveData(
   
  devices: any[],
  accessScope: UserAccessScope
   
): any[] {
  if (accessScope.permissions.canViewSensitiveData) {
    return devices; // 민감 정보 접근 권한이 있으면 원본 반환
  }

  return devices.map(device => ({
    ...device,
    // 연락처 마스킹
    contact_phone: device.contact_phone ?
      device.contact_phone.replace(/(\d{2,3})-?(\d{3,4})-?(\d{4})/, '$1-***-$3') :
      undefined,
    // 상세 주소 마스킹 (동/호수 제거)
    detailed_address: device.detailed_address ?
      device.detailed_address.split(' ').slice(0, -1).join(' ') + ' ***' :
      undefined,
    // 이메일 마스킹
    contact_email: device.contact_email ?
      device.contact_email.replace(/(.{1,3}).*@/, '$1***@') :
      undefined
  }));
}

// 민감 정보 표시 여부 확인
export function shouldShowSensitiveDataIcon(
   
  device: any,
  accessScope: UserAccessScope
): boolean {
  return device.has_sensitive_data && !accessScope.permissions.canViewSensitiveData;
}

// 마스킹된 필드 목록 반환
export function getMaskedFieldLabels(
   
  device: any,
  accessScope: UserAccessScope
): string[] {
  if (accessScope.permissions.canViewSensitiveData) {
    return [];
  }

  const maskedFields: string[] = [];

  if (device.contact_phone) {
    maskedFields.push('연락처');
  }

  if (device.detailed_address) {
    maskedFields.push('상세주소');
  }

  if (device.contact_email) {
    maskedFields.push('이메일');
  }

  return maskedFields;
}
