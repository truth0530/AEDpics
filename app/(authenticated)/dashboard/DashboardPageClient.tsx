'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserProfile } from '@/packages/types';
import { ROLE_ACCESS_MATRIX, getDashboardUIMode } from '@/lib/auth/role-matrix';
import { useAuth } from '@/lib/hooks/useAuth';

// 역할별 대시보드 컴포넌트 import (추후 생성)
import AdminFullDashboard from '@/components/dashboard/AdminFullDashboard';
import LocalFullDashboard from '@/components/dashboard/LocalFullDashboard';
import ReadOnlyDashboard from '@/components/dashboard/ReadOnlyDashboard';
import InspectorOnlyDashboard from '@/components/dashboard/InspectorOnlyDashboard';
import AccessDeniedView from '@/components/dashboard/AccessDeniedView';

interface DashboardPageClientProps {
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

export default function DashboardPageClient({ initialProfile }: DashboardPageClientProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

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

      if (!accessRights?.canAccessDashboard) {
        router.push(accessRights?.fallbackRoute || '/inspection');
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
    console.error(`[DashboardPageClient] Invalid role: ${profile.role}`);
    return <ErrorPage message="Invalid user role" />;
  }

  // UI 모드별 컴포넌트 렌더링
  const dashboardMode = getDashboardUIMode(profile.role);

  switch (dashboardMode) {
    case 'admin-full':
      return <AdminFullDashboard user={profile} />;

    case 'local-full':
      return <LocalFullDashboard user={profile} />;

    case 'read-only':
      return <ReadOnlyDashboard user={profile} />;

    case 'inspector-only':
      return <InspectorOnlyDashboard user={profile} />;

    default:
      // null인 경우 (pending_approval, email_verified, rejected)
      return <AccessDeniedView role={profile.role} />;
  }
}
