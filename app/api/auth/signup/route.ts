import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, profileData } = body

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: '이메일과 비밀번호를 입력해주세요' },
        { status: 400 }
      )
    }

    // 이메일 중복 체크
    const existingUser = await prisma.user_profiles.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { success: false, code: 'EMAIL_ALREADY_EXISTS', error: '이미 가입된 이메일입니다' },
        { status: 409 }
      )
    }

    // 비밀번호 해싱 (bcrypt, salt rounds 10)
    const passwordHash = await bcrypt.hash(password, 10)

    // 사용자 프로필 생성
    const user = await prisma.user_profiles.create({
      data: {
        id: randomUUID(),
        email: profileData.email,
        password_hash: passwordHash,
        full_name: profileData.fullName || profileData.full_name,
        phone: profileData.phone || null,
        region: profileData.region || null,
        region_code: profileData.regionCode || profileData.region_code || null,
        organization_name: profileData.organizationName || profileData.organization_name || null,
        organization_id: profileData.organizationId || profileData.organization_id || null,
        remarks: profileData.remarks || null,
        role: profileData.role || 'pending_approval',
        is_active: profileData.isActive !== undefined ? profileData.isActive : false,
        created_at: new Date(),
        updated_at: new Date()
      }
    })

    // 로그인 히스토리 기록
    await prisma.login_history.create({
      data: {
        id: randomUUID(),
        user_id: user.id,
        success: true,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
      }
    })

    // 비밀번호 해시 제거 후 반환
    const { password_hash: _, ...safeUser } = user

    return NextResponse.json({ success: true, user: safeUser })
  } catch (error) {
    console.error('회원가입 오류:', error)
    return NextResponse.json(
      { success: false, error: '회원가입 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
