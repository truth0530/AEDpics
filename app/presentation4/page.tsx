import Link from 'next/link';

export default function Presentation4Page() {
  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        /* 전문적이고 차분한 색상 팔레트 적용 */
        * {
          color: #1a202c;
        }

        h1, h2, h3, h4, h5, h6 {
          color: #2d3748 !important;
          line-height: 1.3;
          letter-spacing: -0.025em;
        }

        p, li, td, th, span, div {
          color: #4a5568 !important;
          line-height: 1.6;
        }

        /* 정보 박스 스타일 - 더 차분하고 전문적인 느낌 */
        .source-box {
          background: linear-gradient(135deg, #ffffff 0%, #f7fafc 100%);
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 28px 32px;
          margin: 24px 0;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
          position: relative;
        }

        .source-box::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          width: 4px;
          height: 100%;
          background: linear-gradient(to bottom, #4299e1, #63b3ed);
          border-radius: 4px 0 0 4px;
        }

        .source-title {
          font-weight: 600;
          color: #2b6cb0 !important;
          margin-bottom: 16px;
          font-size: 1.125rem;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 8px;
        }

        /* 시스템 비교 섹션 */
        .system-comparison {
          background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
          border: 1px solid #cbd5e0;
          border-radius: 12px;
          padding: 32px;
          margin: 32px 0;
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08);
        }

        /* 도식도 컨테이너 개선 */
        .diagram-container {
          text-align: center;
          margin: 40px 0;
          padding: 32px;
          border: 1px solid #cbd5e0;
          border-radius: 12px;
          background: linear-gradient(135deg, #ffffff 0%, #f7fafc 100%);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.06);
        }

        /* 장단점 비교 */
        .pros-cons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 28px;
          margin: 28px 0;
        }

        .pros {
          background: #f0fff4;
          border-left: 4px solid #38b2ac;
          padding: 24px;
          border-radius: 8px;
          border: 1px solid #b2f5ea;
          box-shadow: 0 4px 12px rgba(56, 178, 172, 0.15);
        }

        .cons {
          background: #fef5e7;
          border-left: 4px solid #ed8936;
          padding: 24px;
          border-radius: 8px;
          border: 1px solid #fbd38d;
          box-shadow: 0 4px 12px rgba(237, 137, 54, 0.15);
        }

        /* 권장사항 박스 - 차분한 스타일로 변경 */
        .recommendation {
          background: #f8fafc;
          border: 1px solid #cbd5e0;
          border-radius: 8px;
          padding: 28px;
          margin: 28px 0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }

        /* 기능 카드 그리드 */
        .feature-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
          gap: 28px;
          margin: 32px 0;
        }

        .feature-card {
          background: linear-gradient(135deg, #ffffff 0%, #f7fafc 100%);
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 28px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .feature-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, #4299e1, #63b3ed, #90cdf4);
        }

        .feature-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
          border-color: #4299e1;
        }

        /* 비교 테이블 개선 */
        .comparison-table {
          width: 100%;
          border-collapse: collapse;
          margin: 32px 0;
          font-size: 14px;
          background-color: #ffffff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08);
        }

        .comparison-table th,
        .comparison-table td {
          border: 1px solid #e2e8f0;
          padding: 18px 20px;
          text-align: left;
          color: #4a5568 !important;
        }

        .comparison-table th {
          background: linear-gradient(135deg, #edf2f7 0%, #e2e8f0 100%);
          font-weight: 600;
          color: #2d3748 !important;
          border-bottom: 2px solid #cbd5e0;
          text-transform: uppercase;
          font-size: 12px;
          letter-spacing: 0.05em;
        }

        .comparison-table tr:nth-child(even) {
          background-color: #f7fafc;
        }

        .comparison-table tr:hover {
          background: linear-gradient(135deg, #ebf8ff 0%, #e6fffa 100%);
          transform: scale(1.01);
          transition: all 0.2s ease;
        }

        /* 강조 박스 색상 조정 */
        .bg-blue-50 {
          background: linear-gradient(135deg, #ebf8ff 0%, #e6fffa 100%) !important;
          border: 1px solid #90cdf4 !important;
          color: #2b6cb0 !important;
        }

        .bg-green-50 {
          background: linear-gradient(135deg, #f0fff4 0%, #e6fffa 100%) !important;
          border: 1px solid #68d391 !important;
          color: #2f855a !important;
        }

        .bg-gray-50 {
          background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%) !important;
          border: 1px solid #cbd5e0 !important;
          color: #4a5568 !important;
        }

        .bg-blue-50 *, .bg-green-50 *, .bg-gray-50 * {
          color: inherit !important;
        }

        /* 링크 스타일 */
        a {
          color: #2b6cb0 !important;
          text-decoration: none;
          transition: color 0.2s ease;
        }

        a:hover {
          color: #2c5282 !important;
          text-decoration: underline;
        }

        /* 반응형 디자인 */
        @media (max-width: 1024px) {
          .feature-grid {
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
          }

          .comparison-table {
            font-size: 13px;
          }

          .comparison-table th,
          .comparison-table td {
            padding: 14px 16px;
          }
        }

        @media (max-width: 768px) {
          .pros-cons {
            grid-template-columns: 1fr;
            gap: 20px;
          }

          .feature-grid {
            grid-template-columns: 1fr;
            gap: 20px;
          }

          .comparison-table {
            font-size: 12px;
            display: block;
            overflow-x: auto;
            white-space: nowrap;
          }

          .comparison-table thead,
          .comparison-table tbody,
          .comparison-table th,
          .comparison-table td,
          .comparison-table tr {
            display: block;
          }

          .comparison-table thead tr {
            position: absolute;
            top: -9999px;
            left: -9999px;
          }

          .comparison-table tr {
            border: 1px solid #e2e8f0;
            margin-bottom: 10px;
            padding: 12px;
            border-radius: 8px;
            background: #ffffff;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
          }

          .comparison-table td {
            border: none;
            position: relative;
            padding-left: 100px !important;
            padding-top: 8px;
            padding-bottom: 8px;
            white-space: normal;
            text-align: left !important;
          }

          .comparison-table td:before {
            content: attr(data-label) ": ";
            position: absolute;
            left: 6px;
            width: 85px;
            padding-right: 10px;
            white-space: nowrap;
            font-weight: 600;
            color: #2d3748 !important;
          }

          .source-box, .system-comparison, .recommendation {
            padding: 16px 20px;
            margin: 16px 0;
          }

          .source-title {
            font-size: 1rem;
            margin-bottom: 12px;
          }

          .feature-card {
            padding: 20px;
          }

          .diagram-container {
            padding: 20px 16px;
            margin: 24px 0;
          }

          .diagram-container svg {
            width: 100%;
            height: auto;
            max-width: 100%;
          }
        }

        @media (max-width: 480px) {
          .comparison-table {
            font-size: 11px;
          }

          .comparison-table td {
            padding-left: 90px !important;
          }

          .comparison-table td:before {
            width: 80px;
            font-size: 10px;
          }

          .source-box, .system-comparison, .recommendation, .feature-card {
            padding: 16px;
          }

          .diagram-container {
            padding: 16px 12px;
          }

          h1 {
            font-size: 1.75rem !important;
            line-height: 1.2;
          }

          h2 {
            font-size: 1.5rem !important;
          }

          h3 {
            font-size: 1.25rem !important;
          }

          h4 {
            font-size: 1.1rem !important;
          }
        }

        /* 추가 전문적 요소 */
        .section-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, #cbd5e0, transparent);
          margin: 40px 0;
        }

        /* 텍스트 그라데이션 효과 */
        .gradient-text {
          background: linear-gradient(135deg, #2b6cb0, #4299e1);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
      `}</style>

      <div className="max-w-6xl mx-auto bg-white shadow-xl rounded-xl p-4 sm:p-6 md:p-8 lg:p-12 m-2 sm:m-4">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 text-center border-b-4 border-blue-600 pb-4 sm:pb-6 mb-6 sm:mb-8 lg:mb-10">
          AED 관리 시스템별 역할 및 스마트 모니터링 대시보드의 가치
        </h1>

        <div className="bg-blue-50 rounded-lg p-6 mb-8">
  <h2 className="text-2xl font-bold text-gray-800 mb-4">요약</h2>
  <p className="mb-3"><strong>현재 AED 정보는 새올행정시스템(민원 신고), 인트라넷(내부 관리), 월별 점검(관리책임자), 외부통계, 보건소 현장점검 등 5개 채널을 통해 수집되지만 체계적으로 통합되지 못하고 있음. E-gen 서비스는 일부 데이터만 연계되어 종합적인 데이터 기반 의사결정에 한계가 있음.</strong></p>
  <p className="mb-3"><strong>인트라넷과 E-gen은 동일한 데이터를 활용하지만 목적이 상이함. 인트라넷은 데이터 입력·수정 위주의 관리 시스템인 반면 새올행정 시스템과 관리책임자의 점검결과에 상당부분 의존적으로 관리되며, E-gen은 인트라넷에서 가공된 최종 자료가 시민들이 지도에서 AED 위치와 기본 정보를 확인하는 단순 조회 서비스.</strong></p>
  <p className="mb-3"><strong>E-gen은 3가지 출처(새올, 월별점검, 인트라넷)에 의존적이지만 2가지 외부 출처(보건소 현장점검, 외부 통계자료)와는 단절되어 최종 완성된 자료로도 심층 분석이 불가능한 상황. &apos;AED 스마트 모니터링 대시보드&apos;는 E-gen의 단순 조회 기능을 넘어 빅데이터 기반의 취약지역 분석, 실시간 모니터링, 고도화된 시각화를 제공하여 정책 수립과 현장 대응력을 획기적으로 개선하는 시스템.</strong></p>
  <p><strong>AED 스마트 모니터링 대시보드는 기존 정책과 시스템 변경 없이 신속하고 경제적으로 구축 가능. 인트라넷과 E-gen에서 가공된 모든 데이터와 단절된 데이터를 모두 통합하여 차세대 서비스를 제공하고 향후 통합 시스템 고도화의 로드맵을 제시.</strong></p>
</div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 border-l-4 border-blue-600 pl-3 sm:pl-4 mt-6 sm:mt-8 lg:mt-10 mb-4 sm:mb-6">
          2. 현재 시스템별 비교
        </h2>

        <div className="system-comparison">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>시스템</th>
                <th>사용자</th>
                <th>정보 형태</th>
                <th>특징</th>
                <th>분석/예측</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td data-label="시스템"><strong>새올행정시스템</strong></td>
                <td data-label="사용자">보건소 담당자</td>
                <td data-label="정보 형태">민원 서식 기반 단편 정보</td>
                <td data-label="특징">민원처리 시스템</td>
                <td data-label="분석/예측">불가</td>
              </tr>
              <tr>
                <td data-label="시스템"><strong>인트라넷</strong></td>
                <td data-label="사용자">중앙응급의료센터, 지자체</td>
                <td data-label="정보 형태"><strong>새올정보, 월별 점검 기반 수신된 데이터</strong></td>
                <td data-label="특징">3가지 출처 통합(새올, 월별 점검, 지원센터 직접관리)</td>
                <td data-label="분석/예측">불가</td>
              </tr>
              <tr>
                <td data-label="시스템"><strong>E-gen</strong></td>
                <td data-label="사용자"><strong>대국민 안내</strong></td>
                <td data-label="정보 형태">E-gen(안내용) 지도 위 위치, 연락처</td>
                <td data-label="특징"><strong>인트라넷 기반 안내</strong></td>
                <td data-label="분석/예측">불가</td>
              </tr>
              <tr>
                <td data-label="시스템"><strong>월별점검</strong></td>
                <td data-label="사용자">관리책임자</td>
                <td data-label="정보 형태"><strong>E-gen(책임자용)</strong></td>
                <td data-label="특징">월 1회 입력</td>
                <td data-label="분석/예측">불가</td>
              </tr>
              <tr>
                <td data-label="시스템"><strong>외부통계</strong></td>
                <td data-label="사용자">통계청, 외부 데이터구매</td>
                <td data-label="정보 형태"><strong>인구, 면적, 발생장소, 유동인구 등</strong></td>
                <td data-label="특징">지표를 위한 외부 자료</td>
                <td data-label="분석/예측">불가</td>
              </tr>
            </tbody>
          </table>
        </div>


        <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 rounded-xl p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="overflow-x-auto">
            <table className="comparison-table w-full border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-green-100 to-blue-100">
                  <th className="text-green-800 font-bold">혁신 시스템</th>
                  <th className="text-green-800 font-bold">통합 사용자</th>
                  <th className="text-green-800 font-bold">고도화된 정보</th>
                  <th className="text-green-800 font-bold">핵심 특징</th>
                  <th className="text-green-800 font-bold">분석/예측</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-gradient-to-r from-green-25 to-blue-25">
                  <td data-label="시스템" className="font-bold text-green-800 text-lg">
                    <span className="inline-block w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                    AED 스마트 모니터링 대시보드
                  </td>
                  <td data-label="사용자" className="font-bold text-blue-800">
                    <span className="text-green-600">✓</span> 모두통합
                    <div className="text-sm text-gray-600 mt-1">
                      (보건소, 지자체, 대국민, 정책입안자)
                    </div>
                  </td>
                  <td data-label="정보 형태" className="font-bold text-blue-800">
                    <span className="text-green-600">✓</span> 시각화 차트, 통계 지도
                    <div className="text-sm text-gray-600 mt-1">
                      현황 분석, 예측, 행정 지원
                    </div>
                  </td>
                  <td data-label="특징" className="font-bold text-blue-800">
                    <span className="text-green-600">✓</span> E-gen 한계 개선
                    <div className="text-sm text-gray-600 mt-1">
                      (직관적 현황 파악, 선제적 관리)
                    </div>
                  </td>
                  <td data-label="분석/예측" className="font-bold text-green-800 text-center">
                    <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-bold">
                      가능 (핵심 기능)
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-4 p-3 bg-white rounded-lg border border-green-200">
            <p className="text-center text-gray-700 font-medium">
              <span className="text-green-600 font-bold">포인트:</span>
              기존 5개 데이터를 통합하여 차세대 AED 관리 플랫폼 구현
            </p>
          </div>
        </div>

        <h4 className="text-base sm:text-lg font-semibold text-gray-700 mt-6 sm:mt-8 mb-3 sm:mb-4 border-l-4 border-blue-500 pl-3 sm:pl-4">인트라넷과 E-gen의 관계</h4>

        <div className="mb-4 p-3 sm:p-4 bg-blue-50 border-l-4 border-blue-400 rounded">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-3">
            <div>
              <strong>인트라넷</strong>: 직원들이 사용하는 관리시스템<br />
              <span className="text-sm text-gray-600">(데이터 입력·수정·관리)</span>
            </div>
            <div>
              <strong>E-GEN</strong>: 일반 국민이 사용하는 서비스<br />
              <span className="text-sm text-gray-600">(지도에서 AED 위치 확인)</span>
            </div>
          </div>
          <div className="text-center text-sm text-gray-600 border-t pt-2">
            <strong>※ 같은 데이터를 사용하지만 용도가 다르며 이하 &apos;인트라넷(E-gen)&apos;으로 표현함</strong>
          </div>
        </div>

        <h4 className="text-base sm:text-lg font-semibold text-gray-700 mt-6 sm:mt-8 mb-3 sm:mb-4 border-l-4 border-teal-500 pl-3 sm:pl-4">E-gen - 대국민 서비스 시스템</h4>

        <ul className="list-disc ml-4 sm:ml-5 space-y-2">
          <li><strong>핵심 목적:</strong> <strong>대국민 위치 안내</strong></li>
          <li><strong>주요 사용자:</strong> 일반 시민, 응급상황에 처한 누구나</li>
          <li><strong>정보의 역할:</strong> 응급상황 발생 시 &quot;가장 가까운 AED가 어디 있는가?&quot;라는 질문에 답을 주는 <strong>&apos;응급실 안내 지도&apos;</strong>임</li>
          <li><strong>특징:</strong> <strong>대국민 대상 포털사이트</strong>로, 간단한 지도 위에 일정 반경 내의 AED 위치를 표시하고, <strong>전화번호, 상세 위치, 운영시간에 대한 간단한 정보만</strong>을 보여주는 데 집중함</li>
        </ul>

        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 border-l-4 border-blue-600 pl-3 sm:pl-4 mt-6 sm:mt-8 lg:mt-10 mb-4 sm:mb-6">
          3. 현재 인트라넷(E-gen) 시스템 구조 분석
        </h2>

        <p className="mb-4 text-justify">
          자동심장충격기(AED)의 효율적인 관리는 국민의 생명과 직결되는 중요한 과제임. 현재 AED 정보는 여러 시스템을 통해 관리되고 있으며, 각 시스템은 고유의 목적과 역할을 가지고 있음:
        </p>


        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mt-6 sm:mt-8 mb-3 sm:mb-4">3.1 데이터 출처별 분류</h3>

        <p className="mb-4">현재 인트라넷 시스템의 데이터는 다음 3가지 주요 출처에 의해 구성되고 있음:</p>

        <div className="source-box">
          <div className="source-title">출처 1: 새올행정시스템 연동 정보</div>
          <ul className="list-disc ml-4 sm:ml-5 space-y-1 sm:space-y-2">
            <li>법적 절차와 서식에 따라 신고된 공식 정보<br />
              <span className="text-xs text-gray-600 italic">[별지 제15호의13서식] 응급장비 설치 신고서(응급의료에 관한 법률 시행규칙)</span></li>
            <li>새올행정시스템에서만 관리 가능한 데이터</li>
            <li>인트라넷(E-gen)과의 자동 또는 수동 매칭 구조로 운영</li>
            <li><strong>정보의 역할:</strong> 법적 서식인 &apos;응급장비 신고서&apos;를 시스템에 입력하기 위한 것으로, <strong>아주 간단한 기본 정보</strong>로만 이루어진 AED의 <strong>&apos;호적 등본&apos;</strong>과 같음</li>
            <li><strong>주요 사용자:</strong> 지자체(보건소) 행정 담당자</li>
            <li><strong>특징:</strong> 법적 신고 시에만 사용하는 시스템으로, AED의 최초 및 폐기 등의 등록 정보를 기록하는 데 그 목적이 있음</li>
          </ul>
        </div>

        <div className="source-box">
          <div className="source-title">출처 2: 관리책임자 검증 정보</div>
          <ul className="list-disc ml-4 sm:ml-5 space-y-1 sm:space-y-2">
            <li>법적 서식과 무관한 정보</li>
            <li>새올시스템 기반 데이터를 관리책임자가 매월 점검</li>
            <li>유효기간, 좌표 등 일부 정보의 반영</li>
            <li><strong>정보의 역할:</strong> AED의 모든 상세 정보와 이력이 담겨있는 <strong>&apos;상세 진료 기록부&apos;</strong>와 같음</li>
            <li><strong>주요 사용자:</strong> 지자체 담당자, 중앙응급의료센터 및 응급의료지원센터 담당자, AED 관리책임자 및 점검자</li>
            <li><strong>특징:</strong> AED 관리책임자는 <strong>매월 인트라넷(E-gen)에 로그인하여 AED 점검 결과</strong>를 남기며, 이 정보들은 개별 장비 정보에 <strong>텍스트 형태로 계속 쌓이고 있음</strong></li>
          </ul>
        </div>

        <div className="source-box">
          <div className="source-title">출처 3: 응급의료지원센터 직접 관리 정보</div>
          <ul className="list-disc ml-4 sm:ml-5 space-y-1 sm:space-y-2">
            <li>법적서식과 관리책임자와 별개의 절차</li>
            <li>자동/수동 매칭 절차 수행(새올과 인트라넷 연계과정)</li>
            <li>일부 정보에 대한 직접 수정 권한</li>
            <li><strong>특징:</strong> 보건소에서 &apos;새올&apos;에 기본 정보를 입력하면, <strong>응급의료지원센터 담당자가 수동으로 정보를 매칭</strong>해야만 인트라넷에 정보가 반영되고, 이후 E-gen에서 서비스됨</li>
          </ul>
        </div>


        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mt-6 sm:mt-8 mb-3 sm:mb-4">3.2 인트라넷 3가지 출처 통합 구조</h3>

        <p className="mb-4">3가지 출처를 통해 인트라넷 시스템으로 통합되어 관리되는 복잡한 흐름에 대한 이해가 필요함. 이 시스템에서 가공된 데이터가 E-gen을 통해 대국민에게 서비스됨</p>

        <div className="diagram-container">
          <svg width="900" height="600" viewBox="0 0 900 600" xmlns="http://www.w3.org/2000/svg">
            <defs>
              {/* 차분하고 전문적인 색상 그라데이션 */}
              <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{stopColor:"#2563eb", stopOpacity:1}} />
                <stop offset="100%" style={{stopColor:"#1d4ed8", stopOpacity:1}} />
              </linearGradient>
              <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{stopColor:"#0891b2", stopOpacity:1}} />
                <stop offset="100%" style={{stopColor:"#0e7490", stopOpacity:1}} />
              </linearGradient>
              <linearGradient id="grad3" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{stopColor:"#059669", stopOpacity:1}} />
                <stop offset="100%" style={{stopColor:"#047857", stopOpacity:1}} />
              </linearGradient>
              <linearGradient id="gradCenter" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{stopColor:"#4338ca", stopOpacity:1}} />
                <stop offset="100%" style={{stopColor:"#3730a3", stopOpacity:1}} />
              </linearGradient>
              <linearGradient id="gradDisconnected1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{stopColor:"#dc2626", stopOpacity:0.8}} />
                <stop offset="100%" style={{stopColor:"#b91c1c", stopOpacity:0.8}} />
              </linearGradient>
              <linearGradient id="gradDisconnected2" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{stopColor:"#ea580c", stopOpacity:0.8}} />
                <stop offset="100%" style={{stopColor:"#c2410c", stopOpacity:0.8}} />
              </linearGradient>

              {/* 화살표 마커 */}
              <marker id="arrowhead1" markerWidth="12" markerHeight="8" refX="11" refY="4" orient="auto" markerUnits="strokeWidth">
                <polygon points="0 0, 12 4, 0 8" fill="#2563eb" stroke="#1d4ed8" strokeWidth="0.5"/>
              </marker>
              <marker id="arrowhead2" markerWidth="12" markerHeight="8" refX="11" refY="4" orient="auto" markerUnits="strokeWidth">
                <polygon points="0 0, 12 4, 0 8" fill="#0891b2" stroke="#0e7490" strokeWidth="0.5"/>
              </marker>
              <marker id="arrowhead3" markerWidth="12" markerHeight="8" refX="11" refY="4" orient="auto" markerUnits="strokeWidth">
                <polygon points="0 0, 12 4, 0 8" fill="#059669" stroke="#047857" strokeWidth="0.5"/>
              </marker>

              {/* 그림자 필터 */}
              <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="2" dy="4" stdDeviation="3" floodColor="#000000" floodOpacity="0.15"/>
              </filter>
            </defs>

            <text x="450" y="30" fontFamily="system-ui, -apple-system, sans-serif" fontSize="22" fontWeight="600" textAnchor="middle" fill="#374151" letterSpacing="-0.025em">데이터 출처별 통합 체계</text>

            {/* 출처 1 박스 */}
            <rect x="100" y="60" width="200" height="100" rx="12" fill="url(#grad1)" stroke="#1e40af" strokeWidth="1" filter="url(#dropShadow)"/>
            <text x="200" y="85" fontFamily="system-ui, sans-serif" fontSize="14" fontWeight="600" textAnchor="middle" fill="white">출처 1</text>
            <text x="200" y="105" fontFamily="system-ui, sans-serif" fontSize="13" textAnchor="middle" fill="#e0e7ff">새올행정시스템</text>
            <text x="200" y="120" fontFamily="system-ui, sans-serif" fontSize="13" textAnchor="middle" fill="#e0e7ff">연동 정보</text>
            <text x="200" y="140" fontFamily="system-ui, sans-serif" fontSize="10" textAnchor="middle" fill="#c7d2fe">법적 절차 및 서식</text>

            {/* 출처 2 박스 */}
            <rect x="350" y="60" width="200" height="100" rx="12" fill="url(#grad2)" stroke="#0369a1" strokeWidth="1" filter="url(#dropShadow)"/>
            <text x="450" y="85" fontFamily="system-ui, sans-serif" fontSize="14" fontWeight="600" textAnchor="middle" fill="white">출처 2</text>
            <text x="450" y="105" fontFamily="system-ui, sans-serif" fontSize="13" textAnchor="middle" fill="#cffafe">관리책임자</text>
            <text x="450" y="120" fontFamily="system-ui, sans-serif" fontSize="13" textAnchor="middle" fill="#cffafe">검증 정보</text>
            <text x="450" y="140" fontFamily="system-ui, sans-serif" fontSize="10" textAnchor="middle" fill="#a5f3fc">매월 점검 및 보완</text>

            {/* 출처 3 박스 */}
            <rect x="600" y="60" width="200" height="100" rx="12" fill="url(#grad3)" stroke="#065f46" strokeWidth="1" filter="url(#dropShadow)"/>
            <text x="700" y="85" fontFamily="system-ui, sans-serif" fontSize="14" fontWeight="600" textAnchor="middle" fill="white">출처 3</text>
            <text x="700" y="105" fontFamily="system-ui, sans-serif" fontSize="13" textAnchor="middle" fill="#d1fae5">응급의료지원센터</text>
            <text x="700" y="120" fontFamily="system-ui, sans-serif" fontSize="13" textAnchor="middle" fill="#d1fae5">직접 관리</text>
            <text x="700" y="140" fontFamily="system-ui, sans-serif" fontSize="10" textAnchor="middle" fill="#bbf7d0">실시간 업데이트</text>

            {/* 연결 화살표 - 더 부드러운 곡선 */}
            <path d="M 200 170 Q 200 210 380 250" stroke="#2563eb" strokeWidth="2.5" fill="none" markerEnd="url(#arrowhead1)" opacity="0.9"/>
            <path d="M 450 170 L 450 250" stroke="#0891b2" strokeWidth="2.5" fill="none" markerEnd="url(#arrowhead2)" opacity="0.9"/>
            <path d="M 700 170 Q 700 210 520 250" stroke="#059669" strokeWidth="2.5" fill="none" markerEnd="url(#arrowhead3)" opacity="0.9"/>

            {/* 중앙 통합 시스템 박스 */}
            <rect x="300" y="260" width="300" height="120" rx="16" fill="url(#gradCenter)" stroke="#312e81" strokeWidth="2" filter="url(#dropShadow)"/>
            <text x="450" y="290" fontFamily="system-ui, sans-serif" fontSize="18" fontWeight="700" textAnchor="middle" fill="white">인트라넷(E-gen) 시스템</text>
            <text x="450" y="315" fontFamily="system-ui, sans-serif" fontSize="14" textAnchor="middle" fill="#e0e7ff">통합 데이터베이스</text>
            <text x="450" y="335" fontFamily="system-ui, sans-serif" fontSize="11" textAnchor="middle" fill="#c7d2fe">자동 매칭 구조</text>
            <text x="450" y="350" fontFamily="system-ui, sans-serif" fontSize="11" textAnchor="middle" fill="#c7d2fe">품질관리 프로세스</text>
            <text x="450" y="365" fontFamily="system-ui, sans-serif" fontSize="11" textAnchor="middle" fill="#c7d2fe">실시간 정보 관리</text>

            {/* 분리된 시스템들 */}
            <rect x="150" y="450" width="180" height="90" rx="12" fill="url(#gradDisconnected1)" stroke="#991b1b" strokeWidth="1" strokeDasharray="4,2" filter="url(#dropShadow)" opacity="0.9"/>
            <text x="240" y="475" fontFamily="system-ui, sans-serif" fontSize="14" fontWeight="600" textAnchor="middle" fill="white">보건소</text>
            <text x="240" y="490" fontFamily="system-ui, sans-serif" fontSize="14" fontWeight="600" textAnchor="middle" fill="white">현장점검</text>
            <text x="240" y="510" fontFamily="system-ui, sans-serif" fontSize="11" textAnchor="middle" fill="#fecaca">분산 관리</text>
            <text x="240" y="525" fontFamily="system-ui, sans-serif" fontSize="10" textAnchor="middle" fill="#fecaca">엑셀 기반 별도 관리</text>

            <rect x="570" y="450" width="180" height="90" rx="12" fill="url(#gradDisconnected2)" stroke="#9a3412" strokeWidth="1" strokeDasharray="4,2" filter="url(#dropShadow)" opacity="0.9"/>
            <text x="660" y="475" fontFamily="system-ui, sans-serif" fontSize="14" fontWeight="600" textAnchor="middle" fill="white">외부</text>
            <text x="660" y="490" fontFamily="system-ui, sans-serif" fontSize="14" fontWeight="600" textAnchor="middle" fill="white">통계지표</text>
            <text x="660" y="510" fontFamily="system-ui, sans-serif" fontSize="11" textAnchor="middle" fill="#fed7aa">분산 관리</text>
            <text x="660" y="525" fontFamily="system-ui, sans-serif" fontSize="10" textAnchor="middle" fill="#fed7aa">통계청 기반 데이터</text>

            {/* 단절 표시 - 더 시각적으로 */}
            <path d="M 240 440 L 240 395" stroke="#94a3b8" strokeWidth="2" strokeDasharray="6,4" fill="none" opacity="0.7"/>
            <circle cx="240" cy="417" r="12" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1"/>
            <text x="240" y="421" fontFamily="system-ui, sans-serif" fontSize="9" fontWeight="500" textAnchor="middle" fill="#64748b">단절</text>

            <path d="M 660 440 L 660 395" stroke="#94a3b8" strokeWidth="2" strokeDasharray="6,4" fill="none" opacity="0.7"/>
            <circle cx="660" cy="417" r="12" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1"/>
            <text x="660" y="421" fontFamily="system-ui, sans-serif" fontSize="9" fontWeight="500" textAnchor="middle" fill="#64748b">단절</text>

            <text x="50" y="580" fontFamily="system-ui, sans-serif" fontSize="12" fill="#6b7280" fontStyle="italic">데이터 흐름: 3가지 출처 외, 보건소 현장점검과 외부 통계지표가 단절된 근본적인 한계</text>
          </svg>
        </div>

        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 border-l-4 border-blue-600 pl-3 sm:pl-4 mt-6 sm:mt-8 lg:mt-10 mb-4 sm:mb-6">
          4. 인트라넷(E-gen)의 한계점
        </h2>

        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mt-6 sm:mt-8 mb-3 sm:mb-4">4.1 정보 분산 문제</h3>

        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 my-4 rounded">
          <strong>1. 보건소 현장점검 결과와 분산</strong><br />
          <strong>쉽게 설명:</strong> 보건소 직원이 직접 현장을 가서 확인한 실제 상황<br />
          • 예시: 인트라넷(E-gen)에는 &quot;AED 설치됨&quot;이라고 되어 있지만, 현장 점검 결과 &quot;실제로는 고장남&quot; 발견<br />
          • 문제: 이런 중요한 정보가 엑셀 파일로만 관리되어 인트라넷(E-gen)에 반영되지 않음<br />
         
          <ul className="list-disc ml-5 mt-2">
            <li>보건소 현장점검을 통해 발견되는 실체 → 인트라넷(E-gen) 정보와의 차이 발생 </li>
            <li>엑셀 기반 별도 관리로 인한 정보 단절</li>
            <li>복지부 제출 후 인트라넷(E-gen) 반영 프로세스 부재</li>
          </ul>
        </div>

        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 my-4 rounded">
          <strong>2. 외부 통계 데이터와 연계 불가</strong><br />
          • 예시: 인구가 많고 심정지가 자주 발생하는 지역을 알 수 있는 통계청 데이터가 있지만, AED 설치 현황과 연결해서 분석하지 못함<br />
          • 문제: &quot;어느 지역에 AED를 더 설치해야 하는지&quot; 같은 판단을 내리기 어려움<br />
          
          <ul className="list-disc ml-5 mt-2">
            <li>통계청 제공 지역별 기초 데이터
              <ul className="list-circle ml-5">
                <li>지역별 면적 정보</li>
                <li>인구 통계</li>
                <li>유동인구 데이터(별도구매)</li>
                <li>심정지 발생장소 통계</li>
              </ul>
            </li>
            <li>인트라넷(E-gen)과의 연계 부재로 활용도 제한</li>
          </ul>
        </div>

        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mt-6 sm:mt-8 mb-3 sm:mb-4">4.2 인트라넷(E-gen) 정보 활용의 한계</h3>

        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 my-4 rounded">
          <strong>쉽게 설명:</strong> 현재 시스템으로는 단편적인 정보만 볼 수 있어 깊이 있는 분석이 어려움<br />
          • 예시: 지도에서 AED 위치는 볼 수 있지만, &quot;이 지역에 정말 충분한가?&quot;, &quot;응급상황이 자주 발생하는 곳은 어디인가?&quot; 같은 질문에 답하기 어려움<br />
          
        </div>

        <ul className="list-disc ml-4 sm:ml-5 space-y-1 sm:space-y-2">
          <li>AED 설치 현황과 지역 특성의 연관 분석 불가</li>
          <li>취약지역 식별을 위한 종합적 데이터 분석 어려움</li>
          <li>시각적 데이터 표현 및 효과적 현황 파악 제한</li>
          <li><strong>E-GEN의 근본적 한계:</strong> 지도상 위치 표시와 간단한 정보 제공에 그쳐 심층적인 분석 기능 부재</li>
          <li><strong>수동 매칭 작업의 비효율:</strong> 새올시스템과 인트라넷(E-gen) 간 수동 연계로 인한 시간과 인력 소모</li>
          <li><strong>텍스트 기반 점검 이력:</strong> 월별 점검 결과가 텍스트로 쌓이기만 하고 분석적 활용이 어려움</li>
        </ul>

        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 border-l-4 border-blue-600 pl-3 sm:pl-4 mt-6 sm:mt-8 lg:mt-10 mb-4 sm:mb-6">
          5. 대시보드 시스템 구축 방안
        </h2>

        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mt-6 sm:mt-8 mb-3 sm:mb-4">5.1 대시보드 시스템으로 인트라넷(E-gen) 한계 극복</h3>

        <div className="bg-green-50 border-l-4 border-green-500 p-5 my-4 rounded">
          <strong>혁신적 접근 방식 - AED 스마트 모니터링 대시보드</strong><br />
          <strong>쉽게 설명:</strong> 기존 시스템들을 대체하는 것이 아니라 서로 연결해서 훨씬 똑똑한 시스템 만들기<br />
          • <strong>현재 상황</strong>: 각 시스템이 따로 놀고, 텍스트로만 쌓이는 점검 데이터<br />
          • <strong>대시보드 역할</strong>: 모든 정보를 연결해서 한눈에 보고, 미래까지 예측하는 &apos;통합 관제 및 분석 플랫폼&apos;<br />
          • 예시: 단순히 &quot;여기 AED 있어요&quot;가 아니라, &quot;이 지역은 인구 대비 AED가 부족하고, 응급상황 발생률이 높으니 추가 설치가 필요해요&quot;까지 알려주는 시스템<br />
         
        </div>

        <p className="mb-4">대시보드 시스템은 기존 인트라넷(E-gen)의 3가지 데이터 출처와 2가지 분산 정보를 통합하는 <strong>종합 정보 집합체</strong>로서 다음과 같은 기능을 수행함:</p>

        <ul className="list-disc ml-4 sm:ml-5 space-y-1 sm:space-y-2">
          <li><strong>통합 데이터 분석</strong>: 인트라넷(E-gen) 데이터 + 현장점검 결과 + 외부통계 연계 (E-GEN 대비 확장)<br />
          <span className="text-gray-600 text-sm">→ 예시: AED 위치 + 실제 작동상태 + 지역 인구수를 모두 함께 분석</span></li>
          <li><strong>취약지역 분석</strong>: AED 데이터와 지역 특성의 중첩 분석 (E-GEN에서 불가능한 기능)<br />
          <span className="text-gray-600 text-sm">→ 예시: &quot;이 지역은 노인 인구는 많은데 AED는 부족해요&quot; 같은 분석</span></li>
          <li><strong>고도화된 시각화 기능</strong>: E-GEN의 단순 지도 표시를 넘어선 효과적인 정보 표현 및 현황 파악<br />
          <span className="text-gray-600 text-sm">→ 예시: 색깔별 위험도 표시, 그래프, 차트 등으로 한눈에 파악 가능</span></li>
          <li><strong>실시간 모니터링</strong>: 종합적 시스템 상태 관리 (관리자·이용자 모두에게 유용)<br />
          <span className="text-gray-600 text-sm">→ 예시: AED 고장 알림, 설치 현황 변화 실시간 확인</span></li>
        </ul>

        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mt-6 sm:mt-8 mb-3 sm:mb-4">5.2 AED 스마트 모니터링 대시보드의 혁신적 가치</h3>

        <div className="bg-green-50 border-l-4 border-green-500 p-5 my-4 rounded">
          <p className="mb-2"><strong>AED 스마트 대시보드는 기존 시스템들을 대체하는 것이 아니라, 각 시스템에 흩어져 있거나 텍스트로만 쌓여있는 데이터를 한곳에 모아 새로운 가치를 창출하는 &apos;통합 관제 및 분석 플랫폼&apos;임.</strong></p>

          <ul className="list-disc ml-4 sm:ml-5 space-y-1 sm:space-y-2">
            <li><strong>핵심 목적:</strong> <strong>데이터 기반의 전략 수립 및 선제적 관리</strong></li>
            <li><strong>주요 사용자:</strong> AED 관리 책임자, 보건 정책 입안자, 응급의료 연구자</li>
            <li><strong>정보의 역할:</strong> 흩어진 기본 정보와 텍스트로 쌓이는 점검 이력을 시각적인 통계와 지도로 변환하여 한눈에 현황을 파악하게 하고, 미래를 예측하는 <strong>&apos;종합 건강검진 결과표 + 미래 건강 예측 리포트&apos;</strong>와 같음</li>
          </ul>
        </div>

        <h4 className="text-lg font-semibold text-gray-700 mt-5 mb-3">차별화된 기능</h4>

        <div className="feature-grid">
          <div className="feature-card">
            
            <h4 className="font-semibold mb-2">통합 관제 및 현황 시각화</h4>
            <ul className="list-disc ml-5 text-sm">
              <li><strong>실시간 반응형 지도:</strong> 전국 AED 현황을 클러스터, 히트맵, 상태별(정상/오류) 점 등 다양한 형태로 시각화</li>
              <li><strong>한눈에 보는 대시보드:</strong> 총 AED 수, 즉시 사용 가능 대수, 장비/소모품 만료 대수 등 핵심 지표(KPI) 실시간 제공</li>
              <li><strong>통계 지도(Choropleth Map):</strong> 인구 10만 명당 또는 면적(km²)당 AED 밀집도를 색상 단계로 표현하여 지역별 격차 명확 비교</li>
              <li><strong>주변 응급자원 찾기:</strong> 가장 가까운 AED와 응급의료기관 정보를 거리, 예상 소요 시간과 함께 제시</li>
            </ul>
          </div>

          <div className="feature-card">
            
            <h4 className="font-semibold mb-2">데이터 기반 심층 분석</h4>
            <ul className="list-disc ml-5 text-sm">
              <li><strong>유동인구 기반 분석:</strong> 통신사 유동인구 데이터와 AED 밀도를 결합하여 &apos;AED 필요지수&apos; 산출, 실질적으로 AED가 더 필요한 잠재적 위험 지역을 과학적으로 도출</li>
              <li><strong>관리 취약 지역 분석:</strong> 점검이 필요하거나 소모품 만료가 임박한 장비들의 위치를 히트맵으로 표시</li>
              <li><strong>서비스 커버리지 분석:</strong> AED와 응급의료기관의 서비스 반경을 중첩하여 지리적 사각지대를 시각적으로 분석</li>
              <li><strong>골든아워 접근성 분석 및 시뮬레이션:</strong> 4분 내 도보 접근이 불가능한 지역을 분석하고, 지도에 가상의 AED를 추가 배치하여 커버리지가 얼마나 개선되는지 실시간으로 시뮬레이션</li>
              <li><strong>설치 최적 입지 분석:</strong> 응급실까지의 거리, AED 밀도 등 복합적인 요소를 가중치로 계산하여, 향후 AED를 신규 설치할 최적의 입지를 추천</li>
            </ul>
          </div>

          <div className="feature-card">
            
            <h4 className="font-semibold mb-2">선제적 예방 및 행정 지원</h4>
            <ul className="list-disc ml-5 text-sm">
              <li><strong>예지 보전(Predictive Maintenance):</strong> 30일, 60일, 90일 내 배터리나 패드 교체가 필요한 장비를 미리 예측하여 목록을 제공함으로써, 사후 조치가 아닌 선제적 예방 관리를 가능하게 함</li>
              <li><strong>스마트 분류 어시스턴트:</strong> &apos;500세대 아파트&apos;, &apos;인천공항&apos; 등 장소명을 입력하면 법적 구비 의무 여부와 표준 분류를 추천해주는 AI 기반 기능</li>
              <li><strong>24시간 민원응대 챗봇:</strong> AED 설치 기준, 관리 방법 등 자주 묻는 질문과 민원에 대해 24시간 응답하는 챗봇을 탑재하여, 시민의 궁금증을 즉시 해소하고 담당 공무원의 반복적인 응대 업무를 경감</li>
              <li><strong>상세 데이터 관리 및 보고:</strong> 모든 AED의 상세 정보를 검색, 필터링하고 엑셀로 다운로드할 수 있으며, 클릭 한 번으로 선택된 장비들의 점검 요청 메시지를 자동 생성</li>
              <li><strong>데이터 품질 관리:</strong> 설정된 규칙에 따라 데이터의 정합성을 검증하고, 오류가 의심되는 데이터를 목록화하여 데이터 품질을 체계적으로 개선</li>
            </ul>
          </div>
        </div>

        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mt-6 sm:mt-8 mb-3 sm:mb-4">5.3 구축 방식 비교 분석 &quot;왜 E-GEN에서 할 수 없는가?&quot;</h3>

        <div className="recommendation">
          <h4 className="font-semibold mb-3">방안 1: 독립 대시보드 구축 방식 (권장안)</h4>
          <div className="pros-cons">
            <div className="pros">
              <h5 className="font-semibold mb-2">장점:</h5>
              <ul className="list-disc ml-5 text-sm">
                <li>내부 직원의 높은 업무 이해도 활용</li>
                <li>기술 구현 경험을 바탕한 효율적 개발</li>
                <li>저비용 구축 가능</li>
                <li>신속한 시스템 구현</li>
                <li>요구사항 변경 시 유연한 대응 가능</li>
                <li>독립적 운영으로 인한 시스템 안정성</li>
                <li>향후 인트라넷(E-gen) 시스템 고도화의 청사진 제시</li>
                <li><strong>별도 예산 없이</strong>지원센터 직원 3명의 노력으로 단기간에 구현한 프로토타입</li>
              </ul>
            </div>
            <div className="cons">
              <h5 className="font-semibold mb-2">특징:</h5>
              <ul className="list-disc ml-5 text-sm">
                <li>별도 시스템 이원화(인트라넷(E-gen)은 관리중심, 대시보드는 E-GEN을 뛰어넘는 이용자 중심)<br />
                <span className="text-gray-600 text-xs">→ 쉽게 말해: 직원용 관리도구는 그대로 두고, 국민용 서비스만 훨씬 좋게 만드는 방식</span></li>
                <li>E-GEN의 단순 정보 제공 한계를 극복한 고도화된 분석·시각화 시스템<br />
                <span className="text-gray-600 text-xs">→ 쉽게 말해: 현재 E-GEN보다 훨씬 똑똑하고 유용한 서비스로 업그레이드</span></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="my-6">
          <h4 className="font-semibold mb-3">방안 2: 인트라넷(E-gen) 고도화 방식</h4>
          <div className="pros-cons">
            <div className="pros">
              <h5 className="font-semibold mb-2">장점:</h5>
              <ul className="list-disc ml-5 text-sm">
                <li>기존 시스템과의 완전한 통합</li>
                <li>단일 시스템 운영의 편의성</li>
              </ul>
            </div>
            <div className="cons">
              <h5 className="font-semibold mb-2">단점:</h5>
              <ul className="list-disc ml-5 text-sm">
                <li>인트라넷(E-gen) 유지보수 업체의 E-GEN 데이터베이스 직접 접근 필요</li>
                <li>추가 개발비용 및 기간 소요 (연구용역 수준 초과)</li>
                <li>복잡한 계약 프로세스 (업체선정 → 계약 → 착수보고)</li>
                <li>업체-담당자 간 업무 이해도 격차로 인한 소통 비용</li>
                <li>시스템 요구사항 변경 시 유연한 대응 한계</li>
              </ul>
            </div>
          </div>
        </div>


        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 border-l-4 border-blue-600 pl-3 sm:pl-4 mt-6 sm:mt-8 lg:mt-10 mb-4 sm:mb-6">
          6. 기대효과 및 활용방안
        </h2>

        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mt-6 sm:mt-8 mb-3 sm:mb-4">6.1 왜 새로운 대시보드가 필요한가?</h3>

        <div className="bg-green-50 border-l-4 border-green-500 p-5 my-4 rounded">
          <p className="mb-2"><strong>기존 시스템들이 AED의 &apos;등록&apos;과 &apos;안내&apos;에 집중했다면, 스마트 대시보드는 &apos;관리의 질&apos;을 높이는 데 집중함.</strong></p>

          <p className="mb-2">&quot;우리 지역에 AED가 몇 대 있다&quot;를 넘어, &quot;그래서 그 장비들이 제대로 관리되고 있는가? 더 필요한 곳은 어디인가?&quot;에 대한 데이터 기반의 해답을 제시함.</p>

          <p>특히, <strong>수동 매칭 작업과 텍스트로 쌓이는 점검 이력 관리의 비효율을 극복</strong>할 강력한 도구가 될 수 있음.</p>
        </div>

        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mt-6 sm:mt-8 mb-3 sm:mb-4">6.2 신속하고 효율적인 개발 방식</h3>

        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 my-4 rounded">
          <strong>혁신적 접근법:</strong><br />
          거대한 국가 시스템을 처음부터 바꾸는 것은 막대한 예산과 시간이 소요됨. 하지만 본 AED 스마트 대시보드는 <strong>별도의 예산 없이 응급의료지원센터 직원 3명의 노력으로 단기간에 구현한 프로토타입</strong><br /><br />

          이는 현장의 필요를 가장 잘 아는 인력이 신속하게 해결책을 만들 수 있다는 &apos;애자일(Agile) 행정&apos;의 좋은 사례.
        </div>

        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mt-6 sm:mt-8 mb-3 sm:mb-4">6.3 정보 통합 효과</h3>
        <ul className="list-disc ml-4 sm:ml-5 space-y-1 sm:space-y-2">
          <li>분산된 5가지 정보원의 통합 관리</li>
          <li>실시간 데이터 기반 의사결정 지원</li>
          <li>정보의 정확성 및 일관성 확보</li>
        </ul>

        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mt-6 sm:mt-8 mb-3 sm:mb-4">6.4 업무 효율성 증대</h3>
        <ul className="list-disc ml-4 sm:ml-5 space-y-1 sm:space-y-2">
          <li>수작업 데이터 관리 프로세스 자동화</li>
          <li>현장점검 결과의 체계적 관리</li>
          <li>복지부 보고 업무의 효율화</li>
        </ul>

        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mt-6 sm:mt-8 mb-3 sm:mb-4">6.5 정책 지원 기능 강화</h3>
        <ul className="list-disc ml-4 sm:ml-5 space-y-1 sm:space-y-2">
          <li>데이터 기반 취약지역 식별</li>
          <li>AED 설치 우선순위 결정 지원</li>
          <li>응급의료 정책 수립을 위한 근거 자료 제공</li>
        </ul>

        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mt-6 sm:mt-8 mb-3 sm:mb-4">6.6 미래 발전 계획 및 기대효과</h3>

        <div className="system-comparison">
          <h4 className="font-semibold mb-3">단계별 발전 로드맵</h4>

          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 my-4 rounded">
            <strong>1단계: 테스트베드 운영</strong><br />
            본 대시보드를 <strong>보건소, 지자체, 더 나아가 보건복지부에서 활용</strong>하여 AED 관리의 효율성을 직접 체감하고 필요한 기능을 검증하는 &apos;테스트베드&apos;로 삼을 수 있음
          </div>

          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 my-4 rounded">
            <strong>2단계: 기능 검증 및 개선</strong><br />
            여기서 검증된 효과적인 기능들(예: 예지보전, 취약지 분석)을 사용자 피드백을 바탕으로 지속적으로 개선
          </div>

          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 my-4 rounded">
            <strong>3단계: 기존 시스템 통합</strong><br />
            <strong>장기적으로 E-GEN이나 NEMC 인트라넷(E-gen)에 공식 기능으로 통합</strong>하는 것을 목표로 함. 이는 막대한 예산을 들여 시스템을 전면 개편하는 대신, 검증된 기능만을 선별하여 성공적으로 이식하는 현명하고 효율적인 시스템 고도화 방식임
          </div>
        </div>

        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 border-l-4 border-blue-600 pl-3 sm:pl-4 mt-6 sm:mt-8 lg:mt-10 mb-4 sm:mb-6">
          7. 결론 및 권고사항
        </h2>

        <div className="bg-blue-50 rounded-lg p-6 mb-8">
          <h3 className="text-xl font-semibold text-gray-700 mb-3">7.1 핵심 결론</h3>
          <p>응급의료지원센터의 효과적인 정보 관리를 위해서는 기존 인트라넷(E-gen) 시스템의 한계를 극복할 수 있는 통합 대시보드 시스템 구축이 필수적임. 특히 E-GEN의 단순한 지도 표시 기능을 뛰어넘어 분산된 정보의 통합과 고도화된 시각적 분석 기능 제공을 통해 업무 효율성과 정책 지원 능력을 크게 향상시킬 수 있을 것으로 예상됨.</p>
        </div>

        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mt-6 sm:mt-8 mb-3 sm:mb-4">7.2 권고사항</h3>
        <ol className="list-decimal ml-4 sm:ml-5 space-y-1 sm:space-y-2">
          <li><strong>독립 대시보드 방식 채택</strong>: 비용 효율성과 구축 속도를 고려하여 독립적인 대시보드 시스템 구축을 권장함.</li>
          <li><strong>단계적 구축 접근</strong>: 핵심 기능부터 우선 구축하고 점진적으로 기능을 확장하는 방식을 제안함.</li>
          <li><strong>데이터 표준화</strong>: 5가지 정보원의 효과적 통합을 위한 데이터 표준화 작업을 선행함.</li>
          <li><strong>지속적 개선체계 구축</strong>: 사용자 피드백을 바탕으로 한 지속적인 시스템 개선 프로세스를 수립함.</li>
        </ol>

        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mt-6 sm:mt-8 mb-3 sm:mb-4">7.3 향후 과제</h3>
        <ul className="list-disc ml-4 sm:ml-5 space-y-1 sm:space-y-2">
          <li>시스템 구축 일정 및 예산 계획 수립</li>
          <li>데이터 연계 방식 및 보안 정책 수립</li>
          <li>사용자 교육 및 변화관리 계획 수립</li>
          <li>시스템 운영 및 유지보수 체계 구축</li>
          <li><strong>사용자별 접근 권한 분리</strong>: 관리자, 점검자, 일반 사용자 등 역할별 접근 권한을 세분화하여 보안을 강화하고 효율적인 업무 수행을 지원</li>
        </ul>

        <div className="bg-blue-50 rounded-lg p-4 sm:p-6 mt-6 sm:mt-8">
          <p className="text-center font-semibold">
            <strong>본 AED 스마트 모니터링 대시보드의 성공적인 구축을 통해 AED 관리 체계는 수동적 기록 관리를 넘어, 데이터에 기반한 선제적이고 과학적인 관리로 발전하여 국민의 생명을 지키는 사회 안전망을 더욱 튼튼하게 만들 것으로 기대됨.</strong>
          </p>
        </div>

        <div className="mt-8 sm:mt-10 lg:mt-12 text-center border-t border-gray-200 pt-6 sm:pt-8">
          <Link
            href="/"
            className="inline-flex items-center px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold text-sm sm:text-base rounded-xl shadow-lg hover:from-blue-700 hover:to-blue-800 hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 border border-blue-600"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" fill="none" stroke="white" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-white">홈으로 돌아가기</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
