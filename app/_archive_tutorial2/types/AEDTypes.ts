// AED 관련 타입 정의 - 수파베이스 8만대 데이터 대비 확장 구조

export interface AEDManufacturer {
  id?: string;
  name: string;
  country: string;
  models: AEDModel[];
  // 추후 수파베이스 연동 시 확장될 필드들
  established_year?: number;
  headquarters?: string;
  certification_info?: string[];
  support_contact?: string;
}

export interface AEDModel {
  id?: string;
  name: string;
  weight: string;
  features: string[];
  battery_life: string;
  pad_life: string;
  shock_time: string;
  // 추후 확장 필드들
  model_year?: string;
  certification_number?: string;
  price_range?: string;
  maintenance_schedule?: string;
  user_manual_url?: string;
}

// 실제 수파베이스 스키마와 호환될 AED 장치 타입
export interface FullAEDDevice {
  // 기본 식별 정보
  id: string;
  serial_number: string;
  device_number?: string; // e-gen 장치번호
  
  // 설치 정보
  installation_org: string;
  installation_location: string;
  installation_address: string;
  installation_date: string;
  initial_install_date?: string;
  
  // 장치 정보
  manufacturer: string;
  model_name: string;
  manufacturing_date: string;
  device_expiry: string;
  
  // 소모품 정보
  battery_expiry: string;
  battery_model?: string;
  pad_expiry: string;
  pad_model?: string;
  
  // 위치 정보
  latitude: number;
  longitude: number;
  building_floor?: string;
  specific_location: string;
  
  // 관리 정보
  manager_name?: string;
  manager_contact?: string;
  department?: string;
  
  // 점검 관련
  last_check_date?: string;
  next_check_date?: string;
  check_frequency?: number; // 개월 단위
  priority: 'urgent' | 'warning' | 'normal';
  
  // 운영 정보
  operating_hours?: OperatingHours[];
  access_restriction?: string;
  external_display_allowed?: boolean;
  external_no_display_reason?: string;
  
  // 지역 특성
  region_code?: string;
  climate_characteristics?: string[];
  special_considerations?: string[];
  
  // 시스템 관리
  created_at?: string;
  updated_at?: string;
  is_active?: boolean;
  saol_deleted?: boolean; // 새올 삭제여부
  data_source?: 'e-gen' | 'manual' | 'import'; // 데이터 출처
}

export interface OperatingHours {
  day: string;
  start_time: string;
  end_time: string;
  is_closed?: boolean;
}

// 현재 튜토리얼용 간소화된 타입 (기존과 호환성 유지)
export interface AEDDevice {
  id: string;
  name: string;
  location: string;
  address?: string;
  manager?: string;
  batteryExpiry: string;
  padExpiry: string;
  deviceExpiry: string;
  priority: 'urgent' | 'warning' | 'normal';
  distance: string;
  lastCheck: string;
  lat: string;
  lng: string;
  installationOrg: string;
  installationLocation: string;
  modelName: string;
  manufacturer?: string;
  manufacturingDate: string;
  serialNumber: string;
  founder?: string;
  initialInstallDate?: string;
  installDate: string;
  registrationDate?: string;
  saolDeleted?: boolean;
  displayAllowed?: boolean;
  externalDisplay?: boolean;
  externalNoDisplayReason?: string;
  governmentSupported?: boolean;
  특성?: string[];
  관심사항?: string[];
  category1?: string;
  category2?: string;
  category3?: string;
  purchaseOrg?: string;
  replacementDate?: string;
  patchAvailable?: boolean;
  patchExpiry?: string;
}

// 데이터 변환 함수들
export const transformFullToSimpleDevice = (fullDevice: FullAEDDevice): AEDDevice => {
  return {
    id: fullDevice.id,
    name: fullDevice.installation_org,
    location: fullDevice.specific_location,
    batteryExpiry: fullDevice.battery_expiry,
    padExpiry: fullDevice.pad_expiry,
    deviceExpiry: fullDevice.device_expiry,
    priority: fullDevice.priority,
    distance: '0km', // 계산 필요
    lastCheck: fullDevice.last_check_date || '',
    lat: String(fullDevice.latitude),
    lng: String(fullDevice.longitude),
    installationOrg: fullDevice.installation_org,
    installationLocation: fullDevice.installation_location,
    modelName: fullDevice.model_name,
    manufacturer: fullDevice.manufacturer,
    manufacturingDate: fullDevice.manufacturing_date,
    serialNumber: fullDevice.serial_number,
    installDate: fullDevice.installation_date,
    saolDeleted: fullDevice.saol_deleted,
    externalDisplay: fullDevice.external_display_allowed,
    특성: fullDevice.climate_characteristics,
    관심사항: fullDevice.special_considerations
  };
};

export const transformSimpleToFullDevice = (simpleDevice: AEDDevice): Partial<FullAEDDevice> => {
  return {
    id: simpleDevice.id,
    serial_number: simpleDevice.serialNumber,
    installation_org: simpleDevice.installationOrg,
    installation_location: simpleDevice.installationLocation,
    installation_address: '', // 추가 정보 필요
    installation_date: simpleDevice.installDate,
    manufacturer: simpleDevice.manufacturer || '',
    model_name: simpleDevice.modelName,
    manufacturing_date: simpleDevice.manufacturingDate,
    device_expiry: simpleDevice.deviceExpiry,
    battery_expiry: simpleDevice.batteryExpiry,
    pad_expiry: simpleDevice.padExpiry,
    latitude: parseFloat(simpleDevice.lat),
    longitude: parseFloat(simpleDevice.lng),
    specific_location: simpleDevice.location,
    last_check_date: simpleDevice.lastCheck,
    priority: simpleDevice.priority,
    external_display_allowed: simpleDevice.externalDisplay,
    external_no_display_reason: simpleDevice.externalNoDisplayReason,
    saol_deleted: simpleDevice.saolDeleted,
    climate_characteristics: simpleDevice.특성,
    special_considerations: simpleDevice.관심사항,
    is_active: true,
    data_source: 'manual' as const
  };
};