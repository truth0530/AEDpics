/**
 * 오프라인 동기화 매니저
 * OfflineQueue와 Supabase를 통합하여 오프라인 작업을 관리
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { OfflineQueue, QueuedOperation } from './OfflineQueue'
import { OptimisticUpdater } from './OptimisticUpdater'
import { ConflictDetector } from './ConflictDetector'
import { logger } from '@/lib/logger'

export interface SyncResult {
  operationId: string
  success: boolean
  data?: any
  error?: string
  conflicts?: any[]
}

export interface SyncProgress {
  total: number
  completed: number
  failed: number
  percentage: number
}

export interface OfflineSyncConfig {
  enableOptimistic?: boolean
  conflictResolution?: 'last-write-wins' | 'first-write-wins' | 'manual'
  syncOnReconnect?: boolean
  syncDebounceMs?: number
}

export class OfflineSyncManager {
  private static instance: OfflineSyncManager | null = null
  private queue: OfflineQueue
  private supabase: SupabaseClient
  private optimisticUpdater: OptimisticUpdater<any>
  private conflictDetector: ConflictDetector
  private config: Required<OfflineSyncConfig>
  private syncInProgress: boolean = false
  private syncDebounceTimer: NodeJS.Timeout | null = null
  private listeners: Map<string, Set<(data: any) => void>> = new Map()

  private constructor(
    supabase: SupabaseClient,
    config: OfflineSyncConfig = {}
  ) {
    this.supabase = supabase
    this.config = {
      enableOptimistic: config.enableOptimistic !== false,
      conflictResolution: config.conflictResolution || 'last-write-wins',
      syncOnReconnect: config.syncOnReconnect !== false,
      syncDebounceMs: config.syncDebounceMs || 1000
    }

    this.queue = new OfflineQueue({
      autoSync: false, // 수동으로 제어
      maxQueueSize: 500,
      maxRetries: 3
    })

    this.optimisticUpdater = new OptimisticUpdater({
      type: this.config.conflictResolution
    })

    this.conflictDetector = new ConflictDetector()

    this.setupEventListeners()
  }

  /**
   * 싱글톤 인스턴스 가져오기
   */
  static getInstance(
    supabase: SupabaseClient,
    config?: OfflineSyncConfig
  ): OfflineSyncManager {
    if (!OfflineSyncManager.instance) {
      OfflineSyncManager.instance = new OfflineSyncManager(supabase, config)
    }
    return OfflineSyncManager.instance
  }

  /**
   * 인스턴스 제거
   */
  static destroyInstance(): void {
    if (OfflineSyncManager.instance) {
      OfflineSyncManager.instance.destroy()
      OfflineSyncManager.instance = null
    }
  }

  /**
   * 초기화
   */
  async initialize(): Promise<void> {
    await this.queue.initialize()
    this.setupQueueListeners()
    logger.info('OfflineSyncManager:initialize', 'OfflineSyncManager initialized')
  }

  /**
   * 이벤트 리스너 설정
   */
  private setupEventListeners(): void {
    // 온라인 상태 변경 감지
    window.addEventListener('online', this.handleOnline.bind(this))
  }

  /**
   * 큐 이벤트 리스너 설정
   */
  private setupQueueListeners(): void {
    // 큐 이벤트 구독
    this.queue.subscribe('online', () => {
      if (this.config.syncOnReconnect) {
        this.debouncedSync()
      }
    })

    this.queue.subscribe('enqueued', (operation) => {
      this.notifyListeners('operation-queued', operation)
    })

    this.queue.subscribe('synced', (data) => {
      this.notifyListeners('operation-synced', data)
    })

    this.queue.subscribe('failed', (data) => {
      this.notifyListeners('operation-failed', data)
    })
  }

  /**
   * 온라인 전환 처리
   */
  private handleOnline(): void {
    if (this.config.syncOnReconnect && !this.syncInProgress) {
      this.debouncedSync()
    }
  }

  /**
   * 디바운스된 동기화
   */
  private debouncedSync(): void {
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer)
    }

    this.syncDebounceTimer = setTimeout(() => {
      this.syncAll()
    }, this.config.syncDebounceMs)
  }

  /**
   * 작업 큐에 추가
   */
  async queueOperation(
    type: 'create' | 'update' | 'delete',
    table: string,
    data: any,
    optimisticUpdate?: () => void
  ): Promise<string> {
    // 온라인이고 동기화 가능한 경우 즉시 실행
    if (this.queue.getIsOnline() && !this.syncInProgress) {
      try {
        const result = await this.executeOperation(type, table, data)

        if (result.success) {
          this.notifyListeners('operation-completed', result)
          return `immediate_${Date.now()}`
        }
      } catch (error) {
        logger.warn('OfflineSyncManager:queueOperation', 'Failed to execute operation immediately, queuing', error instanceof Error ? error : { error })
      }
    }

    // 오프라인이거나 실행 실패 시 큐에 추가
    if (this.config.enableOptimistic && optimisticUpdate) {
      optimisticUpdate()
    }

    const operationId = await this.queue.enqueue(type, table, data)

    // 온라인이면 동기화 시도
    if (this.queue.getIsOnline()) {
      this.debouncedSync()
    }

    return operationId
  }

  /**
   * 작업 실행
   */
  private async executeOperation(
    type: 'create' | 'update' | 'delete',
    table: string,
    data: any
  ): Promise<SyncResult> {
    let result: any

    try {
      switch (type) {
        case 'create':
          result = await this.supabase.from(table).insert(data)
          break

        case 'update':
          if (!data.id) {
            throw new Error('Update operation requires an id')
          }
          const { id, ...updateData } = data
          result = await this.supabase
            .from(table)
            .update(updateData)
            .eq('id', id)
          break

        case 'delete':
          if (!data.id) {
            throw new Error('Delete operation requires an id')
          }
          result = await this.supabase
            .from(table)
            .delete()
            .eq('id', data.id)
          break

        default:
          throw new Error(`Unknown operation type: ${type}`)
      }

      if (result.error) {
        throw result.error
      }

      return {
        operationId: `${type}_${Date.now()}`,
        success: true,
        data: result.data
      }
    } catch (error) {
      return {
        operationId: `${type}_${Date.now()}`,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 단일 작업 동기화
   */
  private async syncOperation(operation: QueuedOperation): Promise<SyncResult> {
    const result = await this.executeOperation(
      operation.type,
      operation.table,
      operation.data
    )

    // 충돌 감지 (update 작업인 경우)
    if (operation.type === 'update' && result.success && result.data) {
      const conflicts = this.conflictDetector.detectConflicts(
        operation.data,
        result.data[0],
        operation.data
      )

      if (conflicts.length > 0) {
        result.conflicts = conflicts
        this.notifyListeners('conflicts-detected', {
          operation,
          conflicts,
          resolution: this.config.conflictResolution
        })
      }
    }

    return result
  }

  /**
   * 모든 대기 작업 동기화
   */
  async syncAll(): Promise<SyncProgress> {
    if (this.syncInProgress) {
      logger.info('OfflineSyncManager:syncAll', 'Sync already in progress')
      return {
        total: 0,
        completed: 0,
        failed: 0,
        percentage: 0
      }
    }

    if (!this.queue.getIsOnline()) {
      logger.info('OfflineSyncManager:syncAll', 'Cannot sync while offline')
      return {
        total: 0,
        completed: 0,
        failed: 0,
        percentage: 0
      }
    }

    this.syncInProgress = true
    const pendingOperations = await this.queue.getPendingOperations()
    const total = pendingOperations.length

    if (total === 0) {
      this.syncInProgress = false
      return {
        total: 0,
        completed: 0,
        failed: 0,
        percentage: 100
      }
    }

    logger.info('OfflineSyncManager:syncAll', 'Starting sync', { total })
    this.notifyListeners('sync-started', { total })

    const result = await this.queue.syncPendingOperations(
      this.syncOperation.bind(this)
    )

    const progress: SyncProgress = {
      total,
      completed: result.succeeded,
      failed: result.failed,
      percentage: Math.round((result.succeeded / total) * 100)
    }

    this.syncInProgress = false
    this.notifyListeners('sync-completed', progress)

    return progress
  }

  /**
   * 특정 테이블의 작업만 동기화
   */
  async syncTable(tableName: string): Promise<SyncProgress> {
    const allOperations = await this.queue.getPendingOperations()
    const tableOperations = allOperations.filter(op => op.table === tableName)

    if (tableOperations.length === 0) {
      return {
        total: 0,
        completed: 0,
        failed: 0,
        percentage: 100
      }
    }

    let completed = 0
    let failed = 0

    for (const operation of tableOperations) {
      const result = await this.syncOperation(operation)

      if (result.success) {
        await this.queue.removeOperation(operation.id)
        completed++
      } else {
        await this.queue.updateOperation(operation.id, {
          retryCount: operation.retryCount + 1,
          error: result.error
        })
        failed++
      }
    }

    return {
      total: tableOperations.length,
      completed,
      failed,
      percentage: Math.round((completed / tableOperations.length) * 100)
    }
  }

  /**
   * 실패한 작업 재시도
   */
  async retryFailed(): Promise<SyncProgress> {
    const allOperations = await this.queue.getPendingOperations()
    const failedOperations = allOperations.filter(
      op => op.status === 'failed' && op.retryCount < op.maxRetries
    )

    if (failedOperations.length === 0) {
      return {
        total: 0,
        completed: 0,
        failed: 0,
        percentage: 100
      }
    }

    // 실패한 작업을 pending으로 변경
    for (const operation of failedOperations) {
      await this.queue.updateOperation(operation.id, {
        status: 'pending'
      })
    }

    // 동기화 실행
    return this.syncAll()
  }

  /**
   * 큐 상태 가져오기
   */
  async getQueueStatus(): Promise<{
    isOnline: boolean
    queueSize: number
    pendingCount: number
    syncInProgress: boolean
  }> {
    return {
      isOnline: this.queue.getIsOnline(),
      queueSize: await this.queue.getQueueSize(),
      pendingCount: await this.queue.getPendingCount(),
      syncInProgress: this.syncInProgress
    }
  }

  /**
   * 대기 중인 작업 가져오기
   */
  async getPendingOperations(): Promise<QueuedOperation[]> {
    return this.queue.getPendingOperations()
  }

  /**
   * 큐 비우기
   */
  async clearQueue(): Promise<void> {
    await this.queue.clearQueue()
    this.notifyListeners('queue-cleared', {})
  }

  /**
   * 특정 작업 취소
   */
  async cancelOperation(operationId: string): Promise<void> {
    await this.queue.removeOperation(operationId)
    this.notifyListeners('operation-cancelled', { operationId })
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
   * 동기화 진행 상태
   */
  isSyncing(): boolean {
    return this.syncInProgress
  }

  /**
   * 리소스 정리
   */
  destroy(): void {
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer)
    }

    window.removeEventListener('online', this.handleOnline)

    this.queue.destroy()
    this.listeners.clear()
  }
}