'use client';

/**
 * 점검 완료 보고서 디자인 미리보기 페이지
 * MS Word 문서 형식의 정식 보고서 디자인
 */

import { useState } from 'react';

export default function InspectionPreviewPage() {
  const [completedTime] = useState(new Date().toISOString());

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
          `}</style>

          {/* ===== 헤더 ===== */}
          <div style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid #ddd' }}>
            <div style={{ fontSize: '9px', color: '#666' }}>
              보고서 생성 일시: {formatKSTTime(completedTime)}
            </div>
          </div>

          {/* ===== 1. 보고서 제목 ===== */}
          <div style={{ marginBottom: '20px', paddingBottom: '20px', paddingTop: '30px', borderBottom: '3px solid #1f2937', textAlign: 'center' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>
              2025년 자동심장충격기 현지점검 결과
            </h1>
          </div>

          {/* ===== 2. 기본 정보 테이블 (Ⅰ. 점검 대상 정보) ===== */}
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 'bold', color: '#1f2937', marginBottom: '10px' }}>
              Ⅰ. 점검 대상 정보
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <tbody>
                <tr style={{ borderTop: '2px solid #333', borderBottom: '1px solid #9ca3af' }}>
                  <td style={{ backgroundColor: '#f3f4f6', padding: '8px', fontWeight: '500', width: '25%', borderRight: '1px solid #9ca3af' }}>설치기관</td>
                  <td style={{ padding: '8px', borderRight: '1px solid #9ca3af' }}>서울시청</td>
                  <td style={{ backgroundColor: '#f3f4f6', padding: '8px', fontWeight: '500', width: '25%', borderRight: '1px solid #9ca3af' }}>관리번호</td>
                  <td style={{ padding: '8px' }}>AED-2025-001</td>
                </tr>
                <tr style={{ borderBottom: '2px solid #333' }}>
                  <td style={{ backgroundColor: '#f3f4f6', padding: '8px', fontWeight: '500', borderRight: '1px solid #9ca3af' }}>장비연번</td>
                  <td style={{ padding: '8px', borderRight: '1px solid #9ca3af' }}>SN20250001</td>
                  <td style={{ backgroundColor: '#f3f4f6', padding: '8px', fontWeight: '500', borderRight: '1px solid #9ca3af' }}>관리책임자</td>
                  <td style={{ padding: '8px' }}>김길동 / 02-1234-5678</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ===== 2. 점검 항목 (Ⅱ. 점검 항목) ===== */}
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 'bold', color: '#1f2937', marginBottom: '10px' }}>
              Ⅱ. 점검 항목
            </h2>
            <div style={{ fontSize: '9px', fontWeight: 'bold', marginBottom: '8px', color: '#1f2937' }}>일치항목</div>

            {/* 정상 항목 */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', marginBottom: '12px' }}>
              <tbody>
                <tr style={{ borderTop: '2px solid #333', borderBottom: '2px solid #333' }}>
                  <td style={{ padding: '6px', border: 'none', lineHeight: '1.6' }}>
                    <div style={{ marginBottom: '3px' }}>• 관리책임자: 김길동  |  분류체계: 공공기관 {`>`} 시청</div>
                    <div style={{ marginBottom: '3px' }}>• 주소: 서울시 중구 세종대로 110  |  GPS 좌표: 37.566102, 126.977041</div>
                    <div style={{ marginBottom: '3px' }}>• 제조사: Philips  |  모델명: HeartStart FR3  |  제조번호: PH202401001</div>
                    <div>• 제조일자: 2024-05-30  |  배터리 유효기간: 2026-05-30  |  패드 유효기간: 2026-05-30  |  안내표지: 양호</div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* 불일치 항목 */}
            <div>
              <div style={{ fontSize: '9px', fontWeight: 'bold', marginBottom: '6px', color: '#1f2937' }}>불일치항목</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px' }}>
                <thead>
                  <tr style={{ borderTop: '2px solid #333', borderBottom: '1px solid #9ca3af' }}>
                    <th style={{ backgroundColor: '#f3f4f6', padding: '4px', textAlign: 'center', fontWeight: 'bold', width: '20%', borderRight: '1px solid #9ca3af' }}>항목</th>
                    <th style={{ backgroundColor: '#f3f4f6', padding: '4px', textAlign: 'center', fontWeight: 'bold', width: '25%', borderRight: '1px solid #9ca3af' }}>원본값</th>
                    <th style={{ backgroundColor: '#f3f4f6', padding: '4px', textAlign: 'center', fontWeight: 'bold', width: '25%', borderRight: '1px solid #9ca3af' }}>수정값</th>
                    <th style={{ backgroundColor: '#f3f4f6', padding: '4px', textAlign: 'center', fontWeight: 'bold', width: '30%' }}>조치</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #9ca3af' }}>
                    <td style={{ padding: '4px', borderRight: '1px solid #9ca3af' }}>관리책임자</td>
                    <td style={{ padding: '4px', borderRight: '1px solid #9ca3af' }}>홍길동</td>
                    <td style={{ padding: '4px', borderRight: '1px solid #9ca3af' }}>김길동</td>
                    <td style={{ padding: '4px' }}>조직 개편 반영</td>
                  </tr>
                  <tr style={{ borderBottom: '2px solid #333' }}>
                    <td style={{ padding: '4px', borderRight: '1px solid #9ca3af' }}>배터리 유효기간</td>
                    <td style={{ padding: '4px', borderRight: '1px solid #9ca3af' }}>2025-01-15</td>
                    <td style={{ padding: '4px', borderRight: '1px solid #9ca3af' }}>2025-01-20</td>
                    <td style={{ padding: '4px' }}>실제 기한 확인</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ===== 3. 종합 의견 및 법조항 (Ⅲ. 점검 종합 의견) ===== */}
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 'bold', color: '#1f2937', marginBottom: '10px' }}>
              Ⅲ. 점검 종합 의견
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '10px' }}>
              <tbody>
                <tr style={{ borderTop: '2px solid #333', borderBottom: '2px solid #333' }}>
                  <td style={{ padding: '8px', border: 'none', color: '#333', lineHeight: 1.5 }}>
                    관리책임자가 변경될 경우 즉시 보건소로 연락주시기 바랍니다.
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

          {/* ===== 10. 서명 ===== */}
          <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '2px solid #1f2937', textAlign: 'right' }}>
            <p style={{ margin: 0, marginBottom: '5px', fontSize: '11px', color: '#333' }}>2025년 10월 21일</p>
            <p style={{ margin: 0, fontSize: '11px', color: '#333' }}>점검자: 이순신</p>
          </div>

          {/* ===== 푸터 ===== */}
          <div style={{ marginTop: '40px', paddingTop: '15px', borderTop: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '9px', color: '#666' }}></div>
            <div style={{ fontSize: '9px', color: '#666' }}>https://aed.pics</div>
          </div>
        </div>

        {/* 프린트 버튼 (화면에만 표시) */}
        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center', gap: '16px' }}>
          <button
            onClick={() => window.print()}
            style={{ padding: '8px 24px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: '500', transition: 'background-color 0.2s' }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
          >
            인쇄 / PDF 저장 (Ctrl+P)
          </button>
        </div>

      </div>
    </div>
  );
}
