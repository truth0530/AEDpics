import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { isAllowedEmailDomain } from '@/lib/auth/config'
import { checkRateLimitWithMessage } from '@/lib/security/rate-limit-middleware'
import { validateRegionInfo, autocompleteRegionInfo } from '@/lib/auth/region-validation'

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

    // 7. 지역 정보 검증 및 자동 완성
    const organizationInfo = {
      organizationName: profileData.organizationName || profileData.organization_name,
      regionCode: profileData.regionCode || profileData.region_code,
      cityCode: profileData.cityCode || profileData.city_code,
      email: email
    }

    // 지역 정보 검증
    const regionValidation = validateRegionInfo(organizationInfo)
    if (!regionValidation.isValid && regionValidation.errors.length > 0) {
      // 치명적인 오류만 거부 (경고는 통과)
      const criticalErrors = regionValidation.errors.filter(
        err => err.includes('유효하지 않은') || err.includes('속하지 않습니다')
      )

      if (criticalErrors.length > 0) {
        return NextResponse.json(
          { success: false, error: `지역 정보 오류: ${criticalErrors[0]}` },
          { status: 400 }
        )
      }
    }

    // 지역 정보 자동 완성
    const autocompletedInfo = autocompleteRegionInfo(organizationInfo)

    // 8. 비밀번호 해싱 (bcrypt, salt rounds 10)
    const passwordHash = await bcrypt.hash(password, 10)

    // 9. 사용자 프로필 생성
    const user = await prisma.user_profiles.create({
      data: {
        id: randomUUID(),
        email: email,
        password_hash: passwordHash,
        full_name: profileData.fullName || profileData.full_name,
        phone: profileData.phone || null,
        region: profileData.region || null,
        region_code: autocompletedInfo.regionCode || profileData.regionCode || profileData.region_code || null,
        organization_name: autocompletedInfo.normalizedOrgName || profileData.organizationName || profileData.organization_name || null,
        organization_id: profileData.organizationId || profileData.organization_id || null,
        remarks: profileData.remarks || null,
        role: profileData.role || 'pending_approval',
        is_active: profileData.isActive !== undefined ? profileData.isActive : false,
        created_at: new Date(),
        updated_at: new Date()
      }
    })

    // 10. 로그인 히스토리 기록
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
