import ComplianceCompletedList from '@/components/admin/compliance/ComplianceCompletedList';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '설치확인 완료 | AEDpics',
  description: '의무설치기관 AED 설치확인 완료 현황',
};

export default function ComplianceCompletedPage() {
  return (
    <div className="container mx-auto p-6">
      <ComplianceCompletedList />
    </div>
  );
}