'use client';

import { useInspectionSessionStore } from '@/lib/state/inspection-session-store';
import { useMemo, useState } from 'react';
import { useUser } from '@/lib/auth/hooks';
import { captureAndShareReport, isReportSharingSupported } from '@/lib/utils/report-sharing';

interface SummaryItem {
  label: string;
  original?: string;
  corrected?: string;
  reason?: string;
  actionType?: 'onsite' | 'office' | null;
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
  category_1?: string;
  category_2?: string;
  category_3?: string;
  edit_reason?: string;
  location_matched?: boolean;
  address?: string;
  gps_verified?: boolean;
  gps_latitude?: number;
  gps_longitude?: number;
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
  manufacturing_date?: string;
  serial_number_photo?: string;
  battery_mfg_date_photo?: string;
  device_mfg_date_photo?: string;
}

interface StorageInfoData {
  all_matched?: boolean | 'edited';
  battery_expiry?: string;
  pad_expiry?: string;
  edit_reason?: string;
}

interface StepData {
  basicInfo?: BasicInfoData;
  locationInfo?: LocationInfoData;
  deviceInfo?: DeviceInfoData;
  storageInfo?: StorageInfoData;
  [key: string]: any;
}

export function InspectionSummaryStep() {
  const session = useInspectionSessionStore((state) => state.session);
  const stepData = useInspectionSessionStore((state) => state.stepData) as StepData;
  const updateStepData = useInspectionSessionStore((state) => state.updateStepData);
  const { user } = useUser();

  const [itemActions, setItemActions] = useState<Record<string, 'onsite' | 'office'>>({});
  const [isSharing, setIsSharing] = useState(false);

  const deviceInfo = (session?.current_snapshot || session?.device_info || {}) as Record<string, any>;

  const formatKSTTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const kstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
      const year = kstDate.getFullYear();
      const month = String(kstDate.getMonth() + 1).padStart(2, '0');
      const day = String(kstDate.getDate()).padStart(2, '0');
      const hours = String(kstDate.getHours()).padStart(2, '0');
      const minutes = String(kstDate.getMinutes()).padStart(2, '0');
      return `${year}년 ${month}월 ${day}일 ${hours}:${minutes}`;
    } catch {
      return isoString;
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const kstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
      const year = kstDate.getFullYear();
      const month = String(kstDate.getMonth() + 1).padStart(2, '0');
      const day = String(kstDate.getDate()).padStart(2, '0');
      return `${year}.${month}.${day}`;
    } catch {
      return isoString;
    }
  };

  // 1단계: 기본 정보 분석
  const basicInfoSummary = useMemo(() => {
    const basicInfo = stepData.basicInfo || {};
    const matched: SummaryItem[] = [];
    const modified: SummaryItem[] = [];

    if (basicInfo.all_matched === true) {
      matched.push({
        label: '관리책임자',
        corrected: basicInfo.manager || deviceInfo.manager || '-',
      });
      matched.push({
        label: '담당자 연락처',
        corrected: basicInfo.contact_info || deviceInfo.contact_info || '-',
      });
      matched.push({
        label: '분류체계',
        corrected: `${basicInfo.category_1 || deviceInfo.category_1 || '-'} > ${basicInfo.category_2 || deviceInfo.category_2 || '-'} > ${basicInfo.category_3 || deviceInfo.category_3 || '-'}`,
      });
    } else if (basicInfo.all_matched === 'edited') {
      const fields = [
        { key: 'manager', label: '관리책임자' },
        { key: 'contact_info', label: '담당자 연락처' },
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
            reason: basicInfo.edit_reason || '수정 사유 없음',
          });
        }
      });
    }

    if (basicInfo.location_matched === true) {
      matched.push({
        label: '주소 및 설치위치',
        corrected: basicInfo.address || deviceInfo.installation_address || '-',
      });
    } else if (basicInfo.location_matched === 'edited') {
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
            original: '',
            corrected: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
            reason: '마커 이동 또는 현재 위치로 변경',
          });
        } else {
          matched.push({
            label: 'GPS 좌표',
            corrected: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
          });
        }
      }
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
    } else if (devInfo.supplies_matched === 'edited') {
      const supplyFields = [
        { key: 'battery_expiry_date', label: '배터리 유효기간', dbKey: 'battery_expiry_date' },
        { key: 'pad_expiry_date', label: '패드 유효기간', dbKey: 'patch_expiry_date' },
        { key: 'manufacturing_date', label: '제조일자', dbKey: 'manufacturing_date' },
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
    const storage = stepData.storageChecklist || {};
    const matched: SummaryItem[] = [];
    const issues: SummaryItem[] = [];
    const photos: string[] = [];

    const checkItems = [
      { key: 'cleanliness', label: '청결 상태' },
      { key: 'visibility', label: '가시성' },
      { key: 'accessibility', label: '접근성' },
      { key: 'label_condition', label: '라벨 상태' },
      { key: 'lock_function', label: '잠금장치' },
      { key: 'signage', label: '안내표지' },
    ];

    checkItems.forEach(item => {
      const value = storage[item.key];
      const note = storage[`${item.key}_note`] || '';
      if (value === 'good' || value === 'yes') {
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

    if (storage.storage_box_photo) photos.push('보관함 사진');
    if (storage.signage_photo) photos.push('안내표지 사진');

    return { matched, issues, photos };
  }, [stepData.storageChecklist]);

  // 전체 통계
  const totalStats = useMemo(() => {
    const matchedCount =
      basicInfoSummary.matched.length +
      deviceInfoSummary.matched.length +
      storageChecklistSummary.matched.length;

    const modifiedCount =
      basicInfoSummary.modified.length +
      deviceInfoSummary.modified.length;

    const issuesCount = storageChecklistSummary.issues.length;

    const photosCount =
      deviceInfoSummary.photos.length +
      storageChecklistSummary.photos.length;

    return { matchedCount, modifiedCount, issuesCount, photosCount };
  }, [basicInfoSummary, deviceInfoSummary, storageChecklistSummary]);

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

  const handleItemAction = (itemKey: string, action: 'onsite' | 'office') => {
    setItemActions(prev => ({
      ...prev,
      [itemKey]: action
    }));
  };

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
        name: user?.user_metadata?.name || user?.email || '점검자',
        organization: user?.user_metadata?.organization || '조직명 미등록',
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
      {/* 공유 버튼 (모바일용) */}
      {isReportSharingSupported() && (
        <div className="flex gap-2 no-print">
          <button
            type="button"
            onClick={handleShareReport}
            disabled={isSharing}
            className="flex-1 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m0 0a2 2 0 01-2 2H3a2 2 0 01-2-2m0-6V7a2 2 0 012-2h12a2 2 0 012 2v6" />
            </svg>
            {isSharing ? '보고서 저장 중...' : '보고서 공유'}
          </button>
        </div>
      )}

      {/* 보고서 컨테이너 - 화면: 기존 디자인, 인쇄: MS Word 스타일 */}
      <div id="inspection-report-container" className="space-y-4 rounded-lg border border-gray-700/30 bg-gray-900/50 p-4">
        <style>{`
          /* 기본: 보고서 섹션 표시 */
          .report-section {
            display: block !important;
          }

          @media print {
            body { margin: 0; padding: 0; background: white; }
            #inspection-report-container {
              border: none !important;
              background: white !important;
              color: #333 !important;
              padding: 20px !important;
              margin: 0 !important;
              border-radius: 0 !important;
              box-shadow: none !important;
              space-y: 0 !important;
              font-family: 'Noto Sans KR', 'Segoe UI', sans-serif;
            }

            .no-print { display: none !important; }

            /* MS Word 문서 스타일 */
            .report-title {
              text-align: center;
              margin-bottom: 8px;
              padding-bottom: 5px;
              border-bottom: 2px solid #333;
            }

            .report-title h1 {
              font-size: 13px;
              font-weight: bold;
              color: #000;
              margin: 0 0 2px 0;
            }

            .report-title p {
              font-size: 9px;
              color: #333;
              margin: 2px 0 0 0;
            }

            .section-title {
              font-size: 10px;
              font-weight: bold;
              color: #000;
              margin-bottom: 3px;
              padding-bottom: 2px;
              border-bottom: 1px solid #999;
            }
            
            .report-section {
              margin-bottom: 6px;
              page-break-inside: avoid;
            }

            .report-section:first-of-type {
              margin-top: 0;
            }

            .report-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 9px;
              margin-bottom: 4px;
            }

            .report-table td,
            .report-table th {
              border: 1px solid #999;
              padding: 3px 4px;
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
              font-size: 9px;
              line-height: 1.3;
              color: #333;
              margin-left: 10px;
            }

            .report-content p {
              margin: 2px 0;
            }

            .signature-section {
              margin-top: 15px;
              padding-top: 10px;
              border-top: 2px solid #333;
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 15px;
              text-align: center;
              font-size: 9px;
            }

            .signature-item {
              page-break-inside: avoid;
            }

            .signature-line {
              height: 20px;
              border-bottom: 1px solid #000;
              margin-top: 10px;
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
        <div className="report-section" style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid #ddd' }}>
          <div style={{ fontSize: '9px', color: '#666' }}>
            보고서 생성 일시: {formatKSTTime(documentation.completed_time || new Date().toISOString())}
          </div>
        </div>

        {/* 1. 보고서 제목 */}
        <div className="report-title report-section" style={{ paddingBottom: '20px', paddingTop: '30px', borderBottom: '3px solid #333', marginBottom: '20px', textAlign: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>2025년 자동심장충격기 현지점검 결과</h1>
        </div>

        {/* 2. 기본 정보 테이블 (Ⅰ. 점검 대상 정보) */}
        <div className="report-section">
          <div className="section-title">Ⅰ. 점검 대상 정보</div>
          <table className="report-table" style={{ borderCollapse: 'collapse' }}>
            <tbody>
              <tr style={{ borderTop: '2px solid #333', borderBottom: '1px solid #999' }}>
                <td className="header" style={{ width: '25%', border: 'none', borderRight: '1px solid #999' }}>설치기관</td>
                <td style={{ border: 'none', borderRight: '1px solid #999' }}>{deviceInfo.installation_institution || deviceInfo.installation_org || '-'}</td>
                <td className="header" style={{ width: '25%', border: 'none', borderRight: '1px solid #999' }}>관리번호</td>
                <td style={{ border: 'none' }}>{deviceInfo.management_number || '-'}</td>
              </tr>
              <tr style={{ borderBottom: '2px solid #333' }}>
                <td className="header" style={{ border: 'none', borderRight: '1px solid #999' }}>장비연번</td>
                <td style={{ border: 'none', borderRight: '1px solid #999' }}>{deviceInfo.equipment_serial || deviceInfo.serial_number || '-'}</td>
                <td className="header" style={{ border: 'none', borderRight: '1px solid #999' }}>관리책임자</td>
                <td style={{ border: 'none' }}>{(deviceInfo.manager || '-')} / {deviceInfo.institution_contact || '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 2. 점검 항목 (Ⅱ. 점검 항목) - 수정 항목 통합 */}
        {basicInfoSummary.matched.length + deviceInfoSummary.matched.length + storageChecklistSummary.matched.length > 0 && (
          <div className="report-section">
            <div className="section-title">Ⅱ. 점검 항목</div>
            <div style={{ fontSize: '9px', fontWeight: 'bold', marginBottom: '8px', color: '#1f2937' }}>일치항목</div>

            {/* 정상 항목 */}
            {[...basicInfoSummary.matched, ...deviceInfoSummary.matched, ...storageChecklistSummary.matched]
              .filter(item => !['청결 상태', '가시성', '접근성', '라벨 상태'].includes(item.label)).length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', marginBottom: '12px' }}>
                <tbody>
                  <tr style={{ borderTop: '2px solid #333', borderBottom: '2px solid #333' }}>
                    <td style={{ padding: '6px', border: 'none', color: '#333', lineHeight: '1.6' }}>
                      {(() => {
                        const items = [...basicInfoSummary.matched, ...deviceInfoSummary.matched, ...storageChecklistSummary.matched]
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
                <div style={{ fontSize: '9px', fontWeight: 'bold', marginBottom: '6px', color: '#1f2937' }}>불일치항목</div>
                <table className="report-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px' }}>
                  <thead>
                    <tr style={{ borderTop: '2px solid #333', borderBottom: '1px solid #999' }}>
                      <th style={{ backgroundColor: '#f3f4f6', padding: '3px', textAlign: 'center', fontWeight: 'bold', border: 'none', borderRight: '1px solid #999' }}>항목</th>
                      <th style={{ backgroundColor: '#f3f4f6', padding: '3px', textAlign: 'center', fontWeight: 'bold', border: 'none', borderRight: '1px solid #999' }}>원본값</th>
                      <th style={{ backgroundColor: '#f3f4f6', padding: '3px', textAlign: 'center', fontWeight: 'bold', border: 'none', borderRight: '1px solid #999' }}>수정값</th>
                      <th style={{ backgroundColor: '#f3f4f6', padding: '3px', textAlign: 'center', fontWeight: 'bold', border: 'none' }}>조치</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...basicInfoSummary.modified, ...deviceInfoSummary.modified].map((item, idx, arr) => {
                      const itemKey = `modified_${idx}`;
                      const selectedAction = itemActions[itemKey];
                      const isLast = idx === arr.length - 1;
                      return (
                        <tr key={idx} style={{ borderBottom: isLast ? '2px solid #333' : '1px solid #999' }}>
                          <td style={{ padding: '3px', border: 'none', borderRight: '1px solid #999' }}>{item.label}</td>
                          <td style={{ padding: '3px', border: 'none', borderRight: '1px solid #999' }}>{item.original || '-'}</td>
                          <td style={{ padding: '3px', fontWeight: 'bold', border: 'none', borderRight: '1px solid #999' }}>{item.corrected}</td>
                          <td style={{ padding: '3px', border: 'none' }}>{selectedAction === 'onsite' ? '현장' : selectedAction === 'office' ? '사무실' : '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 3. 종합 의견 및 법조항 (Ⅲ. 점검 종합 의견) */}
        <div className="report-section">
          <div className="section-title">Ⅲ. 점검 종합 의견</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '10px' }}>
            <tbody>
              <tr style={{ borderTop: '2px solid #333', borderBottom: '2px solid #333' }}>
                <td style={{ padding: '8px', border: 'none', color: '#333', lineHeight: '1.5' }}>
                  {useMemo(() => {
                    // 1. 관리책임자가 수정된 경우
                    const managerModified = basicInfoSummary.modified.some(item => item.label === '관리책임자');
                    if (managerModified) {
                      return '관리책임자가 변경될 경우 즉시 보건소로 연락주시기 바랍니다.';
                    }

                    // 2. 배터리 유효기간과 패드 유효기간이 다른 경우
                    const devInfo = stepData.deviceInfo || {};
                    const batteryExpiry = devInfo.battery_expiry_date || deviceInfo.battery_expiry_date || '';
                    const padExpiry = devInfo.pad_expiry_date || deviceInfo.patch_expiry_date || '';

                    if (batteryExpiry && padExpiry && batteryExpiry !== padExpiry) {
                      return '법 제47조의2제3항을 위반하여 자동심장충격기 등 심폐소생술을 할 수 있는 응급장비의 점검 결과를 통보하지 않은 경우 1차 위반시 과태료 50만원에 해당됩니다. 점검 결과에 정확한 유효기간을 입력하시기 바랍니다.';
                    }

                    // 3. 기본값
                    return documentation.notes || '현장 점검 결과 대부분의 항목이 양호합니다. 정기점검을 통해 장비의 안전성을 지속적으로 확보할 것을 권장합니다.';
                  }, [basicInfoSummary.modified, stepData.deviceInfo, deviceInfo, documentation.notes])}
                </td>
              </tr>
            </tbody>
          </table>

          {/* 법조항 및 과태료 표 */}
          <div style={{ marginTop: '10px' }}>
            <div style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>
              제62조(과태료)
            </div>
            <div style={{ fontSize: '9px', marginBottom: '8px', color: '#333', lineHeight: '1.5' }}>
              다음 각 호의 어느 하나에 해당하는 자에게는 과태료를 부과한다.
            </div>

            {/* 위반 사항이 있는 경우만 표 표시 */}
            {(storageChecklistSummary.issues.some(item => item.label === '최근 점검이력') ||
              storageChecklistSummary.matched.every(item => item.label !== '안내표지') ||
              basicInfoSummary.modified.length > 0) && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', color: '#333', marginTop: '6px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#e8e8e8', borderTop: '2px solid #333', borderBottom: '1px solid #999' }}>
                    <th rowSpan={2} style={{ padding: '4px', textAlign: 'center', fontWeight: 'bold', verticalAlign: 'middle', border: 'none', borderRight: '1px solid #999' }}>위반 행위</th>
                    <th rowSpan={2} style={{ padding: '4px', textAlign: 'center', fontWeight: 'bold', verticalAlign: 'middle', border: 'none', borderRight: '1px solid #999' }}>근거법조문</th>
                    <th colSpan={3} style={{ padding: '4px', textAlign: 'center', fontWeight: 'bold', border: 'none' }}>과태료 금액</th>
                  </tr>
                  <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '1px solid #999' }}>
                    <th style={{ padding: '4px', textAlign: 'center', fontWeight: 'bold', border: 'none', borderRight: '1px solid #999' }}>1차 위반</th>
                    <th style={{ padding: '4px', textAlign: 'center', fontWeight: 'bold', border: 'none', borderRight: '1px solid #999' }}>2차 위반</th>
                    <th style={{ padding: '4px', textAlign: 'center', fontWeight: 'bold', border: 'none' }}>3차 위반</th>
                  </tr>
                </thead>
                <tbody>
                  {/* 변경신고 미이행 */}
                  {basicInfoSummary.modified.length > 0 && (
                    <tr style={{ borderBottom: '1px solid #999' }}>
                      <td style={{ border: 'none', borderRight: '1px solid #999', padding: '4px', textAlign: 'left', lineHeight: '1.4' }}>
                        법 제47조의2제2항을 위반하여 자동심장충격기 등 심폐소생술을 할 수 있는 응급장비의 설치 신고 또는 변경신고를 하지 않은 경우
                      </td>
                      <td style={{ border: 'none', borderRight: '1px solid #999', padding: '4px', textAlign: 'center', fontSize: '7px' }}>
                        법 제62조<br/>제1항 제3호의 4
                      </td>
                      <td style={{ border: 'none', borderRight: '1px solid #999', padding: '4px', textAlign: 'center' }}>50만원</td>
                      <td style={{ border: 'none', borderRight: '1px solid #999', padding: '4px', textAlign: 'center' }}>100만원</td>
                      <td style={{ border: 'none', padding: '4px', textAlign: 'center' }}>150만원</td>
                    </tr>
                  )}

                  {/* 점검 결과 통보 미이행 */}
                  {storageChecklistSummary.issues.some(item => item.label === '최근 점검이력') && (
                    <tr style={{ borderBottom: '1px solid #999' }}>
                      <td style={{ border: 'none', borderRight: '1px solid #999', padding: '4px', textAlign: 'left', lineHeight: '1.4' }}>
                        법 제47조의2제3항을 위반하여 자동심장충격기 등 심폐소생술을 할 수 있는 응급장비의 점검 결과를 통보하지 않은 경우
                      </td>
                      <td style={{ border: 'none', borderRight: '1px solid #999', padding: '4px', textAlign: 'center', fontSize: '7px' }}>
                        법 제62조<br/>제1항 제3호의 5
                      </td>
                      <td style={{ border: 'none', borderRight: '1px solid #999', padding: '4px', textAlign: 'center' }}>50만원</td>
                      <td style={{ border: 'none', borderRight: '1px solid #999', padding: '4px', textAlign: 'center' }}>75만원</td>
                      <td style={{ border: 'none', padding: '4px', textAlign: 'center' }}>100만원</td>
                    </tr>
                  )}

                  {/* 안내표지판 미부착 */}
                  {storageChecklistSummary.matched.every(item => item.label !== '안내표지') && (
                    <tr style={{ borderBottom: '2px solid #333' }}>
                      <td style={{ border: 'none', borderRight: '1px solid #999', padding: '4px', textAlign: 'left', lineHeight: '1.4' }}>
                        법 제47조의2제4항을 위반하여 자동심장충격기 등 심폐소생술을 할 수 있는 응급장비 사용에 관한 안내표지판을 부착하지 않은 경우
                      </td>
                      <td style={{ border: 'none', borderRight: '1px solid #999', padding: '4px', textAlign: 'center', fontSize: '7px' }}>
                        법 제62조<br/>제2항
                      </td>
                      <td style={{ border: 'none', borderRight: '1px solid #999', padding: '4px', textAlign: 'center' }}>30만원</td>
                      <td style={{ border: 'none', borderRight: '1px solid #999', padding: '4px', textAlign: 'center' }}>50만원</td>
                      <td style={{ border: 'none', padding: '4px', textAlign: 'center' }}>70만원</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
            <div style={{ fontSize: '7px', color: '#666', marginTop: '4px', textAlign: 'right' }}>
              응급의료에 관한 법률 시행령 [별표 2] 과태료의 부과기준
            </div>
          </div>
        </div>

        {/* 10. 서명 */}
        <div className="report-section" style={{ marginTop: '40px', paddingTop: '20px', borderTop: '2px solid #000', textAlign: 'right' }}>
          <p style={{ margin: 0, marginBottom: '5px', fontSize: '11px', color: '#333' }}>{formatDate(documentation.completed_time || new Date().toISOString())}</p>
          <p style={{ margin: 0, fontSize: '11px', color: '#333' }}>점검자: {user?.user_metadata?.name || user?.email || '-'}</p>
        </div>

        {/* 11. 하단 페이지 정보 */}
        <div className="report-section" style={{ marginTop: '30px', textAlign: 'center', fontSize: '9px', color: '#999' }}>
          <p>이 보고서는 oo보건소 자동심장충격기(AED) 정기점검 기록입니다.</p>
        </div>

        {/* 푸터 */}
        <div className="report-section" style={{ marginTop: '40px', paddingTop: '15px', borderTop: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '9px', color: '#666' }}></div>
          <div style={{ fontSize: '9px', color: '#666' }}>https://aed.pics</div>
        </div>

        {/* ===== 화면 모드: 기존 디자인 ��지 ===== */}

        {/* 공유 버튼 */}
        {isReportSharingSupported() && (
          <div className="screen-only flex gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex-1 rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              인쇄 / PDF 저장
            </button>
          </div>
        )}

        {/* 보고서 제목 (화면) */}
        <div className="screen-only text-center space-y-1 pb-4 border-b border-gray-600/50">
          <h2 className="text-2xl font-bold text-white">
            AED 점검 보고서
          </h2>
          <p className="text-sm text-gray-400">
            {formatDate(documentation.completed_time || new Date().toISOString())} 점검
          </p>
        </div>

        {/* 기관 및 점검자 정보 (화면) */}
        <div className="screen-only grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-gray-600/40 bg-gray-800/30 p-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">기관 정보</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">기관명</span>
                <span className="text-white font-medium">{deviceInfo.installation_institution || deviceInfo.installation_org || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">관리번호</span>
                <span className="text-white font-medium">{deviceInfo.management_number || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">장비연번</span>
                <span className="text-white font-medium">{deviceInfo.equipment_serial || deviceInfo.serial_number || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">관리책임자</span>
                <span className="text-white font-medium">{deviceInfo.manager || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">담당자 연락처</span>
                <span className="text-white font-medium text-xs">{deviceInfo.institution_contact || '-'}</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-600/40 bg-gray-800/30 p-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">점검자 정보</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">점검자</span>
                <span className="text-white font-medium">{user?.user_metadata?.name || user?.email || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">조직</span>
                <span className="text-white font-medium text-xs">{user?.user_metadata?.organization || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">점검완료</span>
                <span className="text-white font-medium text-xs">{formatKSTTime(documentation.completed_time || new Date().toISOString())}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 점검 결과 요약 (화면) */}
        <div className="screen-only">
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">점검 결과 요약</h3>
          <div className="grid grid-cols-4 gap-2">
            <div className="rounded-lg border border-green-600/40 bg-green-900/15 p-3 text-center">
              <div className="text-2xl font-bold text-green-400">{totalStats.matchedCount}</div>
              <div className="text-xs text-gray-400 mt-1">양호</div>
            </div>
            <div className="rounded-lg border border-yellow-600/40 bg-yellow-900/15 p-3 text-center">
              <div className="text-2xl font-bold text-yellow-400">{totalStats.modifiedCount}</div>
              <div className="text-xs text-gray-400 mt-1">수정</div>
            </div>
            <div className="rounded-lg border border-red-600/40 bg-red-900/15 p-3 text-center">
              <div className="text-2xl font-bold text-red-400">{totalStats.issuesCount}</div>
              <div className="text-xs text-gray-400 mt-1">불량</div>
            </div>
            <div className="rounded-lg border border-blue-600/40 bg-blue-900/15 p-3 text-center">
              <div className="text-2xl font-bold text-blue-400">{totalStats.photosCount}</div>
              <div className="text-xs text-gray-400 mt-1">사진</div>
            </div>
          </div>
        </div>

        {/* 양호 항목 (화면) */}
        {basicInfoSummary.matched.length + deviceInfoSummary.matched.length + storageChecklistSummary.matched.length > 0 && (
          <div className="screen-only rounded-lg border-l-4 border-l-green-500 border border-green-600/30 bg-green-900/10 p-3">
            <h3 className="text-sm font-semibold text-green-400 mb-2 flex items-center gap-2">
              <span>✓</span>
              <span>양호 항목 ({totalStats.matchedCount}개)</span>
            </h3>
            <div className="space-y-1">
              {[...basicInfoSummary.matched, ...deviceInfoSummary.matched, ...storageChecklistSummary.matched].map((item, idx) => (
                <div key={idx} className="text-sm text-gray-300 leading-relaxed">
                  • {typeof item === 'string' ? item : item.label}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 수정 항목 (화면) */}
        {basicInfoSummary.modified.length + deviceInfoSummary.modified.length > 0 && (
          <div className="screen-only rounded-lg border-l-4 border-l-yellow-500 border border-yellow-600/30 bg-yellow-900/10 p-3">
            <h3 className="text-sm font-semibold text-yellow-400 mb-3 flex items-center gap-2">
              <span>⚠</span>
              <span>수정 항목 ({totalStats.modifiedCount}개)</span>
            </h3>
            <div className="space-y-3">
              {[...basicInfoSummary.modified, ...deviceInfoSummary.modified].map((item, idx) => {
                const itemKey = `modified_${idx}`;
                const selectedAction = itemActions[itemKey];

                return (
                  <div key={idx} className="bg-gray-800/30 rounded-lg p-2.5 border border-gray-600/30">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="text-sm font-medium text-yellow-300">{item.label}</div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleItemAction(itemKey, 'onsite')}
                          className={`py-0.5 px-2 rounded text-[10px] font-medium transition-all whitespace-nowrap ${
                            selectedAction === 'onsite'
                              ? 'bg-green-600/40 border border-green-500 text-green-200'
                              : 'bg-gray-700/50 border border-gray-600 text-gray-400 hover:border-green-500'
                          }`}
                        >
                          현장권고
                        </button>
                        <button
                          type="button"
                          onClick={() => handleItemAction(itemKey, 'office')}
                          className={`py-0.5 px-2 rounded text-[10px] font-medium transition-all whitespace-nowrap ${
                            selectedAction === 'office'
                              ? 'bg-blue-600/40 border border-blue-500 text-blue-200'
                              : 'bg-gray-700/50 border border-gray-600 text-gray-400 hover:border-blue-500'
                          }`}
                        >
                          추후통보
                        </button>
                      </div>
                    </div>

                    {item.original ? (
                      <div className="space-y-1">
                        <div className="text-xs text-gray-400 leading-tight">
                          <span className="text-red-400 font-medium">원본:</span> {item.original}
                        </div>
                        <div className="text-xs text-gray-300 leading-tight flex items-start gap-1">
                          <span>→</span>
                          <div>
                            <span className="text-green-400 font-medium">수정:</span> {item.corrected}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-300 leading-tight">
                        {item.corrected}
                      </div>
                    )}

                    {item.reason && (
                      <div className="text-xs text-gray-500 mt-1 italic">
                        사유: {item.reason}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 불량 항목 (화면) */}
        {storageChecklistSummary.issues.length > 0 && (
          <div className="screen-only rounded-lg border-l-4 border-l-red-500 border border-red-600/30 bg-red-900/10 p-3">
            <h3 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
              <span>🔴</span>
              <span>보관함 불량 항목 ({totalStats.issuesCount}개) - 즉시 조치 필요</span>
            </h3>
            <div className="space-y-1">
              {storageChecklistSummary.issues.map((item, idx) => (
                <div key={idx} className="text-sm text-red-300 leading-relaxed">
                  • {item}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 첨부 자료 (화면) */}
        <div className="screen-only rounded-lg border border-gray-600/30 bg-gray-800/20 p-3">
          <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
            <span>📸</span>
            <span>첨부 자료</span>
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              { label: '시리얼번호', count: deviceInfoSummary.photos.includes('시리얼번호') ? 1 : 0 },
              { label: '배터리 제조일자', count: deviceInfoSummary.photos.includes('배터리 제조일자') ? 1 : 0 },
              { label: '본체 제조일자', count: deviceInfoSummary.photos.includes('본체 제조일자') ? 1 : 0 },
              { label: '보관함 사진', count: storageChecklistSummary.photos.includes('보관함 사진') ? 1 : 0 },
              { label: '안내표지 사진', count: storageChecklistSummary.photos.includes('안내표지 사진') ? 1 : 0 },
            ].map((photo, idx) => (
              <div key={idx} className={`rounded-lg p-2 text-center text-xs font-medium transition-colors ${
                photo.count > 0
                  ? 'bg-green-900/20 border border-green-600/30 text-green-400'
                  : 'bg-gray-700/20 border border-gray-600/30 text-gray-500'
              }`}>
                <div className="text-lg mb-0.5">{photo.count > 0 ? '✓' : '◯'}</div>
                {photo.label}
              </div>
            ))}
          </div>
        </div>

        {/* 권장 조치 사항 (화면) */}
        <div className={`screen-only rounded-lg border-l-4 p-3 ${
          recommendedAction.severity === 'high'
            ? 'border-l-red-500 border border-red-600/30 bg-red-900/10'
            : recommendedAction.severity === 'medium'
            ? 'border-l-yellow-500 border border-yellow-600/30 bg-yellow-900/10'
            : 'border-l-green-500 border border-green-600/30 bg-green-900/10'
        }`}>
          <h3 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${
            recommendedAction.severity === 'high' ? 'text-red-400' :
            recommendedAction.severity === 'medium' ? 'text-yellow-400' :
            'text-green-400'
          }`}>
            <span>🎯</span>
            <span>권장 조치 사항</span>
          </h3>
          <p className={`text-sm leading-relaxed ${
            recommendedAction.severity === 'high' ? 'text-red-300' :
            recommendedAction.severity === 'medium' ? 'text-yellow-300' :
            'text-green-300'
          }`}>
            {recommendedAction.reason}
          </p>
        </div>

        {/* 종합 의견 (화면) */}
        <div className="screen-only rounded-lg border border-gray-600/30 bg-gray-800/20 p-3 space-y-2">
          <label htmlFor="notes" className="block text-sm font-semibold text-gray-300 flex items-center gap-2">
            <span>💬</span>
            <span>점검 종합 의견</span>
          </label>
          <textarea
            id="notes"
            value={documentation.notes || ''}
            onChange={(e) => handleChange('notes', e.target.value)}
            rows={3}
            className="block w-full rounded-lg px-3 py-2 bg-gray-800/50 border border-gray-600/40 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            placeholder="점검 과정에서 발견한 특이사항이나 종합 의견을 작성하세요"
          />
        </div>

        {/* 점검자 확인 및 완료 시각 (화면) */}
        <div className="screen-only rounded-lg border border-gray-600/30 bg-gray-800/20 p-3 space-y-3">
          <div>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={documentation.inspector_confirmed || false}
                onChange={(e) => handleChange('inspector_confirmed', e.target.checked)}
                className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm font-medium text-gray-300">
                ✓ 위 내용이 정확함을 확인합니다
              </span>
            </label>
          </div>

          <div>
            <div className="text-sm font-medium text-gray-300 mb-1">
              점검 완료 시각
            </div>
            <div className="rounded-lg px-3 py-2 bg-gray-800/50 border border-gray-600/40 text-sm text-gray-200 font-medium">
              {formatKSTTime(documentation.completed_time || new Date().toISOString())}
            </div>
            <input
              type="datetime-local"
              id="completed_time"
              value={documentation.completed_time || new Date().toISOString().slice(0, 16)}
              onChange={(e) => handleChange('completed_time', e.target.value)}
              className="hidden"
            />
          </div>
        </div>

        {/* 경고 메시지 (화면) */}
        <div className="screen-only rounded-lg bg-yellow-900/20 border border-yellow-600/30 p-2.5">
          <p className="text-xs text-yellow-300 leading-relaxed">
            ⚠️ 점검 완료 후에도 재점검을 통해 내용을 수정할 수 있습니다. 모든 내용을 다시 확인해주세요.
          </p>
        </div>
      </div>
    </div>
  );
}
