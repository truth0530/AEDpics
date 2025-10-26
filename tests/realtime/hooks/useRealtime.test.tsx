import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useRealtime } from '@/lib/realtime/hooks/useRealtime'
import { RealtimeManager } from '@/lib/realtime/RealtimeManager'
import type { User } from '@supabase/supabase-js'

vi.mock('@/lib/realtime/RealtimeManager')

describe('useRealtime', () => {
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
      initialize: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      reconnect: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn().mockReturnValue(vi.fn()),
      getConnectionState: vi.fn().mockReturnValue('disconnected'),
      getOnlineUsers: vi.fn().mockReturnValue([]),
      isUserOnline: vi.fn().mockReturnValue(false),
      updatePresenceActivity: vi.fn().mockResolvedValue(undefined),
      broadcast: vi.fn().mockResolvedValue(undefined),
      broadcastCursor: vi.fn().mockResolvedValue(undefined),
      broadcastTyping: vi.fn().mockResolvedValue(undefined),
      broadcastNotification: vi.fn().mockResolvedValue(undefined)
    }

    mockSupabaseClient = {
      channel: vi.fn().mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockResolvedValue({ error: null }),
        unsubscribe: vi.fn().mockResolvedValue(undefined)
      })
    }

    ;(RealtimeManager.getInstance as any).mockReturnValue(mockManager)
    ;(RealtimeManager.destroyInstance as any).mockImplementation(() => {})
  })

  describe('Initialization', () => {
    it('should initialize realtime manager on mount', async () => {
      const { result } = renderHook(() =>
        useRealtime(mockSupabaseClient, mockUser)
      )

      await waitFor(() => {
        expect(RealtimeManager.getInstance).toHaveBeenCalledWith(
          mockSupabaseClient,
          mockUser
        )
        expect(mockManager.initialize).toHaveBeenCalled()
      })

      expect(result.current.isConnected).toBe(false)
    })

    it('should handle initialization errors gracefully', async () => {
      mockManager.initialize.mockRejectedValueOnce(new Error('Connection failed'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      renderHook(() => useRealtime(mockSupabaseClient, mockUser))

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to initialize realtime:',
          expect.any(Error)
        )
      })

      consoleSpy.mockRestore()
    })

    it('should cleanup on unmount', async () => {
      const { unmount } = renderHook(() =>
        useRealtime(mockSupabaseClient, mockUser)
      )

      await waitFor(() => {
        expect(mockManager.initialize).toHaveBeenCalled()
      })

      unmount()

      expect(mockManager.disconnect).toHaveBeenCalled()
      expect(RealtimeManager.destroyInstance).toHaveBeenCalled()
    })
  })

  describe('Connection State', () => {
    it('should track connection state changes', async () => {
      const { result, rerender } = renderHook(() =>
        useRealtime(mockSupabaseClient, mockUser)
      )

      expect(result.current.connectionState).toBe('disconnected')
      expect(result.current.isConnected).toBe(false)

      mockManager.getConnectionState.mockReturnValue('connected')

      rerender()

      await waitFor(() => {
        expect(result.current.connectionState).toBe('connected')
        expect(result.current.isConnected).toBe(true)
      })
    })
  })

  describe('Event Subscription', () => {
    it('should subscribe to events', async () => {
      const { result } = renderHook(() =>
        useRealtime(mockSupabaseClient, mockUser)
      )

      await waitFor(() => {
        expect(mockManager.initialize).toHaveBeenCalled()
      })

      const callback = vi.fn()
      const eventName = 'test-event'

      act(() => {
        result.current.subscribe(eventName, callback)
      })

      expect(mockManager.subscribe).toHaveBeenCalledWith(eventName, callback)
    })

    it('should return unsubscribe function', async () => {
      const unsubscribeFn = vi.fn()
      mockManager.subscribe.mockReturnValue(unsubscribeFn)

      const { result } = renderHook(() =>
        useRealtime(mockSupabaseClient, mockUser)
      )

      await waitFor(() => {
        expect(mockManager.initialize).toHaveBeenCalled()
      })

      const callback = vi.fn()
      let unsubscribe: (() => void) | undefined

      act(() => {
        unsubscribe = result.current.subscribe('test-event', callback)
      })

      expect(unsubscribe).toBeDefined()

      act(() => {
        unsubscribe?.()
      })

      expect(unsubscribeFn).toHaveBeenCalled()
    })
  })

  describe('Online Users', () => {
    it('should track online users', async () => {
      const mockUsers = [
        { user_id: 'user-1', user_email: 'user1@example.com' },
        { user_id: 'user-2', user_email: 'user2@example.com' }
      ]
      mockManager.getOnlineUsers.mockReturnValue(mockUsers)

      const { result } = renderHook(() =>
        useRealtime(mockSupabaseClient, mockUser)
      )

      await waitFor(() => {
        expect(result.current.onlineUsers).toEqual(mockUsers)
      })
    })

    it('should check if user is online', async () => {
      mockManager.isUserOnline.mockImplementation((userId: string) =>
        userId === 'online-user'
      )

      const { result } = renderHook(() =>
        useRealtime(mockSupabaseClient, mockUser)
      )

      await waitFor(() => {
        expect(mockManager.initialize).toHaveBeenCalled()
      })

      expect(result.current.isUserOnline('online-user')).toBe(true)
      expect(result.current.isUserOnline('offline-user')).toBe(false)
    })
  })

  describe('Presence Updates', () => {
    it('should update presence activity', async () => {
      const { result } = renderHook(() =>
        useRealtime(mockSupabaseClient, mockUser)
      )

      await waitFor(() => {
        expect(mockManager.initialize).toHaveBeenCalled()
      })

      const activity = {
        current_page: '/team-dashboard',
        current_task: 'task-123'
      }

      await act(async () => {
        await result.current.updatePresenceActivity(activity)
      })

      expect(mockManager.updatePresenceActivity).toHaveBeenCalledWith(activity)
    })
  })

  describe('Broadcasting', () => {
    it('should broadcast custom events', async () => {
      const { result } = renderHook(() =>
        useRealtime(mockSupabaseClient, mockUser)
      )

      await waitFor(() => {
        expect(mockManager.initialize).toHaveBeenCalled()
      })

      const payload = { data: 'test' }

      await act(async () => {
        await result.current.broadcast('custom-event', payload)
      })

      expect(mockManager.broadcast).toHaveBeenCalledWith('custom-event', payload)
    })

    it('should broadcast cursor position', async () => {
      const { result } = renderHook(() =>
        useRealtime(mockSupabaseClient, mockUser)
      )

      await waitFor(() => {
        expect(mockManager.initialize).toHaveBeenCalled()
      })

      await act(async () => {
        await result.current.broadcastCursor(100, 200, 'element-123')
      })

      expect(mockManager.broadcastCursor).toHaveBeenCalledWith(100, 200, 'element-123')
    })

    it('should broadcast typing indicator', async () => {
      const { result } = renderHook(() =>
        useRealtime(mockSupabaseClient, mockUser)
      )

      await waitFor(() => {
        expect(mockManager.initialize).toHaveBeenCalled()
      })

      await act(async () => {
        await result.current.broadcastTyping('field-123', true)
      })

      expect(mockManager.broadcastTyping).toHaveBeenCalledWith('field-123', true)
    })

    it('should broadcast notification', async () => {
      const { result } = renderHook(() =>
        useRealtime(mockSupabaseClient, mockUser)
      )

      await waitFor(() => {
        expect(mockManager.initialize).toHaveBeenCalled()
      })

      await act(async () => {
        await result.current.broadcastNotification(
          'task_assigned',
          'New Task',
          'You have a new task',
          ['user-1', 'user-2']
        )
      })

      expect(mockManager.broadcastNotification).toHaveBeenCalledWith(
        'task_assigned',
        'New Task',
        'You have a new task',
        ['user-1', 'user-2'],
        undefined
      )
    })
  })

  describe('Reconnection', () => {
    it('should handle reconnection', async () => {
      const { result } = renderHook(() =>
        useRealtime(mockSupabaseClient, mockUser)
      )

      await waitFor(() => {
        expect(mockManager.initialize).toHaveBeenCalled()
      })

      await act(async () => {
        await result.current.reconnect()
      })

      expect(mockManager.reconnect).toHaveBeenCalled()
    })
  })
})