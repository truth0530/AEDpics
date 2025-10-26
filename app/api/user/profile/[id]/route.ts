import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

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

    // 사용자 프로필 조회
    const profile = await prisma.userProfile.findUnique({
      where: { id },
      include: {
        organization: true,
      }
    })

    if (!profile) {
      return NextResponse.json({ error: '프로필을 찾을 수 없습니다' }, { status: 404 })
    }

    // 비밀번호 해시 제거 (보안)
    const { passwordHash, ...safeProfile } = profile

    return NextResponse.json(safeProfile)
  } catch (error) {
    console.error('프로필 조회 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
