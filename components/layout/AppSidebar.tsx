"use client"

import { memo } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, FileSearch, BarChart3, Database, ClipboardList, ChevronRight, ChevronLeft, GitMerge, Users } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { ProfileDropdown } from "@/components/layout/ProfileDropdown"
import type { UserProfile } from "@/packages/types"
import { cn } from "@/lib/utils"

interface AppSidebarProps {
  canAccessAedData: boolean
  canAccessInspection: boolean
  canApproveUsers?: boolean
  user: UserProfile
  pendingApprovalCount?: number
}

// 성능 최적화: 메모이제이션으로 불필요한 리렌더링 방지
function AppSidebarComponent({ canAccessAedData, canAccessInspection, canApproveUsers = false, user, pendingApprovalCount = 0 }: AppSidebarProps) {
  const pathname = usePathname()
  const { collapsed, setCollapsed } = useSidebar()
  const isExpanded = !collapsed

  const menuItems = [
    {
      title: "일정관리",
      icon: Database as any,
      href: "/aed-data",
      show: canAccessAedData,
    },
    {
      title: "현장점검",
      icon: ClipboardList as any,
      href: "/inspection",
      show: canAccessInspection,
    },
    {
      title: "대시보드",
      icon: Home as any,
      href: "/dashboard",
      show: true,
    },
    {
      title: "의무기관매칭",
      customLabel: "24" as string | undefined,
      icon: undefined as any,
      href: "/admin/target-matching-2024",
      show: canAccessAedData,
    },
    {
      title: "의무기관매칭",
      customLabel: "25" as string | undefined,
      icon: undefined as any,
      href: "/admin/target-matching-2025",
      show: canAccessAedData,
    },
    {
      title: "사용자관리",
      icon: Users as any,
      href: "/admin/users",
      show: canApproveUsers,
      badge: pendingApprovalCount > 0 ? pendingApprovalCount : undefined,
    },
  ]

  const getPageTitle = () => {
    if (pathname === "/admin/target-matching-2024") return "2024년 구비의무기관 매칭"
    if (pathname === "/admin/target-matching-2025") return "2025년 구비의무기관 매칭"
    if (pathname === "/admin/target-matching") return "2024년 구비의무기관 매칭"
    if (pathname === "/admin/users") return "사용자 승인 관리"
    return menuItems.find(item => pathname === item.href)?.title || "대시보드"
  }

  const currentPage = getPageTitle()

  return (
    <Sidebar>
      <SidebarHeader>
        <div className={cn(
          "flex items-center py-2 px-3",
          isExpanded ? "justify-end" : "justify-center"
        )}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 hover:bg-gray-800 rounded transition-colors"
            aria-label={isExpanded ? "사이드바 닫기" : "사이드바 열기"}
          >
            {isExpanded ? (
              <ChevronLeft className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu className="flex-shrink-0">
          {menuItems.map((item) => {
            if (!item.show) return null

            return (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href} prefetch={false}>
                  <SidebarMenuButton isActive={pathname === item.href}>
                    {/* 뱃지가 있으면 아이콘 대신 뱃지 표시, customLabel이 있으면 숫자 표시, 없으면 아이콘 표시 */}
                    {item.badge ? (
                      <span className="flex-shrink-0 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
                        {item.badge}
                      </span>
                    ) : item.customLabel ? (
                      <span className="flex-shrink-0 inline-flex items-center justify-center w-5 h-5 text-sm font-bold text-blue-400 bg-blue-950/50 rounded border border-blue-800">
                        {item.customLabel}
                      </span>
                    ) : item.icon ? (
                      <item.icon className={cn(
                        "flex-shrink-0 transition-all",
                        isExpanded ? "w-5 h-5" : "w-5 h-5"
                      )} />
                    ) : null}
                    {isExpanded && (
                      <span className="whitespace-nowrap overflow-hidden">
                        {item.title}
                      </span>
                    )}
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  )
}

// 메모이제이션된 컴포넌트 export
export const AppSidebar = memo(AppSidebarComponent)
