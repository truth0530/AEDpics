import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { ROLE_ACCESS_MATRIX } from '@/lib/auth/role-matrix';
import InspectionPageClient from './InspectionPageClient';
import { getCachedAuthUser, getCachedUserProfile } from '@/lib/auth/cached-queries';
import { InspectionPageSkeleton } from '@/components/inspection/InspectionPageSkeleton';

export default async function InspectionPage() {
  // 캐싱된 사용자 조회 (layout에서 이미 조회했으므로 캐시에서 즉시 반환)
  const user = await getCachedAuthUser();

  if (!user) {
    redirect('/auth/signin');
  }

  // 캐싱된 프로필 조회 (layout에서 이미 조회했으므로 캐시에서 즉시 반환)
  const typedProfile = await getCachedUserProfile(user.id);

  if (!typedProfile) {
    redirect('/auth/update-profile');
  }

  // 역할 검증
  const accessRights = ROLE_ACCESS_MATRIX[typedProfile.role];
  if (!accessRights?.canAccessInspection) {
    redirect(accessRights?.fallbackRoute || '/dashboard');
  }

  // Suspense로 감싸서 로딩 중 스켈레톤 표시 (성능 최적화)
  return (
    <Suspense fallback={<InspectionPageSkeleton />}>
      <InspectionPageClient initialProfile={typedProfile} />
    </Suspense>
  );
}
