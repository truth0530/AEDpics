import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useRealtimeSync } from '@/lib/realtime/hooks/useRealtimeSync'
import { RealtimeManager } from '@/lib/realtime/RealtimeManager'
import type { User } from '@supabase/supabase-js'

vi.mock('@/lib/realtime/RealtimeManager')

describe('useRealtimeSync', () => {
  let mockManager: any
  let mockSupabaseClient: any
  let mockUser: User

  beforeEach(() => {
    vi.clearAllMocks()

    mockUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString()
    }

    mockManager = {
      subscribe: vi.fn(),
      initialize: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined)
    }

    mockSupabaseClient = {}

    ;(RealtimeManager.getInstance as any).mockReturnValue(mockManager)
    ;(RealtimeManager.destroyInstance as any).mockImplementation(() => {})
  })

  describe('Table Subscriptions', () => {
    it('should register handlers for inspections table', () => {
      const handlers = {
        onInsert: vi.fn(),
        onUpdate: vi.fn(),
        onDelete: vi.fn()
      }

      renderHook(() =>
        useRealtimeSync(mockSupabaseClient, mockUser, {
          inspections: handlers
        })
      )

      expect(mockManager.subscribe).toHaveBeenCalledWith(
        'inspections:INSERT',
        handlers.onInsert
      )
      expect(mockManager.subscribe).toHaveBeenCalledWith(
        'inspections:UPDATE',
        handlers.onUpdate
      )
      expect(mockManager.subscribe).toHaveBeenCalledWith(
        'inspections:DELETE',
        handlers.onDelete
      )
    })

    it('should register handlers for multiple tables', () => {
      const inspectionHandlers = {
        onInsert: vi.fn(),
        onUpdate: vi.fn()
      }

      const scheduleHandlers = {
        onInsert: vi.fn(),
        onDelete: vi.fn()
      }

      renderHook(() =>
        useRealtimeSync(mockSupabaseClient, mockUser, {
          inspections: inspectionHandlers,
          inspection_schedule_entries: scheduleHandlers
        })
      )

      expect(mockManager.subscribe).toHaveBeenCalledWith(
        'inspections:INSERT',
        inspectionHandlers.onInsert
      )
      expect(mockManager.subscribe).toHaveBeenCalledWith(
        'inspections:UPDATE',
        inspectionHandlers.onUpdate
      )
      expect(mockManager.subscribe).toHaveBeenCalledWith(
        'inspection_schedule_entries:INSERT',
        scheduleHandlers.onInsert
      )
      expect(mockManager.subscribe).toHaveBeenCalledWith(
        'inspection_schedule_entries:DELETE',
        scheduleHandlers.onDelete
      )
    })

    it('should skip undefined handlers', () => {
      const handlers = {
        onInsert: vi.fn(),
        onUpdate: undefined,
        onDelete: vi.fn()
      }

      renderHook(() =>
        useRealtimeSync(mockSupabaseClient, mockUser, {
          inspections: handlers
        })
      )

      expect(mockManager.subscribe).toHaveBeenCalledWith(
        'inspections:INSERT',
        handlers.onInsert
      )
      expect(mockManager.subscribe).not.toHaveBeenCalledWith(
        'inspections:UPDATE',
        expect.anything()
      )
      expect(mockManager.subscribe).toHaveBeenCalledWith(
        'inspections:DELETE',
        handlers.onDelete
      )
    })
  })

  describe('Sync State Management', () => {
    it('should track sync state for tables', async () => {
      const { result } = renderHook(() =>
        useRealtimeSync(mockSupabaseClient, mockUser, {
          inspections: {
            onInsert: vi.fn()
          }
        })
      )

      expect(result.current.syncState.inspections).toBeDefined()
      expect(result.current.syncState.inspections.isSyncing).toBe(false)
      expect(result.current.syncState.inspections.lastSync).toBeNull()
      expect(result.current.syncState.inspections.error).toBeNull()
    })

    it('should update sync state on sync events', async () => {
      let syncCallback: ((data: any) => void) | undefined

      mockManager.subscribe.mockImplementation((event: string, callback: any) => {
        if (event === 'sync:inspections') {
          syncCallback = callback
        }
        return vi.fn()
      })

      const { result } = renderHook(() =>
        useRealtimeSync(mockSupabaseClient, mockUser, {
          inspections: {
            onInsert: vi.fn()
          }
        })
      )

      act(() => {
        syncCallback?.({ status: 'syncing' })
      })

      await waitFor(() => {
        expect(result.current.syncState.inspections.isSyncing).toBe(true)
      })

      act(() => {
        syncCallback?.({ status: 'synced' })
      })

      await waitFor(() => {
        expect(result.current.syncState.inspections.isSyncing).toBe(false)
        expect(result.current.syncState.inspections.lastSync).toBeDefined()
      })
    })

    it('should handle sync errors', async () => {
      let errorCallback: ((error: any) => void) | undefined

      mockManager.subscribe.mockImplementation((event: string, callback: any) => {
        if (event === 'sync:inspections:error') {
          errorCallback = callback
        }
        return vi.fn()
      })

      const { result } = renderHook(() =>
        useRealtimeSync(mockSupabaseClient, mockUser, {
          inspections: {
            onInsert: vi.fn()
          }
        })
      )

      const error = new Error('Sync failed')

      act(() => {
        errorCallback?.(error)
      })

      await waitFor(() => {
        expect(result.current.syncState.inspections.error).toBe(error.message)
        expect(result.current.syncState.inspections.isSyncing).toBe(false)
      })
    })
  })

  describe('Pending Changes', () => {
    it('should track pending changes count', () => {
      const { result } = renderHook(() =>
        useRealtimeSync(mockSupabaseClient, mockUser, {
          inspections: {
            onInsert: vi.fn()
          }
        })
      )

      expect(result.current.pendingChanges).toBe(0)

      act(() => {
        result.current.setPendingChanges(5)
      })

      expect(result.current.pendingChanges).toBe(5)
    })

    it('should check if there are pending changes', () => {
      const { result } = renderHook(() =>
        useRealtimeSync(mockSupabaseClient, mockUser, {
          inspections: {
            onInsert: vi.fn()
          }
        })
      )

      expect(result.current.hasPendingChanges).toBe(false)

      act(() => {
        result.current.setPendingChanges(1)
      })

      expect(result.current.hasPendingChanges).toBe(true)
    })
  })

  describe('Force Sync', () => {
    it('should trigger force sync for specific table', async () => {
      const onInsert = vi.fn()
      let forceCallback: (() => void) | undefined

      mockManager.subscribe.mockImplementation((event: string, callback: any) => {
        if (event === 'force-sync:inspections') {
          forceCallback = callback
        }
        return vi.fn()
      })

      const { result } = renderHook(() =>
        useRealtimeSync(mockSupabaseClient, mockUser, {
          inspections: {
            onInsert
          }
        })
      )

      await act(async () => {
        await result.current.forceSync('inspections')
      })

      expect(result.current.syncState.inspections.isSyncing).toBe(false)
    })

    it('should force sync all tables', async () => {
      const { result } = renderHook(() =>
        useRealtimeSync(mockSupabaseClient, mockUser, {
          inspections: {
            onInsert: vi.fn()
          },
          inspection_schedule_entries: {
            onInsert: vi.fn()
          }
        })
      )

      await act(async () => {
        await result.current.forceSyncAll()
      })

      expect(result.current.syncState.inspections.isSyncing).toBe(false)
      expect(result.current.syncState.inspection_schedule_entries.isSyncing).toBe(false)
    })
  })

  describe('Cleanup', () => {
    it('should cleanup all subscriptions on unmount', () => {
      const unsubscribeFns = [vi.fn(), vi.fn(), vi.fn()]
      let subscribeCallCount = 0

      mockManager.subscribe.mockImplementation(() => {
        return unsubscribeFns[subscribeCallCount++]
      })

      const { unmount } = renderHook(() =>
        useRealtimeSync(mockSupabaseClient, mockUser, {
          inspections: {
            onInsert: vi.fn(),
            onUpdate: vi.fn(),
            onDelete: vi.fn()
          }
        })
      )

      unmount()

      unsubscribeFns.forEach(fn => {
        expect(fn).toHaveBeenCalled()
      })
    })

    it('should cleanup subscriptions when handlers change', () => {
      const unsubscribeFn = vi.fn()
      mockManager.subscribe.mockReturnValue(unsubscribeFn)

      const { rerender } = renderHook(
        ({ handlers }) =>
          useRealtimeSync(mockSupabaseClient, mockUser, handlers),
        {
          initialProps: {
            handlers: {
              inspections: {
                onInsert: vi.fn()
              }
            }
          }
        }
      )

      const initialUnsubscribeCalls = unsubscribeFn.mock.calls.length

      rerender({
        handlers: {
          inspections: {
            onInsert: vi.fn(),
            onUpdate: vi.fn()
          }
        }
      })

      expect(unsubscribeFn).toHaveBeenCalledTimes(initialUnsubscribeCalls + 1)
    })
  })
})