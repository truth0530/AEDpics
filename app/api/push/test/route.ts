import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendPushNotification } from '@/lib/push/vapid';

/**
 * POST: 테스트 푸시 알림 발송
 *
 * 현재 사용자의 모든 구독에 테스트 알림을 발송합니다.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 사용자의 모든 푸시 구독 조회
    const subscriptions = await prisma.push_subscriptions.findMany({
      where: {
        user_id: session.user.id,
      },
    });

    if (subscriptions.length === 0) {
      return NextResponse.json(
        { error: '등록된 푸시 구독이 없습니다' },
        { status: 404 }
      );
    }

    // 각 구독에 테스트 알림 발송
    let successCount = 0;
    let failCount = 0;

    for (const sub of subscriptions) {
      const success = await sendPushNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh_key,
            auth: sub.auth_key,
          },
        },
        {
          title: 'AED 픽스 테스트 알림',
          body: '푸시 알림이 작동합니다',
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          data: {
            url: '/dashboard',
          },
        }
      );

      if (success) {
        successCount++;
        // last_used_at 업데이트
        await prisma.push_subscriptions.update({
          where: { id: sub.id },
          data: { last_used_at: new Date() },
        });
      } else {
        failCount++;
      }
    }

    logger.info('PushTest', '테스트 알림 발송 완료', {
      userId: session.user.id,
      totalSubscriptions: subscriptions.length,
      successCount,
      failCount,
    });

    return NextResponse.json({
      success: true,
      totalSubscriptions: subscriptions.length,
      successCount,
      failCount,
    });
  } catch (error) {
    logger.error('PushTest', '테스트 알림 발송 실패', error instanceof Error ? error : { error });

    return NextResponse.json(
      { error: '테스트 알림 발송 실패' },
      { status: 500 }
    );
  }
}
