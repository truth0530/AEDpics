import { getCachedAuthUser, getCachedUserProfile } from "@/lib/auth/cached-queries"
import { redirect } from "next/navigation"
import { PerformanceDashboard } from "./PerformanceDashboard"

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
  const allowedRoles = ['master', 'emergency_center_admin', 'ministry_admin', 'regional_admin'];
  if (!allowedRoles.includes(userProfile.role)) {
    redirect("/dashboard")
  }

  return <PerformanceDashboard userRole={userProfile.role} />
}
