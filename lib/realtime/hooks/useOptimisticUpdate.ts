import { useState, useCallback, useRef } from 'react'
import { OptimisticUpdater, ConflictResolutionStrategy } from '../OptimisticUpdater'
import { ConflictDetector } from '../ConflictDetector'
import { useToast } from '@/components/ui/Toast'

interface UseOptimisticUpdateOptions<T> {
  strategy?: ConflictResolutionStrategy
  onConflict?: (local: T, remote: T) => void
  onRollback?: (original: T) => void
  showToasts?: boolean
}

interface UseOptimisticUpdateReturn<T> {
  updateOptimistically: (
    entity: T,
    changes: Partial<T>,
    serverUpdate: () => Promise<T>
  ) => Promise<void>
  isUpdating: boolean
  pendingCount: number
  conflictCount: number
  rollbackAll: () => void
}

export function useOptimisticUpdate<T extends { id: string; updated_at?: Date | string }>(
  options: UseOptimisticUpdateOptions<T> = {}
): UseOptimisticUpdateReturn<T> {
  const {
    strategy = { type: 'last-write-wins' },
    onConflict,
    onRollback,
    showToasts = true
  } = options

  const [isUpdating, setIsUpdating] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [conflictCount, setConflictCount] = useState(0)

  const updater = useRef(new OptimisticUpdater<T>(strategy))
  const detector = useRef(new ConflictDetector())
  const { showSuccess, showError, showWarning } = useToast()

  const updateOptimistically = useCallback(async (
    entity: T,
    changes: Partial<T>,
    serverUpdate: () => Promise<T>
  ) => {
    setIsUpdating(true)
    setPendingCount(prev => prev + 1)

    // Apply optimistic update
    const updateId = updater.current.applyOptimisticUpdate(
      entity.id,
      changes,
      entity,
      () => {
        // This callback would update the UI
        // In real usage, this would be passed from the component
      }
    )

    try {
      // Perform server update
      const serverValue = await serverUpdate()

      // Detect conflicts
      const localValue = { ...entity, ...changes, updated_at: new Date() } as T
      const conflicts = detector.current.detectConflicts(localValue, serverValue, entity)

      if (conflicts.length > 0) {
        setConflictCount(prev => prev + 1)

        const resolution = detector.current.suggestResolution(conflicts)

        if (resolution === 'manual' || resolution === 'remote-wins') {
          // Handle conflict
          updater.current.handleConflict(
            updateId,
            localValue,
            serverValue,
            () => {
              if (onConflict) {
                onConflict(localValue, serverValue)
              }
              if (showToasts) {
                showWarning(
                  '충돌 감지',
                  { message: `${conflicts.length}개의 충돌이 자동 해결되었습니다` }
                )
              }
            }
          )
        } else {
          // Auto-merge or local-wins
          updater.current.confirmUpdate(updateId)
          if (showToasts) {
            showSuccess('업데이트 성공', { message: '변경사항이 저장되었습니다' })
          }
        }
      } else {
        // No conflicts
        updater.current.confirmUpdate(updateId)
        if (showToasts) {
          showSuccess('업데이트 성공', { message: '변경사항이 저장되었습니다' })
        }
      }
    } catch (error) {
      // Handle failure
      const willRetry = updater.current.handleFailure(
        updateId,
        error as Error,
        true
      )

      if (!willRetry) {
        // Rollback occurred
        if (onRollback) {
          onRollback(entity)
        }
        if (showToasts) {
          showError(
            '업데이트 실패',
            { message: '변경사항을 저장할 수 없습니다. 이전 상태로 복원되었습니다.' }
          )
        }
      }
    } finally {
      setIsUpdating(false)
      setPendingCount(prev => Math.max(0, prev - 1))
    }
  }, [onConflict, onRollback, showToasts, showSuccess, showError, showWarning])

  const rollbackAll = useCallback(() => {
    updater.current.clearPending()
    setPendingCount(0)
    setConflictCount(0)
    if (showToasts) {
      showWarning('모든 변경 취소', { message: '대기 중인 모든 변경사항이 취소되었습니다' })
    }
  }, [showToasts, showWarning])

  return {
    updateOptimistically,
    isUpdating,
    pendingCount,
    conflictCount,
    rollbackAll
  }
}