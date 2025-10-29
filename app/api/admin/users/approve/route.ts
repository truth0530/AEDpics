import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth/auth-options';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { canApproveUsers, getMasterAdminEmails } from '@/lib/auth/config';
import { UserRole } from '@/packages/types';
import { isValidRegionForRole } from '@/lib/constants/regions';

import { prisma } from '@/lib/prisma';
export async function POST(request: NextRequest) {
  try {
    console.log('[Approval API] ========== 승인 프로세스 시작 ==========');

    // 현재 사용자 확인
    const session = await getServerSession(authOptions);
    console.log('[Approval API] Step 1: 인증 확인 -', session ? '성공' : '실패', session?.user?.id);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '인증되지 않은 사용자입니다.' },
        { status: 401 }
      );
    }

    // 현재 사용자의 프로필 조회
    const currentUserProfile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id },
      select: { role: true, email: true }
    });

    if (!currentUserProfile) {
      return NextResponse.json(
        { error: '사용자 프로필을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 승인 권한 확인 (통일된 권한 시스템 사용)
    const { checkPermission, getPermissionError } = await import('@/lib/auth/permissions');
    if (!checkPermission(currentUserProfile.role, 'APPROVE_USERS')) {
      return NextResponse.json(
        { error: getPermissionError('APPROVE_USERS') },
        { status: 403 }
      );
    }

    // 요청 데이터 파싱
    let requestBody;
    try {
      requestBody = await request.json();
      console.log('[Approval API] Step 2a: 요청 파싱 성공');
    } catch (parseError) {
      console.error('❌ [Approval API] JSON 파싱 실패:', parseError);
      return NextResponse.json(
        { error: '잘못된 요청 형식입니다.' },
        { status: 400 }
      );
    }

    const { userId, role, organizationId, organizationName, regionCode, fullName, email, phone } = requestBody;
    console.log('[Approval API] Step 2b: 요청 데이터 -', { userId, role, organizationId, organizationName, regionCode, fullName, email, phone: phone ? '***' : undefined });

    // 필수 필드 검증 - 역할에 따라 선택적 검증
    if (!userId || !role || !regionCode) {
      return NextResponse.json(
        { error: '필수 정보가 누락되었습니다. (사용자ID, 역할, 지역)' },
        { status: 400 }
      );
    }

    // 보건소 역할인 경우 organizationId 필수
    if (role === 'local_admin' && !organizationId) {
      return NextResponse.json(
        { error: '보건소 담당자는 소속기관 ID가 필수입니다. 소속기관을 선택해주세요.' },
        { status: 400 }
      );
    }

    // 응급센터 역할인 경우 organizationId 필수
    if (role === 'regional_emergency_center_admin' && !organizationId) {
      return NextResponse.json(
        { error: '지역응급의료지원센터는 소속기관 ID가 필수입니다. 소속기관을 선택해주세요.' },
        { status: 400 }
      );
    }

    // 승인 대상 사용자 정보 조회 (도메인 검증 전에 미리 조회)
    const targetUser = await prisma.user_profiles.findUnique({
      where: { id: userId },
      select: { email: true, role: true }
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: '승인 대상 사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // ✅ CRITICAL: 도메인 기반 역할 검증 (보안 패치 2025-10-18)
    const { validateDomainForRole } = await import('@/lib/auth/access-control');
    const domainValidation = validateDomainForRole(targetUser.email, role);

    if (!domainValidation.allowed) {
      // 🔒 감사 로그: 도메인 검증 실패 (보안 패치 2025-10-18 Phase 3)
      console.error('[SECURITY_AUDIT] Domain validation failed:', {
        timestamp: new Date().toISOString(),
        admin_id: session.user.id,
        admin_email: currentUserProfile.email,
        target_user_id: userId,
        target_user_email: targetUser.email,
        attempted_role: role,
        suggested_role: domainValidation.suggestedRole,
        error: domainValidation.error,
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
      });

      return NextResponse.json(
        {
          error: domainValidation.error,
          suggestedRole: domainValidation.suggestedRole,
          code: 'DOMAIN_ROLE_MISMATCH'
        },
        { status: 400 }
      );
    }

    // 역할-지역 유효성 검증
    if (!isValidRegionForRole(regionCode, role)) {
      return NextResponse.json(
        { error: '선택한 역할과 지역이 일치하지 않습니다.' },
        { status: 400 }
      );
    }

    // 승인 대기 상태 확인
    if (targetUser.role !== 'pending_approval') {
      return NextResponse.json(
        { error: '이미 승인된 사용자입니다.' },
        { status: 400 }
      );
    }

    // NMC 계정 자동 역할 및 지역 코드 설정
    let finalRole: UserRole = role;
    let finalRegionCode = regionCode;
    const masterEmails = getMasterAdminEmails();

    // 조직명-지역 코드 매핑 (17개 지역 응급의료지원센터)
    const organizationToRegionMap: Record<string, string> = {
      '중앙응급의료센터': 'KR',
      '서울응급의료지원센터': 'SEO',
      '부산응급의료지원센터': 'BUS',
      '대구응급의료지원센터': 'DAE',
      '인천응급의료지원센터': 'INC',
      '광주응급의료지원센터': 'GWA',
      '대전응급의료지원센터': 'DAJ',
      '울산응급의료지원센터': 'ULS',
      '세종응급의료지원센터': 'SEJ',
      '경기응급의료지원센터': 'GYE',
      '강원응급의료지원센터': 'GAN',
      '충북응급의료지원센터': 'CHB',
      '충남응급의료지원센터': 'CHN',
      '전북응급의료지원센터': 'JEB',
      '전남응급의료지원센터': 'JEN',
      '경북응급의료지원센터': 'GYB',
      '경남응급의료지원센터': 'GYN',
      '제주응급의료지원센터': 'JEJ'
    };

    if (targetUser.email.endsWith('@nmc.or.kr') && !masterEmails.includes(targetUser.email)) {
      // organizationName으로 지역 코드 자동 결정
      if (organizationName && organizationToRegionMap[organizationName]) {
        finalRegionCode = organizationToRegionMap[organizationName];

        // 중앙응급의료센터면 emergency_center_admin
        if (organizationName === '중앙응급의료센터') {
          finalRole = 'emergency_center_admin';
        } else {
          // 17개 지역 응급의료지원센터면 regional_emergency_center_admin
          finalRole = 'regional_emergency_center_admin';
        }
      } else {
        // organizationName이 없거나 매핑되지 않으면 기본값
        finalRole = 'emergency_center_admin';
      }
    }

    // Master 권한 부여 제한 (통일된 권한 시스템 사용)
    const { hasSystemAdminAccess } = await import('@/lib/auth/permissions');
    if (finalRole === 'master' && !hasSystemAdminAccess(currentUserProfile.role)) {
      return NextResponse.json(
        { error: 'Master 권한을 부여할 수 있는 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 전화번호 암호화 처리
    let encryptedPhone = null;
    if (phone) {
      try {
        const { encryptPhone } = await import('@/lib/utils/encryption');
        encryptedPhone = encryptPhone(phone);
        console.log('[Approval API] 전화번호 암호화 성공');
      } catch (encryptError) {
        console.error('[Approval API] 전화번호 암호화 실패:', encryptError);
        return NextResponse.json(
          {
            error: '전화번호 암호화 중 오류가 발생했습니다.',
            details: encryptError instanceof Error ? encryptError.message : String(encryptError),
            code: 'ENCRYPTION_ERROR'
          },
          { status: 500 }
        );
      }
    }

    // organizationId 처리 - 빈 문자열을 null로 변환
    const finalOrganizationId = organizationId && organizationId.trim() !== '' ? organizationId : null;

    console.log('[Approval API] 조직 정보:', {
      organizationId: organizationId,
      finalOrganizationId: finalOrganizationId,
      organizationName: organizationName,
      finalRole: finalRole,
      finalRegionCode: finalRegionCode
    });

    // 사용자 프로필 업데이트
    const updateData: Record<string, any> = {
      role: finalRole,
      organization_id: finalOrganizationId,
      region_code: finalRegionCode || null,
      is_active: true, // 승인 시 활성화
      updated_at: new Date().toISOString()
    };

    // organizationName이 있으면 organization_name 필드에도 저장
    if (organizationName) {
      updateData.organization_name = organizationName;
    }

    // 이름, 이메일, 전화번호 업데이트 (제공된 경우)
    if (fullName) {
      updateData.full_name = fullName;
    }
    if (encryptedPhone) {
      updateData.phone = encryptedPhone;
    }

    console.log('[Approval API] Step 3: 프로필 업데이트 시도 -', updateData);

    try {
      await prisma.user_profiles.update({
        where: { id: userId },
        data: {
          role: updateData.role,
          organization_id: updateData.organization_id,
          region_code: updateData.region_code,
          is_active: updateData.is_active,
          organization_name: updateData.organization_name,
          full_name: updateData.full_name,
          phone: updateData.phone,
          updated_at: new Date(updateData.updated_at)
        }
      });

      console.log('[Approval API] Step 4: 프로필 업데이트 결과 - 성공');

    } catch (updateError: any) {
      console.error('❌ [Approval API] 프로필 업데이트 실패:', updateError);
      console.error('❌ [Approval API] 업데이트 데이터:', JSON.stringify(updateData, null, 2));

      // 사용자에게 더 명확한 에러 메시지 제공
      let userMessage = '승인 처리 중 오류가 발생했습니다.';
      if (updateError.code === 'P2025') {
        userMessage = '사용자를 찾을 수 없습니다.';
      } else if (updateError.code === 'P2003') {
        userMessage = '선택한 조직이 존재하지 않습니다. 다른 조직을 선택해주세요.';
      } else if (updateError.code === 'P2002') {
        userMessage = '중복된 정보가 있습니다. 관리자에게 문의하세요.';
      }

      return NextResponse.json(
        {
          error: userMessage,
          details: updateError.message,
          code: updateError.code
        },
        { status: 500 }
      );
    }

    // 이메일 변경은 위 prisma.user_profiles.update에서 이미 처리됨
    if (email && email !== targetUser.email) {
      console.log('[Approval API] Step 5: 이메일이 변경되었습니다 -', { from: targetUser.email, to: email });
    }

    // 승인 이메일 발송
    try {
      const roleNames: Record<string, string> = {
        'master': 'Master 관리자',
        'emergency_center_admin': '중앙응급의료센터 관리자',
        'regional_emergency_center_admin': '지역응급의료지원센터 관리자',
        'ministry_admin': '보건복지부 관리자',
        'regional_admin': '시도 관리자',
        'local_admin': '보건소 담당자',
        'temporary_inspector': '임시 점검원'
      };

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'noreply@aed.pics',
          to: targetUser.email,
          subject: '[AED 시스템] 회원가입이 승인되었습니다',
          html: `
            <h2>AED 점검 시스템 가입 승인 안내</h2>

            <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #2e7d32;">✅ 회원가입이 승인되었습니다!</h3>
              <p style="color: #333; line-height: 1.6;">
                축하합니다! AED 점검 시스템에 성공적으로 가입하셨습니다.
              </p>
            </div>

            <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h4>당신의 계정 정보</h4>
              <ul style="line-height: 1.8;">
                <li><strong>역할:</strong> ${roleNames[finalRole] || finalRole}</li>
                ${finalRegionCode ? `<li><strong>지역:</strong> ${finalRegionCode}</li>` : ''}
                ${organizationName ? `<li><strong>소속:</strong> ${organizationName}</li>` : organizationId ? `<li><strong>소속:</strong> 등록됨</li>` : ''}
              </ul>
            </div>

            <div style="margin-top: 30px; text-align: center;">
              <a href="${process.env.NEXT_PUBLIC_SITE_URL}/auth/signin"
                 style="background: #22c55e; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
                로그인하기
              </a>
            </div>

            <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">

            <p style="color: #666; font-size: 12px;">
              문의사항: truth0530@nmc.or.kr<br>
              이 이메일은 AED 점검 시스템에서 자동으로 발송되었습니다.
            </p>
          `
        })
      });
    } catch (emailError) {
      console.error('Approval email send error:', emailError);
      // 이메일 발송 실패해도 승인은 완료
    }

    // 승인 로그 기록 (에러 처리 강화)
    try {
      await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          user_id: session.user.id,
          action: 'user_approved',
          entity_type: 'user_profile',
          entity_id: userId,
          metadata: {
            actor_email: currentUserProfile.email,
            target_email: targetUser.email,
            assigned_role: finalRole,
            organization_id: organizationId,
            organization_name: organizationName,
            region_code: finalRegionCode
          }
        }
      });
    } catch (auditLogError) {
      console.error('⚠️ Audit log exception (non-critical):', auditLogError);
      // 예외 발생해도 승인은 성공으로 처리
    }

    // 실시간 알림 생성 (사용자에게 승인 결과 알림)
    try {
      const roleLabels: Record<string, string> = {
        'master': '최고 관리자',
        'emergency_center_admin': '중앙응급의료센터 관리자',
        'regional_emergency_center_admin': '지역응급의료지원센터 관리자',
        'local_admin': '보건소 담당자',
        'health_center_admin': '보건소 관리자'
      };

      await prisma.notifications.create({
        data: {
          id: randomUUID(),
          recipient_id: userId,
          type: 'approval_completed',
          title: '가입 승인 완료',
          message: `${roleLabels[finalRole] || finalRole} 역할로 승인되었습니다. 이제 AED 점검 시스템을 사용할 수 있습니다.`
        }
      });
    } catch (notificationError) {
      console.error('⚠️ Notification exception (non-critical):', notificationError);
    }

    // 🔒 감사 로그: 승인 성공 (보안 패치 2025-10-18 Phase 3)
    console.log('[SECURITY_AUDIT] User approval successful:', {
      timestamp: new Date().toISOString(),
      admin_id: session.user.id,
      admin_email: currentUserProfile.email,
      approved_user_id: userId,
      approved_user_email: targetUser.email,
      assigned_role: finalRole,
      organization_id: organizationId,
      region_code: regionCode,
      domain: targetUser.email.split('@')[1],
      ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    });

    return NextResponse.json({
      success: true,
      message: '사용자가 승인되었습니다.',
      data: {
        userId,
        role: finalRole,
        organizationId,
        organizationName,
        regionCode: finalRegionCode
      }
    });

  } catch (error) {
    console.error('❌ [Approval API] Critical error:', error);
    console.error('❌ [Approval API] Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // 현재 사용자 확인
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '인증되지 않은 사용자입니다.' },
        { status: 401 }
      );
    }

    // 현재 사용자의 프로필 조회
    const currentUserProfile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id },
      select: { role: true, email: true }
    });

    if (!currentUserProfile) {
      return NextResponse.json(
        { error: '사용자 프로필을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 승인 권한 확인
    if (!canApproveUsers(currentUserProfile.role)) {
      return NextResponse.json(
        { error: '사용자 거부 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 요청 데이터 파싱
    const { userId, rejectReason } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: '사용자 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 거부 대상 사용자 정보 조회
    const targetUser = await prisma.user_profiles.findUnique({
      where: { id: userId },
      select: { email: true, role: true }
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: '거부 대상 사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 승인 대기 상태 확인
    if (targetUser.role !== 'pending_approval') {
      return NextResponse.json(
        { error: '승인 대기 중인 사용자가 아닙니다.' },
        { status: 400 }
      );
    }

    // Soft Delete: role을 'rejected'로 변경하고 비활성화
    // 이렇게 하면 거부된 사용자가 다시 가입 시도할 수 있고, 감사 추적도 가능
    try {
      await prisma.user_profiles.update({
        where: { id: userId },
        data: {
          role: 'rejected' as any, // TypeScript에서 'rejected'가 정의되지 않을 수 있으므로 any로 캐스팅
          is_active: false,
          updated_at: new Date()
        }
      });
    } catch (updateError: any) {
      console.error('Rejection update error:', updateError);
      return NextResponse.json(
        { error: '거부 처리 중 오류가 발생했습니다.', details: updateError.message },
        { status: 500 }
      );
    }

    // 거부 이메일 발송
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'noreply@aed.pics',
          to: targetUser.email,
          subject: '[AED 시스템] 회원가입 검토 결과 안내',
          html: `
            <h2>AED 점검 시스템 가입 검토 결과</h2>

            <div style="background: #ffebee; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #c62828;">회원가입이 거부되었습니다</h3>
              <p style="color: #333; line-height: 1.6;">
                죄송합니다. 귀하의 회원가입 신청이 승인되지 않았습니다.
              </p>
            </div>

            ${rejectReason ? `
            <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h4>거부 사유</h4>
              <p style="color: #666; line-height: 1.6;">${rejectReason}</p>
            </div>
            ` : ''}

            <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h4>다시 신청하려면?</h4>
              <ul style="line-height: 1.8; color: #666;">
                <li>공공기관 이메일(@korea.kr, @nmc.or.kr)로 재가입을 권장합니다</li>
                <li>소속기관 확인 후 정확한 정보로 가입해주세요</li>
                <li>문의사항은 아래 연락처로 문의해주세요</li>
              </ul>
            </div>

            <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">

            <p style="color: #666; font-size: 12px;">
              문의사항: truth0530@nmc.or.kr<br>
              이 이메일은 AED 점검 시스템에서 자동으로 발송되었습니다.
            </p>
          `
        })
      });
    } catch (emailError) {
      console.error('Rejection email send error:', emailError);
      // 이메일 발송 실패해도 거부는 완료
    }

    // 거부 로그 기록 (에러 처리 강화)
    try {
      await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          user_id: session.user.id,
          action: 'user_rejected',
          entity_type: 'user_profile',
          entity_id: userId,
          metadata: {
            actor_email: currentUserProfile.email,
            target_email: targetUser.email,
            rejection_reason: rejectReason
          }
        }
      });
    } catch (auditLogError) {
      console.error('⚠️ Audit log exception (non-critical):', auditLogError);
      // 예외 발생해도 거부는 성공으로 처리
    }

    // 실시간 알림 생성 (사용자에게 거부 결과 알림)
    try {
      await prisma.notifications.create({
        data: {
          id: randomUUID(),
          recipient_id: userId,
          type: 'approval_rejected',
          title: '가입 거부됨',
          message: `가입이 거부되었습니다. 사유: ${rejectReason || '관리자 검토 결과'}. 재신청 가능합니다.`
        }
      });
    } catch (notificationError) {
      console.error('⚠️ Notification exception (non-critical):', notificationError);
    }

    return NextResponse.json({
      success: true,
      message: '사용자 가입이 거부되었습니다.'
    });

  } catch (error) {
    console.error('Error in user rejection:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}