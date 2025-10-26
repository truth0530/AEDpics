export function PrivacyContent() {
  return (
    <div className="space-y-4 text-gray-300">
      <section>
        <h3 className="text-lg font-semibold text-white mb-2">1. 개인정보의 수집 및 이용 목적</h3>
        <p className="text-sm leading-relaxed">
          국립중앙의료원은 다음의 목적을 위하여 개인정보를 처리합니다. 처리하는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 
          이용 목적이 변경되는 경우에는 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.
        </p>
        <ul className="text-sm mt-2 space-y-1 list-disc list-inside">
          <li>회원 가입 및 관리</li>
          <li>AED 점검 업무 수행 및 관리</li>
          <li>서비스 제공 및 개선</li>
          <li>민원 처리 및 공지사항 전달</li>
        </ul>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-white mb-2">2. 수집하는 개인정보 항목</h3>
        <div className="text-sm space-y-2">
          <div>
            <p className="font-medium text-white">필수 항목:</p>
            <ul className="mt-1 list-disc list-inside">
              <li>이메일 주소 (공공기관 이메일)</li>
              <li>성명</li>
              <li>소속 기관명</li>
              <li>지역 정보</li>
              <li>비밀번호 (암호화 저장)</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-white">선택 항목:</p>
            <ul className="mt-1 list-disc list-inside">
              <li>연락처</li>
              <li>비고사항</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-white">자동 수집 항목:</p>
            <ul className="mt-1 list-disc list-inside">
              <li>접속 IP 주소</li>
              <li>접속 일시</li>
              <li>서비스 이용 기록</li>
            </ul>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-white mb-2">3. 개인정보의 보유 및 이용 기간</h3>
        <p className="text-sm leading-relaxed">
          이용자의 개인정보는 원칙적으로 개인정보의 수집 및 이용목적이 달성되면 지체 없이 파기합니다. 
          단, 다음의 정보에 대해서는 아래의 이유로 명시한 기간 동안 보존합니다.
        </p>
        <ul className="text-sm mt-2 space-y-1 list-disc list-inside">
          <li>회원 정보: 회원 탈퇴 시까지</li>
          <li>AED 점검 기록: 5년 (의료기기법에 따른 보관)</li>
          <li>접속 기록: 3개월 (통신비밀보호법)</li>
          <li>민원 처리 기록: 3년 (전자상거래법)</li>
        </ul>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-white mb-2">4. 개인정보의 제3자 제공</h3>
        <p className="text-sm leading-relaxed">
          기관은 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만, 아래의 경우에는 예외로 합니다.
        </p>
        <ul className="text-sm mt-2 space-y-1 list-disc list-inside">
          <li>이용자가 사전에 동의한 경우</li>
          <li>법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>
        </ul>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-white mb-2">5. 개인정보의 파기 절차 및 방법</h3>
        <div className="text-sm space-y-2">
          <div>
            <p className="font-medium text-white">파기 절차:</p>
            <p>이용자가 입력한 정보는 목적 달성 후 별도의 DB로 옮겨져 내부 방침 및 기타 관련 법령에 따라 일정기간 저장된 후 파기됩니다.</p>
          </div>
          <div>
            <p className="font-medium text-white">파기 방법:</p>
            <ul className="mt-1 list-disc list-inside">
              <li>전자적 파일 형태: 기록을 재생할 수 없는 기술적 방법을 사용하여 삭제</li>
              <li>종이 문서: 분쇄기로 분쇄하거나 소각</li>
            </ul>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-white mb-2">6. 이용자의 권리와 그 행사 방법</h3>
        <p className="text-sm leading-relaxed">
          이용자는 언제든지 다음 각 호의 개인정보 보호 관련 권리를 행사할 수 있습니다.
        </p>
        <ul className="text-sm mt-2 space-y-1 list-disc list-inside">
          <li>개인정보 열람 요구</li>
          <li>오류 등이 있을 경우 정정 요구</li>
          <li>삭제 요구</li>
          <li>처리 정지 요구</li>
        </ul>
        <p className="text-sm mt-2">
          권리 행사는 서면, 전화, 전자우편 등을 통하여 하실 수 있으며, 기관은 이에 대해 지체 없이 조치하겠습니다.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-white mb-2">7. 개인정보 보호를 위한 기술적/관리적 대책</h3>
        <ul className="text-sm space-y-1 list-disc list-inside">
          <li>개인정보의 암호화: 비밀번호 등 중요 정보는 암호화하여 저장</li>
          <li>해킹 등에 대비한 기술적 대책: 보안프로그램 설치 및 주기적 점검</li>
          <li>개인정보 취급 직원의 최소화 및 교육</li>
          <li>접속기록의 보관 및 위변조 방지</li>
        </ul>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-white mb-2">8. 개인정보 보호책임자</h3>
        <div className="text-sm space-y-2">
          <p>기관은 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 이용자의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.</p>
          <div className="mt-2 p-3 bg-gray-800/50 rounded-lg">
            <p className="font-medium text-white">개인정보 보호책임자</p>
            <ul className="mt-1 text-xs">
              <li>부서명: AED 관리팀</li>
              <li>담당자: 시스템 관리자</li>
              <li>연락처: truth0530@nmc.or.kr</li>
              <li>전화번호: 02-2260-7114</li>
            </ul>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-white mb-2">9. 개인정보 처리방침 변경</h3>
        <p className="text-sm leading-relaxed">
          이 개인정보 처리방침은 2025년 1월 1일부터 적용되며, 법령 및 방침에 따른 변경내용의 추가, 삭제 및 정정이 있는 경우에는 변경사항의 시행 7일 전부터 공지사항을 통하여 고지할 것입니다.
        </p>
      </section>

      <section className="pt-4 border-t border-gray-700">
        <p className="text-xs text-gray-400">
          공고일자: 2025년 1월 1일<br/>
          시행일자: 2025년 1월 1일<br/>
          국립중앙의료원
        </p>
      </section>
    </div>
  );
}