'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { ROLE_ACCESS_MATRIX } from '@/lib/auth/role-matrix';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { AdminFullView } from '@/components/inspection/AdminFullView';
import { LocalMobileView, LocalDesktopView } from '@/components/inspection/LocalFullView';
import { ReadOnlyView } from '@/components/inspection/ReadOnlyView';
import { AssignedOnlyView } from '@/components/inspection/AssignedOnlyView';
import { AccessDeniedView } from '@/components/inspection/AccessDeniedView';
import { UserProfile } from '@/packages/types';

interface InspectionPageClientProps {
  initialProfile?: UserProfile;
}

function LoadingSpinner() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
    </div>
  );
}

function ErrorPage({ message }: { message: string }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-red-600 mb-2">오류 발생</h2>
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
}

export default function InspectionPageClient({ initialProfile }: InspectionPageClientProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const isMobile = useMediaQuery('(max-width: 768px)');

  // 프로필 사용 (초기 프로필 또는 auth에서 가져온 프로필)
  const profile = initialProfile || user;

  // 인증 상태 확인
  useEffect(() => {
    if (!authLoading && !profile) {
      router.push('/auth/signin');
    }
  }, [authLoading, profile, router]);

  // 역할별 접근 권한 확인
  useEffect(() => {
    if (!authLoading && profile?.role) {
      const accessRights = ROLE_ACCESS_MATRIX[profile.role];

      if (!accessRights?.canAccessInspection) {
        router.push(accessRights?.fallbackRoute || '/dashboard');
      }
    }
  }, [authLoading, profile, router]);

  // 로딩 중
  if (authLoading && !profile) {
    return <LoadingSpinner />;
  }

  // 사용자 없음
  if (!profile) {
    return null; // useEffect에서 리다이렉트 처리
  }

  // 역할별 UI 렌더링
  const accessRights = ROLE_ACCESS_MATRIX[profile.role];
  if (!accessRights) {
    console.error(`[InspectionPageClient] Invalid role: ${profile.role}`);
    return <ErrorPage message="Invalid user role" />;
  }

  // UI 모드별 컴포넌트 렌더링
  switch (accessRights.inspectionUIMode) {
    case 'admin-full':
      return <AdminFullView user={profile} isMobile={isMobile} pageType="inspection" />;

    case 'local-full':
      return isMobile ?
        <LocalMobileView user={profile} /> :
        <LocalDesktopView user={profile} />;

    case 'read-only':
      return <ReadOnlyView user={profile} role={profile.role} />;

    case 'assigned-only':
      return <AssignedOnlyView user={profile} />;

    default:
      // null인 경우 (pending_approval, email_verified)
      return <AccessDeniedView role={profile.role} />;
  }
}