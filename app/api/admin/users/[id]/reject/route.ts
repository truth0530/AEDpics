import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { checkPermission, getPermissionError } from '@/lib/auth/permissions';
import { randomUUID } from 'crypto';
import { sendRejectionEmail } from '@/lib/email/rejection-email';
import { logger } from '@/lib/logger';

import { prisma } from '@/lib/prisma';
/**
 * POST /api/admin/users/[id]/reject
 * 사용자 거부
 *
 * Request Body:
 * {
 *   "reason": "거부 사유 (필수)"
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. 관리자 프로필 조회
    const adminProfile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id }
    });

    if (!adminProfile) {
      return NextResponse.json(
        { error: 'Admin profile not found' },
        { status: 404 }
      );
    }

    // 3. 권한 확인
    if (!checkPermission(adminProfile.role, 'APPROVE_USERS')) {
      return NextResponse.json(
        { error: getPermissionError('APPROVE_USERS') },
        { status: 403 }
      );
    }

    // 4. Request Body 파싱
    const body = await request.json();
    const { reason } = body;

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      );
    }

    // 5. 거부할 사용자 조회
    const targetUser = await prisma.user_profiles.findUnique({
      where: { id }
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // 6. 이미 처리된 사용자인지 확인
    if (targetUser.role !== 'pending_approval' && targetUser.role !== 'email_verified') {
      return NextResponse.json(
        { error: 'User is already approved or rejected' },
        { status: 400 }
      );
    }

    // 7. Audit Log 기록 (삭제 전에)
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        user_id: adminProfile.id,
        action: 'user_rejected',
        entity_type: 'user_profile',
        entity_id: id,
        metadata: {
          target_user_id: id,
          target_user_email: targetUser.email,
          target_user_role: targetUser.role,
          target_user_name: targetUser.full_name,
          target_user_organization: targetUser.organization_id,
          reason: reason
        },
        ip_address: request.headers.get('x-forwarded-for') ||
                    request.headers.get('x-real-ip') ||
                    'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
      }
    });

    // 8. 거부 이메일 발송 (삭제 전에 발송)
    try {
      await sendRejectionEmail(
        targetUser.email,
        targetUser.full_name,
        reason
      );
    } catch (emailError) {
      // 이메일 발송 실패해도 거부는 진행
      logger.error('AdminUsersReject:POST', 'Email sending failed',
        emailError instanceof Error ? emailError : { emailError }
      );
    }

    // 9. 사용자 삭제
    // Option 1: 완전 삭제 (권장)
    await prisma.user_profiles.delete({
      where: { id }
    });

    // Option 2: is_active만 false로 설정 (soft delete)
    // await prisma.user_profiles.update({
    //   where: { id: params.id },
    //   data: {
    //     is_active: false,
    //     updated_at: new Date()
    //   }
    // });

    logger.info('AdminUsersReject:POST', 'User rejected successfully', {
      targetEmail: targetUser.email,
      rejectedBy: adminProfile.email,
      reason
    });

    return NextResponse.json({
      success: true,
      message: '사용자가 거부되었습니다.'
    });

  } catch (error) {
    logger.error('AdminUsersReject:POST', 'User rejection error',
      error instanceof Error ? error : { error }
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
