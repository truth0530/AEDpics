import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'

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
    const existingUser = await prisma.userProfile.findUnique({
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
    const user = await prisma.userProfile.create({
      data: {
        id: uuidv4(),
        email: profileData.email,
        passwordHash: passwordHash,
        fullName: profileData.fullName,
        phone: profileData.phone || null,
        region: profileData.region,
        regionCode: profileData.regionCode,
        organizationName: profileData.organizationName,
        organizationId: profileData.organizationId || null,
        remarks: profileData.remarks || null,
        role: profileData.role || 'pending_approval',
        isActive: profileData.isActive || false,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

    // 로그인 히스토리 기록
    await prisma.loginHistory.create({
      data: {
        userId: user.id,
        success: true,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    })

    // 비밀번호 해시 제거 후 반환
    const { passwordHash: _, ...safeUser } = user

    return NextResponse.json({ success: true, user: safeUser })
  } catch (error) {
    console.error('회원가입 오류:', error)
    return NextResponse.json(
      { success: false, error: '회원가입 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
