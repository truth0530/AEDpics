/**
 * Production-ready AED Data Types
 * 실제 서비스를 위한 완전한 AED 데이터 타입 정의
 *
 * Supabase aed_data 테이블의 44개 컬럼 완전 매핑
 * 81,331개 AED 장비 관리를 위한 확장 가능한 타입 시스템
 */

import { RealAEDData } from './RealAEDTypes';

/**
 * 점검 기록 인터페이스
 */
export interface InspectionRecord {
  id: string;
  deviceId: string;
  inspectorId: string;
  inspectionDate: Date;

  // 점검 항목
  batteryStatus: 'normal' | 'replace' | 'missing';
  batteryExpiry: string;
  batteryVoltage?: number;

  padStatus: 'normal' | 'replace' | 'missing';
  padAdultExpiry: string;
  padChildExpiry?: string;

  deviceStatus: 'operational' | 'malfunction' | 'maintenance';
  selfDiagnosticResult?: string;

  // 위치 정보
  locationVerified: boolean;
  gpsCoordinates?: { lat: number; lng: number };
  locationNotes?: string;

  // 접근성
  operatingHours: OperatingSchedule[];
  is24Hours: boolean;
  accessibilityNotes?: string;

  // 보관함 정보
  hasStorageCabinet: boolean;
  cabinetStatus?: 'normal' | 'damaged' | 'locked';
  theftAlarmStatus?: 'normal' | 'malfunction' | 'none';

  // 사진 증빙
  photos?: {
    device?: string; // Base64 or URL
    battery?: string;
    pad?: string;
    location?: string;
    cabinet?: string;
  };

  // 조치사항
  issuesFound: string[];
  actionsTaken: string[];
  followUpRequired: boolean;
  followUpNotes?: string;

  // 메타데이터
  createdAt: Date;
  updatedAt: Date;
  syncStatus: 'synced' | 'pending' | 'error';
  offlineData?: boolean;
}

/**
 * 운영 시간표 인터페이스
 */
export interface OperatingSchedule {
  day: '월' | '화' | '수' | '목' | '금' | '토' | '일' | '공휴일';
  start: string; // HH:MM
  end: string;   // HH:MM
  closed?: boolean;
}

/**
 * Production AED Data - RealAEDData 확장
 */
export interface ProductionAEDData extends RealAEDData {
  // 점검 관련 추가 필드
  inspectionHistory?: InspectionRecord[];
  lastInspection?: InspectionRecord;
  nextInspectionDue?: Date;

  // 우선순위 및 위험도
  priorityScore?: number; // 0-100
  riskLevel?: 'critical' | 'high' | 'medium' | 'low';
  priorityFactors?: {
    batteryRisk: number;
    padRisk: number;
    locationRisk: number;
    usageFrequency: number;
    maintenanceHistory: number;
  };

  // 실시간 상태
  realTimeStatus?: {
    online: boolean;
    lastHeartbeat?: Date;
    batteryLevel?: number; // 0-100%
    errorCodes?: string[];
    temperature?: number;
    humidity?: number;
  };

  // 관리 조직 정보
  managementOrg?: {
    id: string;
    name: string;
    type: 'health_center' | 'hospital' | 'public' | 'private';
    contact: string;
    address: string;
  };

  // 담당자 정보
  assignedInspector?: {
    id: string;
    name: string;
    email: string;
    phone: string;
    organization: string;
  };

  // 통계 정보
  statistics?: {
    totalInspections: number;
    avgInspectionInterval: number; // days
    issueRate: number; // percentage
    avgResponseTime: number; // hours
    utilizationRate?: number; // 사용 빈도
  };
}

/**
 * 점검 세션 상태 관리
 */
export interface InspectionSession {
  sessionId: string;
  deviceId: string;
  inspectorId: string;
  startTime: Date;
  endTime?: Date;

  // 진행 상태
  currentStep: number;
  totalSteps: number;
  completedItems: Set<string>;
  skippedItems: Set<string>;

  // 변경사항 추적
  changes: {
    field: string;
    oldValue: unknown;
    newValue: unknown;
    timestamp: Date;
  }[];

  // 임시 저장
  autoSaveEnabled: boolean;
  lastAutoSave?: Date;
  draftData: Partial<InspectionRecord>;

  // 검증 상태
  validationErrors: Record<string, string>;
  warnings: Record<string, string>;

  // 오프라인 지원
  offlineMode: boolean;
  syncQueue: Array<{ type: string; data: unknown; timestamp: Date }>;
  conflictResolution?: 'local' | 'server' | 'manual';
}

/**
 * 대용량 데이터 처리를 위한 페이지네이션
 */
export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy: keyof ProductionAEDData;
  sortOrder: 'asc' | 'desc';
  filters?: Partial<FilterParams>;
}

/**
 * 필터링 파라미터
 */
export interface FilterParams {
  sido?: string;
  gugun?: string;
  category1?: string;
  category2?: string;
  category3?: string;

  priorityLevel?: 'urgent' | 'warning' | 'normal';
  batteryExpiryDays?: number;
  padExpiryDays?: number;
  lastInspectionDays?: number;

  manufacturer?: string;
  modelName?: string;

  hasStorageCabinet?: boolean;
  is24Hours?: boolean;
  externalDisplay?: boolean;

  searchText?: string;
}

/**
 * 데이터 검증 규칙
 */
export interface ValidationRule {
  field: string;
  type: 'required' | 'date' | 'number' | 'pattern' | 'custom';
  message: string;
  validate?: (value: unknown, data: unknown) => boolean;
  params?: unknown;
}

/**
 * 데이터 검증 결과
 */
export interface ValidationResult {
  valid: boolean;
  errors: {
    field: string;
    message: string;
    severity: 'error' | 'warning' | 'info';
  }[];
}

/**
 * 배치 작업 인터페이스
 */
export interface BatchOperation {
  type: 'update' | 'delete' | 'export';
  deviceIds: string[];
  updates?: Partial<ProductionAEDData>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  results?: {
    success: string[];
    failed: string[];
    errors: Record<string, string>;
  };
}

/**
 * 데이터 변환 유틸리티
 */
export class AEDDataTransformer {
  /**
   * RealAEDData를 ProductionAEDData로 변환
   */
  static toProduction(real: RealAEDData): ProductionAEDData {
    const production: ProductionAEDData = {
      ...real,
      priorityScore: this.calculatePriorityScore(real),
      riskLevel: this.determineRiskLevel(real),
    };

    return production;
  }

  /**
   * 우선순위 점수 계산 (0-100)
   */
  private static calculatePriorityScore(aed: RealAEDData): number {
    const today = new Date();
    const batteryExpiry = new Date(aed.battery_expiry_date);
    const padExpiry = new Date(aed.patch_expiry_date);
    const lastInspection = new Date(aed.last_inspection_date);

    const batteryDays = Math.ceil((batteryExpiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const padDays = Math.ceil((padExpiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const inspectionDays = Math.ceil((today.getTime() - lastInspection.getTime()) / (1000 * 60 * 60 * 24));

    let score = 0;

    // 배터리 점수 (40%)
    if (batteryDays <= 0) score += 40;
    else if (batteryDays <= 30) score += 30;
    else if (batteryDays <= 90) score += 20;
    else if (batteryDays <= 180) score += 10;

    // 패드 점수 (40%)
    if (padDays <= 0) score += 40;
    else if (padDays <= 30) score += 30;
    else if (padDays <= 90) score += 20;
    else if (padDays <= 180) score += 10;

    // 점검 주기 점수 (20%)
    if (inspectionDays > 180) score += 20;
    else if (inspectionDays > 90) score += 15;
    else if (inspectionDays > 60) score += 10;
    else if (inspectionDays > 30) score += 5;

    return Math.min(100, score);
  }

  /**
   * 위험도 레벨 결정
   */
  private static determineRiskLevel(aed: RealAEDData): 'critical' | 'high' | 'medium' | 'low' {
    const score = this.calculatePriorityScore(aed);

    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }
}

/**
 * 데이터 검증 유틸리티
 */
export class AEDDataValidator {
  /**
   * 배터리 유효기간 검증
   */
  static validateBatteryExpiry(date: string): ValidationResult {
    const inputDate = new Date(date);
    const today = new Date();
    const maxFutureDate = new Date();
    maxFutureDate.setFullYear(today.getFullYear() + 5);

    const errors: ValidationResult['errors'] = [];

    if (isNaN(inputDate.getTime())) {
      errors.push({
        field: 'battery_expiry_date',
        message: '유효한 날짜 형식이 아닙니다',
        severity: 'error'
      });
    } else if (inputDate < today) {
      errors.push({
        field: 'battery_expiry_date',
        message: '과거 날짜는 입력할 수 없습니다',
        severity: 'error'
      });
    } else if (inputDate > maxFutureDate) {
      errors.push({
        field: 'battery_expiry_date',
        message: '5년을 초과하는 미래 날짜입니다',
        severity: 'warning'
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 전체 점검 데이터 검증
   */
  static validateInspection(data: Partial<InspectionRecord>): ValidationResult {
    const errors: ValidationResult['errors'] = [];

    // 필수 필드 검증
    if (!data.batteryStatus) {
      errors.push({
        field: 'batteryStatus',
        message: '배터리 상태를 선택해주세요',
        severity: 'error'
      });
    }

    if (!data.padStatus) {
      errors.push({
        field: 'padStatus',
        message: '패드 상태를 선택해주세요',
        severity: 'error'
      });
    }

    // 날짜 검증
    if (data.batteryExpiry) {
      const batteryValidation = this.validateBatteryExpiry(data.batteryExpiry);
      errors.push(...batteryValidation.errors);
    }

    // 위치 검증
    if (data.locationVerified && !data.gpsCoordinates) {
      errors.push({
        field: 'gpsCoordinates',
        message: '위치 확인 시 GPS 좌표가 필요합니다',
        severity: 'warning'
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

/**
 * 검색 및 필터링 유틸리티
 */
export class AEDSearchService {
  /**
   * 텍스트 검색
   */
  static searchDevices(
    devices: ProductionAEDData[],
    searchText: string
  ): ProductionAEDData[] {
    const lowerSearch = searchText.toLowerCase();

    return devices.filter(device =>
      device.management_number?.toLowerCase().includes(lowerSearch) ||
      device.installation_institution?.toLowerCase().includes(lowerSearch) ||
      device.installation_address?.toLowerCase().includes(lowerSearch) ||
      device.model_name?.toLowerCase().includes(lowerSearch) ||
      device.manufacturer?.toLowerCase().includes(lowerSearch)
    );
  }

  /**
   * 고급 필터링
   */
  static filterDevices(
    devices: ProductionAEDData[],
    filters: FilterParams
  ): ProductionAEDData[] {
    let filtered = [...devices];

    if (filters.sido) {
      filtered = filtered.filter(d => d.sido === filters.sido);
    }

    if (filters.gugun) {
      filtered = filtered.filter(d => d.gugun === filters.gugun);
    }

    if (filters.priorityLevel) {
      filtered = filtered.filter(d => {
        const score = d.priorityScore || 0;
        switch (filters.priorityLevel) {
          case 'urgent': return score >= 80;
          case 'warning': return score >= 50 && score < 80;
          case 'normal': return score < 50;
          default: return true;
        }
      });
    }

    if (filters.batteryExpiryDays !== undefined) {
      filtered = filtered.filter(d => {
        const today = new Date();
        const expiry = new Date(d.battery_expiry_date);
        const days = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return days <= filters.batteryExpiryDays!;
      });
    }

    return filtered;
  }

  /**
   * 정렬
   */
  static sortDevices(
    devices: ProductionAEDData[],
    sortBy: keyof ProductionAEDData,
    order: 'asc' | 'desc' = 'asc'
  ): ProductionAEDData[] {
    return [...devices].sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];

      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;

      if (aVal < bVal) return order === 'asc' ? -1 : 1;
      if (aVal > bVal) return order === 'asc' ? 1 : -1;
      return 0;
    });
  }
}

export default ProductionAEDData;