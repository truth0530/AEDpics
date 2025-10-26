import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

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
          isActive: false,
          updatedAt: new Date()
        }
      });
    } catch (updateError: any) {
      console.error('Rejection update error:', updateError);
      return NextResponse.json(
        { error: '거부 처리 중 오류가 발생했습니다.', details: updateError.message },
        { status: 500 }
      );
    }

    // 거부 이력 기록
    try {
      await prisma.approvalHistory.create({
        data: {
          userId: userId,
          action: 'rejected',
          reason,
          approvedBy: session.user.id,
          createdAt: new Date()
        }
      });
    } catch (historyError) {
      console.error('Failed to log rejection history:', historyError);
      // 이력 기록 실패는 치명적이지 않으므로 계속 진행
    }

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
      console.error('Failed to send rejection notification:', notifyError);
    }

    return NextResponse.json({
      success: true,
      message: '사용자 가입이 거부되었습니다.'
    });

  } catch (error) {
    console.error('User rejection error:', error);
    return NextResponse.json(
      { error: '거부 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
