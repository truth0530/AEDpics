import { getCachedAuthUser, getCachedUserProfile } from "@/lib/auth/cached-queries"
import { redirect } from "next/navigation"
import { PerformanceDashboard } from "./PerformanceDashboard"
import { hasNationalAccess, hasRegionalAccess } from "@/lib/utils/user-roles"

export const metadata = {
  title: "Performance Dashboard | AED 스마트 점검 시스템",
  description: "시스템 성능 모니터링 대시보드",
}

export default async function PerformancePage() {
  const user = await getCachedAuthUser()

  if (!user) {
    redirect("/auth/signin")
  }

  const userProfile = await getCachedUserProfile(user.id)

  if (!userProfile) {
    redirect("/auth/complete-profile")
  }

  // 관리자만 접근 가능
  // ✅ ROLE_INFO 기반 동적 판단: 전국 권한 또는 시도 권한
  const canAccess = hasNationalAccess(userProfile.role) || hasRegionalAccess(userProfile.role);
  if (!canAccess) {
    redirect("/dashboard")
  }

  return <PerformanceDashboard userRole={userProfile.role} />
}
