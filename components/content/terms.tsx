export function TermsContent() {
  return (
    <div className="space-y-4 text-gray-300">
      <section>
        <h3 className="text-lg font-semibold text-white mb-2">제1조 (목적)</h3>
        <p className="text-sm leading-relaxed">
          본 약관은 국립중앙의료원(이하 &ldquo;기관&rdquo;)이 제공하는 AED 점검 관리 시스템(이하 &ldquo;서비스&rdquo;)의 이용에 관한 조건과 절차, 
          기관과 이용자의 권리와 의무 및 책임사항을 규정함을 목적으로 합니다.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-white mb-2">제2조 (정의)</h3>
        <ul className="text-sm space-y-1 list-disc list-inside">
          <li>&ldquo;서비스&rdquo;란 기관이 제공하는 AED 장치 점검 및 관리 플랫폼을 의미합니다.</li>
          <li>&ldquo;이용자&rdquo;란 본 약관에 따라 서비스를 이용하는 공공기관 소속 직원을 의미합니다.</li>
          <li>&ldquo;AED&rdquo;란 자동제세동기(Automated External Defibrillator)를 의미합니다.</li>
        </ul>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-white mb-2">제3조 (서비스 이용)</h3>
        <p className="text-sm leading-relaxed">
          1. 서비스는 공공기관 소속 직원만 이용할 수 있으며, 가입 시 공공기관 이메일 인증이 필요합니다.<br/>
          2. 이용자는 정확한 정보를 제공해야 하며, 변경사항이 있을 경우 즉시 수정해야 합니다.<br/>
          3. 서비스 이용은 관리자의 승인 후 가능합니다.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-white mb-2">제4조 (이용자의 의무)</h3>
        <ul className="text-sm space-y-1 list-disc list-inside">
          <li>AED 점검 데이터를 정확하게 입력해야 합니다.</li>
          <li>타인의 정보를 도용하거나 허위 정보를 입력해서는 안 됩니다.</li>
          <li>서비스를 이용하여 법령이나 공공질서, 미풍양속에 반하는 행위를 해서는 안 됩니다.</li>
          <li>서비스의 정상적인 운영을 방해하는 행위를 해서는 안 됩니다.</li>
        </ul>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-white mb-2">제5조 (서비스 제공 및 변경)</h3>
        <p className="text-sm leading-relaxed">
          1. 서비스는 연중무휴, 1일 24시간 제공함을 원칙으로 합니다.<br/>
          2. 기관은 서비스 개선을 위해 사전 고지 후 서비스를 변경할 수 있습니다.<br/>
          3. 시스템 점검, 통신장애 등 불가피한 사유가 있는 경우 서비스가 일시 중단될 수 있습니다.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-white mb-2">제6조 (지적재산권)</h3>
        <p className="text-sm leading-relaxed">
          서비스에 포함된 모든 콘텐츠와 소프트웨어는 기관의 지적재산이며, 
          이용자는 서비스 이용 목적으로만 사용할 수 있습니다.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-white mb-2">제7조 (면책조항)</h3>
        <p className="text-sm leading-relaxed">
          1. 기관은 천재지변, 불가항력 등으로 서비스를 제공할 수 없는 경우 책임이 면제됩니다.<br/>
          2. 기관은 이용자의 귀책사유로 인한 서비스 이용 장애에 대해 책임지지 않습니다.<br/>
          3. 기관은 이용자가 서비스를 통해 얻은 정보의 정확성에 대해 보증하지 않습니다.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-white mb-2">제8조 (분쟁 해결)</h3>
        <p className="text-sm leading-relaxed">
          본 약관과 관련하여 분쟁이 발생한 경우, 기관과 이용자는 상호 협의하여 해결하는 것을 원칙으로 하며, 
          협의가 이루어지지 않을 경우 관할 법원은 서울중앙지방법원으로 합니다.
        </p>
      </section>

      <section className="pt-4 border-t border-gray-700">
        <p className="text-xs text-gray-400">
          시행일: 2025년 1월 1일<br/>
          국립중앙의료원 AED 관리팀
        </p>
      </section>
    </div>
  );
}