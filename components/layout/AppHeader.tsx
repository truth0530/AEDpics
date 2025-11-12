"use client"

import { memo } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ProfileDropdown } from "@/components/layout/ProfileDropdown"
import { RegionFilter } from "@/components/layout/RegionFilter"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import type { UserProfile } from "@/packages/types"

interface AppHeaderProps {
  user: UserProfile
  pendingApprovalCount?: number
}

const PAGE_TITLES: Record<string, string> = {
  "/inspection": "현장점검",
  "/aed-data": "일정관리",
  "/dashboard": "대시보드",
  "/admin/target-matching": "구비의무기관 매칭 관리",
  "/admin/compliance": "의무기관매칭",
}

// 성능 최적화: 메모이제이션으로 불필요한 리렌더링 방지
function AppHeaderComponent({ user, pendingApprovalCount = 0 }: AppHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const pageTitle = PAGE_TITLES[pathname] || "대시보드"

  const handleRegionChange = (sido: string, gugun: string) => {
    // 시도/구군이 변경되면 전역 상태로 저장
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('selectedSido', sido);
      window.sessionStorage.setItem('selectedGugun', gugun);

      // inspection 페이지를 위해 regionSelected 이벤트 발송
      console.log('[AppHeader] 📍 Region changed in header, dispatching event:', { sido, gugun });
      window.dispatchEvent(new CustomEvent('regionSelected', {
        detail: { sido, gugun }
      }));
    }
  };

  return (
    <header className="hidden md:block h-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <div className="h-full px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center relative flex-shrink-0 shadow-lg">
            <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            <svg className="absolute w-3.5 h-4 text-white" fill="currentColor" viewBox="0 0 24 24" style={{left: '50%', top: '50%', transform: 'translate(-50%, -50%)'}}>
              <path d="M13 0L7 12h4l-2 12 8-12h-4l2-12z"/>
            </svg>
          </div>
          <div className="flex items-baseline gap-3">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">AED 픽스</h1>
            <p className="text-base text-gray-600 dark:text-gray-400">{pageTitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <RegionFilter user={user} onChange={handleRegionChange} />
          {/* ThemeToggle temporarily hidden - light mode needs comprehensive implementation across all page components */}
          {/* <ThemeToggle /> */}
          <ProfileDropdown user={user} pendingApprovalCount={pendingApprovalCount} />
        </div>
      </div>
    </header>
  )
}

// 메모이제이션된 컴포넌트 export
export const AppHeader = memo(AppHeaderComponent)
