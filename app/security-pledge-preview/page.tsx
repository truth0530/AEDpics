import { SecurityPledge } from "@/components/security/SecurityPledge";

export default function SecurityPledgePreviewPage() {
    return <SecurityPledge preview={true} />;
}

export const metadata = {
    title: "보안 서약서 미리보기 | AED 점검 시스템",
    description: "임시점검원 보안 서약서 및 개인정보 수집 동의 내용을 미리 확인하실 수 있습니다.",
};