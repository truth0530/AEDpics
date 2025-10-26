import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { usePresence } from '@/lib/realtime/hooks/usePresence'
import { RealtimeManager } from '@/lib/realtime/RealtimeManager'
import type { User } from '@supabase/supabase-js'

vi.mock('@/lib/realtime/RealtimeManager')

describe('usePresence', () => {
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
      getOnlineUsers: vi.fn().mockReturnValue([]),
      subscribe: vi.fn(),
      updatePresenceActivity: vi.fn().mockResolvedValue(undefined)
    }

    mockSupabaseClient = {}

    ;(RealtimeManager.getInstance as any).mockReturnValue(mockManager)
    ;(RealtimeManager.destroyInstance as any).mockImplementation(() => {})
  })

  describe('Online Users Tracking', () => {
    it('should return online users from manager', () => {
      const mockUsers = [
        {
          user_id: 'user-1',
          user_email: 'user1@example.com',
          online_at: new Date().toISOString(),
          current_page: '/dashboard'
        },
        {
          user_id: 'user-2',
          user_email: 'user2@example.com',
          online_at: new Date().toISOString(),
          current_page: '/settings'
        }
      ]

      mockManager.getOnlineUsers.mockReturnValue(mockUsers)

      const { result } = renderHook(() =>
        usePresence(mockSupabaseClient, mockUser)
      )

      expect(result.current.onlineUsers).toEqual(mockUsers)
      expect(result.current.onlineCount).toBe(2)
    })

    it('should update when online users change', async () => {
      const { result, rerender } = renderHook(() =>
        usePresence(mockSupabaseClient, mockUser)
      )

      expect(result.current.onlineCount).toBe(0)

      const newUsers = [
        {
          user_id: 'user-1',
          user_email: 'user1@example.com',
          online_at: new Date().toISOString()
        }
      ]
      mockManager.getOnlineUsers.mockReturnValue(newUsers)

      rerender()

      await waitFor(() => {
        expect(result.current.onlineUsers).toEqual(newUsers)
        expect(result.current.onlineCount).toBe(1)
      })
    })
  })

  describe('User Activity Tracking', () => {
    it('should find users by activity', () => {
      const mockUsers = [
        {
          user_id: 'user-1',
          user_email: 'user1@example.com',
          online_at: new Date().toISOString(),
          current_page: '/dashboard',
          is_typing: true,
          current_task: 'task-123'
        },
        {
          user_id: 'user-2',
          user_email: 'user2@example.com',
          online_at: new Date().toISOString(),
          current_page: '/settings',
          is_typing: false
        }
      ]

      mockManager.getOnlineUsers.mockReturnValue(mockUsers)

      const { result } = renderHook(() =>
        usePresence(mockSupabaseClient, mockUser)
      )

      const typingUsers = result.current.getUsersByActivity('is_typing', true)
      expect(typingUsers).toHaveLength(1)
      expect(typingUsers[0].user_id).toBe('user-1')

      const dashboardUsers = result.current.getUsersByActivity('current_page', '/dashboard')
      expect(dashboardUsers).toHaveLength(1)
      expect(dashboardUsers[0].user_id).toBe('user-1')
    })

    it('should get users on specific page', () => {
      const mockUsers = [
        {
          user_id: 'user-1',
          user_email: 'user1@example.com',
          online_at: new Date().toISOString(),
          current_page: '/team-dashboard'
        },
        {
          user_id: 'user-2',
          user_email: 'user2@example.com',
          online_at: new Date().toISOString(),
          current_page: '/team-dashboard'
        },
        {
          user_id: 'user-3',
          user_email: 'user3@example.com',
          online_at: new Date().toISOString(),
          current_page: '/settings'
        }
      ]

      mockManager.getOnlineUsers.mockReturnValue(mockUsers)

      const { result } = renderHook(() =>
        usePresence(mockSupabaseClient, mockUser)
      )

      const dashboardUsers = result.current.getUsersOnPage('/team-dashboard')
      expect(dashboardUsers).toHaveLength(2)
      expect(dashboardUsers.map(u => u.user_id)).toContain('user-1')
      expect(dashboardUsers.map(u => u.user_id)).toContain('user-2')
    })

    it('should get typing users', () => {
      const mockUsers = [
        {
          user_id: 'user-1',
          user_email: 'user1@example.com',
          online_at: new Date().toISOString(),
          is_typing: true,
          field_id: 'field-1'
        },
        {
          user_id: 'user-2',
          user_email: 'user2@example.com',
          online_at: new Date().toISOString(),
          is_typing: true,
          field_id: 'field-1'
        },
        {
          user_id: 'user-3',
          user_email: 'user3@example.com',
          online_at: new Date().toISOString(),
          is_typing: false
        }
      ]

      mockManager.getOnlineUsers.mockReturnValue(mockUsers)

      const { result } = renderHook(() =>
        usePresence(mockSupabaseClient, mockUser)
      )

      const typingUsers = result.current.getTypingUsers('field-1')
      expect(typingUsers).toHaveLength(2)
      expect(typingUsers.map(u => u.user_id)).toContain('user-1')
      expect(typingUsers.map(u => u.user_id)).toContain('user-2')
    })
  })

  describe('Activity Updates', () => {
    it('should update current activity', async () => {
      const { result } = renderHook(() =>
        usePresence(mockSupabaseClient, mockUser)
      )

      const activity = {
        current_page: '/team-dashboard',
        current_task: 'task-456'
      }

      await act(async () => {
        await result.current.updateActivity(activity)
      })

      expect(mockManager.updatePresenceActivity).toHaveBeenCalledWith(activity)
    })

    it('should handle update errors gracefully', async () => {
      mockManager.updatePresenceActivity.mockRejectedValueOnce(
        new Error('Update failed')
      )

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { result } = renderHook(() =>
        usePresence(mockSupabaseClient, mockUser)
      )

      await act(async () => {
        await result.current.updateActivity({ current_page: '/test' })
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to update presence activity:',
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })
  })

  describe('Event Subscriptions', () => {
    it('should subscribe to presence sync events', () => {
      const callback = vi.fn()
      mockManager.subscribe.mockReturnValue(vi.fn())

      const { result } = renderHook(() =>
        usePresence(mockSupabaseClient, mockUser)
      )

      act(() => {
        result.current.onSync(callback)
      })

      expect(mockManager.subscribe).toHaveBeenCalledWith('presence-sync', callback)
    })

    it('should subscribe to user join events', () => {
      const callback = vi.fn()
      mockManager.subscribe.mockReturnValue(vi.fn())

      const { result } = renderHook(() =>
        usePresence(mockSupabaseClient, mockUser)
      )

      act(() => {
        result.current.onJoin(callback)
      })

      expect(mockManager.subscribe).toHaveBeenCalledWith('user-join', callback)
    })

    it('should subscribe to user leave events', () => {
      const callback = vi.fn()
      mockManager.subscribe.mockReturnValue(vi.fn())

      const { result } = renderHook(() =>
        usePresence(mockSupabaseClient, mockUser)
      )

      act(() => {
        result.current.onLeave(callback)
      })

      expect(mockManager.subscribe).toHaveBeenCalledWith('user-leave', callback)
    })

    it('should return unsubscribe function', () => {
      const unsubscribeFn = vi.fn()
      mockManager.subscribe.mockReturnValue(unsubscribeFn)

      const { result } = renderHook(() =>
        usePresence(mockSupabaseClient, mockUser)
      )

      const unsubscribe = result.current.onSync(vi.fn())

      expect(typeof unsubscribe).toBe('function')

      act(() => {
        unsubscribe()
      })

      expect(unsubscribeFn).toHaveBeenCalled()
    })
  })

  describe('Cleanup', () => {
    it('should cleanup subscriptions on unmount', () => {
      const unsubscribeFns = [vi.fn(), vi.fn(), vi.fn()]
      let subscribeCallCount = 0

      mockManager.subscribe.mockImplementation(() => {
        return unsubscribeFns[subscribeCallCount++]
      })

      const { result, unmount } = renderHook(() =>
        usePresence(mockSupabaseClient, mockUser)
      )

      act(() => {
        result.current.onSync(vi.fn())
        result.current.onJoin(vi.fn())
        result.current.onLeave(vi.fn())
      })

      unmount()

      unsubscribeFns.forEach(fn => {
        expect(fn).toHaveBeenCalled()
      })
    })
  })
})