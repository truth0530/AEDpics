'use client';

import { useEffect, useState } from 'react';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function PushNotificationManager() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    // 푸시 알림 지원 여부 확인
    if (typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator) {
      setSupported(true);
      setPermission(Notification.permission);
      checkSubscription();
    }
  }, []);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error) {
      logger.error('PushNotificationManager', '구독 확인 실패', error instanceof Error ? error : { error });
    }
  };

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const requestPermission = async () => {
    try {
      setLoading(true);
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        await subscribeToPush();
      }
    } catch (error) {
      logger.error('PushNotificationManager', '권한 요청 실패', error instanceof Error ? error : { error });
    } finally {
      setLoading(false);
    }
  };

  const subscribeToPush = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;

      // VAPID 공개 키 가져오기
      const response = await fetch('/api/push/vapid-public-key');
      const { publicKey } = await response.json();

      if (!publicKey) {
        throw new Error('VAPID 공개 키를 가져올 수 없습니다');
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      // 구독 정보를 서버에 전송
      const saveResponse = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscription),
      });

      if (!saveResponse.ok) {
        throw new Error('구독 저장 실패');
      }

      setIsSubscribed(true);
      logger.info('PushNotificationManager', '푸시 알림 구독 완료');
    } catch (error) {
      logger.error('PushNotificationManager', '구독 실패', error instanceof Error ? error : { error });
    }
  };

  const unsubscribeFromPush = async () => {
    try {
      setLoading(true);
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        // 서버에서 구독 제거
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(subscription),
        });

        setIsSubscribed(false);
        logger.info('PushNotificationManager', '푸시 알림 구독 해제 완료');
      }
    } catch (error) {
      logger.error('PushNotificationManager', '구독 해제 실패', error instanceof Error ? error : { error });
    } finally {
      setLoading(false);
    }
  };

  const sendTestNotification = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/push/test', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('테스트 알림 발송 실패');
      }

      logger.info('PushNotificationManager', '테스트 알림 발송 완료');
    } catch (error) {
      logger.error('PushNotificationManager', '테스트 알림 발송 실패', error instanceof Error ? error : { error });
    } finally {
      setLoading(false);
    }
  };

  if (!supported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>푸시 알림</CardTitle>
          <CardDescription>
            이 브라우저는 푸시 알림을 지원하지 않습니다.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>푸시 알림</CardTitle>
        <CardDescription>
          데이터 개선 알림을 실시간으로 받아보세요.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              알림 상태
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {permission === 'granted' && isSubscribed && '활성화됨'}
              {permission === 'granted' && !isSubscribed && '비활성화됨'}
              {permission === 'denied' && '거부됨'}
              {permission === 'default' && '권한 없음'}
            </p>
          </div>
          {permission === 'granted' && (
            <div className="flex gap-2">
              {isSubscribed ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={sendTestNotification}
                    disabled={loading}
                  >
                    테스트
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={unsubscribeFromPush}
                    disabled={loading}
                  >
                    비활성화
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={subscribeToPush}
                  disabled={loading}
                >
                  활성화
                </Button>
              )}
            </div>
          )}
          {permission !== 'granted' && permission !== 'denied' && (
            <Button
              size="sm"
              onClick={requestPermission}
              disabled={loading}
            >
              권한 요청
            </Button>
          )}
          {permission === 'denied' && (
            <p className="text-xs text-red-600 dark:text-red-400">
              브라우저 설정에서 알림 권한을 허용해주세요.
            </p>
          )}
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            알림 받을 내용
          </h4>
          <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
            <li>30일 이상 방치된 중요 문제 발생 시</li>
            <li>담당 지역의 데이터 개선 필요 사항</li>
            <li>주간 개선 현황 요약</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
