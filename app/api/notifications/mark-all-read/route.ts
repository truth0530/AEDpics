import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth/auth-options';

import { prisma } from '@/lib/prisma';
export async function POST() {
  try {
    // 현재 사용자 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 사용자의 모든 읽지 않은 알림을 읽음으로 표시
    const result = await prisma.notifications.updateMany({
      where: {
        recipient_id: session.user.id,
        is_read: false
      },
      data: {
        is_read: true
      }
    });

    const updatedCount = result.count;

    console.log(`Marked ${updatedCount} notifications as read for user ${session.user.id}`);

    return Response.json({
      success: true,
      updatedCount
    });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    return Response.json({
      error: 'Failed to mark all notifications as read',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}