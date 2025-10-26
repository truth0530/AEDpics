/**
 * AED 장치 관련 타입 정의
 */

export interface AEDDevice {
  id: string;

  // 식별 정보
  management_number?: string;
  equipment_serial?: string;
  category_1?: string;
  category_2?: string;
  category_3?: string;
  serial_number?: string;

  // 기본 정보
  installation_institution?: string;
  installation_org?: string; // Alias for installation_institution
  installation_address?: string;
  address?: string; // Alias for installation_address
  installation_location_address?: string;
  installation_position?: string;
  jurisdiction_health_center?: string;
  manufacturer?: string;
  model_name?: string;
  installation_method?: string;
  purchase_institution?: string;
  manufacturing_country?: string;
  manufacturing_date?: string;
  device_serial?: string; // Alias for equipment_serial

  // 위치 정보
  region_code?: string;
  city_code?: string;
  sido?: string;
  gugun?: string;
  latitude?: number;
  longitude?: number;
  distance_km?: number; // 보건소로부터의 거리 (km)

  // 관할 정보
  health_center_id?: string;

  // 유효기간 정보
  expiry_date?: string;
  battery_expiry_date?: string;
  patch_expiry_date?: string;
  pad_expiry_date?: string;
  replacement_date?: string;

  // 계산된 필드 (클라이언트 또는 API에서 추가)
  days_until_battery_expiry?: number;
  days_until_patch_expiry?: number;
  days_until_pad_expiry?: number;
  days_until_replacement?: number;
  days_until_expiry?: number;

  // 상태 정보
  operation_status?: string;
  external_display?: string; // 'Y' | 'N'
  display_allowed?: string;
  external_non_display_reason?: string | null;
  patch_available?: string; // 'Y' | 'N'
  government_support?: string;

  // 연락처
  institution_contact?: string;
  manager?: string;
  establisher?: string;

  // 점검 정보
  last_inspection_date?: string;
  days_since_last_inspection?: number;
  installation_date?: string;
  first_installation_date?: string;
  last_use_date?: string;

  // 점검 상태 정보 (from API)
  inspection_status?: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'unavailable';

  // 점검불가 정보 (from assigned_aed_list view)
  assignment_status?: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'unavailable';
  unavailable_reason?: 'disposed' | 'broken' | 'other';
  unavailable_note?: string | null;
  unavailable_at?: string | null;

  // 추가 정보
  remarks?: string;
  report_date?: string;
  registration_date?: string;
  saeum_deletion_status?: string;
  data_status?: string;
  first_seen_date?: string;
  last_seen_date?: string;
  consecutive_missing_days?: number;
  deletion_suspected_date?: string;
  sync_batch_id?: string;

  // 메타데이터
  created_at?: string;
  updated_at?: string;
}

// AED 데이터 응답 타입
export interface AEDDataResponse {
  data: AEDDevice[];
  pagination: {
    page: number;
    limit: number;
    /**
     * 커서 기반 네비게이션의 단일 소스.
     * true일 때만 추가 페이지 요청을 시도해야 합니다.
     */
    hasMore: boolean;
    /**
     * 다음 페이지 요청 시 사용할 커서.
     * hasMore가 false이면 null을 반환합니다.
     */
    nextCursor: string | null;
    /**
     * @deprecated 오프셋 기반 UI를 위한 메타데이터입니다.
     * 커서 네비게이션에서는 참조하지 마세요.
     */
    total?: number;
    /**
     * @deprecated 오프셋 기반 UI를 위한 메타데이터입니다.
     * 커서 네비게이션에서는 참조하지 마세요.
     */
    currentPage?: number;
    /**
     * @deprecated 오프셋 기반 UI를 위한 메타데이터입니다.
     * 커서 네비게이션에서는 참조하지 마세요.
     */
    totalPages?: number;
    /**
     * @deprecated 오프셋 기반 UI를 위한 메타데이터입니다.
     * 커서 네비게이션에서는 참조하지 마세요.
     */
    from?: number;
    /**
     * @deprecated 오프셋 기반 UI를 위한 메타데이터입니다.
     * 커서 네비게이션에서는 참조하지 마세요.
     */
    to?: number;
  };
  summary: {
    totalCount: number;
    expiredCount: number;
    expiringSoonCount: number;
    hiddenCount: number;
    withSensitiveDataCount: number;
  };
  filters: {
    applied: {
      battery_expiry_date?: string;
      patch_expiry_date?: string;
      replacement_date?: string;
      last_inspection_date?: string;
      status?: string[];
      regions?: string[] | null;
      cities?: string[] | null;
      category_1?: string[] | null;
      category_2?: string[] | null;
      category_3?: string[] | null;
      external_display?: string;
      search?: string;
      queryCriteria?: 'address' | 'jurisdiction';
    };
    enforced?: {
      appliedDefaults: string[];
    };
    available: {
      canViewAllRegions: boolean;
      allowedRegions?: string[] | null;
      allowedCities?: string[] | null;
      maxLimit: number;
      canExportData: boolean;
      canViewSensitiveData: boolean;
      requiredFilters?: string[];
      requireOneOf?: string[];
    };
  };
}
