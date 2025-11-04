 
/* global self, clients */

// 푸시 알림 이벤트 리스너
self.addEventListener('push', function(event) {
  console.log('[Service Worker] Push 이벤트 수신:', event);

  if (!event.data) {
    console.log('[Service Worker] Push 데이터 없음');
    return;
  }

  let notificationData;
  try {
    notificationData = event.data.json();
  } catch (error) {
    console.error('[Service Worker] Push 데이터 파싱 실패:', error);
    return;
  }

  const title = notificationData.title || 'AED 픽스';
  const options = {
    body: notificationData.body,
    icon: notificationData.icon || '/icon-192x192.png',
    badge: notificationData.badge || '/icon-192x192.png',
    data: notificationData.data || {},
    actions: notificationData.actions || [],
    tag: notificationData.tag || 'aed-notification',
    requireInteraction: false,
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// 알림 클릭 이벤트
self.addEventListener('notificationclick', function(event) {
  console.log('[Service Worker] 알림 클릭:', event);

  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        // 이미 열려있는 창이 있으면 포커스
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          const clientUrl = new URL(client.url);
          const targetUrl = new URL(urlToOpen, client.url);

          if (clientUrl.pathname === targetUrl.pathname && 'focus' in client) {
            return client.focus();
          }
        }
        // 없으면 새 창 열기
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// 알림 닫힘 이벤트
self.addEventListener('notificationclose', function(event) {
  console.log('[Service Worker] 알림 닫힘:', event);
});
