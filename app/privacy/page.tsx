import Link from "next/link";

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M50 85C50 85 20 60 20 40C20 30 25 25 32 25C38 25 44 28 50 35C56 28 62 25 68 25C75 25 80 30 80 40C80 60 50 85 50 85Z" fill="white"/>
                <path d="M55 35L45 50H55L40 65L60 45H50L55 35Z" fill="#10b981" strokeWidth="2" stroke="#10b981"/>
              </svg>
            </div>
            <span className="text-white font-semibold">AED Smart Check</span>
          </Link>
          <Link 
            href="/"
            className="text-gray-400 hover:text-white transition-colors"
          >
            메인으로 돌아가기
          </Link>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-gray-800/50 rounded-2xl p-8">
          <h1 className="text-3xl font-bold text-white mb-8 text-center">개인정보 처리방침</h1>
          
          <div className="prose prose-invert max-w-none text-gray-300 leading-relaxed">
            <div className="space-y-8">
              <section>
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mb-6">
                  <p className="text-green-400 font-semibold text-center">
                    중앙응급의료센터는 개인정보보호법에 따라 이용자의 개인정보 보호 및 권익을 보호하고 개인정보와 관련한 이용자의 고충을 원활하게 처리할 수 있도록 다음과 같은 처리방침을 두고 있습니다.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-green-400 mb-4">제1조 (개인정보의 처리목적)</h2>
                <p className="mb-4">중앙응급의료센터는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 개인정보보호법 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.</p>
                
                <div className="bg-gray-700/50 rounded-lg p-4 mb-4">
                  <h3 className="text-lg font-medium text-white mb-3">1. 회원 가입 및 관리</h3>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                    <li>회원 가입의사 확인, 회원제 서비스 제공에 따른 본인 식별·인증</li>
                    <li>회원자격 유지·관리, 서비스 부정이용 방지</li>
                    <li>각종 고지·통지, 고충처리 등을 목적으로 개인정보를 처리합니다.</li>
                  </ul>
                </div>

                <div className="bg-gray-700/50 rounded-lg p-4 mb-4">
                  <h3 className="text-lg font-medium text-white mb-3">2. AED 점검 업무 수행</h3>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                    <li>AED 장비 점검 결과 기록 및 관리</li>
                    <li>점검 담당자 식별 및 업무 배정</li>
                    <li>점검 이력 추적 및 품질 관리</li>
                  </ul>
                </div>

                <div className="bg-gray-700/50 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-white mb-3">3. 민원사무 처리</h3>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                    <li>민원인의 신원 확인, 민원사항 확인, 사실조사를 위한 연락·통지</li>
                    <li>처리결과 통보 등을 목적으로 개인정보를 처리합니다.</li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-green-400 mb-4">제2조 (개인정보의 처리 및 보유기간)</h2>
                <div className="mb-4">
                  <p className="mb-4">① 중앙응급의료센터는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.</p>
                  <p className="mb-4">② 각각의 개인정보 처리 및 보유 기간은 다음과 같습니다.</p>
                </div>

                <div className="bg-gray-700/50 rounded-lg p-4 mb-4">
                  <h3 className="text-lg font-medium text-white mb-3">1. 회원 관리</h3>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                    <li>보존항목: 이름, 이메일, 소속기관, 담당업무</li>
                    <li>보존근거: 서비스 이용약관</li>
                    <li>보존기간: 회원 탈퇴 시까지</li>
                  </ul>
                </div>

                <div className="bg-gray-700/50 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-white mb-3">2. AED 점검 기록</h3>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                    <li>보존항목: 점검자 정보, 점검 일시, 점검 결과</li>
                    <li>보존근거: 응급의료에 관한 법률</li>
                    <li>보존기간: 3년</li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-green-400 mb-4">제3조 (처리하는 개인정보의 항목)</h2>
                <p className="mb-4">중앙응급의료센터는 다음의 개인정보 항목을 처리하고 있습니다.</p>
                
                <div className="bg-gray-700/50 rounded-lg p-4 mb-4">
                  <h3 className="text-lg font-medium text-white mb-3">1. 회원가입 및 관리</h3>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                    <li>필수항목: 이름, 이메일 주소, 소속기관명, 부서명, 직책</li>
                    <li>선택항목: 연락처(업무용)</li>
                    <li>자동수집항목: 접속 IP 정보, 접속 로그, 서비스 이용 기록</li>
                  </ul>
                </div>

                <div className="bg-gray-700/50 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-white mb-3">2. AED 점검 업무</h3>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                    <li>점검자 식별정보: 이름, 소속기관</li>
                    <li>점검 관련 정보: 점검 일시, 위치 정보, 점검 결과</li>
                    <li>사진 정보: AED 장비 및 설치 환경 사진</li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-green-400 mb-4">제4조 (개인정보의 제3자 제공)</h2>
                <div className="mb-4">
                  <p className="mb-4">① 중앙응급의료센터는 개인정보를 제1조(개인정보의 처리목적)에서 명시한 범위 내에서만 처리하며, 정보주체의 동의, 법률의 특별한 규정 등 개인정보보호법 제17조에 해당하는 경우에만 개인정보를 제3자에게 제공합니다.</p>
                  <p className="mb-4">② 중앙응급의료센터는 다음과 같이 개인정보를 제3자에게 제공하고 있습니다.</p>
                </div>

                <div className="bg-gray-700/50 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-white mb-3">보건복지부</h3>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                    <li>개인정보를 제공받는 자: 보건복지부</li>
                    <li>개인정보를 제공받는 자의 이용목적: 전국 AED 현황 통계 및 정책 수립</li>
                    <li>제공하는 개인정보 항목: 점검 결과 통계(개인 식별정보 제외)</li>
                    <li>개인정보를 제공받는 자의 보유·이용기간: 통계 목적 달성 시까지</li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-green-400 mb-4">제5조 (개인정보 처리의 위탁)</h2>
                <p className="mb-4">① 중앙응급의료센터는 원활한 개인정보 업무처리를 위하여 다음과 같이 개인정보 처리업무를 위탁하고 있습니다.</p>
                
                <div className="bg-gray-700/50 rounded-lg p-4 mb-4">
                  <h3 className="text-lg font-medium text-white mb-3">클라우드 서비스 제공</h3>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                    <li>위탁받는 자(수탁자): Vercel Inc. (미국)</li>
                    <li>위탁하는 업무의 내용: 웹 호스팅 및 데이터 저장</li>
                    <li>위탁기간: 서비스 계약 기간</li>
                  </ul>
                </div>

                <p className="text-sm text-gray-400">② 중앙응급의료센터는 위탁계약 체결시 개인정보보호법 제26조에 따라 위탁업무 수행목적 외 개인정보 처리금지, 기술적·관리적 보호조치, 재위탁 제한, 수탁자에 대한 관리·감독, 손해배상 등 책임에 관한 사항을 계약서 등 문서에 명시하고, 수탁자가 개인정보를 안전하게 처리하는지를 감독하고 있습니다.</p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-green-400 mb-4">제6조 (정보주체의 권리·의무 및 행사방법)</h2>
                <p className="mb-4">① 정보주체는 중앙응급의료센터에 대해 언제든지 다음 각 호의 개인정보 보호 관련 권리를 행사할 수 있습니다.</p>
                
                <div className="bg-gray-700/50 rounded-lg p-4 mb-4">
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>개인정보 처리현황 통지요구</li>
                    <li>개인정보 열람요구</li>
                    <li>개인정보 정정·삭제요구</li>
                    <li>개인정보 처리정지요구</li>
                  </ul>
                </div>

                <p className="mb-4">② 제1항에 따른 권리 행사는 중앙응급의료센터에 대해 서면, 전화, 전자우편, 모사전송(FAX) 등을 통하여 하실 수 있으며 중앙응급의료센터는 이에 대해 지체없이 조치하겠습니다.</p>
                <p className="text-sm text-gray-400">③ 정보주체가 개인정보의 오류 등에 대한 정정 또는 삭제를 요구한 경우에는 중앙응급의료센터는 정정 또는 삭제를 완료할 때까지 당해 개인정보를 이용하거나 제공하지 않습니다.</p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-green-400 mb-4">제7조 (개인정보보호책임자)</h2>
                <p className="mb-4">① 중앙응급의료센터는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보보호책임자를 지정하고 있습니다.</p>
                
                <div className="bg-gray-700/50 rounded-lg p-4 mb-6">
                  <h3 className="text-lg font-medium text-white mb-3">개인정보보호책임자</h3>
                  <ul className="space-y-2">
                    <li><span className="font-medium text-white">성명:</span> 홍길동</li>
                    <li><span className="font-medium text-white">직책:</span> 정보보호팀장</li>
                    <li><span className="font-medium text-white">연락처:</span> 02-2260-7114</li>
                    <li><span className="font-medium text-white">이메일:</span> privacy@nmc.or.kr</li>
                  </ul>
                </div>

                <p className="text-sm text-gray-400">② 정보주체께서는 중앙응급의료센터의 서비스(또는 사업)을 이용하시면서 발생한 모든 개인정보 보호 관련 문의, 불만처리, 피해구제 등에 관한 사항을 개인정보보호책임자 및 담당부서로 문의하실 수 있습니다. 중앙응급의료센터는 정보주체의 문의에 대해 지체없이 답변 및 처리해드릴 것입니다.</p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-green-400 mb-4">제8조 (개인정보의 안전성 확보조치)</h2>
                <p className="mb-4">중앙응급의료센터는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.</p>
                
                <div className="space-y-4">
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <h3 className="text-lg font-medium text-white mb-2">1. 관리적 조치</h3>
                    <p className="text-sm">내부관리계획 수립·시행, 정기적 직원 교육 등</p>
                  </div>

                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <h3 className="text-lg font-medium text-white mb-2">2. 기술적 조치</h3>
                    <p className="text-sm">개인정보처리시스템 등의 접근권한 관리, 접근통제시스템 설치, 고유식별정보 등의 암호화, 보안프로그램 설치 및 갱신</p>
                  </div>

                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <h3 className="text-lg font-medium text-white mb-2">3. 물리적 조치</h3>
                    <p className="text-sm">전산실, 자료보관실 등의 접근통제</p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-green-400 mb-4">제9조 (개인정보 처리방침 변경)</h2>
                <div className="mb-6">
                  <p className="mb-4">① 이 개인정보처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경내용의 추가, 삭제 및 정정이 있는 경우에는 변경사항의 시행 7일 전부터 공지사항을 통하여 고지할 것입니다.</p>
                </div>

                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-green-400 mb-2">시행일자</h3>
                  <p>본 방침은 2025년 9월 12일부터 시행됩니다.</p>
                </div>
              </section>
            </div>
          </div>
        </div>

        {/* Back to Home Button */}
        <div className="text-center mt-8">
          <Link 
            href="/"
            className="inline-flex items-center px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
          >
            메인으로 돌아가기
          </Link>
        </div>
      </div>
    </main>
  );
}