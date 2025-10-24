/**
 * Sidebar Navigation Component
 *
 * Features:
 * - Navigation links
 * - Role-based menu items
 * - Mobile responsive
 */

'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UserProfile {
  name: string;
  email: string;
  role: string;
  organization?: string;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    fetchUserProfile();
  }, []);

  async function fetchUserProfile() {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      }
    } catch (error) {
      console.error('[Sidebar] Failed to fetch user profile:', error);
    }
  }

  const navigationItems = [
    {
      name: '대시보드',
      href: '/dashboard',
      icon: '📊',
      roles: ['viewer', 'inspector', 'admin', 'master'],
    },
    {
      name: 'AED 장비 현황',
      href: '/aed-data',
      icon: '🚑',
      roles: ['viewer', 'inspector', 'admin', 'master'],
    },
    {
      name: '점검 관리',
      href: '/inspections',
      icon: '✅',
      roles: ['inspector', 'admin', 'master'],
    },
    {
      name: '배정 관리',
      href: '/assignments',
      icon: '📋',
      roles: ['admin', 'master'],
    },
    {
      name: '사용자 관리',
      href: '/admin/users',
      icon: '👥',
      roles: ['admin', 'master'],
    },
    {
      name: '감사 로그',
      href: '/admin/audit-logs',
      icon: '📝',
      roles: ['admin', 'master'],
    },
    {
      name: '설정',
      href: '/settings',
      icon: '⚙️',
      roles: ['viewer', 'inspector', 'admin', 'master'],
    },
  ];

  const filteredItems = navigationItems.filter((item) =>
    user ? item.roles.includes(user.role) : false
  );

  const isActive = (href: string) => pathname === href;

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200 pt-5 pb-4 overflow-y-auto">
          {/* Logo */}
          <div className="flex items-center flex-shrink-0 px-4">
            <h1 className="text-2xl font-bold text-blue-600">AED 점검 시스템</h1>
          </div>

          {/* User info */}
          {user && (
            <div className="mt-5 px-4 py-3 bg-gray-50 border-y border-gray-200">
              <p className="text-sm font-medium text-gray-900">{user.name || user.email}</p>
              <p className="text-xs text-gray-500 mt-1">
                {user.role === 'master' && '마스터'}
                {user.role === 'admin' && '관리자'}
                {user.role === 'inspector' && '점검자'}
                {user.role === 'viewer' && '조회자'}
              </p>
              {user.organization && (
                <p className="text-xs text-gray-500">{user.organization}</p>
              )}
            </div>
          )}

          {/* Navigation */}
          <nav className="mt-5 flex-1 px-2 space-y-1">
            {filteredItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`
                  group flex items-center px-2 py-2 text-sm font-medium rounded-md
                  ${
                    isActive(item.href)
                      ? 'bg-blue-100 text-blue-900'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
              >
                <span className="mr-3 text-lg">{item.icon}</span>
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Logout button */}
          <div className="flex-shrink-0 px-2 pb-2">
            <button
              onClick={async () => {
                try {
                  await fetch('/api/auth/logout', { method: 'POST' });
                  router.push('/login');
                } catch (error) {
                  console.error('[Sidebar] Logout failed:', error);
                }
              }}
              className="group flex items-center w-full px-2 py-2 text-sm font-medium text-red-600 rounded-md hover:bg-red-50"
            >
              <span className="mr-3 text-lg">🚪</span>
              로그아웃
            </button>
          </div>
        </div>
      </div>

      {/* Mobile sidebar */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white transform transition-transform duration-300 ease-in-out lg:hidden
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex flex-col flex-grow pt-5 pb-4 overflow-y-auto">
          {/* Logo & Close button */}
          <div className="flex items-center justify-between px-4">
            <h1 className="text-xl font-bold text-blue-600">AED 점검 시스템</h1>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {/* User info */}
          {user && (
            <div className="mt-5 px-4 py-3 bg-gray-50 border-y border-gray-200">
              <p className="text-sm font-medium text-gray-900">{user.name || user.email}</p>
              <p className="text-xs text-gray-500 mt-1">
                {user.role === 'master' && '마스터'}
                {user.role === 'admin' && '관리자'}
                {user.role === 'inspector' && '점검자'}
                {user.role === 'viewer' && '조회자'}
              </p>
            </div>
          )}

          {/* Navigation */}
          <nav className="mt-5 flex-1 px-2 space-y-1">
            {filteredItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={`
                  group flex items-center px-2 py-2 text-sm font-medium rounded-md
                  ${
                    isActive(item.href)
                      ? 'bg-blue-100 text-blue-900'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
              >
                <span className="mr-3 text-lg">{item.icon}</span>
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Logout button */}
          <div className="flex-shrink-0 px-2 pb-2">
            <button
              onClick={async () => {
                try {
                  await fetch('/api/auth/logout', { method: 'POST' });
                  router.push('/login');
                } catch (error) {
                  console.error('[Sidebar] Logout failed:', error);
                }
              }}
              className="group flex items-center w-full px-2 py-2 text-sm font-medium text-red-600 rounded-md hover:bg-red-50"
            >
              <span className="mr-3 text-lg">🚪</span>
              로그아웃
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
