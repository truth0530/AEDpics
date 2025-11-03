import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { isAllowedEmailDomain } from '@/lib/auth/config'
import { checkRateLimitWithMessage } from '@/lib/security/rate-limit-middleware'

import { prisma } from '@/lib/prisma';

// 비밀번호 강도 검증 함수
function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: '비밀번호는 최소 8자 이상이어야 합니다' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: '비밀번호는 최소 1개의 소문자를 포함해야 합니다' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: '비밀번호는 최소 1개의 대문자를 포함해야 합니다' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: '비밀번호는 최소 1개의 숫자를 포함해야 합니다' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, error: '비밀번호는 최소 1개의 특수문자를 포함해야 합니다' };
  }
  return { valid: true };
}

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limiting 체크 (1시간에 3회)
    const rateLimitResult = await checkRateLimitWithMessage(request, 'SIGNUP');
    if (rateLimitResult) {
      return rateLimitResult;
    }

    // 2. 요청 데이터 파싱
    const body = await request.json()
    const { email, password, profileData } = body

    // 3. 필수 필드 검증
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: '이메일과 비밀번호를 입력해주세요' },
        { status: 400 }
      )
    }

    // 4. 비밀번호 강도 검증
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { success: false, error: passwordValidation.error },
        { status: 400 }
      )
    }

    // 5. 서버사이드 이메일 도메인 검증 (보안 강화)
    if (!isAllowedEmailDomain(email)) {
      return NextResponse.json(
        { success: false, error: '허용되지 않은 이메일 도메인입니다' },
        { status: 400 }
      )
    }

    // 6. 이메일 중복 체크
    const existingUser = await prisma.user_profiles.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { success: false, code: 'EMAIL_ALREADY_EXISTS', error: '이미 가입된 이메일입니다' },
        { status: 409 }
      )
    }

    // 7. 비밀번호 해싱 (bcrypt, salt rounds 10)
    const passwordHash = await bcrypt.hash(password, 10)

    // 8. 사용자 프로필 생성
    const user = await prisma.user_profiles.create({
      data: {
        id: randomUUID(),
        email: email,
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

    // 9. 로그인 히스토리 기록
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
