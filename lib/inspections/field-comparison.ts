import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface FieldComparison {
  field_name: string;
  field_category: 'battery' | 'pad' | 'manager' | 'installation' | 'device';
  inspection_value: string | null;
  aed_data_value: string | null;
  status_at_inspection: 'good' | 'problematic';
  issue_severity?: 'critical' | 'major' | 'minor';
}

/**
 * 날짜를 YYYY-MM-DD 형식 문자열로 변환
 */
function formatDate(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
  } catch {
    return null;
  }
}

/**
 * 두 값을 정규화하여 비교
 */
function normalizeValue(value: any): string | null {
  if (value === null || value === undefined || value === '') return null;

  // 날짜 형식 감지 및 정규화
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return formatDate(value);
  }

  // 공백 제거 및 소문자 변환
  return String(value).trim();
}

/**
 * 두 값이 같은지 비교
 */
function isEqual(value1: any, value2: any): boolean {
  const norm1 = normalizeValue(value1);
  const norm2 = normalizeValue(value2);

  // 둘 다 null이면 같음
  if (norm1 === null && norm2 === null) return true;

  // 하나만 null이면 다름
  if (norm1 === null || norm2 === null) return false;

  return norm1 === norm2;
}

/**
 * 심각도 결정
 */
function determineSeverity(
  fieldName: string,
  inspectionValue: string | null,
  aedDataValue: string | null
): 'critical' | 'major' | 'minor' {
  // 배터리/패드 만료일은 critical
  if (fieldName.includes('expiry_date') || fieldName.includes('유효기한')) {
    return 'critical';
  }

  // 관리자, 연락처는 major
  if (fieldName.includes('manager') || fieldName.includes('contact') || fieldName.includes('관리자')) {
    return 'major';
  }

  // 나머지는 minor
  return 'minor';
}

/**
 * 점검 완료 시 필드별 비교 분석
 */
export async function analyzeInspectionFields(
  inspectionId: string,
  equipmentSerial: string,
  inspectedData: any
): Promise<void> {
  try {
    // aed_data 조회
    const aedData = await prisma.aed_data.findUnique({
      where: { equipment_serial: equipmentSerial },
    });

    if (!aedData) {
      logger.warn('FieldComparison', `장비 ${equipmentSerial} 데이터를 찾을 수 없음`);
      return;
    }

    const comparisons: Omit<FieldComparison, 'status_at_inspection' | 'issue_severity'>[] = [];
    const inspectionTime = new Date();

    // BasicInfo에서 비교할 필드들
    const basicInfo = inspectedData.basicInfo || {};

    // 관리자
    if (basicInfo.manager !== undefined) {
      comparisons.push({
        field_name: 'manager',
        field_category: 'manager',
        inspection_value: normalizeValue(basicInfo.manager),
        aed_data_value: normalizeValue(aedData.manager),
      });
    }

    // 설치기관
    if (basicInfo.installation_institution !== undefined) {
      comparisons.push({
        field_name: 'installation_institution',
        field_category: 'installation',
        inspection_value: normalizeValue(basicInfo.installation_institution),
        aed_data_value: normalizeValue(aedData.installation_institution),
      });
    }

    // 설치주소
    if (basicInfo.address !== undefined) {
      comparisons.push({
        field_name: 'installation_address',
        field_category: 'installation',
        inspection_value: normalizeValue(basicInfo.address),
        aed_data_value: normalizeValue(aedData.installation_address),
      });
    }

    // 연락처
    if (basicInfo.contact !== undefined) {
      comparisons.push({
        field_name: 'institution_contact',
        field_category: 'manager',
        inspection_value: normalizeValue(basicInfo.contact),
        aed_data_value: normalizeValue(aedData.institution_contact),
      });
    }

    // 외부표출
    if (basicInfo.external_display !== undefined) {
      comparisons.push({
        field_name: 'external_display',
        field_category: 'basic_info',
        inspection_value: normalizeValue(basicInfo.external_display),
        aed_data_value: normalizeValue(aedData.external_display),
      });
    }

    // DeviceInfo에서 비교할 필드들
    const deviceInfo = inspectedData.deviceInfo || {};

    // 제조사
    if (deviceInfo.manufacturer !== undefined) {
      comparisons.push({
        field_name: 'manufacturer',
        field_category: 'device',
        inspection_value: normalizeValue(deviceInfo.manufacturer),
        aed_data_value: normalizeValue(aedData.manufacturer),
      });
    }

    // 모델명
    if (deviceInfo.model_name !== undefined) {
      comparisons.push({
        field_name: 'model_name',
        field_category: 'device',
        inspection_value: normalizeValue(deviceInfo.model_name),
        aed_data_value: normalizeValue(aedData.model_name),
      });
    }

    // 시리얼 번호
    if (deviceInfo.serial_number !== undefined) {
      comparisons.push({
        field_name: 'serial_number',
        field_category: 'device',
        inspection_value: normalizeValue(deviceInfo.serial_number),
        aed_data_value: normalizeValue(aedData.serial_number),
      });
    }

    // Supplies에서 비교할 필드들
    const supplies = inspectedData.supplies || {};

    // 배터리 만료일
    if (supplies.battery_expiry_date !== undefined) {
      comparisons.push({
        field_name: 'battery_expiry_date',
        field_category: 'battery',
        inspection_value: formatDate(supplies.battery_expiry_date),
        aed_data_value: formatDate(aedData.battery_expiry_date),
      });
    }

    // 패드 만료일
    if (supplies.pad_expiry_date !== undefined) {
      comparisons.push({
        field_name: 'pad_expiry_date',
        field_category: 'pad',
        inspection_value: formatDate(supplies.pad_expiry_date),
        aed_data_value: formatDate(aedData.patch_expiry_date), // Note: aed_data에서는 patch_expiry_date
      });
    }

    // 각 비교 항목에 대해 상태 및 심각도 결정 후 저장
    const records = comparisons.map(comp => {
      const isGood = isEqual(comp.inspection_value, comp.aed_data_value);

      return {
        inspection_id: inspectionId,
        equipment_serial: equipmentSerial,
        field_name: comp.field_name,
        field_category: comp.field_category,
        inspection_value: comp.inspection_value,
        aed_data_value: comp.aed_data_value,
        inspection_time: inspectionTime,
        status_at_inspection: isGood ? 'good' : 'problematic',
        issue_severity: isGood ? null : determineSeverity(comp.field_name, comp.inspection_value, comp.aed_data_value),
        current_aed_value: comp.aed_data_value, // 초기에는 현재값 = 점검시값
        improvement_status: null, // 아직 개선 여부 미확인
      };
    });

    // DB에 일괄 저장
    if (records.length > 0) {
      await prisma.inspection_field_comparisons.createMany({
        data: records,
      });

      const problematicCount = records.filter(r => r.status_at_inspection === 'problematic').length;
      const goodCount = records.filter(r => r.status_at_inspection === 'good').length;

      logger.info('FieldComparison', `점검 ${inspectionId}: 필드 비교 완료`, {
        equipmentSerial,
        totalFields: records.length,
        good: goodCount,
        problematic: problematicCount,
      });
    }

  } catch (error) {
    logger.error('FieldComparison', '필드 비교 분석 실패', error instanceof Error ? error : { error });
    // 에러가 발생해도 점검 완료는 진행되도록 throw하지 않음
  }
}

/**
 * 특정 장비의 개선 상태 확인 및 업데이트
 */
export async function checkImprovements(equipmentSerial: string): Promise<void> {
  try {
    // 현재 aed_data 조회
    const aedData = await prisma.aed_data.findUnique({
      where: { equipment_serial: equipmentSerial },
    });

    if (!aedData) {
      logger.warn('FieldComparison', `장비 ${equipmentSerial} 데이터를 찾을 수 없음`);
      return;
    }

    // 이 장비의 모든 문제 필드 조회 (아직 개선되지 않은 것만)
    const problematicFields = await prisma.inspection_field_comparisons.findMany({
      where: {
        equipment_serial: equipmentSerial,
        status_at_inspection: 'problematic',
        improvement_status: { in: [null, 'neglected'] }, // 개선된 것은 제외
      },
    });

    // 각 필드의 현재 상태 확인
    for (const field of problematicFields) {
      const currentValue = normalizeValue((aedData as any)[field.field_name]);
      const inspectionValue = normalizeValue(field.inspection_value);
      const isImproved = isEqual(currentValue, inspectionValue);

      const daysSince = Math.floor(
        (Date.now() - new Date(field.inspection_time).getTime()) / (1000 * 60 * 60 * 24)
      );

      await prisma.inspection_field_comparisons.update({
        where: { id: field.id },
        data: {
          current_aed_value: currentValue,
          improvement_status: isImproved ? 'improved' : 'neglected',
          improved_at: isImproved ? new Date() : null,
          last_checked_at: new Date(),
          days_since_inspection: daysSince,
        },
      });
    }

    logger.info('FieldComparison', `장비 ${equipmentSerial} 개선 상태 업데이트 완료`, {
      checkedFields: problematicFields.length,
    });

  } catch (error) {
    logger.error('FieldComparison', '개선 상태 확인 실패', error instanceof Error ? error : { error });
  }
}

/**
 * 전체 장비의 개선 상태 일괄 확인 (CRON 작업용)
 */
export async function checkAllImprovements(): Promise<{ checked: number; improved: number; neglected: number }> {
  try {
    // 개선 확인이 필요한 모든 문제 필드 조회
    const problematicFields = await prisma.inspection_field_comparisons.findMany({
      where: {
        status_at_inspection: 'problematic',
        improvement_status: { in: [null, 'neglected'] },
      },
      include: {
        aed_device: true,
      },
    });

    let improvedCount = 0;
    let neglectedCount = 0;

    for (const field of problematicFields) {
      const currentValue = normalizeValue((field.aed_device as any)[field.field_name]);
      const inspectionValue = normalizeValue(field.inspection_value);
      const isImproved = isEqual(currentValue, inspectionValue);

      const daysSince = Math.floor(
        (Date.now() - new Date(field.inspection_time).getTime()) / (1000 * 60 * 60 * 24)
      );

      await prisma.inspection_field_comparisons.update({
        where: { id: field.id },
        data: {
          current_aed_value: currentValue,
          improvement_status: isImproved ? 'improved' : 'neglected',
          improved_at: isImproved ? new Date() : null,
          last_checked_at: new Date(),
          days_since_inspection: daysSince,
        },
      });

      if (isImproved) {
        improvedCount++;
      } else {
        neglectedCount++;
      }
    }

    logger.info('FieldComparison', '전체 개선 상태 확인 완료', {
      totalChecked: problematicFields.length,
      improved: improvedCount,
      neglected: neglectedCount,
    });

    return {
      checked: problematicFields.length,
      improved: improvedCount,
      neglected: neglectedCount,
    };

  } catch (error) {
    logger.error('FieldComparison', '전체 개선 상태 확인 실패', error instanceof Error ? error : { error });
    throw error;
  }
}
