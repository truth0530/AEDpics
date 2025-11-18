"use client"

import { memo, useState, useEffect } from "react"
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
  const [isMounted, setIsMounted] = useState(false)
  const [isLandscape, setIsLandscape] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    const checkOrientation = () => {
      setIsLandscape(window.innerWidth > window.innerHeight && window.innerWidth < 1024)
    }
    checkOrientation()
    window.addEventListener('resize', checkOrientation)
    window.addEventListener('orientationchange', checkOrientation)
    return () => {
      window.removeEventListener('resize', checkOrientation)
      window.removeEventListener('orientationchange', checkOrientation)
    }
  }, [])

  const handleRegionChange = (sidoCode: string, gugun: string, sidoLabel: string) => {
    // 시도/구군이 변경되면 전역 상태로 저장
    if (typeof window !== 'undefined') {
      // 이전 시도 확인
      const previousSido = window.sessionStorage.getItem('selectedSido');
      const isSidoChanged = previousSido !== sidoLabel;

      window.sessionStorage.setItem('selectedSido', sidoLabel);
      if (sidoCode && sidoCode !== '시도') {
        window.sessionStorage.setItem('selectedSidoCode', sidoCode);
      } else {
        window.sessionStorage.removeItem('selectedSidoCode');
      }

      // 시도가 변경된 경우 구군을 강제로 '전체'로 리셋
      const finalGugun = isSidoChanged ? '전체' : gugun;
      window.sessionStorage.setItem('selectedGugun', finalGugun);

      // inspection 페이지를 위해 regionSelected 이벤트 발송
      console.log('[AppHeader] 📍 Region changed in header, dispatching event:', {
        regionCode: sidoCode,
        sidoLabel,
        gugun: finalGugun,
        isSidoChanged
      });
      window.dispatchEvent(new CustomEvent('regionSelected', {
        detail: { sido: sidoLabel, gugun: finalGugun, regionCode: sidoCode }
      }));
    }
  };

  return (
    <header className={isMounted && isLandscape ? "hidden md:block h-8 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800" : "hidden md:block h-12 lg:h-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800"} suppressHydrationWarning>
      <div className={isMounted && isLandscape ? "h-full px-1 flex items-center justify-between" : "h-full px-2 lg:px-6 flex items-center justify-between"}>
        <div className={isMounted && isLandscape ? "flex items-center gap-0.5" : "flex items-center gap-1 lg:gap-4"}>
          <div className={isMounted && isLandscape ? "w-5 h-5 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center relative flex-shrink-0 shadow-lg" : "w-7 h-7 lg:w-12 lg:h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center relative flex-shrink-0 shadow-lg"}>
            <svg className={isMounted && isLandscape ? "w-3 h-3 text-white" : "w-4 h-4 lg:w-7 lg:h-7 text-white"} fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            <svg className={isMounted && isLandscape ? "absolute w-1.5 h-2 text-white" : "absolute w-2 h-2.5 lg:w-3.5 lg:h-4 text-white"} fill="currentColor" viewBox="0 0 24 24" style={{left: '50%', top: '50%', transform: 'translate(-50%, -50%)'}}>
              <path d="M13 0L7 12h4l-2 12 8-12h-4l2-12z"/>
            </svg>
          </div>
          <div className={isMounted && isLandscape ? "flex items-baseline gap-0.5" : "flex items-baseline gap-1 lg:gap-3"}>
            <h1 className={isMounted && isLandscape ? "text-xs font-bold text-gray-900 dark:text-white" : "text-base lg:text-3xl font-bold text-gray-900 dark:text-white"}>AED 픽스</h1>
            <p className={isMounted && isLandscape ? "text-[8px] text-gray-600 dark:text-gray-400" : "text-[10px] lg:text-base text-gray-600 dark:text-gray-400"}>{pageTitle}</p>
          </div>
        </div>

        <div className={isMounted && isLandscape ? "flex items-center gap-0.5" : "flex items-center gap-1 lg:gap-3"}>
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
