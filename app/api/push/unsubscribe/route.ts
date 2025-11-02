import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * POST: 푸시 알림 구독 해제
 *
 * 클라이언트의 푸시 구독 정보를 데이터베이스에서 삭제합니다.
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

    if (!subscription.endpoint) {
      return NextResponse.json(
        { error: '유효하지 않은 구독 정보입니다' },
        { status: 400 }
      );
    }

    await prisma.push_subscriptions.deleteMany({
      where: {
        user_id: session.user.id,
        endpoint: subscription.endpoint,
      },
    });

    logger.info('PushUnsubscribe', '푸시 구독 해제 완료', {
      userId: session.user.id,
      endpoint: subscription.endpoint.substring(0, 50),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('PushUnsubscribe', '푸시 구독 해제 실패', error instanceof Error ? error : { error });

    return NextResponse.json(
      { error: '푸시 구독 해제 실패' },
      { status: 500 }
    );
  }
}
