'use client';

import { useInspectionSessionStore } from '@/lib/state/inspection-session-store';
import { useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { captureAndShareReport, isReportSharingSupported } from '@/lib/utils/report-sharing';

interface SummaryItem {
  label: string;
  original?: string;
  corrected?: string;
}

interface PhotoDocumentation {
  photos?: string[];
  notes?: string;
  inspector_confirmed?: boolean;
  completed_time?: string;
  reference_docs?: string;
}

interface BasicInfoData {
  all_matched?: boolean | 'edited';
  manager?: string;
  contact_info?: string;
  external_display?: string;
  category_1?: string;
  category_2?: string;
  category_3?: string;
  edit_reason?: string;
  location_matched?: boolean;
  address?: string;
  gps_verified?: boolean;
  gps_latitude?: number;
  gps_longitude?: number;
  access_level?: string;
  available_hours?: string;
}

interface LocationInfoData {
  location_matched?: boolean;
  address?: string;
  gps_verified?: boolean;
  gps_latitude?: number;
  gps_longitude?: number;
}

interface DeviceInfoData {
  all_matched?: boolean | 'edited';
  manufacturer?: string;
  model_name?: string;
  serial_number?: string;
  production_date?: string;
  edit_reason?: string;
  supplies_matched?: boolean | 'edited';
  battery_expiry_date?: string;
  pad_expiry_date?: string;
  battery_action_plan?: string;
  pad_action_plan?: string;
  manufacturing_date?: string;
  manufacturing_date_action_plan?: string;
  operation_status?: string;
  serial_number_photo?: string;
  battery_mfg_date_photo?: string;
  device_mfg_date_photo?: string;
  // 수정사유 필드
  battery_modification_reason?: string;
  pad_expiry_date_modification_reason?: string;
  manufacturing_date_modification_reason?: string;
  // 기타사유 필드
  battery_action_custom_reason?: string;
  pad_expiry_date_action_custom_reason?: string;
  manufacturing_date_action_custom_reason?: string;
  // 조치기한
  action_deadline?: string;
}

interface StorageInfoData {
  all_matched?: boolean | 'edited';
  battery_expiry?: string;
  pad_expiry?: string;
  edit_reason?: string;
}

interface ManagerEducationData {
  education_status?: 'manager_education' | 'legal_mandatory_education' | 'not_completed' | 'other';
  not_completed_reason?: 'new_manager' | 'recent_installation' | 'other';
  not_completed_other_text?: string;
  education_other_text?: string;
  message_to_mohw?: string;
}

interface StepData {
  basicInfo?: BasicInfoData;
  locationInfo?: LocationInfoData;
  deviceInfo?: DeviceInfoData;
  storageInfo?: StorageInfoData;
  managerEducation?: ManagerEducationData;
  [key: string]: any;
}

export function InspectionSummaryStep() {
  const inspectionSession = useInspectionSessionStore((state) => state.session);
  const stepData = useInspectionSessionStore((state) => state.stepData) as StepData;
  const updateStepData = useInspectionSessionStore((state) => state.updateStepData);
  const { data: session } = useSession();
  const user = session?.user;

  const [isSharing, setIsSharing] = useState(false);

  const deviceInfo = (inspectionSession?.current_snapshot || inspectionSession?.device_info || {}) as Record<string, any>;

  const formatKSTTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).replace(/\. /g, '년 ').replace(/\. /g, '월 ').replace(/\./g, '일');
    } catch {
      return isoString;
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).replace(/\. /g, '.').replace(/\.$/, '');
    } catch {
      return isoString;
    }
  };

  // 1단계: 기본 정보 분석
  const basicInfoSummary = useMemo(() => {
    const basicInfo = stepData.basicInfo || {};
    const matched: SummaryItem[] = [];
    const modified: SummaryItem[] = [];

    if ((basicInfo.all_matched as any) === true) {
      matched.push({
        label: '관리책임자',
        corrected: basicInfo.manager || deviceInfo.manager || '-',
      });
      matched.push({
        label: '담당자 연락처',
        corrected: basicInfo.contact_info || deviceInfo.contact_info || '-',
      });
      matched.push({
        label: '외부표출',
        corrected: basicInfo.external_display || deviceInfo.external_display || '-',
      });
      matched.push({
        label: '분류체계',
        corrected: `${basicInfo.category_1 || deviceInfo.category_1 || '-'} > ${basicInfo.category_2 || deviceInfo.category_2 || '-'} > ${basicInfo.category_3 || deviceInfo.category_3 || '-'}`,
      });
    } else if ((basicInfo.all_matched as any) === 'edited') {
      const fields = [
        { key: 'manager', label: '관리책임자' },
        { key: 'contact_info', label: '담당자 연락처' },
        { key: 'external_display', label: '외부표출' },
        { key: 'category_1', label: '대분류' },
        { key: 'category_2', label: '중분류' },
        { key: 'category_3', label: '소분류' },
      ];

      fields.forEach(field => {
        const original = deviceInfo[field.key] || '';
        const corrected = basicInfo[field.key] || '';
        if (corrected && original !== corrected) {
          modified.push({
            label: field.label,
            original: original || '(비어있음)',
            corrected,
          });
        }
      });
    }

    if (basicInfo.location_matched === true) {
      matched.push({
        label: '주소 및 설치위치',
        corrected: basicInfo.address || deviceInfo.installation_address || '-',
      });
    } else if ((basicInfo.location_matched as any) === 'edited') {
      const addressOriginal = deviceInfo.installation_address || '';
      const addressCorrected = basicInfo.address || '';

      if (addressOriginal !== addressCorrected && addressCorrected) {
        modified.push({
          label: '주소',
          original: addressOriginal,
          corrected: addressCorrected,
        });
      }
    }

    if (basicInfo.gps_verified && basicInfo.gps_latitude !== undefined && basicInfo.gps_longitude !== undefined) {
      const lat = basicInfo.gps_latitude;
      const lng = basicInfo.gps_longitude;
      const origLat = deviceInfo.latitude || deviceInfo.gps_latitude;
      const origLng = deviceInfo.longitude || deviceInfo.gps_longitude;

      // ✅ lat, lng가 유효한 숫자인지 확인
      if (typeof lat === 'number' && typeof lng === 'number') {
        if (Math.abs(lat - origLat) > 0.0001 || Math.abs(lng - origLng) > 0.0001) {
          modified.push({
            label: 'GPS 좌표',
            original: `${origLat.toFixed(6)}, ${origLng.toFixed(6)}`,
            corrected: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
          });
        } else {
          matched.push({
            label: 'GPS 좌표',
            corrected: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
          });
        }
      }
    }

    // 접근 허용 범위 추가
    if (basicInfo.access_level) {
      matched.push({
        label: '접근 허용 범위',
        corrected: basicInfo.access_level,
      });
    }

    // 사용 가능 시간 추가
    if (basicInfo.available_hours) {
      matched.push({
        label: '사용 가능 시간',
        corrected: basicInfo.available_hours,
      });
    }

    // 매월 점검 상태 추가
    if ((basicInfo as any).monthlyInspectionStatus) {
      const status = (basicInfo as any).monthlyInspectionStatus;
      const statusText = status === 'inspected' ? '매월 1회 점검' : '매월 1회 미점검';
      matched.push({
        label: '매월 점검 현황',
        corrected: statusText,
      });

      // 미점검 사유
      if (status === 'not_inspected' && (basicInfo as any).uninspectedReason) {
        matched.push({
          label: '미점검 사유',
          corrected: (basicInfo as any).uninspectedReason,
        });
      }
    }

    // 최근 1년간 사용건수 추가
    if ((basicInfo as any).usageCountLastYear !== undefined && (basicInfo as any).usageCountLastYear !== null && (basicInfo as any).usageCountLastYear !== '') {
      matched.push({
        label: '최근 1년간 사용건수',
        corrected: `${(basicInfo as any).usageCountLastYear}회`,
      });
    }

    return { matched, modified };
  }, [stepData.basicInfo, deviceInfo]);

  // 2단계: 장비 정보 분석
  const deviceInfoSummary = useMemo(() => {
    const devInfo = stepData.deviceInfo || {};
    const matched: SummaryItem[] = [];
    const modified: SummaryItem[] = [];
    const photos: string[] = [];

    if (devInfo.all_matched === true) {
      matched.push({
        label: '제조사',
        corrected: devInfo.manufacturer || deviceInfo.manufacturer || '-',
      });
      matched.push({
        label: '모델명',
        corrected: devInfo.model_name || deviceInfo.model_name || '-',
      });
      matched.push({
        label: '제조번호',
        corrected: devInfo.serial_number || deviceInfo.serial_number || '-',
      });
    } else if (devInfo.all_matched === 'edited') {
      const fields = [
        { key: 'manufacturer', label: '제조사', dbKey: 'manufacturer' },
        { key: 'model_name', label: '모델명', dbKey: 'model_name' },
        { key: 'serial_number', label: '제조번호', dbKey: 'serial_number' },
      ];

      fields.forEach(field => {
        const original = deviceInfo[field.dbKey] || '';
        const corrected = devInfo[field.key] || '';
        if (corrected && original !== corrected) {
          modified.push({
            label: field.label,
            original: original || '(비어있음)',
            corrected,
          });
        }
      });
    }

    if (devInfo.supplies_matched === true) {
      matched.push({
        label: '배터리 유효기간',
        corrected: devInfo.battery_expiry_date || deviceInfo.battery_expiry_date || '-',
      });
      matched.push({
        label: '패드 유효기간',
        corrected: devInfo.pad_expiry_date || deviceInfo.patch_expiry_date || '-',
      });
      matched.push({
        label: '제조일자',
        corrected: devInfo.manufacturing_date || deviceInfo.manufacturing_date || '-',
      });
      matched.push({
        label: '작동상태',
        corrected: devInfo.operation_status || deviceInfo.operation_status || '-',
      });
      // 배터리/패드/제조일자 조치계획 추가 (2025-11-09: Critical fix)
      if (devInfo.battery_action_plan) {
        matched.push({
          label: '배터리 조치계획',
          corrected: devInfo.battery_action_plan,
        });
      }
      if (devInfo.battery_action_custom_reason) {
        matched.push({
          label: '배터리 기타사유',
          corrected: devInfo.battery_action_custom_reason,
        });
      }
      if (devInfo.battery_modification_reason) {
        matched.push({
          label: '배터리 수정사유',
          corrected: devInfo.battery_modification_reason,
        });
      }
      if (devInfo.pad_action_plan) {
        matched.push({
          label: '패드 조치계획',
          corrected: devInfo.pad_action_plan,
        });
      }
      if (devInfo.pad_expiry_date_action_custom_reason) {
        matched.push({
          label: '패드 기타사유',
          corrected: devInfo.pad_expiry_date_action_custom_reason,
        });
      }
      if (devInfo.pad_expiry_date_modification_reason) {
        matched.push({
          label: '패드 수정사유',
          corrected: devInfo.pad_expiry_date_modification_reason,
        });
      }
      if (devInfo.manufacturing_date_action_plan) {
        matched.push({
          label: '제조일자 조치계획',
          corrected: devInfo.manufacturing_date_action_plan,
        });
      }
      if (devInfo.manufacturing_date_action_custom_reason) {
        matched.push({
          label: '제조일자 기타사유',
          corrected: devInfo.manufacturing_date_action_custom_reason,
        });
      }
      if (devInfo.manufacturing_date_modification_reason) {
        matched.push({
          label: '제조일자 수정사유',
          corrected: devInfo.manufacturing_date_modification_reason,
        });
      }
      // 조치기한 추가
      if (devInfo.action_deadline) {
        matched.push({
          label: '조치기한',
          corrected: devInfo.action_deadline,
        });
      }
    } else if (devInfo.supplies_matched === 'edited') {
      const supplyFields = [
        { key: 'battery_expiry_date', label: '배터리 유효기간', dbKey: 'battery_expiry_date' },
        { key: 'pad_expiry_date', label: '패드 유효기간', dbKey: 'patch_expiry_date' },
        { key: 'battery_action_plan', label: '배터리 조치계획', dbKey: 'battery_action_plan' },
        { key: 'battery_action_custom_reason', label: '배터리 기타사유', dbKey: 'battery_action_custom_reason' },
        { key: 'battery_modification_reason', label: '배터리 수정사유', dbKey: 'battery_modification_reason' },
        { key: 'pad_action_plan', label: '패드 조치계획', dbKey: 'pad_action_plan' },
        { key: 'pad_expiry_date_action_custom_reason', label: '패드 기타사유', dbKey: 'pad_expiry_date_action_custom_reason' },
        { key: 'pad_expiry_date_modification_reason', label: '패드 수정사유', dbKey: 'pad_expiry_date_modification_reason' },
        { key: 'manufacturing_date', label: '제조일자', dbKey: 'manufacturing_date' },
        { key: 'manufacturing_date_action_plan', label: '제조일자 조치계획', dbKey: 'manufacturing_date_action_plan' },
        { key: 'manufacturing_date_action_custom_reason', label: '제조일자 기타사유', dbKey: 'manufacturing_date_action_custom_reason' },
        { key: 'manufacturing_date_modification_reason', label: '제조일자 수정사유', dbKey: 'manufacturing_date_modification_reason' },
        { key: 'operation_status', label: '작동상태', dbKey: 'operation_status' },
        { key: 'action_deadline', label: '조치기한', dbKey: 'action_deadline' },
      ];

      supplyFields.forEach(field => {
        const original = deviceInfo[field.dbKey] || '';
        const corrected = devInfo[field.key] || '';
        if (original !== corrected && corrected) {
          modified.push({
            label: field.label,
            original,
            corrected,
          });
        }
      });
    }

    if (devInfo.serial_number_photo) photos.push('시리얼번호');
    if (devInfo.battery_mfg_date_photo) photos.push('배터리 제조일자');
    if (devInfo.device_mfg_date_photo) photos.push('본체 제조일자');

    return { matched, modified, photos };
  }, [stepData.deviceInfo, deviceInfo]);

  // 3단계: 보관함 점검 분석
  const storageChecklistSummary = useMemo(() => {
    // storage로 통일 (storageChecklist가 아님)
    const storage = stepData.storage || {};
    const matched: SummaryItem[] = [];
    const issues: SummaryItem[] = [];
    const photos: string[] = [];

    // 2025-11-09: CRITICAL FIX - 실제 저장된 필드명 사용
    const checklistItems = storage.checklist_items || {};
    const improvementNotes = storage.improvement_notes || {};

    // 보관함 형태
    if (storage.storage_type) {
      matched.push({
        label: '보관함 형태',
        corrected: storage.storage_type === 'wall_mounted' ? '벽면부착식'
                 : storage.storage_type === 'standalone' ? '독립식'
                 : '기타',
      });
    }

    // 체크리스트 항목들 (실제 저장된 필드명 사용)
    const checkItems = [
      { key: 'alarm_functional', label: '도난경보장치 작동 여부' },
      { key: 'instructions_status', label: '보관함 각종 안내문구 표시' },
      { key: 'emergency_contact', label: '비상연락망 표시 여부' },
      { key: 'cpr_manual', label: '심폐소생술 방법 안내책자/그림 여부' },
      { key: 'expiry_display', label: '패드 및 배터리 유효기간 표시 여부' },
    ];

    checkItems.forEach(item => {
      const value = checklistItems[item.key];
      const note = improvementNotes[item.key] || '';
      if (value === 'normal' || value === 'yes') {
        matched.push({
          label: item.label,
          corrected: note || '양호',
        });
      } else if (value === 'bad' || value === 'no') {
        issues.push({
          label: item.label,
          corrected: note || '불량',
        });
      } else if (value === 'needs_improvement') {
        issues.push({
          label: item.label,
          corrected: note || '개선 필요',
        });
      }
    });

    // 안내표지 설치 (다중선택)
    if (storage.signage_selected && Array.isArray(storage.signage_selected) && storage.signage_selected.length > 0) {
      const signageLabels = storage.signage_selected.map(s =>
        s === 'entrance' ? '출입구'
        : s === 'interior' ? '실내'
        : s === 'map' ? '지도'
        : s
      ).join(', ');
      matched.push({
        label: '안내표지 설치',
        corrected: signageLabels,
      });
    }

    // 사진
    if (storage.storage_box_photo) photos.push('보관함 사진');
    if (storage.signage_photo) photos.push('안내표지 사진');

    return { matched, issues, photos };
  }, [stepData.storage]);

  // 4단계: 관리책임자 교육 정보 분석 (2025-11-09: CRITICAL FIX)
  const managerEducationSummary = useMemo(() => {
    const managerEducation = stepData.managerEducation || {};
    const matched: SummaryItem[] = [];

    if (managerEducation.education_status) {
      let educationStatusLabel = '';
      switch (managerEducation.education_status) {
        case 'manager_education':
          educationStatusLabel = '관리책임자 교육 이수';
          break;
        case 'legal_mandatory_education':
          educationStatusLabel = '법정의무교육 이수';
          break;
        case 'not_completed':
          educationStatusLabel = '미이수';
          // 미이수 사유 추가
          if (managerEducation.not_completed_reason) {
            let reasonLabel = '';
            switch (managerEducation.not_completed_reason) {
              case 'new_manager':
                reasonLabel = '관리책임자 신규지정';
                break;
              case 'recent_installation':
                reasonLabel = '최근 설치';
                break;
              case 'other':
                reasonLabel = managerEducation.not_completed_other_text || '기타 사유';
                break;
            }
            educationStatusLabel += ` (${reasonLabel})`;
          }
          break;
        case 'other':
          educationStatusLabel = `기타 (${managerEducation.education_other_text || ''})`;
          break;
      }

      if (educationStatusLabel) {
        matched.push({
          label: '관리책임자 교육 이수 현황',
          corrected: educationStatusLabel,
        });
      }
    }

    // 보건복지부 전달사항
    if (managerEducation.message_to_mohw) {
      matched.push({
        label: '보건복지부 재난의료대응과로 전달할 사항',
        corrected: managerEducation.message_to_mohw,
      });
    }

    return { matched, issues: [], photos: [] };
  }, [stepData.managerEducation]);

  // 전체 통계 (2025-11-09: 관리책임자 교육 포함)
  const totalStats = useMemo(() => {
    const matchedCount =
      basicInfoSummary.matched.length +
      deviceInfoSummary.matched.length +
      storageChecklistSummary.matched.length +
      managerEducationSummary.matched.length;

    const modifiedCount =
      basicInfoSummary.modified.length +
      deviceInfoSummary.modified.length;

    const issuesCount = storageChecklistSummary.issues.length;

    const photosCount =
      deviceInfoSummary.photos.length +
      storageChecklistSummary.photos.length;

    return { matchedCount, modifiedCount, issuesCount, photosCount };
  }, [basicInfoSummary, deviceInfoSummary, storageChecklistSummary, managerEducationSummary]);

  // 권장 조치 판단
  const recommendedAction = useMemo(() => {
    const { modifiedCount, issuesCount } = totalStats;

    if (issuesCount > 0) {
      return {
        type: 'onsite' as const,
        reason: '보관함 불량 항목이 있어 현장에서 즉시 조치가 필요합니다.',
        severity: 'high' as const,
      };
    }

    if (modifiedCount > 3) {
      return {
        type: 'office' as const,
        reason: '수정 항목이 많아 사무실에서 데이터 검토가 필요합니다.',
        severity: 'medium' as const,
      };
    }

    if (modifiedCount > 0) {
      return {
        type: 'office' as const,
        reason: '수정된 데이터가 있어 사무실에서 확인이 필요합니다.',
        severity: 'low' as const,
      };
    }

    return {
      type: 'onsite' as const,
      reason: '모든 항목이 정상이며 현장 처리가 가능합니다.',
      severity: 'low' as const,
    };
  }, [totalStats]);

  const documentation = stepData.documentation || {};

  const handleChange = (field: string, value: any) => {
    updateStepData('documentation', {
      ...documentation,
      [field]: value,
    });
  };

  const handleShareReport = async () => {
    if (isSharing) return;

    setIsSharing(true);
    try {
      const fileName = `AED점검보고서_${new Date().toISOString().split('T')[0]}.png`;
      const success = await captureAndShareReport('inspection-report-container', fileName, {
        name: user?.name || user?.email || '점검자',
        organization: (user as any)?.organization?.organization_name || '조직명 미등록',
      });

      if (!success && isReportSharingSupported()) {
        console.log('Share was not completed');
      }
    } catch (error) {
      console.error('Error sharing report:', error);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* 보고서 컨테이너 - MS Word 스타일 */}
      <div id="inspection-report-container" className="space-y-4 rounded-lg border border-gray-700/30 bg-gray-900/50 p-4 sm:p-6">
        <style>{`
          /* 기본: 보고서 섹션 표시 */
          .report-section {
            display: block !important;
          }

          /* 화면 표시용 반응형 폰트 시스템 */
          @media screen {
            #inspection-report-container {
              font-size: clamp(10px, 2vw, 14px);
              line-height: 1.6;
            }

            #inspection-report-container .report-title h1 {
              font-size: clamp(16px, 4vw, 24px) !important;
            }

            #inspection-report-container .section-title {
              font-size: clamp(12px, 2.5vw, 16px) !important;
            }

            #inspection-report-container .report-table {
              font-size: clamp(10px, 2vw, 13px) !important;
              width: 100%;
              table-layout: fixed;
            }

            #inspection-report-container .report-table td,
            #inspection-report-container .report-table th {
              word-wrap: break-word;
              overflow-wrap: break-word;
            }

            /* 모바일 최적화 */
            @media (max-width: 640px) {
              #inspection-report-container {
                padding: 12px !important;
              }

              #inspection-report-container .report-table {
                font-size: 10px !important;
              }

              #inspection-report-container .report-table td,
              #inspection-report-container .report-table th {
                padding: 4px 2px !important;
              }
            }
          }

          @media print {
            body { margin: 0; padding: 0; background: white; }
            #inspection-report-container {
              border: none !important;
              background: white !important;
              color: #333 !important;
              padding: 10px !important;
              margin: 0 !important;
              border-radius: 0 !important;
              box-shadow: none !important;
              space-y: 0 !important;
              font-family: 'Noto Sans KR', 'Segoe UI', sans-serif;
            }

            .no-print { display: none !important; }

            /* MS Word 문서 스타일 - 1페이지 최적화 */
            .report-title {
              text-align: center;
              margin-bottom: 4px;
              padding-bottom: 3px;
              border-bottom: 1.5px solid #333;
            }

            .report-title h1 {
              font-size: 11px;
              font-weight: bold;
              color: #000;
              margin: 0 0 1px 0;
            }

            .report-title p {
              font-size: 7px;
              color: #333;
              margin: 1px 0 0 0;
            }

            .section-title {
              font-size: 8px;
              font-weight: bold;
              color: #000;
              margin-bottom: 2px;
              padding-bottom: 1px;
              border-bottom: 0.5px solid #999;
            }

            .report-section {
              margin-bottom: 3px;
              page-break-inside: avoid;
            }

            .report-section:first-of-type {
              margin-top: 0;
            }

            .report-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 7px;
              margin-bottom: 2px;
            }

            .report-table td,
            .report-table th {
              border: 0.5px solid #999;
              padding: 2px 3px;
            }

            .report-table th {
              background-color: #e0e0e0;
              font-weight: bold;
              color: #000;
            }

            .report-table td {
              background-color: #fff;
              color: #333;
            }

            .report-table .header {
              background-color: #e0e0e0;
              font-weight: bold;
            }

            .report-content {
              font-size: 7px;
              line-height: 1.2;
              color: #333;
              margin-left: 8px;
            }

            .report-content p {
              margin: 1px 0;
            }

            .signature-section {
              margin-top: 8px;
              padding-top: 6px;
              border-top: 1.5px solid #333;
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 10px;
              text-align: center;
              font-size: 7px;
            }

            .signature-item {
              page-break-inside: avoid;
            }

            .signature-line {
              height: 15px;
              border-bottom: 0.5px solid #000;
              margin-top: 6px;
            }

            /* 화면에서 숨김 */
            .screen-only {
              display: none !important;
            }
          }
          
          /* 화면에서만 표시 */
          .screen-only {
            display: block;
          }
        `}</style>

        {/* ===== 보고서: MS Word 스타일 ===== */}

        {/* 헤더 */}
        <div className="report-section" style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid #4b5563' }}>
          <div style={{ fontSize: '9px', color: '#9ca3af' }}>
            보고서 생성 일시: {formatKSTTime(documentation.completed_time || new Date().toISOString())}
          </div>
        </div>

        {/* 1. 보고서 제목 */}
        <div className="report-title report-section" style={{ paddingBottom: '20px', paddingTop: '30px', borderBottom: '3px solid #4b5563', marginBottom: '20px', textAlign: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#f3f4f6' }}>2025년 자동심장충격기 현지점검 결과</h1>
        </div>

        {/* 2. 기본 정보 테이블 (Ⅰ. 점검 대상 정보) */}
        <div className="report-section">
          <div className="section-title">Ⅰ. 점검 대상 정보</div>
          <table className="report-table" style={{ borderCollapse: 'collapse' }}>
            <tbody>
              <tr style={{ borderTop: '2px solid #4b5563', borderBottom: '1px solid #6b7280' }}>
                <td className="header" style={{ width: '25%', border: 'none', borderRight: '1px solid #6b7280', backgroundColor: '#374151', color: '#f3f4f6', fontWeight: '500' }}>설치기관</td>
                <td style={{ border: 'none', borderRight: '1px solid #6b7280', color: '#d1d5db' }}>{deviceInfo.installation_institution || deviceInfo.installation_org || '-'}</td>
                <td className="header" style={{ width: '25%', border: 'none', borderRight: '1px solid #6b7280', backgroundColor: '#374151', color: '#f3f4f6', fontWeight: '500' }}>관리번호</td>
                <td style={{ border: 'none', color: '#d1d5db' }}>{deviceInfo.management_number || '-'}</td>
              </tr>
              <tr style={{ borderBottom: '2px solid #4b5563' }}>
                <td className="header" style={{ border: 'none', borderRight: '1px solid #6b7280', backgroundColor: '#374151', color: '#f3f4f6', fontWeight: '500' }}>장비연번</td>
                <td style={{ border: 'none', borderRight: '1px solid #6b7280', color: '#d1d5db' }}>{deviceInfo.equipment_serial || deviceInfo.serial_number || '-'}</td>
                <td className="header" style={{ border: 'none', borderRight: '1px solid #6b7280', backgroundColor: '#374151', color: '#f3f4f6', fontWeight: '500' }}>관리책임자</td>
                <td style={{ border: 'none', color: '#d1d5db' }}>{(deviceInfo.manager || '-')} / {deviceInfo.institution_contact || '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 2. 점검 항목 (Ⅱ. 점검 항목) - 수정 항목 통합 */}
        {basicInfoSummary.matched.length + deviceInfoSummary.matched.length + storageChecklistSummary.matched.length + managerEducationSummary.matched.length > 0 && (
          <div className="report-section">
            <div className="section-title">Ⅱ. 점검 항목</div>
            <div style={{ fontSize: '9px', fontWeight: 'bold', marginBottom: '8px', color: '#e5e7eb' }}>일치항목</div>

            {/* 정상 항목 (2025-11-09: 관리책임자 교육 포함) */}
            {[...basicInfoSummary.matched, ...deviceInfoSummary.matched, ...storageChecklistSummary.matched, ...managerEducationSummary.matched]
              .filter(item => !['청결 상태', '가시성', '접근성', '라벨 상태'].includes(item.label)).length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', marginBottom: '12px' }}>
                <tbody>
                  <tr style={{ borderTop: '2px solid #4b5563', borderBottom: '2px solid #4b5563' }}>
                    <td style={{ padding: '6px', border: 'none', color: '#d1d5db', lineHeight: '1.6' }}>
                      {(() => {
                        const items = [...basicInfoSummary.matched, ...deviceInfoSummary.matched, ...storageChecklistSummary.matched, ...managerEducationSummary.matched]
                          .filter(item => !['청결 상태', '가시성', '접근성', '라벨 상태'].includes(item.label));
                        const itemsPerLine = 2;
                        const lines = [];

                        for (let i = 0; i < items.length; i += itemsPerLine) {
                          lines.push(items.slice(i, i + itemsPerLine));
                        }

                        return lines.map((line, lineIdx) => (
                          <div key={lineIdx} style={{ marginBottom: '3px' }}>
                            {line.map((item, idx) => (
                              <span key={idx}>
                                • {item.label}: {item.corrected}
                                {idx < line.length - 1 ? '  |  ' : ''}
                              </span>
                            ))}
                          </div>
                        ));
                      })()}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}

            {/* 불일치 항목 */}
            {basicInfoSummary.modified.length + deviceInfoSummary.modified.length > 0 && (
              <div>
                <div style={{ fontSize: '9px', fontWeight: 'bold', marginBottom: '6px', color: '#e5e7eb' }}>불일치항목</div>
                <table className="report-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px' }}>
                  <thead>
                    <tr style={{ borderTop: '2px solid #4b5563', borderBottom: '1px solid #6b7280' }}>
                      <th style={{ backgroundColor: '#374151', padding: '3px', textAlign: 'center', fontWeight: 'bold', border: 'none', borderRight: '1px solid #6b7280', color: '#f3f4f6' }}>항목</th>
                      <th style={{ backgroundColor: '#374151', padding: '3px', textAlign: 'center', fontWeight: 'bold', border: 'none', borderRight: '1px solid #6b7280', color: '#f3f4f6' }}>원본값</th>
                      <th style={{ backgroundColor: '#374151', padding: '3px', textAlign: 'center', fontWeight: 'bold', border: 'none', color: '#f3f4f6' }}>수정값</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...basicInfoSummary.modified, ...deviceInfoSummary.modified].map((item, idx, arr) => {
                      const isLast = idx === arr.length - 1;
                      return (
                        <tr key={idx} style={{ borderBottom: isLast ? '2px solid #4b5563' : '1px solid #6b7280' }}>
                          <td style={{ padding: '3px', border: 'none', borderRight: '1px solid #6b7280', color: '#d1d5db' }}>{item.label}</td>
                          <td style={{ padding: '3px', border: 'none', borderRight: '1px solid #6b7280', color: '#d1d5db' }}>{item.original || '-'}</td>
                          <td style={{ padding: '3px', fontWeight: 'bold', border: 'none', color: '#e5e7eb' }}>{item.corrected}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 3. 관리책임자 교육 이수 현황 (Ⅲ. 관리책임자 교육 이수 현황) */}
        <div className="report-section">
          <div className="section-title">Ⅲ. 관리책임자 교육 이수 현황</div>
          <table className="report-table" style={{ borderCollapse: 'collapse' }}>
            <tbody>
              <tr style={{ borderTop: '2px solid #4b5563', borderBottom: '1px solid #6b7280' }}>
                <td className="header" style={{ width: '25%', border: 'none', borderRight: '1px solid #6b7280', backgroundColor: '#374151', color: '#f3f4f6', fontWeight: '500' }}>교육 이수 현황</td>
                <td style={{ border: 'none', color: '#d1d5db' }}>
                  {(() => {
                    const managerEducation = stepData.managerEducation;
                    if (!managerEducation?.education_status) return '미입력';

                    switch (managerEducation.education_status) {
                      case 'manager_education':
                        return '관리책임자 교육 이수';
                      case 'legal_mandatory_education':
                        return '법정의무교육 이수';
                      case 'not_completed':
                        if (managerEducation.not_completed_reason === 'new_manager') {
                          return '미이수 (관리책임자 신규지정)';
                        } else if (managerEducation.not_completed_reason === 'recent_installation') {
                          return '미이수 (최근 설치로 교육 이수 예정)';
                        } else if (managerEducation.not_completed_reason === 'other') {
                          return `미이수 (${managerEducation.not_completed_other_text || '기타 사유'})`;
                        }
                        return '미이수';
                      case 'other':
                        return managerEducation.education_other_text || '기타';
                      default:
                        return '미입력';
                    }
                  })()}
                </td>
              </tr>
              {stepData.managerEducation?.message_to_mohw && (
                <tr style={{ borderBottom: '2px solid #4b5563' }}>
                  <td className="header" style={{ border: 'none', borderRight: '1px solid #6b7280', backgroundColor: '#374151', color: '#f3f4f6', fontWeight: '500' }}>보건복지부 전달사항</td>
                  <td style={{ border: 'none', color: '#d1d5db' }}>
                    {stepData.managerEducation.message_to_mohw}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 10. 서명 */}
        <div className="report-section" style={{ marginTop: '40px', paddingTop: '20px', borderTop: '2px solid #4b5563', textAlign: 'right' }}>
          <p style={{ margin: 0, marginBottom: '5px', fontSize: '11px', color: '#d1d5db' }}>{formatDate(documentation.completed_time || new Date().toISOString())}</p>
          <p style={{ margin: 0, marginBottom: '3px', fontSize: '11px', color: '#d1d5db' }}>관리책임자: {stepData.basicInfo?.manager || deviceInfo.manager || '-'}</p>
          <p style={{ margin: 0, fontSize: '11px', color: '#d1d5db' }}>점검자: {user?.name || user?.email || '-'}</p>
        </div>

        {/* 11. 하단 페이지 정보 */}
        <div className="no-print report-section" style={{ marginTop: '30px', textAlign: 'center', fontSize: '9px', color: '#9ca3af' }}>
          <p>이 보고서는 oo보건소 자동심장충격기(AED) 정기점검 기록입니다.</p>
        </div>

        {/* 푸터 */}
        <div className="no-print report-section" style={{ marginTop: '40px', paddingTop: '15px', borderTop: '1px solid #4b5563', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '9px', color: '#9ca3af' }}></div>
          <div style={{ fontSize: '9px', color: '#9ca3af' }}>https://aed.pics</div>
        </div>
      </div>

      {/* 미리보기 안내 메시지 */}
      <div className="mt-4 rounded-lg bg-blue-900/20 border border-blue-700/30 p-4">
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-gray-300">
            <p className="font-medium mb-1">이것은 점검 결과 미리보기입니다</p>
            <p className="text-xs text-gray-400">
              점검을 완료하면 전체 보고서를 확인하고 인쇄하거나 PDF로 저장할 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
