/**
 * 오프라인 큐 관리자
 * IndexedDB를 사용하여 오프라인 작업을 저장하고 관리
 */

import { logger } from '@/lib/logger'

export interface QueuedOperation {
  id: string
  timestamp: number
  type: 'create' | 'update' | 'delete'
  table: string
  data: any
  retryCount: number
  maxRetries: number
  status: 'pending' | 'processing' | 'failed' | 'completed'
  error?: string
  syncedAt?: number
}

export interface OfflineQueueConfig {
  dbName?: string
  storeName?: string
  maxRetries?: number
  retryDelay?: number
  maxQueueSize?: number
  autoSync?: boolean
  syncInterval?: number
}

export class OfflineQueue {
  private db: IDBDatabase | null = null
  private config: Required<OfflineQueueConfig>
  private syncTimer: NodeJS.Timeout | null = null
  private isOnline: boolean = navigator.onLine
  private listeners: Map<string, Set<(data: any) => void>> = new Map()
  private fallbackMode: boolean = false
  private memoryQueue: Map<string, QueuedOperation> = new Map()
  private cachedPendingCount: number = 0

  constructor(config: OfflineQueueConfig = {}) {
    this.config = {
      dbName: config.dbName || 'aed-offline-queue',
      storeName: config.storeName || 'operations',
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      maxQueueSize: config.maxQueueSize || 1000,
      autoSync: config.autoSync !== false,
      syncInterval: config.syncInterval || 30000 // 30초
    }

    this.setupEventListeners()
  }

  /**
   * IndexedDB 초기화
   */
  async initialize(): Promise<void> {
    // IndexedDB 가용성 체크
    const isSupported = await this.checkIndexedDBSupport()
    if (!isSupported) {
      logger.warn('OfflineQueue:initialize', 'IndexedDB를 사용할 수 없습니다. 메모리 기반 폴백 모드로 동작합니다.')
      return this.initializeFallback()
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName, 1)

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'))
      }

      request.onsuccess = () => {
        this.db = request.result
        logger.info('OfflineQueue:initialize', 'IndexedDB initialized')

        if (this.config.autoSync) {
          this.startAutoSync()
        }

        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        if (!db.objectStoreNames.contains(this.config.storeName)) {
          const store = db.createObjectStore(this.config.storeName, {
            keyPath: 'id',
            autoIncrement: false
          })

          // 인덱스 생성
          store.createIndex('status', 'status', { unique: false })
          store.createIndex('table', 'table', { unique: false })
          store.createIndex('timestamp', 'timestamp', { unique: false })
          store.createIndex('type', 'type', { unique: false })
        }
      }
    })
  }

  /**
   * IndexedDB 지원 확인 (Promise 기반)
   */
  private async checkIndexedDBSupport(): Promise<boolean> {
    try {
      // IndexedDB 존재 여부 체크
      if (typeof indexedDB === 'undefined') {
        return false
      }

      // Safari Private 모드 체크
      return new Promise<boolean>((resolve) => {
        const testDBName = '_test_' + Date.now()
        const deleteReq = indexedDB.deleteDatabase(testDBName)

        deleteReq.onsuccess = () => {
          const openReq = indexedDB.open(testDBName, 1)

          openReq.onerror = () => {
            resolve(false) // Private 모드
          }

          openReq.onsuccess = () => {
            const db = openReq.result
            db.close()
            indexedDB.deleteDatabase(testDBName)
            resolve(true) // 정상 모드
          }
        }

        deleteReq.onerror = () => {
          resolve(false)
        }
      })
    } catch {
      return false
    }
  }

  /**
   * 폴백 모드 초기화 (메모리 기반)
   */
  private async initializeFallback(): Promise<void> {
    this.fallbackMode = true
    this.memoryQueue.clear()

    logger.warn('OfflineQueue:initializeFallback', '오프라인 큐가 메모리 모드로 동작합니다. 페이지 새로고침 시 데이터가 손실될 수 있습니다.')

    // 사용자에게 알림
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const showAlert = localStorage.getItem('hideIndexedDBAlert') !== 'true'
      if (showAlert) {
        window.alert('브라우저의 개인정보 보호 모드나 설정으로 인해 로컬 저장소를 사용할 수 없습니다. 오프라인 데이터가 페이지 새로고침 시 손실될 수 있습니다.')
        localStorage.setItem('hideIndexedDBAlert', 'true')
      }
    }

    if (this.config.autoSync) {
      this.startAutoSync()
    }
  }

  /**
   * 이벤트 리스너 설정
   */
  private setupEventListeners(): void {
    // 온라인/오프라인 상태 감지
    window.addEventListener('online', this.handleOnline.bind(this))
    window.addEventListener('offline', this.handleOffline.bind(this))

    // 페이지 종료 시 동기화
    window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this))
  }

  /**
   * 온라인 상태 전환 처리
   */
  private handleOnline(): void {
    logger.info('OfflineQueue:handleOnline', 'Online detected')
    this.isOnline = true
    this.notifyListeners('online', { isOnline: true })

    // 온라인 전환 시 즉시 동기화 시도
    // 자동 동기화는 외부에서 syncHandler를 제공해야 함
    if (this.config.autoSync) {
      this.notifyListeners('ready-to-sync', {})
    }
  }

  /**
   * 오프라인 상태 전환 처리
   */
  private handleOffline(): void {
    logger.info('OfflineQueue:handleOffline', 'Offline detected')
    this.isOnline = false
    this.notifyListeners('offline', { isOnline: false })
  }

  /**
   * 페이지 종료 전 처리
   */
  private handleBeforeUnload(event: BeforeUnloadEvent): void {
    // 캐시된 값 사용 (동기적으로 처리 필요)
    if (this.cachedPendingCount > 0) {
      const message = `${this.cachedPendingCount}개의 동기화되지 않은 작업이 있습니다. 페이지를 떠나시겠습니까?`
      event.preventDefault()
      event.returnValue = message
    }
  }

  /**
   * 대기 중인 작업 수 캐시 업데이트
   */
  private async updatePendingCountCache(): Promise<void> {
    this.cachedPendingCount = await this.getPendingCount()
  }

  /**
   * 작업을 큐에 추가
   */
  async enqueue(
    type: 'create' | 'update' | 'delete',
    table: string,
    data: any
  ): Promise<string> {
    // 폴백 모드 처리
    if (this.fallbackMode) {
      return this.enqueueFallback(type, table, data)
    }

    if (!this.db) {
      throw new Error('OfflineQueue not initialized')
    }

    // 큐 크기 체크
    const count = await this.getQueueSize()
    if (count >= this.config.maxQueueSize) {
      throw new Error(`Queue is full (max: ${this.config.maxQueueSize})`)
    }

    const operation: QueuedOperation = {
      id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type,
      table,
      data,
      retryCount: 0,
      maxRetries: this.config.maxRetries,
      status: 'pending'
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.config.storeName], 'readwrite')
      const store = transaction.objectStore(this.config.storeName)
      const request = store.add(operation)

      request.onsuccess = async () => {
        logger.info('OfflineQueue:enqueue', 'Operation queued', { operationId: operation.id })
        await this.updatePendingCountCache()
        this.notifyListeners('enqueued', operation)
        resolve(operation.id)
      }

      request.onerror = () => {
        reject(new Error('Failed to enqueue operation'))
      }
    })
  }

  /**
   * 폴백 모드에서 작업 큐에 추가
   */
  private async enqueueFallback(
    type: 'create' | 'update' | 'delete',
    table: string,
    data: any
  ): Promise<string> {
    const count = this.memoryQueue.size
    if (count >= this.config.maxQueueSize) {
      throw new Error(`Queue is full (max: ${this.config.maxQueueSize})`)
    }

    const operation: QueuedOperation = {
      id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type,
      table,
      data,
      retryCount: 0,
      maxRetries: this.config.maxRetries,
      status: 'pending'
    }

    this.memoryQueue.set(operation.id, operation)
    this.notifyListeners('enqueued', operation)
    return operation.id
  }

  /**
   * 특정 작업 가져오기
   */
  async getOperation(id: string): Promise<QueuedOperation | null> {
    if (this.fallbackMode) {
      return this.memoryQueue.get(id) || null
    }
    if (!this.db) return null

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.config.storeName], 'readonly')
      const store = transaction.objectStore(this.config.storeName)
      const request = store.get(id)

      request.onsuccess = () => {
        resolve(request.result || null)
      }

      request.onerror = () => {
        reject(new Error('Failed to get operation'))
      }
    })
  }

  /**
   * 대기 중인 작업 가져오기
   */
  async getPendingOperations(): Promise<QueuedOperation[]> {
    if (this.fallbackMode) {
      const operations = Array.from(this.memoryQueue.values())
        .filter(op => op.status === 'pending')
        .sort((a, b) => a.timestamp - b.timestamp)
      return operations
    }

    if (!this.db) return []

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.config.storeName], 'readonly')
      const store = transaction.objectStore(this.config.storeName)
      const index = store.index('status')
      const request = index.getAll('pending')

      request.onsuccess = () => {
        const operations = request.result || []
        // 타임스탬프 순으로 정렬
        operations.sort((a, b) => a.timestamp - b.timestamp)
        resolve(operations)
      }

      request.onerror = () => {
        reject(new Error('Failed to get pending operations'))
      }
    })
  }

  /**
   * 작업 상태 업데이트
   */
  async updateOperation(
    id: string,
    updates: Partial<QueuedOperation>
  ): Promise<void> {
    if (!this.db) return

    const operation = await this.getOperation(id)
    if (!operation) return

    const updated = { ...operation, ...updates }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.config.storeName], 'readwrite')
      const store = transaction.objectStore(this.config.storeName)
      const request = store.put(updated)

      request.onsuccess = () => {
        this.notifyListeners('updated', updated)
        resolve()
      }

      request.onerror = () => {
        reject(new Error('Failed to update operation'))
      }
    })
  }

  /**
   * 작업 삭제
   */
  async removeOperation(id: string): Promise<void> {
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.config.storeName], 'readwrite')
      const store = transaction.objectStore(this.config.storeName)
      const request = store.delete(id)

      request.onsuccess = () => {
        this.notifyListeners('removed', { id })
        resolve()
      }

      request.onerror = () => {
        reject(new Error('Failed to remove operation'))
      }
    })
  }

  /**
   * 모든 대기 중인 작업 동기화
   */
  async syncPendingOperations(
    syncHandler: (operation: QueuedOperation) => Promise<any>
  ): Promise<{ succeeded: number; failed: number }> {
    if (!this.isOnline) {
      logger.info('OfflineQueue:syncPendingOperations', 'Cannot sync while offline')
      return { succeeded: 0, failed: 0 }
    }

    const operations = await this.getPendingOperations()
    let succeeded = 0
    let failed = 0

    logger.info('OfflineQueue:syncPendingOperations', 'Syncing operations', { count: operations.length })

    for (const operation of operations) {
      try {
        // 상태를 processing으로 변경
        await this.updateOperation(operation.id, { status: 'processing' })

        // 동기화 핸들러 실행
        const result = await syncHandler(operation)

        // 성공 시 완료 처리
        await this.updateOperation(operation.id, {
          status: 'completed',
          syncedAt: Date.now()
        })

        // 완료된 작업 제거
        await this.removeOperation(operation.id)

        succeeded++
        this.notifyListeners('synced', { operation, result })
      } catch (error) {
        failed++
        const retryCount = operation.retryCount + 1

        if (retryCount >= operation.maxRetries) {
          // 최대 재시도 횟수 초과
          await this.updateOperation(operation.id, {
            status: 'failed',
            retryCount,
            error: error instanceof Error ? error.message : 'Unknown error'
          })

          this.notifyListeners('failed', { operation, error })
        } else {
          // 재시도 카운트 증가
          await this.updateOperation(operation.id, {
            status: 'pending',
            retryCount
          })

          // 재시도 지연
          await new Promise(resolve =>
            setTimeout(resolve, this.config.retryDelay * retryCount)
          )
        }
      }
    }

    logger.info('OfflineQueue:syncPendingOperations', 'Sync completed', { succeeded, failed })
    this.notifyListeners('sync-completed', { succeeded, failed })

    return { succeeded, failed }
  }

  /**
   * 자동 동기화 시작
   */
  private startAutoSync(): void {
    if (this.syncTimer) return

    this.syncTimer = setInterval(() => {
      if (this.isOnline) {
        // syncHandler는 외부에서 제공되어야 함
        this.notifyListeners('auto-sync', {})
      }
    }, this.config.syncInterval)
  }

  /**
   * 자동 동기화 중지
   */
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
    }
  }

  /**
   * 큐 크기 가져오기
   */
  async getQueueSize(): Promise<number> {
    if (!this.db) return 0

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.config.storeName], 'readonly')
      const store = transaction.objectStore(this.config.storeName)
      const request = store.count()

      request.onsuccess = () => {
        resolve(request.result)
      }

      request.onerror = () => {
        reject(new Error('Failed to get queue size'))
      }
    })
  }

  /**
   * 대기 중인 작업 개수 가져오기
   */
  async getPendingCount(): Promise<number> {
    const operations = await this.getPendingOperations()
    return operations.length
  }

  /**
   * 모든 작업 삭제
   */
  async clearQueue(): Promise<void> {
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.config.storeName], 'readwrite')
      const store = transaction.objectStore(this.config.storeName)
      const request = store.clear()

      request.onsuccess = () => {
        this.notifyListeners('cleared', {})
        resolve()
      }

      request.onerror = () => {
        reject(new Error('Failed to clear queue'))
      }
    })
  }

  /**
   * 이벤트 구독
   */
  subscribe(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }

    this.listeners.get(event)!.add(callback)

    // Unsubscribe 함수 반환
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
   * 리소스 정리
   */
  destroy(): void {
    this.stopAutoSync()

    if (this.db) {
      this.db.close()
      this.db = null
    }

    window.removeEventListener('online', this.handleOnline)
    window.removeEventListener('offline', this.handleOffline)
    window.removeEventListener('beforeunload', this.handleBeforeUnload)

    this.listeners.clear()
  }

  /**
   * 온라인 상태 확인
   */
  getIsOnline(): boolean {
    return this.isOnline
  }

  /**
   * 설정 가져오기
   */
  getConfig(): Required<OfflineQueueConfig> {
    return { ...this.config }
  }
}