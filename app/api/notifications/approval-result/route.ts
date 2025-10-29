import { NextRequest } from 'next/server';

import { prisma } from '@/lib/prisma';
export async function POST(request: NextRequest) {
  try {
    const { userId, approved, reason, approverName } = await request.json();

    if (!userId) {
      return Response.json({ error: 'User ID required' }, { status: 400 });
    }

    // 사용자 정보 조회
    const user = await prisma.user_profiles.findUnique({
      where: { id: userId },
      select: { id: true, email: true, full_name: true }
    });

    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // 알림 타입과 메시지 결정
    const type = approved ? 'approval_completed' : 'approval_rejected';
    const templateData = {
      userName: user.full_name,
      approverName: approverName || '관리자',
      reason: reason || ''
    };

    // 직접 알림 생성
    const result = await prisma.notifications.create({
      data: {
        recipient_id: userId,
        sender_id: null,
        type: type as any,
        title: templateData.userName
          ? `${templateData.userName}님의 계정 ${approved ? '승인' : '거부'} 알림`
          : '계정 처리 알림',
        message: approved
          ? `회원가입 신청이 승인되었습니다. ${templateData.approverName}에 의해 처리되었습니다.`
          : `회원가입 신청이 거부되었습니다. 사유: ${reason || '관리자 판단'}`,
        data: {
          approved,
          reason,
          approverName,
          timestamp: new Date().toISOString()
        } as any,
        is_read: false
      } as any,
      select: { id: true }
    });

    console.log(`Successfully created approval notification for user ${user.id}: ${approved ? 'approved' : 'rejected'}`);

    return Response.json({
      success: true,
      notificationId: result.id,
      message: `${approved ? 'Approval' : 'Rejection'} notification sent to user ${user.id}`
    });
  } catch (error) {
    console.error('Approval notification error:', error);
    return Response.json({
      error: 'Failed to send approval notification',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}