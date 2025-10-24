/**
 * Header Component
 *
 * Features:
 * - Mobile menu button
 * - Page title
 * - Notification bell
 * - User avatar
 */

'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<number>(0);

  const pageTitles: Record<string, string> = {
    '/dashboard': '대시보드',
    '/aed-data': 'AED 장비 현황',
    '/inspections': '점검 관리',
    '/assignments': '배정 관리',
    '/admin/users': '사용자 관리',
    '/admin/audit-logs': '감사 로그',
    '/settings': '설정',
  };

  const pageTitle = pageTitles[pathname] || 'AED 점검 시스템';

  useEffect(() => {
    fetchNotificationCount();
  }, []);

  async function fetchNotificationCount() {
    try {
      const response = await fetch('/api/notifications/count');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.count || 0);
      }
    } catch (error) {
      console.error('[Header] Failed to fetch notification count:', error);
    }
  }

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Mobile menu button + Page title */}
          <div className="flex items-center">
            <button
              onClick={onMenuClick}
              className="lg:hidden mr-4 text-gray-500 hover:text-gray-700"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <h1 className="text-xl font-semibold text-gray-900">{pageTitle}</h1>
          </div>

          {/* Right: Notifications */}
          <div className="flex items-center space-x-4">
            {/* Notification bell */}
            <button className="relative p-2 text-gray-500 hover:text-gray-700">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              {notifications > 0 && (
                <span className="absolute top-1 right-1 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
                  {notifications > 9 ? '9+' : notifications}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
