import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { canAccessAEDData } from '@/lib/auth/access-control';
import { AEDDataPageClient } from './AEDDataPageClient';
import { getCachedAuthUser, getCachedUserProfile } from '@/lib/auth/cached-queries';
import { AEDDataPageSkeleton } from '@/components/aed-data/AEDDataPageSkeleton';

type SearchParams = Record<string, string | string[] | undefined>;

interface AEDDataPageProps {
  searchParams?: Promise<SearchParams>;
}

export default async function AEDDataPage({ searchParams }: AEDDataPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};

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

  if (!canAccessAEDData(typedProfile)) {
    redirect('/dashboard');
  }

  // 초기 필터에 사용자의 관할 지역 추가 (초기 렌더링부터 적용)
  const enhancedFilters = {
    ...resolvedSearchParams,
  };

  // region 필터가 없고 사용자에게 관할 지역이 있으면 추가
  if (!enhancedFilters.region && typedProfile.organization?.regionCode) {
    enhancedFilters.region = typedProfile.organization.regionCode;
    console.log('[AEDDataPage] Added region to initialFilters:', enhancedFilters.region);
  }

  console.log('[AEDDataPage] Enhanced filters:', enhancedFilters);

  // Suspense로 감싸서 로딩 중 스켈레톤 표시 (성능 최적화)
  return (
    <Suspense fallback={<AEDDataPageSkeleton />}>
      <AEDDataPageClient initialFilters={enhancedFilters} userProfile={typedProfile} />
    </Suspense>
  );
}
