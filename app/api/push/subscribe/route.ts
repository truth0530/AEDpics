import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * POST: 푸시 알림 구독 저장
 *
 * 클라이언트에서 생성한 푸시 구독 정보를 데이터베이스에 저장합니다.
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

    const subscription = await request.json();

    if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return NextResponse.json(
        { error: '유효하지 않은 구독 정보입니다' },
        { status: 400 }
      );
    }

    const userAgent = request.headers.get('user-agent') || undefined;

    // 기존 구독이 있으면 업데이트, 없으면 생성
    await prisma.push_subscriptions.upsert({
      where: {
        user_id_endpoint: {
          user_id: session.user.id,
          endpoint: subscription.endpoint,
        },
      },
      update: {
        p256dh_key: subscription.keys.p256dh,
        auth_key: subscription.keys.auth,
        user_agent: userAgent,
        updated_at: new Date(),
        last_used_at: new Date(),
      },
      create: {
        user_id: session.user.id,
        endpoint: subscription.endpoint,
        p256dh_key: subscription.keys.p256dh,
        auth_key: subscription.keys.auth,
        user_agent: userAgent,
      },
    });

    logger.info('PushSubscribe', '푸시 구독 저장 완료', {
      userId: session.user.id,
      endpoint: subscription.endpoint.substring(0, 50),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('PushSubscribe', '푸시 구독 저장 실패', error instanceof Error ? error : { error });

    return NextResponse.json(
      { error: '푸시 구독 저장 실패' },
      { status: 500 }
    );
  }
}
