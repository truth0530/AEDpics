import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOptimisticUpdate } from '@/lib/realtime/hooks/useOptimisticUpdate'
import * as ToastModule from '@/components/ui/Toast'

vi.mock('@/components/ui/Toast')

describe('useOptimisticUpdate', () => {
  let mockShowSuccess: any
  let mockShowError: any
  let mockShowWarning: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockShowSuccess = vi.fn()
    mockShowError = vi.fn()
    mockShowWarning = vi.fn()

    vi.spyOn(ToastModule, 'useToast').mockReturnValue({
      showSuccess: mockShowSuccess,
      showError: mockShowError,
      showWarning: mockShowWarning,
      showInfo: vi.fn()
    })
  })

  describe('Basic Operations', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useOptimisticUpdate())

      expect(result.current.isUpdating).toBe(false)
      expect(result.current.pendingCount).toBe(0)
      expect(result.current.conflictCount).toBe(0)
    })

    it('should handle successful optimistic update', async () => {
      const { result } = renderHook(() => useOptimisticUpdate())

      const entity = {
        id: 'test-1',
        name: 'Test Entity',
        updated_at: new Date().toISOString()
      }

      const changes = {
        name: 'Updated Entity'
      }

      const serverUpdate = vi.fn().mockResolvedValue({
        ...entity,
        ...changes,
        updated_at: new Date().toISOString()
      })

      await act(async () => {
        await result.current.updateOptimistically(entity, changes, serverUpdate)
      })

      expect(serverUpdate).toHaveBeenCalled()
      expect(result.current.isUpdating).toBe(false)
      expect(result.current.pendingCount).toBe(0)
      expect(mockShowSuccess).toHaveBeenCalledWith(
        '업데이트 성공',
        '변경사항이 저장되었습니다'
      )
    })

    it('should track updating state', async () => {
      const { result } = renderHook(() => useOptimisticUpdate())

      const entity = { id: 'test-1', name: 'Test' }
      const serverUpdate = vi.fn(() =>
        new Promise(resolve => setTimeout(() => resolve(entity), 100))
      )

      const updatePromise = act(async () => {
        await result.current.updateOptimistically(entity, { name: 'Updated' }, serverUpdate)
      })

      expect(result.current.isUpdating).toBe(true)
      expect(result.current.pendingCount).toBe(1)

      await updatePromise

      expect(result.current.isUpdating).toBe(false)
      expect(result.current.pendingCount).toBe(0)
    })
  })

  describe('Conflict Handling', () => {
    it('should detect and handle conflicts', async () => {
      const onConflict = vi.fn()

      const { result } = renderHook(() =>
        useOptimisticUpdate({ onConflict })
      )

      const entity = {
        id: 'test-1',
        name: 'Original',
        status: 'active',
        updated_at: new Date(Date.now() - 5000).toISOString()
      }

      const changes = {
        name: 'Updated Locally',
        updated_at: new Date().toISOString()
      }

      const serverValue = {
        ...entity,
        name: 'Updated Remotely',
        status: 'inactive',
        updated_at: new Date(Date.now() + 1000).toISOString()
      }

      const serverUpdate = vi.fn().mockResolvedValue(serverValue)

      await act(async () => {
        await result.current.updateOptimistically(entity, changes, serverUpdate)
      })

      expect(result.current.conflictCount).toBe(1)
      expect(onConflict).toHaveBeenCalled()
      expect(mockShowWarning).toHaveBeenCalled()
    })

    it('should use last-write-wins strategy by default', async () => {
      const { result } = renderHook(() => useOptimisticUpdate())

      const entity = {
        id: 'test-1',
        name: 'Original',
        updated_at: new Date(Date.now() - 5000).toISOString()
      }

      const serverValue = {
        id: 'test-1',
        name: 'Server Value',
        updated_at: new Date().toISOString()
      }

      const serverUpdate = vi.fn().mockResolvedValue(serverValue)

      await act(async () => {
        await result.current.updateOptimistically(
          entity,
          { name: 'Local Value' },
          serverUpdate
        )
      })

      expect(serverUpdate).toHaveBeenCalled()
      expect(mockShowSuccess).toHaveBeenCalled()
    })

    it('should support custom conflict resolution strategy', async () => {
      const customMerge = vi.fn((local, remote) => ({
        ...remote,
        name: `Merged: ${local.name} + ${remote.name}`
      }))

      const { result } = renderHook(() =>
        useOptimisticUpdate({
          strategy: { type: 'merge', mergeFunction: customMerge }
        })
      )

      const entity = {
        id: 'test-1',
        name: 'Original',
        updated_at: new Date(Date.now() - 5000).toISOString()
      }

      const serverValue = {
        id: 'test-1',
        name: 'Server',
        updated_at: new Date().toISOString()
      }

      const serverUpdate = vi.fn().mockResolvedValue(serverValue)

      await act(async () => {
        await result.current.updateOptimistically(
          entity,
          { name: 'Local' },
          serverUpdate
        )
      })

      expect(mockShowWarning).toHaveBeenCalled()
    })
  })

  describe('Failure Handling', () => {
    it('should handle update failures', async () => {
      const onRollback = vi.fn()

      const { result } = renderHook(() =>
        useOptimisticUpdate({ onRollback })
      )

      const entity = {
        id: 'test-1',
        name: 'Original'
      }

      const serverUpdate = vi.fn().mockRejectedValue(new Error('Network error'))

      await act(async () => {
        await result.current.updateOptimistically(
          entity,
          { name: 'Updated' },
          serverUpdate
        )
      })

      expect(onRollback).toHaveBeenCalledWith(entity)
      expect(mockShowError).toHaveBeenCalledWith(
        '업데이트 실패',
        '변경사항을 저장할 수 없습니다. 이전 상태로 복원되었습니다.'
      )
      expect(result.current.pendingCount).toBe(0)
    })

    it('should rollback on failure', async () => {
      const { result } = renderHook(() => useOptimisticUpdate())

      const entity = {
        id: 'test-1',
        name: 'Original',
        count: 5
      }

      const serverUpdate = vi.fn()
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockRejectedValueOnce(new Error('Second attempt failed'))
        .mockRejectedValueOnce(new Error('Third attempt failed'))
        .mockRejectedValueOnce(new Error('Fourth attempt failed'))

      await act(async () => {
        await result.current.updateOptimistically(
          entity,
          { count: 10 },
          serverUpdate
        )
      })

      expect(serverUpdate).toHaveBeenCalledTimes(1)
      expect(mockShowError).toHaveBeenCalled()
    })
  })

  describe('Multiple Updates', () => {
    it('should track multiple pending updates', async () => {
      const { result } = renderHook(() => useOptimisticUpdate())

      const entities = [
        { id: 'test-1', name: 'Entity 1' },
        { id: 'test-2', name: 'Entity 2' },
        { id: 'test-3', name: 'Entity 3' }
      ]

      const serverUpdate = vi.fn(() =>
        new Promise(resolve => setTimeout(resolve, 50))
      )

      const promises = entities.map(entity =>
        act(async () => {
          await result.current.updateOptimistically(
            entity,
            { name: `Updated ${entity.name}` },
            serverUpdate
          )
        })
      )

      expect(result.current.pendingCount).toBe(3)

      await Promise.all(promises)

      expect(result.current.pendingCount).toBe(0)
    })

    it('should track conflicts across multiple updates', async () => {
      const { result } = renderHook(() => useOptimisticUpdate())

      const createConflictingUpdate = (id: string) => ({
        entity: {
          id,
          name: 'Original',
          updated_at: new Date(Date.now() - 10000).toISOString()
        },
        serverValue: {
          id,
          name: 'Conflicted',
          updated_at: new Date().toISOString()
        }
      })

      const updates = [
        createConflictingUpdate('test-1'),
        createConflictingUpdate('test-2')
      ]

      await Promise.all(
        updates.map(({ entity, serverValue }) =>
          act(async () => {
            await result.current.updateOptimistically(
              entity,
              { name: 'Local Update' },
              vi.fn().mockResolvedValue(serverValue)
            )
          })
        )
      )

      expect(result.current.conflictCount).toBe(2)
    })
  })

  describe('Rollback All', () => {
    it('should rollback all pending changes', async () => {
      const { result } = renderHook(() => useOptimisticUpdate())

      const longRunningUpdate = vi.fn(() =>
        new Promise(resolve => setTimeout(resolve, 1000))
      )

      act(() => {
        result.current.updateOptimistically(
          { id: 'test-1', name: 'Entity 1' },
          { name: 'Updated 1' },
          longRunningUpdate
        )
        result.current.updateOptimistically(
          { id: 'test-2', name: 'Entity 2' },
          { name: 'Updated 2' },
          longRunningUpdate
        )
      })

      expect(result.current.pendingCount).toBe(2)

      act(() => {
        result.current.rollbackAll()
      })

      expect(result.current.pendingCount).toBe(0)
      expect(result.current.conflictCount).toBe(0)
      expect(mockShowWarning).toHaveBeenCalledWith(
        '모든 변경 취소',
        '대기 중인 모든 변경사항이 취소되었습니다'
      )
    })
  })

  describe('Toast Notifications', () => {
    it('should show toasts when enabled', async () => {
      const { result } = renderHook(() =>
        useOptimisticUpdate({ showToasts: true })
      )

      const entity = { id: 'test-1', name: 'Test' }
      const serverUpdate = vi.fn().mockResolvedValue(entity)

      await act(async () => {
        await result.current.updateOptimistically(entity, { name: 'Updated' }, serverUpdate)
      })

      expect(mockShowSuccess).toHaveBeenCalled()
    })

    it('should not show toasts when disabled', async () => {
      const { result } = renderHook(() =>
        useOptimisticUpdate({ showToasts: false })
      )

      const entity = { id: 'test-1', name: 'Test' }
      const serverUpdate = vi.fn().mockResolvedValue(entity)

      await act(async () => {
        await result.current.updateOptimistically(entity, { name: 'Updated' }, serverUpdate)
      })

      expect(mockShowSuccess).not.toHaveBeenCalled()
    })
  })
})