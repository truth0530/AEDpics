/**
 * VAPID 키 관리
 *
 * VAPID (Voluntary Application Server Identification)는
 * 푸시 알림 서버를 식별하기 위한 표준입니다.
 *
 * 키 생성 방법:
 * ```
 * npx web-push generate-vapid-keys
 * ```
 *
 * 생성된 키를 환경변수에 추가:
 * ```
 * NEXT_PUBLIC_VAPID_PUBLIC_KEY="your_public_key"
 * VAPID_PRIVATE_KEY="your_private_key"
 * ```
 */

import webpush from 'web-push';
import { logger } from '@/lib/logger';

// VAPID 키 설정
export function setupVapidKeys() {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:noreply@nmc.or.kr';

  if (!vapidPublicKey || !vapidPrivateKey) {
    logger.warn('VAPID', 'VAPID 키가 설정되지 않았습니다. 푸시 알림이 작동하지 않습니다.');
    return false;
  }

  webpush.setVapidDetails(
    vapidSubject,
    vapidPublicKey,
    vapidPrivateKey
  );

  return true;
}

// VAPID 공개 키 가져오기
export function getVapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null;
}

// 푸시 알림 발송
export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, any>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export async function sendPushNotification(
  subscription: PushSubscription,
  payload: PushNotificationPayload
): Promise<boolean> {
  if (!setupVapidKeys()) {
    throw new Error('VAPID 키가 설정되지 않았습니다');
  }

  try {
    const notificationPayload = JSON.stringify(payload);

    await webpush.sendNotification(
      subscription,
      notificationPayload,
      {
        TTL: 60 * 60 * 24, // 24시간
      }
    );

    logger.info('VAPID', '푸시 알림 발송 완료', { endpoint: subscription.endpoint.substring(0, 50) });
    return true;
  } catch (error) {
    logger.error('VAPID', '푸시 알림 발송 실패', error instanceof Error ? error : { error });
    return false;
  }
}
