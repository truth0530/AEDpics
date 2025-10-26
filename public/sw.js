/**
 * Service Worker for Background Sync
 * 백그라운드 동기화를 위한 서비스 워커
 */

const CACHE_NAME = 'aed-check-v1'
const SYNC_TAG = 'aed-data-sync'

// 환경변수 저장용 (클라이언트에서 전달받음)
let config = {
  API_BASE_URL: ''
}

// 캐시할 정적 자산
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/offline.html'
]

// 설치 이벤트
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] 설치 중...')

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] 정적 자산 캐싱')
      return cache.addAll(STATIC_ASSETS)
    })
  )

  // 즉시 활성화
  self.skipWaiting()
})

// 활성화 이벤트
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] 활성화')

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => {
            console.log('[ServiceWorker] 이전 캐시 삭제:', cacheName)
            return caches.delete(cacheName)
          })
      )
    })
  )

  // 모든 클라이언트 제어
  self.clients.claim()
})

// Fetch 이벤트 (네트워크 요청 인터셉트)
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // API 요청 처리
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request))
    return
  }

  // 정적 자산 처리 (캐시 우선)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse
      }

      return fetch(request).then((networkResponse) => {
        // 성공적인 응답만 캐시
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone()

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache)
          })
        }

        return networkResponse
      }).catch(() => {
        // 오프라인 페이지 반환
        if (request.destination === 'document') {
          return caches.match('/offline.html')
        }
      })
    })
  )
})

// API 요청 처리 (오프라인 큐)
async function handleApiRequest(request) {
  try {
    const response = await fetch(request.clone())

    if (response.ok) {
      return response
    }

    // 실패 시 큐에 저장
    if (request.method !== 'GET') {
      await queueFailedRequest(request)
    }

    return response
  } catch (error) {
    console.log('[ServiceWorker] 오프라인 감지, 요청 큐잉')

    // GET 요청은 캐시에서
    if (request.method === 'GET') {
      const cachedResponse = await caches.match(request)
      if (cachedResponse) {
        return cachedResponse
      }
    } else {
      // POST/PUT/DELETE는 큐에 저장
      await queueFailedRequest(request)
    }

    return new Response(
      JSON.stringify({
        error: 'Offline',
        message: '오프라인 상태입니다. 연결 복구 시 자동으로 동기화됩니다.'
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

// 실패한 요청 큐에 저장
async function queueFailedRequest(request) {
  const db = await openIndexedDB()
  const tx = db.transaction(['sync-queue'], 'readwrite')
  const store = tx.objectStore('sync-queue')

  const requestData = {
    id: `req_${Date.now()}_${Math.random()}`,
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body: await request.text(),
    timestamp: Date.now()
  }

  await store.add(requestData)

  // 백그라운드 동기화 등록
  if ('sync' in self.registration) {
    await self.registration.sync.register(SYNC_TAG)
  }
}

// 백그라운드 동기화 이벤트
self.addEventListener('sync', (event) => {
  console.log('[ServiceWorker] 백그라운드 동기화 시작:', event.tag)

  if (event.tag === SYNC_TAG) {
    event.waitUntil(syncQueuedRequests())
  }
})

// 큐에 저장된 요청 동기화
async function syncQueuedRequests() {
  const db = await openIndexedDB()
  const tx = db.transaction(['sync-queue'], 'readwrite')
  const store = tx.objectStore('sync-queue')

  const requests = await store.getAll()
  console.log(`[ServiceWorker] ${requests.length}개 요청 동기화 중...`)

  const results = []

  for (const reqData of requests) {
    try {
      const response = await fetch(reqData.url, {
        method: reqData.method,
        headers: reqData.headers,
        body: reqData.method !== 'GET' ? reqData.body : undefined
      })

      if (response.ok) {
        // 성공 시 큐에서 제거
        await store.delete(reqData.id)
        results.push({ id: reqData.id, success: true })
      } else {
        results.push({
          id: reqData.id,
          success: false,
          error: `HTTP ${response.status}`
        })
      }
    } catch (error) {
      console.error('[ServiceWorker] 동기화 실패:', error)
      results.push({
        id: reqData.id,
        success: false,
        error: error.message
      })
    }
  }

  // 클라이언트에 결과 알림
  const clients = await self.clients.matchAll()
  clients.forEach(client => {
    client.postMessage({
      type: 'sync-complete',
      results
    })
  })

  return results
}

// IndexedDB 열기
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('aed-sync-db', 1)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = event.target.result

      if (!db.objectStoreNames.contains('sync-queue')) {
        const store = db.createObjectStore('sync-queue', {
          keyPath: 'id'
        })
        store.createIndex('timestamp', 'timestamp', { unique: false })
      }
    }
  })
}

// 주기적 동기화 (Periodic Background Sync API)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'aed-periodic-sync') {
    console.log('[ServiceWorker] 주기적 동기화 실행')
    event.waitUntil(periodicSync())
  }
})

// 주기적 동기화 처리
async function periodicSync() {
  // 네트워크 상태 체크
  if (!navigator.onLine) {
    console.log('[ServiceWorker] 오프라인 - 주기적 동기화 건너뜀')
    return
  }

  // 큐에 있는 요청 동기화
  await syncQueuedRequests()

  // 클라이언트에 알림
  const clients = await self.clients.matchAll()
  clients.forEach(client => {
    client.postMessage({
      type: 'periodic-sync-complete',
      timestamp: Date.now()
    })
  })
}

// Push 알림 이벤트
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : '새로운 알림이 있습니다.',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'view',
        title: '확인',
        icon: '/check-icon.png'
      },
      {
        action: 'close',
        title: '닫기',
        icon: '/close-icon.png'
      }
    ]
  }

  event.waitUntil(
    self.registration.showNotification('AED 점검 시스템', options)
  )
})

// 알림 클릭 이벤트
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/dashboard')
    )
  }
})

// 메시지 수신 (클라이언트와 통신)
self.addEventListener('message', (event) => {
  console.log('[ServiceWorker] 메시지 수신:', event.data)

  switch (event.data.type) {
    case 'SET_CONFIG':
      // 환경변수 설정
      if (event.data.config) {
        config = { ...config, ...event.data.config }
        console.log('[ServiceWorker] 설정 업데이트:', config)
      }
      break

    case 'SKIP_WAITING':
      self.skipWaiting()
      break

    case 'SYNC_NOW':
      event.waitUntil(syncQueuedRequests())
      break

    case 'CLEAR_CACHE':
      event.waitUntil(
        caches.keys().then(cacheNames =>
          Promise.all(cacheNames.map(name => caches.delete(name)))
        )
      )
      break

    case 'GET_QUEUE_STATUS':
      event.waitUntil(getQueueStatus().then(status => {
        event.ports[0].postMessage(status)
      }))
      break

    case 'SHOW_NOTIFICATION':
      // 알림 표시
      event.waitUntil(showNotification(event.data.payload))
      break
  }
})

// 큐 상태 확인
async function getQueueStatus() {
  try {
    const db = await openIndexedDB()
    const tx = db.transaction(['sync-queue'], 'readonly')
    const store = tx.objectStore('sync-queue')
    const count = await store.count()

    return {
      queueSize: count,
      isOnline: navigator.onLine,
      cacheSize: await getCacheSize()
    }
  } catch (error) {
    return {
      queueSize: 0,
      isOnline: navigator.onLine,
      cacheSize: 0,
      error: error.message
    }
  }
}

// 캐시 크기 계산
async function getCacheSize() {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate()
    return estimate.usage || 0
  }
  return 0
}

// 알림 표시 함수
async function showNotification(payload) {
  const {
    title,
    body,
    icon = '/icon-192x192.png',
    badge = '/badge-72x72.png',
    tag,
    data = {},
    requireInteraction = false,
    silent = false,
    vibrate,
    actions = []
  } = payload

  const options = {
    body,
    icon,
    badge,
    tag: tag || `notification-${Date.now()}`,
    data: {
      ...data,
      timestamp: Date.now()
    },
    requireInteraction,
    silent,
    vibrate: vibrate || [200, 100, 200],
    actions,
    timestamp: Date.now()
  }

  try {
    await self.registration.showNotification(title, options)
    console.log('[ServiceWorker] 알림 표시:', title)
  } catch (error) {
    console.error('[ServiceWorker] 알림 표시 실패:', error)
  }
}

console.log('[ServiceWorker] 스크립트 로드 완료')