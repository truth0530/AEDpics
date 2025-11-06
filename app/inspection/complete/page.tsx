'use client';

/**
 * 점검 완료 보고서 페이지
 * - 기존 MS Word 스타일 보고서 디자인 승계
 * - 모바일 환경과 PDF 출력 환경 모두 레이아웃 유지
 * - A4 용지 사이즈 최적화
 */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getInspectionHistory, type InspectionHistory } from '@/lib/inspections/session-utils';

export default function InspectionCompletePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const serial = searchParams.get('serial');

  const [inspection, setInspection] = useState<InspectionHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadInspection() {
      if (!serial) {
        setError('장비 연번이 제공되지 않았습니다.');
        setLoading(false);
        return;
      }

      try {
        // 최근 24시간 내 해당 장비의 점검 이력 조회
        const history = await getInspectionHistory(serial, 24);

        if (history.length === 0) {
          setError('점검 기록을 찾을 수 없습니다.');
          setLoading(false);
          return;
        }

        // 가장 최근 점검 기록 사용
        setInspection(history[0]);
        setLoading(false);
      } catch (err) {
        console.error('[InspectionCompletePage] 점검 기록 로드 실패:', err);
        setError('점검 기록을 불러오는 중 오류가 발생했습니다.');
        setLoading(false);
      }
    }

    loadInspection();
  }, [serial]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#6b7280' }}>
          <p>점검 보고서를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !inspection) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#ef4444', marginBottom: '16px' }}>{error || '점검 기록을 찾을 수 없습니다.'}</p>
          <button
            onClick={() => router.push('/inspection')}
            style={{ padding: '8px 16px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            점검 목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  // stepData 추출 (inspected_data)
  const stepData = inspection.step_data || {};
  const basicInfo = stepData.basicInfo || {};
  const deviceInfo = stepData.deviceInfo || {};
  const storage = stepData.storage || {};
  const documentation = stepData.documentation || {};

  // 원본 데이터 (original_data = session.device_info)
  const originalData = (inspection as any).original_data || {};

  // 날짜 포맷팅
  const formatKSTTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      // toLocaleString을 사용하여 정확한 한국 시간대 변환
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
      // toLocaleDateString을 사용하여 정확한 한국 날짜 변환
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

  // 불일치 항목 수집 (original_data와 비교)
  const mismatches: Array<{ field: string; original: string; edited: string }> = [];

  if (basicInfo.all_matched === 'edited') {
    if (basicInfo.manager !== originalData.manager) {
      mismatches.push({
        field: '관리책임자',
        original: originalData.manager || '-',
        edited: basicInfo.manager || '-',
      });
    }
    if (basicInfo.contact_info !== originalData.institution_contact) {
      mismatches.push({
        field: '연락처',
        original: originalData.institution_contact || '-',
        edited: basicInfo.contact_info || '-',
      });
    }
  }

  if (basicInfo.location_matched === 'edited') {
    if (basicInfo.address !== originalData.installation_address) {
      mismatches.push({
        field: '주소',
        original: originalData.installation_address || '-',
        edited: basicInfo.address || '-',
      });
    }
  }

  if (deviceInfo.all_matched === 'edited') {
    if (deviceInfo.manufacturer !== originalData.manufacturer) {
      mismatches.push({
        field: '제조사',
        original: originalData.manufacturer || '-',
        edited: deviceInfo.manufacturer || '-',
      });
    }
    if (deviceInfo.model_name !== originalData.model_name) {
      mismatches.push({
        field: '모델명',
        original: originalData.model_name || '-',
        edited: deviceInfo.model_name || '-',
      });
    }
  }

  if (deviceInfo.battery_expiry_date_matched === 'edited') {
    mismatches.push({
      field: '배터리 유효기간',
      original: originalData.battery_expiry_date || '-',
      edited: deviceInfo.battery_expiry_date || '-',
    });
  }

  if (deviceInfo.pad_expiry_date_matched === 'edited') {
    mismatches.push({
      field: '패드 유효기간',
      original: originalData.pad_expiry_date || '-',
      edited: deviceInfo.pad_expiry_date || '-',
    });
  }

  // 일치 항목 문자열 생성
  const matchedItems: string[] = [];
  if (basicInfo.all_matched === true || basicInfo.all_matched === 'edited') {
    matchedItems.push(`관리책임자: ${basicInfo.manager || originalData.manager || '-'}  |  분류체계: ${basicInfo.category_1 || originalData.category_1 || '-'} > ${basicInfo.category_2 || originalData.category_2 || '-'} > ${basicInfo.category_3 || originalData.category_3 || '-'}`);
  }
  if (basicInfo.location_matched === true || basicInfo.location_matched === 'edited') {
    matchedItems.push(`주소: ${basicInfo.address || originalData.installation_address || '-'}  |  GPS 좌표: ${(basicInfo.gps_latitude || originalData.latitude || originalData.gps_latitude)?.toFixed(6) || '-'}, ${(basicInfo.gps_longitude || originalData.longitude || originalData.gps_longitude)?.toFixed(6) || '-'}`);
  }
  if (deviceInfo.all_matched === true || deviceInfo.all_matched === 'edited') {
    matchedItems.push(`제조사: ${deviceInfo.manufacturer || originalData.manufacturer || '-'}  |  모델명: ${deviceInfo.model_name || originalData.model_name || '-'}  |  제조번호: ${deviceInfo.serial_number || originalData.serial_number || '-'}`);
  }
  if (deviceInfo.manufacturing_date_matched === true || deviceInfo.manufacturing_date_matched === 'edited') {
    matchedItems.push(`제조일자: ${deviceInfo.manufacturing_date || originalData.manufacturing_date || '-'}`);
  }
  if (deviceInfo.battery_expiry_date_matched === true || deviceInfo.battery_expiry_date_matched === 'edited') {
    matchedItems.push(`배터리 유효기간: ${deviceInfo.battery_expiry_date || originalData.battery_expiry_date || '-'}`);
  }
  if (deviceInfo.pad_expiry_date_matched === true || deviceInfo.pad_expiry_date_matched === 'edited') {
    matchedItems.push(`패드 유효기간: ${deviceInfo.pad_expiry_date || originalData.patch_expiry_date || originalData.pad_expiry_date || '-'}`);
  }
  if (storage.signage_selected && storage.signage_selected.length > 0) {
    matchedItems.push(`안내표지: ${storage.signage_selected.join(', ')}`);
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', padding: '16px' }}>
      <div style={{ maxWidth: '80rem', margin: '0 auto' }}>
        {/* 보고서 컨테이너 - A4 종이처럼 */}
        <div id="inspection-report-container" style={{ backgroundColor: 'white', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', padding: '20px', minHeight: '100vh', fontFamily: 'Noto Sans KR, Segoe UI, sans-serif', color: '#333', fontSize: '11px', lineHeight: 1.3 }}>
          <style>{`
            @media print {
              body { margin: 0; padding: 0; background: white; }
              #inspection-report-container {
                box-shadow: none !important;
                padding: 20px !important;
                margin: 0 !important;
                max-width: 100% !important;
              }
              .no-print { display: none !important; }
              .page-break { page-break-before: always; }
            }
            @media (max-width: 640px) {
              #inspection-report-container {
                padding: 12px !important;
                fontSize: 10px !important;
              }
            }
          `}</style>

          {/* 헤더 */}
          <div style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid #ddd' }}>
            <div style={{ fontSize: '9px', color: '#666' }}>
              보고서 생성 일시: {formatKSTTime(inspection.created_at)}
            </div>
          </div>

          {/* 보고서 제목 */}
          <div style={{ marginBottom: '20px', paddingBottom: '20px', paddingTop: '30px', borderBottom: '3px solid #1f2937', textAlign: 'center' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>
              2025년 자동심장충격기 현지점검 결과
            </h1>
          </div>

          {/* I. 점검 대상 정보 */}
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 'bold', color: '#1f2937', marginBottom: '10px' }}>
              I. 점검 대상 정보
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <tbody>
                <tr style={{ borderTop: '2px solid #333', borderBottom: '1px solid #9ca3af' }}>
                  <td style={{ backgroundColor: '#f3f4f6', padding: '8px', fontWeight: '500', width: '25%', borderRight: '1px solid #9ca3af' }}>설치기관</td>
                  <td style={{ padding: '8px', borderRight: '1px solid #9ca3af' }}>{originalData.installation_institution || originalData.installation_org || '-'}</td>
                  <td style={{ backgroundColor: '#f3f4f6', padding: '8px', fontWeight: '500', width: '25%', borderRight: '1px solid #9ca3af' }}>관리번호</td>
                  <td style={{ padding: '8px' }}>{originalData.management_number || '-'}</td>
                </tr>
                <tr style={{ borderBottom: '2px solid #333' }}>
                  <td style={{ backgroundColor: '#f3f4f6', padding: '8px', fontWeight: '500', borderRight: '1px solid #9ca3af' }}>장비연번</td>
                  <td style={{ padding: '8px', borderRight: '1px solid #9ca3af' }}>{inspection.equipment_serial}</td>
                  <td style={{ backgroundColor: '#f3f4f6', padding: '8px', fontWeight: '500', borderRight: '1px solid #9ca3af' }}>관리책임자</td>
                  <td style={{ padding: '8px' }}>{basicInfo.manager || originalData.manager || '-'} / {basicInfo.contact_info || originalData.institution_contact || '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* II. 점검 항목 */}
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 'bold', color: '#1f2937', marginBottom: '10px' }}>
              II. 점검 항목
            </h2>
            <div style={{ fontSize: '9px', fontWeight: 'bold', marginBottom: '8px', color: '#1f2937' }}>일치항목</div>

            {/* 정상 항목 */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', marginBottom: '12px' }}>
              <tbody>
                <tr style={{ borderTop: '2px solid #333', borderBottom: mismatches.length > 0 ? '1px solid #9ca3af' : '2px solid #333' }}>
                  <td style={{ padding: '6px', border: 'none', lineHeight: '1.6' }}>
                    {matchedItems.map((item, idx) => (
                      <div key={idx} style={{ marginBottom: idx < matchedItems.length - 1 ? '3px' : '0' }}>• {item}</div>
                    ))}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* 불일치 항목 */}
            {mismatches.length > 0 && (
              <div>
                <div style={{ fontSize: '9px', fontWeight: 'bold', marginBottom: '6px', color: '#1f2937' }}>불일치항목</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px' }}>
                  <thead>
                    <tr style={{ borderTop: '2px solid #333', borderBottom: '1px solid #9ca3af' }}>
                      <th style={{ backgroundColor: '#f3f4f6', padding: '4px', textAlign: 'center', fontWeight: 'bold', width: '25%', borderRight: '1px solid #9ca3af' }}>항목</th>
                      <th style={{ backgroundColor: '#f3f4f6', padding: '4px', textAlign: 'center', fontWeight: 'bold', width: '37.5%', borderRight: '1px solid #9ca3af' }}>원본값</th>
                      <th style={{ backgroundColor: '#f3f4f6', padding: '4px', textAlign: 'center', fontWeight: 'bold', width: '37.5%' }}>수정값</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mismatches.map((mismatch, idx) => (
                      <tr key={idx} style={{ borderBottom: idx === mismatches.length - 1 ? '2px solid #333' : '1px solid #9ca3af' }}>
                        <td style={{ padding: '4px', borderRight: '1px solid #9ca3af' }}>{mismatch.field}</td>
                        <td style={{ padding: '4px', borderRight: '1px solid #9ca3af' }}>{mismatch.original}</td>
                        <td style={{ padding: '4px' }}>{mismatch.edited}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* III. 점검 종합 의견 */}
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 'bold', color: '#1f2937', marginBottom: '10px' }}>
              III. 점검 종합 의견
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '10px' }}>
              <tbody>
                <tr style={{ borderTop: '2px solid #333', borderBottom: '2px solid #333' }}>
                  <td style={{ padding: '8px', border: 'none', color: '#333', lineHeight: 1.5 }}>
                    {documentation.notes || '특이사항 없음'}
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

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', color: '#333', marginTop: '6px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#e8e8e8', borderTop: '2px solid #333', borderBottom: '1px solid #999' }}>
                    <th rowSpan={2} style={{ padding: '4px', textAlign: 'center', fontWeight: 'bold', verticalAlign: 'middle', borderRight: '1px solid #999' }}>위반 행위</th>
                    <th rowSpan={2} style={{ padding: '4px', textAlign: 'center', fontWeight: 'bold', verticalAlign: 'middle', borderRight: '1px solid #999' }}>근거법조문</th>
                    <th colSpan={3} style={{ padding: '4px', textAlign: 'center', fontWeight: 'bold' }}>과태료 금액</th>
                  </tr>
                  <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '1px solid #999' }}>
                    <th style={{ padding: '4px', textAlign: 'center', fontWeight: 'bold', borderRight: '1px solid #999' }}>1차 위반</th>
                    <th style={{ padding: '4px', textAlign: 'center', fontWeight: 'bold', borderRight: '1px solid #999' }}>2차 위반</th>
                    <th style={{ padding: '4px', textAlign: 'center', fontWeight: 'bold' }}>3차 위반</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #999' }}>
                    <td style={{ padding: '4px', textAlign: 'left', lineHeight: '1.4', borderRight: '1px solid #999' }}>
                      법 제47조의2제1항을 위반하여 자동심장충격기 등 심폐소생술을 할 수 있는 응급장비를 갖추지 않은 경우
                    </td>
                    <td style={{ padding: '4px', textAlign: 'center', fontSize: '7px', borderRight: '1px solid #999' }}>
                      법 제62조<br/>제1항 제3호의 2
                    </td>
                    <td style={{ padding: '4px', textAlign: 'center', borderRight: '1px solid #999' }}>100만원</td>
                    <td style={{ padding: '4px', textAlign: 'center', borderRight: '1px solid #999' }}>150만원</td>
                    <td style={{ padding: '4px', textAlign: 'center' }}>200만원</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #999' }}>
                    <td style={{ padding: '4px', textAlign: 'left', lineHeight: '1.4', borderRight: '1px solid #999' }}>
                      법 제47조의2제2항을 위반하여 자동심장충격기 등 심폐소생술을 할 수 있는 응급장비의 설치 신고 또는 변경신고를 하지 않은 경우
                    </td>
                    <td style={{ padding: '4px', textAlign: 'center', fontSize: '7px', borderRight: '1px solid #999' }}>
                      법 제62조<br/>제1항 제3호의 4
                    </td>
                    <td style={{ padding: '4px', textAlign: 'center', borderRight: '1px solid #999' }}>50만원</td>
                    <td style={{ padding: '4px', textAlign: 'center', borderRight: '1px solid #999' }}>100만원</td>
                    <td style={{ padding: '4px', textAlign: 'center' }}>150만원</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #999' }}>
                    <td style={{ padding: '4px', textAlign: 'left', lineHeight: '1.4', borderRight: '1px solid #999' }}>
                      법 제47조의2제3항을 위반하여 자동심장충격기 등 심폐소생술을 할 수 있는 응급장비의 점검 결과를 통보하지 않은 경우
                    </td>
                    <td style={{ padding: '4px', textAlign: 'center', fontSize: '7px', borderRight: '1px solid #999' }}>
                      법 제62조<br/>제1항 제3호의 5
                    </td>
                    <td style={{ padding: '4px', textAlign: 'center', borderRight: '1px solid #999' }}>50만원</td>
                    <td style={{ padding: '4px', textAlign: 'center', borderRight: '1px solid #999' }}>75만원</td>
                    <td style={{ padding: '4px', textAlign: 'center' }}>100만원</td>
                  </tr>
                  <tr style={{ borderBottom: '2px solid #333' }}>
                    <td style={{ padding: '4px', textAlign: 'left', lineHeight: '1.4', borderRight: '1px solid #999' }}>
                      법 제47조의2제4항을 위반하여 자동심장충격기 등 심폐소생술을 할 수 있는 응급장비 사용에 관한 안내표지판을 부착하지 않은 경우
                    </td>
                    <td style={{ padding: '4px', textAlign: 'center', fontSize: '7px', borderRight: '1px solid #999' }}>
                      법 제62조<br/>제2항
                    </td>
                    <td style={{ padding: '4px', textAlign: 'center', borderRight: '1px solid #999' }}>30만원</td>
                    <td style={{ padding: '4px', textAlign: 'center', borderRight: '1px solid #999' }}>50만원</td>
                    <td style={{ padding: '4px', textAlign: 'center' }}>70만원</td>
                  </tr>
                </tbody>
              </table>

              <div style={{ fontSize: '7px', color: '#666', marginTop: '4px', textAlign: 'right' }}>
                응급의료에 관한 법률 시행령 [별표 2] 과태료의 부과기준
              </div>
            </div>
          </div>

          {/* 서명 */}
          <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '2px solid #1f2937', textAlign: 'right' }}>
            <p style={{ margin: 0, marginBottom: '5px', fontSize: '11px', color: '#333' }}>{formatDate(inspection.inspection_date)}</p>
            <p style={{ margin: 0, fontSize: '11px', color: '#333' }}>점검자: {inspection.inspector_name}</p>
          </div>

          {/* 푸터 */}
          <div style={{ marginTop: '40px', paddingTop: '15px', borderTop: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '9px', color: '#666' }}></div>
            <div style={{ fontSize: '9px', color: '#666' }}>https://aed.pics</div>
          </div>
        </div>

        {/* 프린트 버튼 (화면에만 표시) */}
        <div className="no-print" style={{ marginTop: '24px', display: 'flex', justifyContent: 'center', gap: '16px' }}>
          <button
            onClick={() => window.print()}
            style={{ padding: '8px 24px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: '500', transition: 'background-color 0.2s' }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#1d4ed8')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#2563eb')}
          >
            인쇄 / PDF 저장 (Ctrl+P)
          </button>
          <button
            onClick={() => router.push('/inspection')}
            style={{ padding: '8px 24px', backgroundColor: '#6b7280', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: '500', transition: 'background-color 0.2s' }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#4b5563')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#6b7280')}
          >
            점검 목록으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}
