import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCursorTracking } from '@/lib/realtime/hooks/useCursorTracking'
import { RealtimeManager } from '@/lib/realtime/RealtimeManager'
import type { User } from '@supabase/supabase-js'

vi.mock('@/lib/realtime/RealtimeManager')

describe('useCursorTracking', () => {
  let mockManager: any
  let mockSupabaseClient: any
  let mockUser: User

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    mockUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString()
    }

    mockManager = {
      broadcastCursor: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn().mockReturnValue(vi.fn()),
      initialize: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined)
    }

    mockSupabaseClient = {}

    ;(RealtimeManager.getInstance as any).mockReturnValue(mockManager)
    ;(RealtimeManager.destroyInstance as any).mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Cursor Broadcasting', () => {
    it('should broadcast cursor position when enabled', async () => {
      const { result } = renderHook(() =>
        useCursorTracking(mockSupabaseClient, mockUser)
      )

      act(() => {
        result.current.setEnabled(true)
      })

      await act(async () => {
        await result.current.updateCursor(100, 200, 'element-123')
      })

      expect(mockManager.broadcastCursor).toHaveBeenCalledWith(100, 200, 'element-123')
    })

    it('should not broadcast when disabled', async () => {
      const { result } = renderHook(() =>
        useCursorTracking(mockSupabaseClient, mockUser, { enabled: false })
      )

      await act(async () => {
        await result.current.updateCursor(100, 200, 'element-123')
      })

      expect(mockManager.broadcastCursor).not.toHaveBeenCalled()
    })

    it('should throttle cursor updates', async () => {
      const { result } = renderHook(() =>
        useCursorTracking(mockSupabaseClient, mockUser, { throttleMs: 100 })
      )

      act(() => {
        result.current.setEnabled(true)
      })

      await act(async () => {
        await result.current.updateCursor(100, 200, 'element-123')
        await result.current.updateCursor(150, 250, 'element-123')
        await result.current.updateCursor(200, 300, 'element-123')
      })

      expect(mockManager.broadcastCursor).toHaveBeenCalledTimes(1)
      expect(mockManager.broadcastCursor).toHaveBeenCalledWith(100, 200, 'element-123')

      act(() => {
        vi.advanceTimersByTime(100)
      })

      await act(async () => {
        await result.current.updateCursor(250, 350, 'element-123')
      })

      expect(mockManager.broadcastCursor).toHaveBeenCalledTimes(2)
      expect(mockManager.broadcastCursor).toHaveBeenLastCalledWith(250, 350, 'element-123')
    })
  })

  describe('Remote Cursors', () => {
    it('should track remote cursors', () => {
      let cursorCallback: ((data: any) => void) | undefined

      mockManager.subscribe.mockImplementation((event: string, callback: any) => {
        if (event === 'cursor') {
          cursorCallback = callback
        }
        return vi.fn()
      })

      const { result } = renderHook(() =>
        useCursorTracking(mockSupabaseClient, mockUser)
      )

      const cursorData = {
        user_id: 'user-2',
        user_email: 'user2@example.com',
        x: 300,
        y: 400,
        element_id: 'element-456',
        timestamp: new Date().toISOString()
      }

      act(() => {
        cursorCallback?.(cursorData)
      })

      expect(result.current.remoteCursors).toHaveLength(1)
      expect(result.current.remoteCursors[0]).toMatchObject({
        user_id: 'user-2',
        user_email: 'user2@example.com',
        x: 300,
        y: 400,
        element_id: 'element-456'
      })
    })

    it('should update existing cursor for same user', () => {
      let cursorCallback: ((data: any) => void) | undefined

      mockManager.subscribe.mockImplementation((event: string, callback: any) => {
        if (event === 'cursor') {
          cursorCallback = callback
        }
        return vi.fn()
      })

      const { result } = renderHook(() =>
        useCursorTracking(mockSupabaseClient, mockUser)
      )

      act(() => {
        cursorCallback?.({
          user_id: 'user-2',
          user_email: 'user2@example.com',
          x: 100,
          y: 100,
          element_id: 'element-1',
          timestamp: new Date().toISOString()
        })
      })

      expect(result.current.remoteCursors).toHaveLength(1)
      expect(result.current.remoteCursors[0].x).toBe(100)

      act(() => {
        cursorCallback?.({
          user_id: 'user-2',
          user_email: 'user2@example.com',
          x: 200,
          y: 200,
          element_id: 'element-2',
          timestamp: new Date().toISOString()
        })
      })

      expect(result.current.remoteCursors).toHaveLength(1)
      expect(result.current.remoteCursors[0].x).toBe(200)
      expect(result.current.remoteCursors[0].element_id).toBe('element-2')
    })

    it('should ignore own cursor broadcasts', () => {
      let cursorCallback: ((data: any) => void) | undefined

      mockManager.subscribe.mockImplementation((event: string, callback: any) => {
        if (event === 'cursor') {
          cursorCallback = callback
        }
        return vi.fn()
      })

      const { result } = renderHook(() =>
        useCursorTracking(mockSupabaseClient, mockUser)
      )

      act(() => {
        cursorCallback?.({
          user_id: mockUser.id,
          user_email: mockUser.email,
          x: 100,
          y: 100,
          element_id: 'element-1',
          timestamp: new Date().toISOString()
        })
      })

      expect(result.current.remoteCursors).toHaveLength(0)
    })

    it('should limit maximum number of remote cursors', () => {
      let cursorCallback: ((data: any) => void) | undefined

      mockManager.subscribe.mockImplementation((event: string, callback: any) => {
        if (event === 'cursor') {
          cursorCallback = callback
        }
        return vi.fn()
      })

      const { result } = renderHook(() =>
        useCursorTracking(mockSupabaseClient, mockUser, { maxCursors: 2 })
      )

      act(() => {
        cursorCallback?.({
          user_id: 'user-1',
          user_email: 'user1@example.com',
          x: 100,
          y: 100,
          element_id: 'element-1',
          timestamp: new Date().toISOString()
        })
        cursorCallback?.({
          user_id: 'user-2',
          user_email: 'user2@example.com',
          x: 200,
          y: 200,
          element_id: 'element-2',
          timestamp: new Date().toISOString()
        })
        cursorCallback?.({
          user_id: 'user-3',
          user_email: 'user3@example.com',
          x: 300,
          y: 300,
          element_id: 'element-3',
          timestamp: new Date().toISOString()
        })
      })

      expect(result.current.remoteCursors).toHaveLength(2)
      expect(result.current.remoteCursors.map(c => c.user_id)).toContain('user-2')
      expect(result.current.remoteCursors.map(c => c.user_id)).toContain('user-3')
    })
  })

  describe('Cursor Expiration', () => {
    it('should remove expired cursors', () => {
      let cursorCallback: ((data: any) => void) | undefined

      mockManager.subscribe.mockImplementation((event: string, callback: any) => {
        if (event === 'cursor') {
          cursorCallback = callback
        }
        return vi.fn()
      })

      const { result } = renderHook(() =>
        useCursorTracking(mockSupabaseClient, mockUser, { expirationMs: 5000 })
      )

      const oldTimestamp = new Date(Date.now() - 6000).toISOString()
      const newTimestamp = new Date().toISOString()

      act(() => {
        cursorCallback?.({
          user_id: 'user-1',
          user_email: 'user1@example.com',
          x: 100,
          y: 100,
          element_id: 'element-1',
          timestamp: oldTimestamp
        })
        cursorCallback?.({
          user_id: 'user-2',
          user_email: 'user2@example.com',
          x: 200,
          y: 200,
          element_id: 'element-2',
          timestamp: newTimestamp
        })
      })

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(result.current.remoteCursors).toHaveLength(1)
      expect(result.current.remoteCursors[0].user_id).toBe('user-2')
    })
  })

  describe('Element-specific Cursors', () => {
    it('should get cursors for specific element', () => {
      let cursorCallback: ((data: any) => void) | undefined

      mockManager.subscribe.mockImplementation((event: string, callback: any) => {
        if (event === 'cursor') {
          cursorCallback = callback
        }
        return vi.fn()
      })

      const { result } = renderHook(() =>
        useCursorTracking(mockSupabaseClient, mockUser)
      )

      act(() => {
        cursorCallback?.({
          user_id: 'user-1',
          user_email: 'user1@example.com',
          x: 100,
          y: 100,
          element_id: 'element-1',
          timestamp: new Date().toISOString()
        })
        cursorCallback?.({
          user_id: 'user-2',
          user_email: 'user2@example.com',
          x: 200,
          y: 200,
          element_id: 'element-2',
          timestamp: new Date().toISOString()
        })
        cursorCallback?.({
          user_id: 'user-3',
          user_email: 'user3@example.com',
          x: 300,
          y: 300,
          element_id: 'element-1',
          timestamp: new Date().toISOString()
        })
      })

      const element1Cursors = result.current.getCursorsForElement('element-1')
      expect(element1Cursors).toHaveLength(2)
      expect(element1Cursors.map(c => c.user_id)).toContain('user-1')
      expect(element1Cursors.map(c => c.user_id)).toContain('user-3')

      const element2Cursors = result.current.getCursorsForElement('element-2')
      expect(element2Cursors).toHaveLength(1)
      expect(element2Cursors[0].user_id).toBe('user-2')
    })
  })

  describe('Cleanup', () => {
    it('should clear interval on unmount', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval')

      const { unmount } = renderHook(() =>
        useCursorTracking(mockSupabaseClient, mockUser)
      )

      unmount()

      expect(clearIntervalSpy).toHaveBeenCalled()
    })

    it('should unsubscribe from cursor events on unmount', () => {
      const unsubscribeFn = vi.fn()
      mockManager.subscribe.mockReturnValue(unsubscribeFn)

      const { unmount } = renderHook(() =>
        useCursorTracking(mockSupabaseClient, mockUser)
      )

      unmount()

      expect(unsubscribeFn).toHaveBeenCalled()
    })
  })
})