import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'

import { prisma } from '@/lib/prisma';
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 인증 확인
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // 사용자 ID가 일치하거나 관리자 권한이 있는지 확인
    if (session.user.id !== id && session.user.role !== 'master') {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
    }

    // 사용자 프로필 조회 (필요한 필드만 선택)
    const profile = await prisma.user_profiles.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true,
        organization_id: true,
        organization_name: true,
        is_active: true,
        created_at: true,
        updated_at: true,
        organizations: true
        // 제외: password_hash, account_locked, lock_reason, approval_status 등 민감 정보
      }
    })

    if (!profile) {
      return NextResponse.json({ error: '프로필을 찾을 수 없습니다' }, { status: 404 })
    }

    return NextResponse.json(profile)
  } catch (error) {
    console.error('프로필 조회 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
