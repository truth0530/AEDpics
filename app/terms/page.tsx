import Link from "next/link";

export default function TermsOfService() {
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
          <h1 className="text-3xl font-bold text-white mb-8 text-center">서비스 이용약관</h1>
          
          <div className="prose prose-invert max-w-none text-gray-300 leading-relaxed">
            <div className="space-y-8">
              <section>
                <h2 className="text-2xl font-semibold text-green-400 mb-4">제 1장 총칙</h2>
                
                <div className="mb-6">
                  <h3 className="text-xl font-medium text-white mb-3">제 1 조 (목적)</h3>
                  <p>본 약관은 중앙응급의료센터에서 운영하는 사이트(이하 &ldquo;당 사이트&rdquo;) 관련 서비스(이하 &ldquo;서비스&rdquo;)의 이용조건 및 절차, 이용자와 당 사이트의 권리, 의무, 책임사항과 기타 필요한 사항을 규정함을 목적으로 합니다.</p>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-medium text-white mb-3">제 2 조 (약관의 효력과 변경)</h3>
                  <ol className="list-decimal list-inside space-y-2 ml-4">
                    <li>당 사이트는 귀하가 본 약관 내용에 동의하는 것을 조건으로 귀하에게 서비스를 수집 및 제공할 것이며, 귀하가 본 약관의 내용에 동의하는 경우, 당 사이트의 서비스 제공 행위 및 귀하의 서비스 사용 행위에는 본 약관이 우선적으로 적용될 것입니다.</li>
                    <li>당 사이트는 본 약관을 사전 고지 없이 변경할 수 있으며, 변경된 약관은 당 사이트 내에 공지함으로써 이용자가 직접 확인하도록 할 것입니다. 이용자가 변경된 약관에 동의하지 아니하는 경우, 이용자는 본인의 회원등록을 취소(회원탈퇴)할 수 있으며, 계속 사용의 경우는 약관 변경에 대한 동의로 간주됩니다. 변경된 약관은 공지와 동시에 그 효력이 발생됩니다.</li>
                  </ol>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-medium text-white mb-3">제 3 조 (약관외 준칙)</h3>
                  <ol className="list-decimal list-inside space-y-2 ml-4">
                    <li>본 약관은 당 사이트가 제공하는 서비스에 관한 이용규정 및 별도 약관과 함께 적용됩니다.</li>
                    <li>본 약관에 명시되지 않은 사항은 전기통신기본법, 전기통신사업법, 정보통신윤리위원회심의규정, 정보통신 윤리강령, 저작권법 및 기타 관련 법령의 규정에 의합니다.</li>
                  </ol>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-medium text-white mb-3">제 4 조 (용어의 정의)</h3>
                  <p className="mb-3">본 약관에서 사용하는 용어의 정의는 다음과 같습니다.</p>
                  <ol className="list-decimal list-inside space-y-2 ml-4">
                    <li>이용자: 본 약관에 따라 당 사이트가 제공하는 서비스를 받는 자.</li>
                    <li>가입: 당 사이트가 제공하는 신청서 양식에 해당 정보를 기입하고, 본 약관에 동의하여 서비스 이용계약을 완료시키는 행위</li>
                    <li>회원: 당 사이트에 개인 정보를 제공하여 회원 등록을 한 자로서, 당 사이트의 정보를 제공받으며, 당 사이트가 제공하는 서비스를 이용할 수 있는 자.</li>
                    <li>회원ID: 영어소문자 또는 영어소문자와 숫자를 결합한 4자리 이상 10자리 미만의 조합.</li>
                    <li>비밀번호: 이용자와 회원ID가 일치하는지를 확인하고 통신상의 자신의 비밀보호를 위하여 이용자 자신이 선정한 문자와 숫자의 조합.</li>
                    <li>탈퇴: 회원이 이용계약을 종료 시키는 행위</li>
                    <li>본 약관에서 정의하지 않은 용어는 개별서비스에 대한 별도 약관 및 이용규정에서 정의합니다.</li>
                  </ol>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-green-400 mb-4">제 2장 서비스의 제공 및 이용</h2>
                
                <div className="mb-6">
                  <h3 className="text-xl font-medium text-white mb-3">제 5조 (이용계약체결)</h3>
                  <p className="mb-3">①이용계약은 &ldquo;회원&rdquo;이 되고자 하는 자(이하 &ldquo;가입신청자&rdquo;)가 약관의 내용에 대하여 동의를 한 다음 회원가입신청을 하고 &ldquo;중앙응급의료센터&rdquo;가 이러한 신청에 대하여 승낙함으로써 체결됩니다.</p>
                  <p className="mb-3">②&ldquo;중앙응급의료센터&rdquo;는 &ldquo;가입신청자&rdquo;의 신청에 대하여 &ldquo;서비스&rdquo; 이용을 승낙함을 원칙으로 합니다. 다만, &ldquo;중앙응급의료센터&rdquo;는 다음 각 호에 해당하는 신청에 대하여는 승낙을 하지 않거나 사후에 이용계약을 해지할 수 있습니다.</p>
                  <ol className="list-decimal list-inside space-y-1 ml-4 text-sm">
                    <li>가입신청자가 이 약관에 의하여 이전에 회원자격을 상실한 적이 있는 경우, 단 &ldquo;중앙응급의료센터&rdquo;의 회원 재가입 승낙을 얻은 경우에는 예외로 함.</li>
                    <li>실명이 아니거나 타인의 명의를 이용한 경우</li>
                    <li>허위의 정보를 기재하거나, &ldquo;중앙응급의료센터&rdquo;가 제시하는 내용을 기재하지 않은 경우</li>
                    <li>응급의료와 관련된 업무를 수행하지 않는 경우</li>
                    <li>이용자의 귀책사유로 인하여 승인이 불가능하거나 기타 규정한 제반 사항을 위반하며 신청하는 경우</li>
                  </ol>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-medium text-white mb-3">제 6 조 (서비스 이용시간)</h3>
                  <ol className="list-decimal list-inside space-y-2 ml-4">
                    <li>서비스 이용시간은 당 사이트의 업무상 또는 기술상 특별한 지장이 없는 한 연중무휴, 1일 24시간을 원칙으로 합니다.</li>
                    <li>제1항의 이용시간은 정기점검 등의 필요로 인하여 당 사이트가 정한 날 또는 시간은 예외로 합니다.</li>
                  </ol>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-green-400 mb-4">제 3 장 의무 및 책임</h2>
                
                <div className="mb-6">
                  <h3 className="text-xl font-medium text-white mb-3">제 12 조 (당 사이트의 의무)</h3>
                  <ol className="list-decimal list-inside space-y-2 ml-4">
                    <li>당 사이트는 법령과 본 약관이 금지하거나 미풍양속에 반하는 행위를 하지않으며, 계속적, 안정적으로 서비스를 제공하기 위해 노력할 의무가 있습니다.</li>
                    <li>당 사이트는 회원의 개인 신상 정보를 본인의 승낙 없이 타인에게 누설, 배포하지 않습니다. 다만, 회원정보보호법 등 관계법령에 의하여 관계 국가기관 등의 요구가 있는 경우에는 그러하지 아니합니다.</li>
                    <li>당 사이트는 이용자가 안전하게 당 사이트 서비스를 이용할 수 있도록 이용자의 회원정보(신용정보 포함) 보호를 위한 보안시스템을 갖추어야 합니다.</li>
                  </ol>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-medium text-white mb-3">제 13조 (회원의 의무)</h3>
                  <ol className="list-decimal list-inside space-y-2 ml-4">
                    <li>회원 가입시에 요구되는 정보는 정확하게 기입하여야 합니다. 또한 이미 제공된 귀하에 대한 정보가 정확한 정보가 되도록 유지, 갱신하여야 하며, 회원은 자신의 ID 및 비밀번호를 제3자에게 이용하게 해서는 안됩니다.</li>
                    <li>회원은 당 사이트의 사전 승낙 없이 서비스를 이용하여 어떠한 영리행위도 할 수 없습니다.</li>
                    <li>회원은 당 사이트 서비스를 이용하여 얻은 정보를 당 사이트의 사전승낙 없이 복사, 복제, 변경, 번역, 출판, 방송 기타의 방법으로 사용하거나 이를 타인에게 제공할 수 없습니다.</li>
                  </ol>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-green-400 mb-4">제 4 장 기타</h2>
                
                <div className="mb-6">
                  <h3 className="text-xl font-medium text-white mb-3">제 18 조 (관할법원)</h3>
                  <p>본 서비스 이용과 관련하여 발생한 분쟁에 대해 소송이 제기될 경우 중앙응급의료센터 본원 소재지 관할 법원을 전속적 관할 법원으로 합니다.</p>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-medium text-white mb-3">부 칙</h3>
                  <p className="font-semibold">1. (시행일) 본 약관은 2025년 9월 12일부터 시행됩니다.</p>
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