'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { canApproveUsers } from '@/lib/auth/config'
import type { UserProfile } from '@/packages/types'

interface ProfileMenuClientProps {
  user: UserProfile
  pendingApprovalCount: number
}

export function ProfileMenuClient({ user, pendingApprovalCount }: ProfileMenuClientProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const router = useRouter()

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      // TODO: Replace with API call - await supabase.auth.signOut()
      router.push('/auth/signin')
    } catch (error) {
      console.error('Logout error:', error)
      setIsLoggingOut(false)
    }
  }

  const menuItems = [
    {
      id: 'profile',
      title: '프로필 설정',
      description: '개인정보 및 계정 설정',
      href: '/profile',
      icon: (
        <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    },
    ...(canApproveUsers(user.role) ? [{
      id: 'admin-users',
      title: '사용자 관리',
      description: `관리자 전용 - 승인 대기 ${pendingApprovalCount}건`,
      href: '/admin/users',
      icon: (
        <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      ),
      badge: pendingApprovalCount > 0 ? pendingApprovalCount : undefined
    }] : [])
  ]

  return (
    <div className="min-h-screen bg-black">
      {/* 헤더 */}
      <div className="bg-gray-900 border-b border-gray-700 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center relative">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            <svg className="absolute w-2.5 h-3 text-white" fill="currentColor" viewBox="0 0 24 24" style={{left: '50%', top: '50%', transform: 'translate(-50%, -50%)'}}>
              <path d="M13 0L7 12h4l-2 12 8-12h-4l2-12z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">프로필 메뉴</h1>
            <p className="text-sm text-gray-300">
              {user.organization?.name || '소속 기관'} · {user.email}
            </p>
          </div>
        </div>
      </div>

      {/* 메뉴 리스트 */}
      <div className="p-4 space-y-3">
        {menuItems.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="block p-4 bg-gray-800 rounded-lg border border-gray-700 hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {item.icon}
                <div>
                  <h3 className="text-white font-medium">{item.title}</h3>
                  <p className="text-sm text-gray-400 mt-1">{item.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {item.badge && (
                  <span className="bg-red-500 text-white text-xs font-medium px-2 py-1 rounded-full">
                    {item.badge}
                  </span>
                )}
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </Link>
        ))}

        {/* 로그아웃 버튼 */}
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-full p-4 bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="flex items-center justify-center gap-3">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="text-white font-medium">
              {isLoggingOut ? '로그아웃 중...' : '로그아웃'}
            </span>
          </div>
        </button>
      </div>
    </div>
  )
}