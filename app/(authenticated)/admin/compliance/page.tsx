import ComplianceMainLayout from '@/components/admin/compliance/ComplianceMainLayout';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '의무기관매칭 | AEDpics',
  description: '구비의무기관의 AED 설치 현황을 확인하고 관리합니다',
};

export default function CompliancePage() {
  return (
    <div className="h-full">
      <ComplianceMainLayout />
    </div>
  );
}