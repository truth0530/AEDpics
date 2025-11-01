import { NextRequest } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth/auth-options';
import { logger } from '@/lib/logger';

import { prisma } from '@/lib/prisma';
export async function POST(request: NextRequest) {
  try {
    const { recipient_ids, type, title, message, data, templateData } = await request.json();

    // 현재 사용자 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 관리자 권한 확인
    const userProfile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!userProfile) {
      return Response.json({ error: 'User profile not found' }, { status: 404 });
    }

    // 알림 생성 권한 확인
    const { checkPermission, getPermissionError } = await import('@/lib/auth/permissions');
    if (!checkPermission(userProfile.role, 'CREATE_NOTIFICATION')) {
      return Response.json({ error: getPermissionError('CREATE_NOTIFICATION') }, { status: 403 });
    }

    // 템플릿을 사용하는 경우 템플릿 데이터로 메시지 생성
    let finalTitle = title;
    let finalMessage = message;
    let expires_at = null;

    if (type && !title && !message) {
      // 템플릿 조회
      const template = await prisma.notification_templates.findFirst({
        where: { type: type as any }
      });

      if (template) {
        // 템플릿 변수 치환
        finalTitle = template.title_template;
        finalMessage = template.message_template;

        if (templateData) {
          for (const [key, value] of Object.entries(templateData)) {
            finalTitle = finalTitle.replace(new RegExp(`{${key}}`, 'g'), String(value));
            finalMessage = finalMessage.replace(new RegExp(`{${key}}`, 'g'), String(value));
          }
        }

        // 만료 시간 설정
        if (template.default_expiry_hours) {
          expires_at = new Date(Date.now() + template.default_expiry_hours * 60 * 60 * 1000);
        }
      }
    }

    // 알림 생성
    const notifications = recipient_ids.map((recipient_id: string) => ({
      recipient_id: recipient_id,
      sender_id: session.user.id,
      type: type as any,
      title: finalTitle,
      message: finalMessage,
      data: data || {},
      expires_at: expires_at
    }));

    const createdNotifications = await prisma.notifications.createMany({
      data: notifications,
      skipDuplicates: true
    });

    return Response.json({
      success: true,
      count: createdNotifications.count
    });
  } catch (error) {
    logger.error('NotificationCreate:POST', 'Notification creation error',
      error instanceof Error ? error : { error }
    );
    return Response.json({
      error: 'Failed to create notifications',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = parseInt(searchParams.get('offset') || '0');

  try {
    // 현재 사용자 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 사용자의 알림 조회
    const notifications = await prisma.notifications.findMany({
      where: {
        recipient_id: session.user.id,
        OR: [
          { expires_at: null },
          { expires_at: { gt: new Date() } }
        ]
      },
      include: {
        user_profiles_notifications_sender_idTouser_profiles: {
          select: {
            full_name: true,
            email: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      },
      skip: offset,
      take: limit
    });

    // 읽지 않은 알림 개수 조회
    const unreadCount = await prisma.notifications.count({
      where: {
        recipient_id: session.user.id,
        is_read: false,
        OR: [
          { expires_at: null },
          { expires_at: { gt: new Date() } }
        ]
      }
    });

    return Response.json({
      notifications: notifications || [],
      unreadCount: unreadCount || 0,
      hasMore: (notifications?.length || 0) === limit
    });
  } catch (error) {
    logger.error('NotificationCreate:GET', 'Get notifications error',
      error instanceof Error ? error : { error }
    );
    return Response.json({
      error: 'Failed to get notifications'
    }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, action } = await request.json();

    // 현재 사용자 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let updateData = {};

    switch (action) {
      case 'mark_read':
        updateData = { is_read: true };
        break;
      case 'mark_unread':
        updateData = { is_read: false };
        break;
      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }

    await prisma.notifications.updateMany({
      where: {
        id: id,
        recipient_id: session.user.id
      },
      data: updateData
    });

    return Response.json({ success: true });
  } catch (error) {
    logger.error('NotificationCreate:PATCH', 'Update notification error',
      error instanceof Error ? error : { error }
    );
    return Response.json({
      error: 'Failed to update notification'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  try {
    // 현재 사용자 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!id) {
      return Response.json({ error: 'Notification ID required' }, { status: 400 });
    }

    await prisma.notifications.deleteMany({
      where: {
        id: id,
        recipient_id: session.user.id
      }
    });

    return Response.json({ success: true });
  } catch (error) {
    logger.error('NotificationCreate:DELETE', 'Delete notification error',
      error instanceof Error ? error : { error }
    );
    return Response.json({
      error: 'Failed to delete notification'
    }, { status: 500 });
  }
}
