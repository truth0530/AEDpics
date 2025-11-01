import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import ComplianceMainLayout from '@/components/admin/compliance/ComplianceMainLayout';
import { getCachedAuthUser, getCachedUserProfile } from '@/lib/auth/cached-queries';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '의무기관매칭 | AEDpics',
  description: '구비의무기관의 AED 설치 현황을 확인하고 관리합니다',
};

export default async function CompliancePage() {
  const user = await getCachedAuthUser();

  if (!user) {
    redirect('/auth/signin');
  }

  const typedProfile = await getCachedUserProfile(user.id);

  if (!typedProfile) {
    redirect('/auth/update-profile');
  }

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
      </div>
    }>
      <div className="h-full">
        <ComplianceMainLayout initialProfile={typedProfile} />
      </div>
    </Suspense>
  );
}