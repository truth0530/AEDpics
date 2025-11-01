/**
 * 오프라인 동기화 훅
 * 오프라인 큐와 동기화 상태를 관리
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { SupabaseClient } from '@supabase/supabase-js'
import { OfflineSyncManager, SyncProgress } from '../OfflineSyncManager'
import { QueuedOperation } from '../OfflineQueue'
import { logger } from '@/lib/logger'

export interface OfflineSyncState {
  isOnline: boolean
  isSyncing: boolean
  queueSize: number
  pendingCount: number
  lastSyncAt: Date | null
  syncProgress: SyncProgress | null
  pendingOperations: QueuedOperation[]
}

export interface UseOfflineSyncOptions {
  autoSync?: boolean
  syncOnMount?: boolean
  syncInterval?: number
  onSyncComplete?: (progress: SyncProgress) => void
  onOperationQueued?: (operation: any) => void
  onConflict?: (conflict: any) => void
}

export function useOfflineSync(
  supabase: SupabaseClient,
  options: UseOfflineSyncOptions = {}
) {
  const {
    autoSync = true,
    syncOnMount = false,
    syncInterval = 30000,
    onSyncComplete,
    onOperationQueued,
    onConflict
  } = options

  const [state, setState] = useState<OfflineSyncState>({
    isOnline: typeof window !== 'undefined' ? navigator.onLine : true,
    isSyncing: false,
    queueSize: 0,
    pendingCount: 0,
    lastSyncAt: null,
    syncProgress: null,
    pendingOperations: []
  })

  const syncManagerRef = useRef<OfflineSyncManager | null>(null)
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const unsubscribesRef = useRef<(() => void)[]>([])

  // 싱글톤 매니저 초기화
  useEffect(() => {
    const initializeManager = async () => {
      const manager = OfflineSyncManager.getInstance(supabase, {
        syncOnReconnect: autoSync,
        conflictResolution: 'last-write-wins'
      })

      await manager.initialize()
      syncManagerRef.current = manager

      // 이벤트 구독
      const unsubscribes: (() => void)[] = []

      // 온라인/오프라인 상태 변경
      const handleOnlineChange = () => {
        setState(prev => ({ ...prev, isOnline: navigator.onLine }))
      }
      window.addEventListener('online', handleOnlineChange)
      window.addEventListener('offline', handleOnlineChange)

      // 동기화 시작
      unsubscribes.push(
        manager.subscribe('sync-started', ({ total }) => {
          setState(prev => ({
            ...prev,
            isSyncing: true,
            syncProgress: {
              total,
              completed: 0,
              failed: 0,
              percentage: 0
            }
          }))
        })
      )

      // 동기화 완료
      unsubscribes.push(
        manager.subscribe('sync-completed', (progress: SyncProgress) => {
          setState(prev => ({
            ...prev,
            isSyncing: false,
            syncProgress: progress,
            lastSyncAt: new Date()
          }))

          onSyncComplete?.(progress)
        })
      )

      // 작업 큐 추가
      unsubscribes.push(
        manager.subscribe('operation-queued', (operation) => {
          updateQueueStatus()
          onOperationQueued?.(operation)
        })
      )

      // 작업 동기화됨
      unsubscribes.push(
        manager.subscribe('operation-synced', () => {
          updateQueueStatus()
        })
      )

      // 충돌 감지
      unsubscribes.push(
        manager.subscribe('conflicts-detected', (conflict) => {
          onConflict?.(conflict)
        })
      )

      unsubscribesRef.current = unsubscribes

      // 초기 상태 업데이트
      await updateQueueStatus()

      // 마운트 시 동기화
      if (syncOnMount && navigator.onLine) {
        await manager.syncAll()
      }

      // 자동 동기화 설정
      if (autoSync && syncInterval > 0) {
        syncIntervalRef.current = setInterval(async () => {
          if (navigator.onLine && !manager.isSyncing()) {
            await manager.syncAll()
          }
        }, syncInterval)
      }

      return () => {
        window.removeEventListener('online', handleOnlineChange)
        window.removeEventListener('offline', handleOnlineChange)
      }
    }

    initializeManager()

    return () => {
      // 정리
      unsubscribesRef.current.forEach(unsubscribe => unsubscribe())

      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
      }
    }
  }, [supabase, autoSync, syncOnMount, syncInterval, onSyncComplete, onOperationQueued, onConflict])

  // 큐 상태 업데이트
  const updateQueueStatus = useCallback(async () => {
    if (!syncManagerRef.current) return

    const status = await syncManagerRef.current.getQueueStatus()
    const operations = await syncManagerRef.current.getPendingOperations()

    setState(prev => ({
      ...prev,
      isOnline: status.isOnline,
      isSyncing: status.syncInProgress,
      queueSize: status.queueSize,
      pendingCount: status.pendingCount,
      pendingOperations: operations
    }))
  }, [])

  // 작업 큐에 추가
  const queueOperation = useCallback(async (
    type: 'create' | 'update' | 'delete',
    table: string,
    data: any,
    optimisticUpdate?: () => void
  ): Promise<string> => {
    if (!syncManagerRef.current) {
      throw new Error('Offline sync manager not initialized')
    }

    const operationId = await syncManagerRef.current.queueOperation(
      type,
      table,
      data,
      optimisticUpdate
    )

    await updateQueueStatus()
    return operationId
  }, [updateQueueStatus])

  // 수동 동기화 트리거
  const syncNow = useCallback(async (): Promise<SyncProgress> => {
    if (!syncManagerRef.current) {
      throw new Error('Offline sync manager not initialized')
    }

    if (state.isSyncing) {
      logger.info('useOfflineSync:syncNow', 'Sync already in progress')
      return state.syncProgress || {
        total: 0,
        completed: 0,
        failed: 0,
        percentage: 0
      }
    }

    const progress = await syncManagerRef.current.syncAll()
    await updateQueueStatus()
    return progress
  }, [state.isSyncing, state.syncProgress, updateQueueStatus])

  // 특정 테이블 동기화
  const syncTable = useCallback(async (tableName: string): Promise<SyncProgress> => {
    if (!syncManagerRef.current) {
      throw new Error('Offline sync manager not initialized')
    }

    const progress = await syncManagerRef.current.syncTable(tableName)
    await updateQueueStatus()
    return progress
  }, [updateQueueStatus])

  // 실패한 작업 재시도
  const retryFailed = useCallback(async (): Promise<SyncProgress> => {
    if (!syncManagerRef.current) {
      throw new Error('Offline sync manager not initialized')
    }

    const progress = await syncManagerRef.current.retryFailed()
    await updateQueueStatus()
    return progress
  }, [updateQueueStatus])

  // 특정 작업 취소
  const cancelOperation = useCallback(async (operationId: string): Promise<void> => {
    if (!syncManagerRef.current) {
      throw new Error('Offline sync manager not initialized')
    }

    await syncManagerRef.current.cancelOperation(operationId)
    await updateQueueStatus()
  }, [updateQueueStatus])

  // 큐 비우기
  const clearQueue = useCallback(async (): Promise<void> => {
    if (!syncManagerRef.current) {
      throw new Error('Offline sync manager not initialized')
    }

    const confirm = window.confirm(
      `${state.pendingCount}개의 동기화되지 않은 작업이 있습니다. 모두 삭제하시겠습니까?`
    )

    if (confirm) {
      await syncManagerRef.current.clearQueue()
      await updateQueueStatus()
    }
  }, [state.pendingCount, updateQueueStatus])

  // CREATE 작업 헬퍼
  const create = useCallback(async (
    table: string,
    data: any,
    optimisticUpdate?: () => void
  ): Promise<string> => {
    return queueOperation('create', table, data, optimisticUpdate)
  }, [queueOperation])

  // UPDATE 작업 헬퍼
  const update = useCallback(async (
    table: string,
    data: any,
    optimisticUpdate?: () => void
  ): Promise<string> => {
    return queueOperation('update', table, data, optimisticUpdate)
  }, [queueOperation])

  // DELETE 작업 헬퍼
  const remove = useCallback(async (
    table: string,
    data: { id: string },
    optimisticUpdate?: () => void
  ): Promise<string> => {
    return queueOperation('delete', table, data, optimisticUpdate)
  }, [queueOperation])

  return {
    // 상태
    ...state,

    // 액션
    queueOperation,
    syncNow,
    syncTable,
    retryFailed,
    cancelOperation,
    clearQueue,

    // 헬퍼 메서드
    create,
    update,
    remove,

    // 유틸리티
    hasPendingOperations: state.pendingCount > 0,
    canSync: state.isOnline && !state.isSyncing && state.pendingCount > 0
  }
}