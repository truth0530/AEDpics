'use client';

import { useEffect } from 'react';
import { ServiceWorkerManager } from '@/lib/realtime/ServiceWorkerManager';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    // ServiceWorkerManager를 통한 통합 관리
    const initServiceWorker = async () => {
      try {
        const swManager = ServiceWorkerManager.getInstance();

        // Service Worker 등록
        const registration = await swManager.register();

        if (registration) {
          console.log('Service Worker 등록 성공:', registration.scope);

          // 알림 권한 요청 (필요시)
          if (Notification.permission === 'default') {
            await swManager.requestNotificationPermission();
          }
        }
      } catch (error) {
        console.error('Service Worker 초기화 실패:', error);
      }
    };

    // window 로드 후 실행
    if (typeof window !== 'undefined') {
      if (document.readyState === 'complete') {
        initServiceWorker();
      } else {
        window.addEventListener('load', initServiceWorker);
        return () => window.removeEventListener('load', initServiceWorker);
      }
    }
  }, []);

  return null;
}