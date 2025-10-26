// 데이터 검증 서비스 - 실제 데이터 기반 검증
'use client';

import { getSupabaseClient } from './supabaseClient';
import { RealAEDData } from '../types/RealAEDTypes';

export interface DataValidationIssue {
  type: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  field?: string;
  value?: unknown;
  relatedData?: unknown;
}

export interface ValidationReport {
  deviceId: string;
  managementNumber: string;
  institution: string;
  issues: DataValidationIssue[];
  totalIssues: number;
  criticalIssues: number;
  warningIssues: number;
}

export class ValidationService {
  private static instance: ValidationService;
  private supabase = getSupabaseClient();

  private constructor() {}

  static getInstance(): ValidationService {
    if (!ValidationService.instance) {
      ValidationService.instance = new ValidationService();
    }
    return ValidationService.instance;
  }

  /**
   * 단일 AED 장치에 대한 종합 검증
   */
  async validateDevice(device: RealAEDData): Promise<ValidationReport> {
    const issues: DataValidationIssue[] = [];

    // 1. 제조번호 중복 검사
    const duplicateSerialIssues = await this.checkDuplicateSerialNumber(device);
    issues.push(...duplicateSerialIssues);

    // 2. 날짜 논리 검사
    const dateLogicIssues = this.checkDateLogic(device);
    issues.push(...dateLogicIssues);

    // 3. GPS 좌표 유효성 검사
    const gpsIssues = this.checkGPSCoordinates(device);
    issues.push(...gpsIssues);

    // 4. 필수 필드 누락 검사
    const missingFieldIssues = this.checkMissingFields(device);
    issues.push(...missingFieldIssues);

    // 5. 운영 상태 일관성 검사
    const statusIssues = this.checkOperationStatusConsistency(device);
    issues.push(...statusIssues);

    // 6. 유효기간 만료 검사
    const expiryIssues = this.checkExpiryDates(device);
    issues.push(...expiryIssues);

    // 7. 최근 점검일 분석 (점검 주기는 알 수 없음)
    const inspectionIssues = this.checkLastInspectionDate(device);
    issues.push(...inspectionIssues);

    // 8. 카테고리 분류 검사
    const categoryIssues = this.checkCategoryConsistency(device);
    issues.push(...categoryIssues);

    // 9. 연락처 형식 검사
    const contactIssues = this.checkContactFormat(device);
    issues.push(...contactIssues);

    // 10. 제조사/모델 일관성 검사
    const manufacturerIssues = this.checkManufacturerModelConsistency(device);
    issues.push(...manufacturerIssues);

    // 11. 주소 불일치 검사
    const addressIssues = this.checkAddressConsistency(device);
    issues.push(...addressIssues);

    // 12. 폐기 상태 불일치 검사
    const disposalIssues = this.checkDisposalStatusConsistency(device);
    issues.push(...disposalIssues);

    return {
      deviceId: String(device.id),
      managementNumber: device.management_number,
      institution: device.installation_institution,
      issues: issues,
      totalIssues: issues.length,
      criticalIssues: issues.filter(i => i.type === 'error').length,
      warningIssues: issues.filter(i => i.type === 'warning').length
    };
  }

  /**
   * 1. 제조번호 중복 검사
   */
  private async checkDuplicateSerialNumber(device: RealAEDData): Promise<DataValidationIssue[]> {
    const issues: DataValidationIssue[] = [];

    if (!device.serial_number || device.serial_number.trim() === '') {
      issues.push({
        type: 'warning',
        category: '제조번호',
        message: '제조번호가 입력되지 않았습니다',
        field: 'serial_number'
      });
      return issues;
    }

    try {
      const { data, error } = await this.supabase
        .from('aed_data')
        .select('id, management_number, installation_institution')
        .eq('serial_number', device.serial_number)
        .neq('id', device.id);

      if (!error && data && data.length > 0) {
        issues.push({
          type: 'warning',
          category: '데이터 중복',
          message: `제조번호 ${device.serial_number}이(가) ${data.length}개의 다른 장치와 중복됩니다`,
          field: 'serial_number',
          value: device.serial_number,
          relatedData: data.map(d => ({
            managementNumber: d.management_number,
            institution: d.installation_institution
          }))
        });
      }
    } catch (error) {
      console.error('제조번호 중복 검사 오류:', error);
    }

    return issues;
  }

  /**
   * 2. 날짜 논리 검사
   */
  private checkDateLogic(device: RealAEDData): DataValidationIssue[] {
    const issues: DataValidationIssue[] = [];

    // 제조일 > 설치일 검사
    if (device.manufacturing_date && device.installation_date) {
      const mfgDate = new Date(device.manufacturing_date);
      const installDate = new Date(device.installation_date);

      if (mfgDate > installDate) {
        issues.push({
          type: 'error',
          category: '날짜 논리 오류',
          message: `제조일(${device.manufacturing_date})이 설치일(${device.installation_date})보다 늦습니다`,
          field: 'manufacturing_date',
          value: device.manufacturing_date
        });
      }
    }

    // 최초설치일 > 현재설치일 검사
    if (device.first_installation_date && device.installation_date) {
      const firstDate = new Date(device.first_installation_date);
      const currentDate = new Date(device.installation_date);

      if (firstDate > currentDate) {
        issues.push({
          type: 'error',
          category: '날짜 논리 오류',
          message: `최초설치일(${device.first_installation_date})이 현재설치일(${device.installation_date})보다 늦습니다`,
          field: 'first_installation_date'
        });
      }
    }

    // 미래 날짜 검사
    const today = new Date();
    if (device.manufacturing_date && new Date(device.manufacturing_date) > today) {
      issues.push({
        type: 'error',
        category: '날짜 오류',
        message: '제조일이 미래 날짜입니다',
        field: 'manufacturing_date',
        value: device.manufacturing_date
      });
    }

    return issues;
  }

  /**
   * 3. GPS 좌표 유효성 검사
   */
  private checkGPSCoordinates(device: RealAEDData): DataValidationIssue[] {
    const issues: DataValidationIssue[] = [];

    // 한국의 GPS 범위
    const KOREA_BOUNDS = {
      lat: { min: 33.0, max: 39.0 },
      lng: { min: 124.0, max: 132.0 }
    };

    if (!device.latitude || !device.longitude) {
      issues.push({
        type: 'warning',
        category: 'GPS 좌표',
        message: 'GPS 좌표가 입력되지 않았습니다',
        field: 'coordinates'
      });
    } else {
      // 0,0 좌표 검사
      if (device.latitude === 0 && device.longitude === 0) {
        issues.push({
          type: 'error',
          category: 'GPS 좌표',
          message: 'GPS 좌표가 (0, 0)으로 설정되어 있습니다',
          field: 'coordinates'
        });
      }
      // 범위 검사
      else if (
        device.latitude < KOREA_BOUNDS.lat.min ||
        device.latitude > KOREA_BOUNDS.lat.max ||
        device.longitude < KOREA_BOUNDS.lng.min ||
        device.longitude > KOREA_BOUNDS.lng.max
      ) {
        issues.push({
          type: 'error',
          category: 'GPS 좌표',
          message: `GPS 좌표가 한국 범위를 벗어났습니다 (위도: ${device.latitude}, 경도: ${device.longitude})`,
          field: 'coordinates',
          value: { lat: device.latitude, lng: device.longitude }
        });
      }
    }

    return issues;
  }

  /**
   * 4. 필수 필드 누락 검사
   */
  private checkMissingFields(device: RealAEDData): DataValidationIssue[] {
    const issues: DataValidationIssue[] = [];

    const requiredFields = [
      { field: 'management_number', name: '관리번호' },
      { field: 'installation_institution', name: '설치기관' },
      { field: 'installation_position', name: '설치위치' },
      { field: 'model_name', name: '모델명' },
      { field: 'manufacturer', name: '제조사' },
      { field: 'battery_expiry_date', name: '배터리 유효기간' },
      { field: 'patch_expiry_date', name: '패드 유효기간' },
      { field: 'installation_date', name: '설치일자' }
    ];

    requiredFields.forEach(({ field, name }) => {
      if (!device[field as keyof RealAEDData] ||
          String(device[field as keyof RealAEDData]).trim() === '') {
        issues.push({
          type: 'warning',
          category: '필수 정보 누락',
          message: `${name}이 입력되지 않았습니다`,
          field: field
        });
      }
    });

    return issues;
  }

  /**
   * 5. 운영 상태 일관성 검사
   */
  private checkOperationStatusConsistency(device: RealAEDData): DataValidationIssue[] {
    const issues: DataValidationIssue[] = [];

    // 운영 상태가 '운영'인데 외부 미표출인 경우
    if (device.operation_status === '운영' && device.external_display === 'N') {
      if (!device.external_non_display_reason || device.external_non_display_reason.trim() === '') {
        issues.push({
          type: 'warning',
          category: '운영 상태',
          message: '운영 중인 장비가 외부 미표출로 설정되어 있으나 사유가 없습니다',
          field: 'external_non_display_reason'
        });
      }
    }

    return issues;
  }

  /**
   * 6. 유효기간 만료 검사
   */
  private checkExpiryDates(device: RealAEDData): DataValidationIssue[] {
    const issues: DataValidationIssue[] = [];
    const today = new Date();

    // 배터리 유효기간
    if (device.battery_expiry_date) {
      const batteryExpiry = new Date(device.battery_expiry_date);
      const batteryDays = Math.ceil((batteryExpiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (batteryDays < 0) {
        issues.push({
          type: 'error',
          category: '유효기간 만료',
          message: `배터리가 ${Math.abs(batteryDays)}일 전에 만료되었습니다`,
          field: 'battery_expiry_date',
          value: device.battery_expiry_date
        });
      } else if (batteryDays <= 30) {
        issues.push({
          type: 'warning',
          category: '유효기간 임박',
          message: `배터리가 ${batteryDays}일 후 만료됩니다`,
          field: 'battery_expiry_date',
          value: device.battery_expiry_date
        });
      }
    }

    // 패드 유효기간
    if (device.patch_expiry_date) {
      const patchExpiry = new Date(device.patch_expiry_date);
      const patchDays = Math.ceil((patchExpiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (patchDays < 0) {
        issues.push({
          type: 'error',
          category: '유효기간 만료',
          message: `패드가 ${Math.abs(patchDays)}일 전에 만료되었습니다`,
          field: 'patch_expiry_date',
          value: device.patch_expiry_date
        });
      } else if (patchDays <= 30) {
        issues.push({
          type: 'warning',
          category: '유효기간 임박',
          message: `패드가 ${patchDays}일 후 만료됩니다`,
          field: 'patch_expiry_date',
          value: device.patch_expiry_date
        });
      }
    }

    return issues;
  }

  /**
   * 7. 최근 점검일 분석 (점검 주기는 알 수 없음)
   */
  private checkLastInspectionDate(device: RealAEDData): DataValidationIssue[] {
    const issues: DataValidationIssue[] = [];
    const today = new Date();

    if (device.last_inspection_date) {
      const lastInspection = new Date(device.last_inspection_date);
      const daysSince = Math.ceil((today.getTime() - lastInspection.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSince > 180) {
        issues.push({
          type: 'warning',
          category: '점검 필요',
          message: `마지막 점검이 ${daysSince}일 전입니다 (6개월 초과)`,
          field: 'last_inspection_date',
          value: device.last_inspection_date,
          relatedData: {
            note: '정기 점검 여부는 점검 이력을 통해서만 확인 가능'
          }
        });
      } else if (daysSince > 90) {
        issues.push({
          type: 'info',
          category: '점검 일정',
          message: `마지막 점검이 ${daysSince}일 전입니다 (3개월 초과)`,
          field: 'last_inspection_date',
          value: device.last_inspection_date
        });
      }
    } else {
      issues.push({
        type: 'warning',
        category: '점검 이력',
        message: '점검 이력이 없습니다',
        field: 'last_inspection_date'
      });
    }

    return issues;
  }

  /**
   * 8. 카테고리 분류 일관성 검사
   */
  private checkCategoryConsistency(device: RealAEDData): DataValidationIssue[] {
    const issues: DataValidationIssue[] = [];

    // 구비의무기관 카테고리 검증 (실제 법적 의무 대상)
    const mandatoryTypes = [
      // 응급의료법 시행규칙 제38조의2
      '의료기관', '500세대 이상 공동주택', '철도역사', '여객터미널',
      '공항', '선박', '체육시설', '목욕장업', '숙박업소',
      // 학교보건법
      '학교', '어린이집', '유치원'
    ];

    // 구비의무기관 vs 구비의무기관 외 분류 검증
    if (device.category_1 === '구비의무기관') {
      // category_2가 실제 의무 대상인지 확인
      const isMandatory = mandatoryTypes.some(type =>
        device.category_2?.includes(type)
      );

      if (!isMandatory && device.category_2) {
        issues.push({
          type: 'info',
          category: '카테고리 분류',
          message: `'${device.category_2}'이(가) 구비의무기관으로 분류되어 있으나 법적 의무 대상이 아닐 수 있습니다`,
          field: 'category_1',
          value: device.category_2
        });
      }
    } else if (device.category_1 === '구비의무기관 외') {
      // 실제로는 의무기관인데 '구비의무기관 외'로 분류된 경우
      const shouldBeMandatory = mandatoryTypes.some(type =>
        device.category_2?.includes(type) ||
        device.installation_institution?.includes(type)
      );

      if (shouldBeMandatory) {
        issues.push({
          type: 'warning',
          category: '카테고리 분류',
          message: `법적 의무 대상 시설이 '구비의무기관 외'로 분류되어 있습니다`,
          field: 'category_1',
          relatedData: {
            category_2: device.category_2,
            institution: device.installation_institution
          }
        });
      }
    }

    // e-gen 데이터는 모두 카테고리가 있으므로 누락 검사는 제거
    // 실제 데이터에서는 category_1, category_2, category_3이 모두 입력되어 있음

    return issues;
  }

  /**
   * 9. 연락처 형식 검사
   */
  private checkContactFormat(device: RealAEDData): DataValidationIssue[] {
    const issues: DataValidationIssue[] = [];

    if (device.institution_contact) {
      // 전화번호 형식 검사
      const phoneRegex = /^(\d{2,3}-\d{3,4}-\d{4}|\d{9,11})$/;
      const cleanedPhone = device.institution_contact.replace(/[^\d-]/g, '');

      if (!phoneRegex.test(cleanedPhone)) {
        issues.push({
          type: 'warning',
          category: '연락처',
          message: `연락처 형식이 올바르지 않습니다: "${device.institution_contact}"`,
          field: 'institution_contact',
          value: device.institution_contact
        });
      }
    }

    return issues;
  }

  /**
   * 10. 제조사/모델 일관성 검사
   */
  private checkManufacturerModelConsistency(device: RealAEDData): DataValidationIssue[] {
    const issues: DataValidationIssue[] = [];

    // 알려진 제조사-모델 매핑 (실제 데이터 기반)
    const knownMappings: { [key: string]: string[] } = {
      '씨유메디칼': ['CU-SP1', 'CU-SP1 Plus', 'i-PAD CU-SP1', 'i-PAD NF1200'],
      '나눔테크': ['NT-381.C', 'ReHeart NT-381.C'],
      '라디안': ['HR-501', 'HR-501-B', 'HR-502', 'HR-503'],
      '필립스': ['HeartStart HS1', 'HeartStart FRx', 'HeartStart OnSite'],
      '메디아나': ['HeartSaver-A', 'Heart Saver-A', 'HeartOn A15', 'HeartOn A10'],
      '자일': ['CardioLife AED-3100', 'AED-2100K'],
      '프로젝트메드': ['HeartPlus NT-280', 'NT-180']
    };

    // 제조사명 정규화
    const normalizedManufacturer = device.manufacturer
      ?.replace(/\(주\)/g, '')
      ?.replace(/주식회사/g, '')
      ?.trim();

    // 매핑 확인
    Object.entries(knownMappings).forEach(([manufacturer, models]) => {
      if (normalizedManufacturer?.includes(manufacturer)) {
        const modelMatched = models.some(model =>
          device.model_name?.includes(model)
        );

        if (!modelMatched && device.model_name) {
          issues.push({
            type: 'info',
            category: '제조사-모델',
            message: `제조사 "${device.manufacturer}"의 알려지지 않은 모델: "${device.model_name}"`,
            field: 'model_name',
            value: device.model_name
          });
        }
      }
    });

    return issues;
  }

  /**
   * 11. 주소 불일치 검사
   */
  private checkAddressConsistency(device: RealAEDData): DataValidationIssue[] {
    const issues: DataValidationIssue[] = [];

    // 설치기관 주소와 설치장소 주소 비교
    if (device.installation_address && device.installation_location_address) {
      // 시/도가 다른 경우
      const institutionProvince = this.extractProvince(device.installation_address);
      const positionProvince = this.extractProvince(device.installation_location_address);

      if (institutionProvince && positionProvince && institutionProvince !== positionProvince) {
        issues.push({
          type: 'warning',
          category: '주소 정보',
          message: `설치기관과 설치장소의 시/도가 다릅니다 (${institutionProvince} ≠ ${positionProvince})`,
          field: 'address',
          relatedData: {
            institutionAddress: device.installation_address,
            positionAddress: device.installation_location_address
          }
        });
      }
    }

    // 설치위치 주소가 비어있는 경우
    if (!device.installation_location_address || device.installation_location_address.trim() === '') {
      issues.push({
        type: 'warning',
        category: '주소 정보',
        message: '설치장소 주소가 입력되지 않았습니다',
        field: 'installation_location_address'
      });
    }

    // 시도와 주소 불일치
    if (device.sido && device.installation_address) {
      const addressProvince = this.extractProvince(device.installation_address);
      if (addressProvince && !addressProvince.includes(device.sido) && !device.sido.includes(addressProvince)) {
        issues.push({
          type: 'warning',
          category: '주소 정보',
          message: `시/도 정보와 주소가 일치하지 않습니다 (${device.sido} ≠ ${addressProvince})`,
          field: 'sido'
        });
      }
    }

    return issues;
  }

  /**
   * 12. 폐기 상태 불일치 검사
   */
  private checkDisposalStatusConsistency(device: RealAEDData): DataValidationIssue[] {
    const issues: DataValidationIssue[] = [];

    // 운영 상태가 '폐기'인데 외부 표출이 활성화된 경우
    if (device.operation_status === '폐기' && device.external_display === 'Y') {
      issues.push({
        type: 'error',
        category: '상태 불일치',
        message: '폐기된 장비가 외부 표출 활성화되어 있습니다',
        field: 'operation_status',
        relatedData: {
          operation_status: device.operation_status,
          external_display: device.external_display
        }
      });
    }

    // 운영 상태가 '중지'인데 미표출 사유가 없는 경우
    if (device.operation_status === '중지' && device.external_display === 'N' &&
        (!device.external_non_display_reason || device.external_non_display_reason.trim() === '')) {
      issues.push({
        type: 'warning',
        category: '상태 불일치',
        message: '운영 중지 상태이나 미표출 사유가 입력되지 않았습니다',
        field: 'external_non_display_reason'
      });
    }

    return issues;
  }

  /**
   * 주소에서 시/도 추출 헬퍼 메서드
   */
  private extractProvince(address: string): string | null {
    const provinces = [
      '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
      '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'
    ];

    for (const province of provinces) {
      if (address.includes(province)) {
        return province;
      }
    }

    return null;
  }

  /**
   * 여러 장치에 대한 일괄 검증
   */
  async validateMultipleDevices(devices: RealAEDData[]): Promise<ValidationReport[]> {
    const reports: ValidationReport[] = [];

    for (const device of devices) {
      const report = await this.validateDevice(device);
      reports.push(report);
    }

    return reports;
  }

  /**
   * 검증 보고서 요약
   */
  summarizeValidationReports(reports: ValidationReport[]): {
    totalDevices: number;
    totalIssues: number;
    criticalDevices: number;
    warningDevices: number;
    topIssueCategories: { category: string; count: number }[];
  } {
    const categoryCount: { [key: string]: number } = {};
    let totalIssues = 0;
    let criticalDevices = 0;
    let warningDevices = 0;

    reports.forEach(report => {
      totalIssues += report.totalIssues;
      if (report.criticalIssues > 0) criticalDevices++;
      if (report.warningIssues > 0) warningDevices++;

      report.issues.forEach(issue => {
        categoryCount[issue.category] = (categoryCount[issue.category] || 0) + 1;
      });
    });

    const topIssueCategories = Object.entries(categoryCount)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalDevices: reports.length,
      totalIssues,
      criticalDevices,
      warningDevices,
      topIssueCategories
    };
  }
}

// 전역 인스턴스
export const validationService = ValidationService.getInstance();