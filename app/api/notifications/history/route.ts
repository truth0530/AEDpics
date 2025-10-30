import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithProfile, isErrorResponse } from '@/lib/auth/session-helpers';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/notifications/history
 * 사용자의 알림 히스토리 조회
 *
 * Query Parameters:
 * - limit: 조회할 알림 개수 (기본: 50, 최대: 200)
 * - unreadOnly: true일 경우 읽지 않은 알림만 조회
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthWithProfile();

    if (isErrorResponse(authResult)) {
      return authResult;
    }

    const { profile } = authResult;

    // Query parameters
    const { searchParams } = new URL(request.url);
    const limitParam = parseInt(searchParams.get('limit') || '50');
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    // limit 제한
    const limit = Math.min(limitParam, 200);

    // 알림 히스토리 조회
    const where: any = {
      recipient_id: profile.id,
    };

    if (unreadOnly) {
      where.is_read = false;
    }

    const notifications = await prisma.approval_notifications.findMany({
      where,
      orderBy: {
        created_at: 'desc',
      },
      take: limit,
      select: {
        id: true,
        new_user_id: true,
        new_user_email: true,
        new_user_name: true,
        new_user_region: true,
        new_user_org: true,
        notification_type: true,
        is_read: true,
        read_at: true,
        created_at: true,
      },
    });

    // 읽지 않은 알림 개수
    const unreadCount = await prisma.approval_notifications.count({
      where: {
        recipient_id: profile.id,
        is_read: false,
      },
    });

    return NextResponse.json({
      notifications: notifications.map((n) => ({
        id: n.id,
        newUserId: n.new_user_id,
        newUserEmail: n.new_user_email,
        newUserName: n.new_user_name,
        newUserRegion: n.new_user_region,
        newUserOrg: n.new_user_org,
        notificationType: n.notification_type,
        isRead: n.is_read,
        readAt: n.read_at,
        createdAt: n.created_at,
      })),
      unreadCount,
    });
  } catch (error) {
    console.error('[GET /api/notifications/history] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications/history
 * 알림 읽음 상태 변경
 *
 * Request Body:
 * {
 *   notificationId?: string,  // 특정 알림 읽음 처리
 *   markAllRead?: boolean     // 모든 알림 읽음 처리
 * }
 */
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAuthWithProfile();

    if (isErrorResponse(authResult)) {
      return authResult;
    }

    const { profile } = authResult;
    const body = await request.json();

    if (body.markAllRead === true) {
      // 모든 알림 읽음 처리
      const result = await prisma.approval_notifications.updateMany({
        where: {
          recipient_id: profile.id,
          is_read: false,
        },
        data: {
          is_read: true,
          read_at: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        count: result.count,
        message: `${result.count}개 알림을 읽음 처리했습니다.`,
      });
    } else if (body.notificationId) {
      // 특정 알림 읽음 처리
      const notification = await prisma.approval_notifications.findUnique({
        where: { id: body.notificationId },
      });

      if (!notification) {
        return NextResponse.json(
          { error: '알림을 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      if (notification.recipient_id !== profile.id) {
        return NextResponse.json(
          { error: '권한이 없습니다.' },
          { status: 403 }
        );
      }

      await prisma.approval_notifications.update({
        where: { id: body.notificationId },
        data: {
          is_read: true,
          read_at: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: '알림을 읽음 처리했습니다.',
      });
    } else {
      return NextResponse.json(
        { error: 'notificationId 또는 markAllRead를 지정해야 합니다.' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[PATCH /api/notifications/history] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/notifications/history
 * 알림 삭제
 *
 * Query Parameters:
 * - id: 삭제할 알림 ID
 * - deleteAll: true일 경우 읽은 알림 모두 삭제
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuthWithProfile();

    if (isErrorResponse(authResult)) {
      return authResult;
    }

    const { profile } = authResult;

    const { searchParams } = new URL(request.url);
    const notificationId = searchParams.get('id');
    const deleteAll = searchParams.get('deleteAll') === 'true';

    if (deleteAll) {
      // 읽은 알림 모두 삭제
      const result = await prisma.approval_notifications.deleteMany({
        where: {
          recipient_id: profile.id,
          is_read: true,
        },
      });

      return NextResponse.json({
        success: true,
        count: result.count,
        message: `${result.count}개 알림을 삭제했습니다.`,
      });
    } else if (notificationId) {
      // 특정 알림 삭제
      const notification = await prisma.approval_notifications.findUnique({
        where: { id: notificationId },
      });

      if (!notification) {
        return NextResponse.json(
          { error: '알림을 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      if (notification.recipient_id !== profile.id) {
        return NextResponse.json(
          { error: '권한이 없습니다.' },
          { status: 403 }
        );
      }

      await prisma.approval_notifications.delete({
        where: { id: notificationId },
      });

      return NextResponse.json({
        success: true,
        message: '알림을 삭제했습니다.',
      });
    } else {
      return NextResponse.json(
        { error: 'id 또는 deleteAll을 지정해야 합니다.' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[DELETE /api/notifications/history] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
