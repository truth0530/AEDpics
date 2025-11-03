import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { ROLE_ACCESS_MATRIX } from '@/lib/auth/role-matrix';
import DashboardPageClient from './DashboardPageClient';
import { getCachedAuthUser, getCachedUserProfile } from '@/lib/auth/cached-queries';

export default async function DashboardPage() {
  // 캐싱된 사용자 조회
  const user = await getCachedAuthUser();

  if (!user) {
    redirect('/auth/signin');
  }

  // 캐싱된 프로필 조회
  const typedProfile = await getCachedUserProfile(user.id);

  if (!typedProfile) {
    console.error('Profile not found in dashboard page - this should not happen');
    redirect('/auth/signin');
  }

  // 역할 검증
  const accessRights = ROLE_ACCESS_MATRIX[typedProfile.role];
  if (!accessRights?.canAccessDashboard) {
    redirect(accessRights?.fallbackRoute || '/inspection');
  }

  // getCachedUserProfile에서 이미 Decimal을 Number로 변환했으므로 바로 사용 가능
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
      </div>
    }>
      <DashboardPageClient initialProfile={typedProfile} />
    </Suspense>
  );
}