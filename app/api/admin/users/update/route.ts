import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth/auth-options';
import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@/packages/types';
import { isValidRegionForRole } from '@/lib/constants/regions';
import { randomUUID } from 'crypto';

import { prisma } from '@/lib/prisma';
/**
 * PATCH /api/admin/users/update
 * 이미 승인된 사용자의 정보를 수정합니다.
 *
 * - 역할 변경 가능
 * - 소속 기관 변경 가능
 * - 지역 코드 변경 가능
 */
export async function PATCH(request: NextRequest) {
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

    // 승인 권한 확인 (통일된 권한 시스템 사용)
    const { checkPermission, getPermissionError } = await import('@/lib/auth/permissions');
    if (!checkPermission(currentUserProfile.role, 'APPROVE_USERS')) {
      return NextResponse.json(
        { error: getPermissionError('APPROVE_USERS') },
        { status: 403 }
      );
    }

    // 요청 데이터 파싱
    const { userId, role, organizationId, organizationName, regionCode, fullName, email, phone } = await request.json();

    // 필수 필드 검증
    if (!userId) {
      return NextResponse.json(
        { error: '사용자 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 수정 대상 사용자 정보 조회
    const targetUser = await prisma.user_profiles.findUnique({
      where: { id: userId },
      select: { email: true, role: true, full_name: true }
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: '수정 대상 사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 역할-지역 유효성 검증 (역할이 제공된 경우)
    if (role && regionCode && !isValidRegionForRole(regionCode, role)) {
      return NextResponse.json(
        { error: '선택한 역할과 지역이 일치하지 않습니다.' },
        { status: 400 }
      );
    }

    // 보건소 역할인 경우 organizationId 또는 organizationName 필수
    if (role === 'local_admin' && !organizationId && !organizationName) {
      return NextResponse.json(
        { error: '보건소 담당자는 소속기관이 필수입니다.' },
        { status: 400 }
      );
    }

    // Master 권한 부여 제한 (통일된 권한 시스템 사용)
    const { hasSystemAdminAccess } = await import('@/lib/auth/permissions');
    if (role === 'master' && !hasSystemAdminAccess(currentUserProfile.role)) {
      return NextResponse.json(
        { error: 'Master 권한을 부여할 수 있는 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 전화번호 암호화 처리
    let encryptedPhone = null;
    if (phone) {
      const { encryptPhone } = await import('@/lib/utils/encryption');
      encryptedPhone = encryptPhone(phone);
    }

    // 업데이트할 데이터 준비 (제공된 필드만 업데이트)
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (role) updateData.role = role;
    if (organizationId !== undefined) updateData.organization_id = organizationId || null;
    if (organizationName !== undefined) updateData.organization_name = organizationName;
    if (regionCode !== undefined) updateData.region_code = regionCode || null;
    if (fullName !== undefined) updateData.full_name = fullName;
    if (encryptedPhone) updateData.phone = encryptedPhone;

    // 사용자 프로필 업데이트
    try {
      const prismaUpdateData: any = {
        updatedAt: new Date()
      };

      if (role) prismaUpdateData.role = role;
      if (organizationId !== undefined) prismaUpdateData.organizationId = organizationId || null;
      if (organizationName !== undefined) prismaUpdateData.organizationName = organizationName;
      if (regionCode !== undefined) prismaUpdateData.regionCode = regionCode || null;
      if (fullName !== undefined) prismaUpdateData.fullName = fullName;
      if (email !== undefined) prismaUpdateData.email = email;
      if (encryptedPhone) prismaUpdateData.phone = encryptedPhone;

      await prisma.user_profiles.update({
        where: { id: userId },
        data: prismaUpdateData
      });

    } catch (updateError: any) {
      console.error('User update error:', updateError);
      return NextResponse.json(
        { error: '사용자 정보 수정 중 오류가 발생했습니다.', details: updateError.message },
        { status: 500 }
      );
    }

    // 수정 로그 기록 (에러 처리 강화)
    try {
      await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          user_id: session.user.id,
          action: 'user_updated',
          entity_type: 'user_profile',
          entity_id: userId,
          metadata: {
            actor_email: currentUserProfile.email,
            target_email: targetUser.email,
            updated_role: role,
            updated_organization_id: organizationId,
            updated_region_code: regionCode,
            previous_role: targetUser.role
          }
        }
      });
    } catch (auditLogError) {
      console.error('⚠️ Audit log exception (non-critical):', auditLogError);
      // 예외 발생해도 수정은 성공으로 처리
    }

    // 실시간 알림 생성 (사용자에게 정보 변경 알림)
    try {
      const roleLabels: Record<string, string> = {
        'master': '최고 관리자',
        'emergency_center_admin': '중앙응급의료센터 관리자',
        'local_emergency_center_admin': '지역응급의료센터 관리자',
        'local_admin': '보건소 담당자',
        'health_center_admin': '보건소 관리자'
      };

      await prisma.notifications.create({
        data: {
          id: randomUUID(),
          recipient_id: userId,
          type: 'role_updated',
          title: '계정 정보 변경',
          message: `관리자에 의해 계정 정보가 수정되었습니다. ${role ? `역할: ${roleLabels[role] || role}` : ''}`
        }
      });
    } catch (notificationError) {
      console.error('⚠️ Notification exception (non-critical):', notificationError);
    }

    return NextResponse.json({
      success: true,
      message: '사용자 정보가 수정되었습니다.',
      data: {
        userId,
        updatedFields: Object.keys(updateData).filter(k => k !== 'updated_at')
      }
    });

  } catch (error) {
    console.error('Error in user update:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
