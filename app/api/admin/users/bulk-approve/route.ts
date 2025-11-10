import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth/auth-options';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { canApproveUsers } from '@/lib/auth/config';
import { generateApprovalSuggestion } from '@/lib/utils/approval-helpers';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { validateRoleOrganizationAssignment } from '@/lib/auth/role-organization-validation';
import { sendApprovalEmail } from '@/lib/email/approval-email';
import { sendRejectionEmail } from '@/lib/email/rejection-email';

import { prisma } from '@/lib/prisma';
export async function POST(request: NextRequest) {
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
      select: { role: true, email: true, full_name: true }
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
        { error: '사용자 승인 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 요청 데이터 파싱
    const { userIds } = await request.json();

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: '사용자 ID 목록이 필요합니다.' },
        { status: 400 }
      );
    }

    // 벌크 승인 대상 사용자들 조회
    const targetUsers = await prisma.user_profiles.findMany({
      where: {
        id: { in: userIds }
      },
      select: {
        id: true,
        email: true,
        full_name: true,
        organization_name: true,
        organization_id: true,
        role: true
      }
    });

    if (!targetUsers || targetUsers.length === 0) {
      return NextResponse.json(
        { error: '승인 대상 사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 승인 대기 상태가 아닌 사용자 필터링
    const pendingUsers = targetUsers.filter(u => u.role === 'pending_approval');

    if (pendingUsers.length === 0) {
      return NextResponse.json(
        { error: '승인 대기 중인 사용자가 없습니다.' },
        { status: 400 }
      );
    }

    const results = [];
    const errors = [];

    // 각 사용자에 대해 승인 처리
    for (const targetUser of pendingUsers) {
      try {
        // 스마트 추천 생성
        const suggestion = generateApprovalSuggestion(
          targetUser.email,
          targetUser.organization_name || ''
        );

        const validation = await validateRoleOrganizationAssignment(
          prisma,
          suggestion.role,
          targetUser.organization_id
        );

        if (!validation.isValid) {
          errors.push({
            userId: targetUser.id,
            email: targetUser.email,
            error: validation.error,
            details: validation.details
          });
          continue;
        }

        // 사용자 프로필 업데이트
        try {
          await prisma.user_profiles.update({
            where: { id: targetUser.id },
            data: {
              role: suggestion.role,
              region_code: suggestion.regionCode || null,
              is_active: true,
              updated_at: new Date()
            }
          });
        } catch (updateError: any) {
          errors.push({
            userId: targetUser.id,
            email: targetUser.email,
            error: updateError.message
          });
          continue;
        }

        results.push({
          userId: targetUser.id,
          email: targetUser.email,
          fullName: targetUser.full_name,
          assignedRole: suggestion.role,
          regionCode: suggestion.regionCode
        });

        // 승인 이메일 발송 (비동기)
        try {
          const org = validation.organization;
          await sendApprovalEmail(
            targetUser.email,
            targetUser.full_name,
            suggestion.role as any,
            org?.name || '미정의 조직',
            new Date()
          );
        } catch (emailError) {
          logger.error('API:bulkApprove', 'Failed to send bulk approval email', emailError instanceof Error ? emailError : { emailError });
          // 이메일 발송 실패해도 승인은 완료
        }

        // 승인 결과 알림 발송 (비동기)
        try {
          await fetch(`${env.NEXT_PUBLIC_SITE_URL}/api/notifications/approval-result`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: targetUser.id,
              approved: true,
              approverName: currentUserProfile.full_name || currentUserProfile.email,
              bulk: true
            })
          });
        } catch (notifyError) {
          logger.error('API:bulkApprove', 'Failed to send bulk approval notification', notifyError instanceof Error ? notifyError : { notifyError });
        }

      } catch (userError) {
        logger.error('API:bulkApprove', 'Error approving user', { userId: targetUser.id, error: userError instanceof Error ? userError.message : userError });
        errors.push({
          userId: targetUser.id,
          email: targetUser.email,
          error: userError instanceof Error ? userError.message : '알 수 없는 오류'
        });
      }
    }

    // 감사 로그 기록
    for (const result of results) {
      try {
        await prisma.audit_logs.create({
          data: {
            id: randomUUID(),
            user_id: session.user.id,
            action: 'user_bulk_approved',
            entity_type: 'user_profile',
            entity_id: result.userId,
            metadata: {
              actor_email: currentUserProfile.email,
              target_email: result.email,
              assigned_role: result.assignedRole,
              region_code: result.regionCode,
              bulk_operation: true,
              total_processed: results.length
            }
          }
        });
      } catch (auditError) {
        logger.error('API:bulkApprove', 'Audit log exception (non-critical)', auditError instanceof Error ? auditError : { auditError });
      }
    }

    return NextResponse.json({
      success: true,
      message: `${results.length}명의 사용자가 승인되었습니다.`,
      results,
      errors: errors.length > 0 ? errors : undefined,
      summary: {
        total_requested: userIds.length,
        total_approved: results.length,
        total_errors: errors.length,
        pending_users_found: pendingUsers.length
      }
    });

  } catch (error) {
    logger.error('API:bulkApprove', 'Error in bulk user approval', error instanceof Error ? error : { error });
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
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
      select: { role: true, email: true, full_name: true }
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
    const { userIds, rejectReason } = await request.json();

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: '사용자 ID 목록이 필요합니다.' },
        { status: 400 }
      );
    }

    // 벌크 거부 대상 사용자들 조회
    const targetUsers = await prisma.user_profiles.findMany({
      where: {
        id: { in: userIds }
      },
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true
      }
    });

    if (!targetUsers || targetUsers.length === 0) {
      return NextResponse.json(
        { error: '거부 대상 사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 승인 대기 상태인 사용자만 필터링
    const pendingUsers = targetUsers.filter(u => u.role === 'pending_approval');

    if (pendingUsers.length === 0) {
      return NextResponse.json(
        { error: '승인 대기 중인 사용자가 없습니다.' },
        { status: 400 }
      );
    }

    const results = [];
    const errors = [];

    // 각 사용자에 대해 거부 처리 (프로필 삭제)
    for (const targetUser of pendingUsers) {
      try {
        // 사용자 프로필 삭제
        try {
          await prisma.user_profiles.delete({
            where: { id: targetUser.id }
          });
        } catch (deleteError: any) {
          errors.push({
            userId: targetUser.id,
            email: targetUser.email,
            error: deleteError.message
          });
          continue;
        }

        results.push({
          userId: targetUser.id,
          email: targetUser.email,
          fullName: targetUser.full_name
        });

        // 거부 이메일 발송 (비동기)
        try {
          await sendRejectionEmail(
            targetUser.email,
            targetUser.full_name,
            rejectReason || '관리자가 일괄 거부했습니다.'
          );
        } catch (emailError) {
          logger.error('API:bulkReject', 'Failed to send bulk rejection email', emailError instanceof Error ? emailError : { emailError });
          // 이메일 발송 실패해도 거부는 완료
        }

        // 거부 결과 알림 발송 (비동기)
        try {
          await fetch(`${env.NEXT_PUBLIC_SITE_URL}/api/notifications/approval-result`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: targetUser.id,
              approved: false,
              reason: rejectReason || '관리자가 일괄 거부했습니다.',
              approverName: currentUserProfile.full_name || currentUserProfile.email,
              bulk: true
            })
          });
        } catch (notifyError) {
          logger.error('API:bulkReject', 'Failed to send bulk rejection notification', notifyError instanceof Error ? notifyError : { notifyError });
        }

      } catch (userError) {
        logger.error('API:bulkReject', 'Error rejecting user', { userId: targetUser.id, error: userError instanceof Error ? userError.message : userError });
        errors.push({
          userId: targetUser.id,
          email: targetUser.email,
          error: userError instanceof Error ? userError.message : '알 수 없는 오류'
        });
      }
    }

    // 감사 로그 기록
    for (const result of results) {
      try {
        await prisma.audit_logs.create({
          data: {
            id: randomUUID(),
            user_id: session.user.id,
            action: 'user_bulk_rejected',
            entity_type: 'user_profile',
            entity_id: result.userId,
            metadata: {
              actor_email: currentUserProfile.email,
              target_email: result.email,
              rejection_reason: rejectReason,
              bulk_operation: true,
              total_processed: results.length
            }
          }
        });
      } catch (auditError) {
        logger.error('API:bulkApprove', 'Audit log exception (non-critical)', auditError instanceof Error ? auditError : { auditError });
      }
    }

    return NextResponse.json({
      success: true,
      message: `${results.length}명의 사용자 가입이 거부되었습니다.`,
      results,
      errors: errors.length > 0 ? errors : undefined,
      summary: {
        total_requested: userIds.length,
        total_rejected: results.length,
        total_errors: errors.length,
        pending_users_found: pendingUsers.length
      }
    });

  } catch (error) {
    logger.error('API:bulkReject', 'Error in bulk user rejection', error instanceof Error ? error : { error });
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
