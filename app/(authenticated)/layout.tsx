import { redirect } from "next/navigation"
import { canApproveUsers } from "@/lib/auth/config"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { AppHeader } from "@/components/layout/AppHeader"
import { MobileHeader } from "@/components/layout/MobileHeader"
import { MobileBottomNav } from "@/components/layout/MobileBottomNav"
import { RealtimeApprovalNotifier } from "@/components/layout/RealtimeApprovalNotifier"
import { ToastProvider } from "@/components/ui/Toast"
import { NotificationProvider } from "@/lib/hooks/useNotifications"
import { canAccessAEDData, canAccessInspectionMenu, canAccessInspectionEffect } from "@/lib/auth/access-control"
import { getCachedAuthUser, getCachedUserProfile, getCachedPendingApprovalCount } from "@/lib/auth/cached-queries"
import { DataRefreshBanner } from "@/components/ui/DataRefreshBanner"
import { ErrorBoundary } from "@/components/error/ErrorBoundary"

// Force dynamic rendering - this layout uses headers() for authentication
export const dynamic = 'force-dynamic';

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 캐싱된 사용자 조회
  const user = await getCachedAuthUser()

  if (!user) {
    redirect("/auth/signin")
  }

  // 캐싱된 프로필 조회
  const typedProfile = await getCachedUserProfile(user.id)

  if (!typedProfile) {
    redirect("/auth/complete-profile")
  }

  // pending_approval 사용자는 pending-approval 페이지로
  if (typedProfile.role === "pending_approval") {
    redirect("/auth/pending-approval")
  }

  // 프로필은 있지만 필수 정보가 누락된 경우 체크
  if (!typedProfile.region || !typedProfile.region_code) {
    console.error(`User ${typedProfile.id} has incomplete profile: missing region data`)
    redirect("/auth/update-profile")
  }

  // 승인 대기 카운트 (조건부로만 조회)
  let pendingApprovalCount = 0
  if (canApproveUsers(typedProfile.role)) {
    pendingApprovalCount = await getCachedPendingApprovalCount()
  }

  const canAccessAedData = canAccessAEDData(typedProfile)
  const canAccessInspection = canAccessInspectionMenu(typedProfile)
  const canAccessEffect = canAccessInspectionEffect(typedProfile)
  const hasApproveUsersPermission = canApproveUsers(typedProfile.role)

  // getCachedUserProfile에서 이미 Decimal을 Number로 변환했으므로 바로 사용 가능
  return (
    <ToastProvider>
      <NotificationProvider>
        <SidebarProvider>
          <div className="flex h-screen bg-black relative">
            {/* 데이터 업데이트 알림 배너 */}
            <DataRefreshBanner />

            {/* 실시간 승인 알림 - 승인 권한이 있는 사용자만 렌더링 */}
            {hasApproveUsersPermission && (
              <RealtimeApprovalNotifier
                userRole={typedProfile.role}
                userRegionCode={typedProfile.region_code || ''}
                canApproveUsers={hasApproveUsersPermission}
              />
            )}
            <AppSidebar
              canAccessAedData={canAccessAedData}
              canAccessInspection={canAccessInspection}
              canAccessInspectionEffect={canAccessEffect}
              canApproveUsers={hasApproveUsersPermission}
              user={typedProfile}
              pendingApprovalCount={pendingApprovalCount}
            />
            <SidebarInset>
              <MobileHeader user={typedProfile} />
              <AppHeader user={typedProfile} pendingApprovalCount={pendingApprovalCount} />
              <main className="flex-1 overflow-auto pb-16 md:pb-0">
                <ErrorBoundary>
                  {children}
                </ErrorBoundary>
              </main>
            </SidebarInset>
            <MobileBottomNav
              canAccessAedData={canAccessAedData}
              canAccessInspection={canAccessInspection}
              canAccessInspectionEffect={canAccessEffect}
              user={typedProfile}
              pendingApprovalCount={pendingApprovalCount}
            />
          </div>
        </SidebarProvider>
      </NotificationProvider>
    </ToastProvider>
  )
}
