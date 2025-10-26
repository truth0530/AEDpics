import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

/**
 * 서버 컴포넌트에서 현재 세션 가져오기
 */
export async function getSession() {
  return await getServerSession(authOptions)
}

/**
 * 서버 컴포넌트에서 현재 사용자 정보 가져오기
 * @returns UserProfile with organization or null
 */
export async function getCurrentUser() {
  const session = await getSession()

  if (!session?.user?.id) {
    return null
  }

  const user = await prisma.userProfile.findUnique({
    where: { id: session.user.id },
    include: { organization: true }
  })

  return user
}

/**
 * 사용자가 특정 권한을 가지고 있는지 확인
 */
export async function hasPermission(permission: keyof Pick<
  Awaited<ReturnType<typeof getCurrentUser>>,
  'canApproveUsers' | 'canManageDevices' | 'canViewReports' | 'canExportData'
>): Promise<boolean> {
  const user = await getCurrentUser()

  if (!user) {
    return false
  }

  return user[permission] === true
}

/**
 * 사용자가 특정 역할을 가지고 있는지 확인
 */
export async function hasRole(role: string | string[]): Promise<boolean> {
  const user = await getCurrentUser()

  if (!user) {
    return false
  }

  if (Array.isArray(role)) {
    return role.includes(user.role)
  }

  return user.role === role
}

/**
 * Master 권한 확인
 */
export async function isMaster(): Promise<boolean> {
  return await hasRole('master')
}

/**
 * 관리자 권한 확인 (master, emergency_center_admin, ministry_admin, regional_admin, local_admin)
 */
export async function isAdmin(): Promise<boolean> {
  return await hasRole([
    'master',
    'emergency_center_admin',
    'ministry_admin',
    'regional_admin',
    'local_admin'
  ])
}
