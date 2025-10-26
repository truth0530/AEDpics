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
  if (userProfile.role !== 'central_admin' && userProfile.role !== 'regional_admin') {
    redirect("/dashboard")
  }

  return <PerformanceDashboard userRole={userProfile.role} />
}
