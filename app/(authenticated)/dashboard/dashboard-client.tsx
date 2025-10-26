'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { hasPermission, canApproveUsers } from '@/lib/auth/config';
import { UserRole } from '@/packages/types';
import { PendingApprovalAlert } from '@/components/admin/PendingApprovalAlert';
import { NotificationBadge } from '@/components/admin/NotificationBadge';
import { AdminDashboardStats } from '@/components/admin/AdminDashboardStats';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  organization_name?: string;
  region?: string;
}

interface DashboardClientProps {
  profile: UserProfile;
  initialStats: {
    totalDevices: number;
    needsInspection: number;
    expiringSoon: number;
    todayInspections: number;
  };
  pendingApprovalCount?: number;
  canAccessAedData: boolean;
  canAccessInspection: boolean;
}

export default function DashboardClient({
  profile,
  initialStats,
  pendingApprovalCount = 0,
  canAccessAedData,
  canAccessInspection,
}: DashboardClientProps) {
  const router = useRouter();
  const [stats] = useState(initialStats);

  const handleSignOut = async () => {
    // TODO: Replace with API call - await supabase.auth.signOut();
    router.push('/auth/signin');
  };

  return (
    <div className="min-h-screen bg-black">
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-white">
                AED 스마트 점검 시스템
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              {canApproveUsers(profile?.role || ('local_admin' as UserRole)) && (
                <NotificationBadge count={pendingApprovalCount} />
              )}
              <button
                onClick={() => router.push('/profile')}
                className="text-gray-400 hover:text-white text-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {profile?.full_name}
              </button>
              <span className="text-gray-500 text-sm">({profile?.role})</span>
              <button onClick={handleSignOut} className="text-gray-400 hover:text-white text-sm">
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {canApproveUsers(profile?.role || ('local_admin' as UserRole)) && (
          <PendingApprovalAlert count={pendingApprovalCount} />
        )}

        {canApproveUsers(profile?.role || ('local_admin' as UserRole)) && (
          <div className="mb-8">
            <AdminDashboardStats currentUserRole={profile?.role || ('local_admin' as UserRole)} />
          </div>
        )}

        <div>
          <h2 className="text-lg font-semibold text-white mb-4">AED 장치 현황</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
              <div className="text-gray-400 text-sm mb-2">전체 AED</div>
              <div className="text-3xl font-bold text-white">{stats.totalDevices}</div>
            </div>
            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
              <div className="text-gray-400 text-sm mb-2">점검 필요</div>
              <div className="text-3xl font-bold text-red-400">{stats.needsInspection}</div>
            </div>
            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
              <div className="text-gray-400 text-sm mb-2">만료 임박</div>
              <div className="text-3xl font-bold text-yellow-400">{stats.expiringSoon}</div>
            </div>
            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
              <div className="text-gray-400 text-sm mb-2">오늘 점검</div>
              <div className="text-3xl font-bold text-green-400">{stats.todayInspections}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {hasPermission(profile?.role || ('local_admin' as UserRole), 'inspection.perform') && (
            <button
              onClick={() => router.push('/inspection/new')}
              className="bg-green-500 hover:bg-green-600 text-white rounded-lg p-6 text-left transition-colors"
            >
              <div className="text-xl font-semibold mb-2">새 점검 시작</div>
              <div className="text-sm opacity-90">AED 정기 점검 수행</div>
            </button>
          )}

          {canAccessAedData && (
            <button
              onClick={() => router.push('/aed-data')}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg p-6 text-left transition-colors"
            >
              <div className="text-xl font-semibold mb-2">AED 데이터 조회</div>
              <div className="text-sm opacity-90">전국/지역 AED 현황 조회</div>
            </button>
          )}

          {canAccessInspection && (
            <button
              onClick={() => router.push('/inspection')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg p-6 text-left transition-colors"
            >
              <div className="text-xl font-semibold mb-2">AED 점검하기</div>
              <div className="text-sm.opacity-90">관할 장비 즉시 점검</div>
            </button>
          )}


          <button
            onClick={() => router.push('/reports')}
            className="bg-gray-800 hover:bg-gray-700 text-white rounded-lg p-6 text-left transition-colors"
          >
            <div className="text-xl font-semibold mb-2">보고서</div>
            <div className="text-sm opacity-90">점검 현황 및 통계</div>
          </button>
        </div>

        {hasPermission(profile?.role || ('local_admin' as UserRole), 'users.manage') && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-white mb-4">관리자 메뉴</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => router.push('/admin/users')}
                className="bg-gray-800 hover:bg-gray-700 text-white rounded-lg p-4 text-left transition-colors"
              >
                <div className="font-semibold">사용자 관리</div>
                <div className="text-sm text-gray-400">승인 대기 및 권한 설정</div>
              </button>
              <button
                onClick={() => router.push('/admin/organizations')}
                className="bg-gray-800 hover:bg-gray-700 text-white rounded-lg p-4 text-left transition-colors"
              >
                <div className="font-semibold">조직 관리</div>
                <div className="text-sm text-gray-400">보건소 및 지역 설정</div>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
