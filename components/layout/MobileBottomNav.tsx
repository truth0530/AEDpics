'use client';

import { memo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { UserProfile } from '@/packages/types';

interface MobileBottomNavProps {
  canAccessAedData: boolean;
  canAccessInspection: boolean;
  user: UserProfile;
  pendingApprovalCount: number;
}

// 성능 최적화: 메모이제이션으로 불필요한 리렌더링 방지
function MobileBottomNavComponent({ canAccessAedData, canAccessInspection, user, pendingApprovalCount }: MobileBottomNavProps) {
  const pathname = usePathname();

  const navigationItems = [
    {
      id: 'aed-data',
      label: '일정관리',
      href: '/aed-data',
      icon: (active: boolean) => (
        <svg className={`w-6 h-6 ${active ? 'text-blue-400' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v14a2 2 0 01-2 2z" />
        </svg>
      ),
      show: canAccessAedData
    },
    {
      id: 'inspection',
      label: '현장점검',
      href: '/inspection',
      icon: (active: boolean) => (
        <svg className={`w-6 h-6 ${active ? 'text-blue-400' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      show: canAccessInspection
    },
    {
      id: 'dashboard',
      label: '대시보드',
      href: '/dashboard',
      icon: (active: boolean) => (
        <svg className={`w-6 h-6 ${active ? 'text-blue-400' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      show: true
    }
  ];

  const visibleItems = navigationItems.filter(item => item.show);

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-xl border-t border-gray-700 z-50 md:hidden">
      <div className="flex items-center py-2">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.id === 'dashboard' && pathname === '/') ||
            (item.href !== '/' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex flex-col items-center py-1 px-2 rounded-lg transition-colors min-w-0 flex-1 ${
                isActive ? 'bg-gray-800/50' : 'hover:bg-gray-800/30'
              }`}
            >
              <div className="mb-1">
                {item.icon(isActive)}
              </div>
              <span className={`text-xs font-medium truncate ${
                isActive ? 'text-blue-400' : 'text-gray-400'
              }`}>
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* 설정 버튼 */}
        <Link
          href="/profile/menu"
          className={`flex flex-col items-center py-1 px-2 rounded-lg transition-colors min-w-0 flex-1 relative ${
            pathname === '/profile/menu' || pathname.startsWith('/profile') || pathname.startsWith('/admin')
              ? 'bg-gray-800/50' : 'hover:bg-gray-800/30'
          }`}
        >
          <div className="mb-1 relative">
            <svg className={`w-6 h-6 ${
              pathname === '/profile/menu' || pathname.startsWith('/profile') || pathname.startsWith('/admin')
                ? 'text-blue-400' : 'text-gray-400'
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {pendingApprovalCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {pendingApprovalCount > 99 ? '99+' : pendingApprovalCount}
              </span>
            )}
          </div>
          <span className={`text-xs font-medium truncate ${
            pathname === '/profile/menu' || pathname.startsWith('/profile') || pathname.startsWith('/admin')
              ? 'text-blue-400' : 'text-gray-400'
          }`}>
            설정
          </span>
        </Link>
      </div>
    </div>
  );
}

// 메모이제이션된 컴포넌트 export
export const MobileBottomNav = memo(MobileBottomNavComponent);