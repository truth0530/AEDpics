import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth/auth-options';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

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

    // 현재 사용자의 프로필 및 권한 확인
    const currentUserProfile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!currentUserProfile) {
      return NextResponse.json(
        { error: '사용자 프로필을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 승인 권한 확인
    const { checkPermission, getPermissionError } = await import('@/lib/auth/permissions');
    if (!checkPermission(currentUserProfile.role, 'APPROVE_USERS')) {
      return NextResponse.json(
        { error: getPermissionError('APPROVE_USERS') },
        { status: 403 }
      );
    }

    // 요청 데이터 파싱
    const { userId, reason } = await request.json();

    if (!userId || !reason) {
      return NextResponse.json(
        { error: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 대상 사용자 확인
    const targetUser = await prisma.user_profiles.findUnique({
      where: { id: userId }
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: '대상 사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 사용자 상태 업데이트 (거부)
    try {
      await prisma.user_profiles.update({
        where: { id: userId },
        data: {
          role: 'rejected',
          is_active: false,
          rejected_reason: reason,
          updated_at: new Date()
        }
      });
    } catch (updateError: any) {
      logger.error('AdminUsersReject:POST', 'Rejection update error',
        updateError instanceof Error ? updateError : { updateError }
      );
      return NextResponse.json(
        { error: '거부 처리 중 오류가 발생했습니다.', details: updateError.message },
        { status: 500 }
      );
    }

    // 거부 이력 기록 - approvalHistory 테이블은 아직 구현되지 않음
    // TODO: 향후 audit_logs 테이블 사용으로 대체 예정
    // try {
    //   await prisma.approval_history.create({
    //     data: {
    //       user_id: userId,
    //       action: 'rejected',
    //       reason,
    //       approved_by: session.user.id,
    //       created_at: new Date()
    //     }
    //   });
    // } catch (historyError) {
    //   console.error('Failed to log rejection history:', historyError);
    // }

    // 거부 알림 전송
    try {
      await fetch('/api/notifications/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          type: 'approval_rejected',
          title: '가입 신청 거부',
          message: `가입 신청이 거부되었습니다. 사유: ${reason}`,
          metadata: { reason }
        })
      });
    } catch (notifyError) {
      logger.error('AdminUsersReject:POST', 'Failed to send rejection notification',
        notifyError instanceof Error ? notifyError : { notifyError }
      );
    }

    return NextResponse.json({
      success: true,
      message: '사용자 가입이 거부되었습니다.'
    });

  } catch (error) {
    logger.error('AdminUsersReject:POST', 'User rejection error',
      error instanceof Error ? error : { error }
    );
    return NextResponse.json(
      { error: '거부 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
