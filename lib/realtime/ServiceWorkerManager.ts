/**
 * Service Worker 관리자
 * Service Worker 등록, 업데이트, 통신 관리
 */

export interface SyncResult {
  id: string
  success: boolean
  error?: string
}

export interface ServiceWorkerStatus {
  registered: boolean
  ready: boolean
  updateAvailable: boolean
  queueSize: number
  isOnline: boolean
  cacheSize: number
}

export class ServiceWorkerManager {
  private static instance: ServiceWorkerManager | null = null
  private registration: ServiceWorkerRegistration | null = null
  private updateAvailable: boolean = false
  private listeners: Map<string, Set<(data: any) => void>> = new Map()
  private isSupported: boolean = false

  private constructor() {
    // SSR 환경에서는 실행하지 않음
    if (typeof window !== 'undefined') {
      this.isSupported = this.checkSupport()
    }
  }

  static getInstance(): ServiceWorkerManager {
    if (!ServiceWorkerManager.instance) {
      ServiceWorkerManager.instance = new ServiceWorkerManager()
    }
    return ServiceWorkerManager.instance
  }

  /**
   * Service Worker 지원 확인
   */
  private checkSupport(): boolean {
    // SSR 환경 체크
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return false
    }

    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker를 지원하지 않는 브라우저입니다.')
      return false
    }

    // HTTPS 또는 localhost 확인
    const isSecureContext = window.location.protocol === 'https:' ||
                           window.location.hostname === 'localhost' ||
                           window.location.hostname === '127.0.0.1'

    if (!isSecureContext) {
      console.warn('Service Worker는 HTTPS 환경에서만 동작합니다.')
      return false
    }

    return true
  }

  /**
   * Service Worker 등록
   */
  async register(): Promise<ServiceWorkerRegistration | null> {
    // SSR 환경 또는 미지원 브라우저에서는 null 반환
    if (!this.isSupported || typeof navigator === 'undefined') {
      return null
    }

    try {
      console.log('Service Worker 등록 중...')

      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      })

      console.log('Service Worker 등록 성공:', this.registration.scope)

      // 이벤트 리스너 설정
      this.setupEventListeners()

      // Service Worker가 준비되면 설정 전달
      await this.waitForReady()
      await this.sendConfiguration()

      // 업데이트 확인
      await this.checkForUpdate()

      // 백그라운드 동기화 권한 요청
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({
          name: 'background-sync' as PermissionName
        })
        console.log('백그라운드 동기화 권한:', permission.state)
      }

      // 주기적 백그라운드 동기화 등록
      await this.registerPeriodicSync()

      return this.registration
    } catch (error) {
      console.error('Service Worker 등록 실패:', error)
      return null
    }
  }

  /**
   * Service Worker가 준비될 때까지 대기
   */
  private async waitForReady(): Promise<void> {
    if (!this.registration) return

    return new Promise((resolve) => {
      if (this.registration!.active) {
        resolve()
        return
      }

      const worker = this.registration!.installing || this.registration!.waiting
      if (worker) {
        worker.addEventListener('statechange', () => {
          if (worker.state === 'activated') {
            resolve()
          }
        })
      } else {
        resolve()
      }
    })
  }

  /**
   * Service Worker에 설정 전달
   */
  private async sendConfiguration(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker.controller) {
      return
    }

    // 환경변수를 Service Worker에 전달
    navigator.serviceWorker.controller.postMessage({
      type: 'SET_CONFIG',
      config: {
        API_BASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || ''
      }
    })
  }

  /**
   * 이벤트 리스너 설정
   */
  private setupEventListeners(): void {
    // SSR 환경 체크
    if (typeof navigator === 'undefined') {
      return
    }

    // Service Worker 메시지 수신
    navigator.serviceWorker.addEventListener('message', (event) => {
      console.log('Service Worker로부터 메시지:', event.data)

      const { type, ...data } = event.data

      switch (type) {
        case 'sync-complete':
          this.handleSyncComplete(data.results)
          break

        case 'periodic-sync-complete':
          this.handlePeriodicSyncComplete(data)
          break

        case 'update-available':
          this.handleUpdateAvailable()
          break

        default:
          this.notifyListeners(type, data)
      }
    })

    // Service Worker 상태 변경 감지
    if (this.registration) {
      this.registration.addEventListener('updatefound', () => {
        const newWorker = this.registration!.installing

        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' &&
                navigator.serviceWorker.controller) {
              this.updateAvailable = true
              this.notifyListeners('update-available', {})
            }
          })
        }
      })
    }
  }

  /**
   * 동기화 완료 처리
   */
  private handleSyncComplete(results: SyncResult[]): void {
    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    console.log(`동기화 완료: ${successful}개 성공, ${failed}개 실패`)

    this.notifyListeners('sync-complete', {
      successful,
      failed,
      results
    })
  }

  /**
   * 주기적 동기화 완료 처리
   */
  private handlePeriodicSyncComplete(data: any): void {
    console.log('주기적 동기화 완료:', new Date(data.timestamp))
    this.notifyListeners('periodic-sync-complete', data)
  }

  /**
   * 업데이트 가능 알림
   */
  private handleUpdateAvailable(): void {
    this.updateAvailable = true
    this.notifyListeners('update-available', {})
  }

  /**
   * 업데이트 확인
   */
  async checkForUpdate(): Promise<boolean> {
    if (!this.registration) {
      return false
    }

    try {
      await this.registration.update()
      return this.updateAvailable
    } catch (error) {
      console.error('업데이트 확인 실패:', error)
      return false
    }
  }

  /**
   * 업데이트 적용
   */
  async applyUpdate(): Promise<void> {
    if (!this.updateAvailable || !this.registration) {
      return
    }

    const waiting = this.registration.waiting

    if (waiting) {
      // Service Worker에 SKIP_WAITING 메시지 전송
      waiting.postMessage({ type: 'SKIP_WAITING' })

      // 페이지 새로고침
      window.location.reload()
    }
  }

  /**
   * 주기적 백그라운드 동기화 등록
   */
  private async registerPeriodicSync(): Promise<void> {
    if (!this.registration) {
      return
    }

    // Periodic Background Sync API 지원 확인
    if ('periodicSync' in this.registration) {
      try {
        await (this.registration as any).periodicSync.register(
          'aed-periodic-sync',
          {
            minInterval: 60 * 60 * 1000 // 1시간
          }
        )
        console.log('주기적 백그라운드 동기화 등록 완료')
      } catch (error) {
        console.warn('주기적 백그라운드 동기화 등록 실패:', error)
      }
    }
  }

  /**
   * 즉시 동기화 트리거
   */
  async triggerSync(): Promise<void> {
    // SSR 환경 체크
    if (typeof navigator === 'undefined') {
      return
    }

    if (!this.registration || !navigator.serviceWorker.controller) {
      console.warn('Service Worker가 준비되지 않았습니다.')
      return
    }

    navigator.serviceWorker.controller.postMessage({
      type: 'SYNC_NOW'
    })
  }

  /**
   * 큐 상태 조회
   */
  async getQueueStatus(): Promise<ServiceWorkerStatus> {
    // SSR 환경 체크
    if (typeof navigator === 'undefined') {
      return {
        registered: false,
        ready: false,
        updateAvailable: false,
        queueSize: 0,
        isOnline: true,
        cacheSize: 0
      }
    }

    if (!navigator.serviceWorker.controller) {
      return {
        registered: false,
        ready: false,
        updateAvailable: false,
        queueSize: 0,
        isOnline: navigator.onLine,
        cacheSize: 0
      }
    }

    return new Promise((resolve) => {
      const channel = new MessageChannel()

      channel.port1.onmessage = (event) => {
        resolve({
          registered: true,
          ready: true,
          updateAvailable: this.updateAvailable,
          ...event.data
        })
      }

      navigator.serviceWorker.controller.postMessage(
        { type: 'GET_QUEUE_STATUS' },
        [channel.port2]
      )

      // 타임아웃 처리
      setTimeout(() => {
        resolve({
          registered: true,
          ready: true,
          updateAvailable: this.updateAvailable,
          queueSize: 0,
          isOnline: navigator.onLine,
          cacheSize: 0
        })
      }, 3000)
    })
  }

  /**
   * 캐시 초기화
   */
  async clearCache(): Promise<void> {
    // SSR 환경 체크
    if (typeof navigator === 'undefined' || !navigator.serviceWorker.controller) {
      return
    }

    navigator.serviceWorker.controller.postMessage({
      type: 'CLEAR_CACHE'
    })
  }

  /**
   * Push 알림 권한 요청
   */
  async requestNotificationPermission(): Promise<NotificationPermission> {
    // SSR 환경 체크
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn('브라우저가 알림을 지원하지 않습니다.')
      return 'denied'
    }

    // 이미 권한이 있는 경우
    if (Notification.permission === 'granted') {
      console.log('알림 권한이 이미 허용되었습니다.')
      if (this.registration) {
        await this.subscribeToPush()
      }
      return 'granted'
    }

    // 권한이 거부된 경우
    if (Notification.permission === 'denied') {
      console.warn('알림 권한이 거부되었습니다. 브라우저 설정에서 직접 변경해야 합니다.')
      this.notifyListeners('permission-denied', {})
      return 'denied'
    }

    // 권한 요청
    try {
      const permission = await Notification.requestPermission()
      console.log('알림 권한 요청 결과:', permission)

      if (permission === 'granted' && this.registration) {
        // Push 구독
        await this.subscribeToPush()
        this.notifyListeners('permission-granted', {})
      } else if (permission === 'denied') {
        this.notifyListeners('permission-denied', {})
      }

      return permission
    } catch (error) {
      console.error('알림 권한 요청 실패:', error)
      return 'denied'
    }
  }

  /**
   * Push 구독
   */
  private async subscribeToPush(): Promise<PushSubscription | null> {
    if (!this.registration) {
      return null
    }

    try {
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey ? this.urlBase64ToUint8Array(vapidKey) : undefined
      })

      console.log('Push 구독 성공:', subscription.endpoint)

      // 서버에 구독 정보 전송
      await this.sendSubscriptionToServer(subscription)

      return subscription
    } catch (error) {
      console.error('Push 구독 실패:', error)
      return null
    }
  }

  /**
   * 서버에 구독 정보 전송
   */
  private async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    try {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(subscription)
      })
    } catch (error) {
      console.error('구독 정보 전송 실패:', error)
    }
  }

  /**
   * VAPID 키 변환
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    // SSR 환경에서는 빈 배열 반환
    if (typeof window === 'undefined') {
      return new Uint8Array(0)
    }

    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }

    return outputArray
  }

  /**
   * 이벤트 구독
   */
  subscribe(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }

    this.listeners.get(event)!.add(callback)

    return () => {
      this.listeners.get(event)?.delete(callback)
    }
  }

  /**
   * 이벤트 알림
   */
  private notifyListeners(event: string, data: any): void {
    this.listeners.get(event)?.forEach(callback => callback(data))
  }

  /**
   * Service Worker 등록 해제
   */
  async unregister(): Promise<boolean> {
    if (!this.registration) {
      return false
    }

    const success = await this.registration.unregister()
    if (success) {
      this.registration = null
      console.log('Service Worker 등록 해제 완료')
    }

    return success
  }

  /**
   * 현재 상태 조회
   */
  getStatus(): {
    supported: boolean
    registered: boolean
    updateAvailable: boolean
  } {
    return {
      supported: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
      registered: !!this.registration,
      updateAvailable: this.updateAvailable
    }
  }
}