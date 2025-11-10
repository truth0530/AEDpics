'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { canApproveUsers } from '@/lib/auth/config';
import { useSidebar } from '@/components/ui/sidebar';
import type { UserProfile } from '@/packages/types';

interface ProfileDropdownProps {
  user: UserProfile;
  pendingApprovalCount: number;
}

export function ProfileDropdown({ user, pendingApprovalCount }: ProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { collapsed } = useSidebar();
  const isExpanded = !collapsed;

  const isAdmin = canApproveUsers(user.role);
  const hasPendingApprovals = pendingApprovalCount > 0;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSignOut = async () => {
    try {
      // signOut 완료를 기다림
      await signOut({
        redirect: false
      });
    } catch (error) {
      console.error('로그아웃 처리 중 오류:', error);
      // 실패해도 로그인 페이지로 이동하여 사용자를 갇히게 하지 않음
    }

    // 성공/실패 여부와 관계없이 로그인 페이지로 이동
    window.location.href = '/auth/signin';
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="relative w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 hover:bg-gray-800/80 hover:text-white text-gray-400"
      >
        <div className="relative w-5 h-5 bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-white font-medium text-[10px]">
            {getInitials(user.fullName || user.email || 'U')}
          </span>
          {/* 접힌 상태에서 보이는 배지 */}
          {!isExpanded && isAdmin && hasPendingApprovals && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
              {pendingApprovalCount > 9 ? '9' : pendingApprovalCount}
            </span>
          )}
        </div>

        {isExpanded && (
          <>
            <span className="whitespace-nowrap overflow-hidden text-ellipsis">
              {user.fullName || user.email || '프로필'}
            </span>

            {/* 펼쳐진 상태에서 보이는 배지 */}
            {isAdmin && hasPendingApprovals && (
              <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                {pendingApprovalCount > 9 ? '9+' : pendingApprovalCount}
              </span>
            )}
          </>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-gray-800 rounded-lg shadow-xl border border-gray-700 py-1 z-[200]">
          {/* 사용자 정보 */}
          <div className="px-4 py-3 border-b border-gray-700">
            <div className="text-sm font-medium text-white">{user.fullName || '사용자'}</div>
            <div className="text-sm text-gray-300">{user.email}</div>
            <div className="text-xs text-gray-400 mt-1">
              {user.organization?.name || '조직 없음'}
            </div>
          </div>

          {/* 메뉴 항목들 */}
          <div className="py-1">
            <Link
              href="/profile"
              className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
              onClick={() => setIsOpen(false)}
            >
              프로필 설정
            </Link>

            {isAdmin && (
              <Link
                href="/admin/users"
                className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors relative"
                onClick={() => setIsOpen(false)}
              >
                사용자 관리
                {hasPendingApprovals && (
                  <span className="ml-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                    {pendingApprovalCount}
                  </span>
                )}
              </Link>
            )}

            {isAdmin && (
              <Link
                href="/admin/organizations"
                className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                onClick={() => setIsOpen(false)}
              >
                조직 관리
              </Link>
            )}

            <hr className="my-1 border-gray-700" />

            <button
              onClick={handleSignOut}
              className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-900/30 hover:text-red-300 transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>
      )}
    </div>
  );
}