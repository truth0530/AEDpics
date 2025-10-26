import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTypingIndicator } from '@/lib/realtime/hooks/useTypingIndicator'
import { RealtimeManager } from '@/lib/realtime/RealtimeManager'
import type { User } from '@supabase/supabase-js'

vi.mock('@/lib/realtime/RealtimeManager')

describe('useTypingIndicator', () => {
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
      broadcastTyping: vi.fn().mockResolvedValue(undefined),
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

  describe('Typing State Management', () => {
    it('should start typing and broadcast', async () => {
      const { result } = renderHook(() =>
        useTypingIndicator(mockSupabaseClient, mockUser)
      )

      await act(async () => {
        await result.current.startTyping('field-123')
      })

      expect(result.current.isTyping).toBe(true)
      expect(result.current.currentField).toBe('field-123')
      expect(mockManager.broadcastTyping).toHaveBeenCalledWith('field-123', true)
    })

    it('should stop typing and broadcast', async () => {
      const { result } = renderHook(() =>
        useTypingIndicator(mockSupabaseClient, mockUser)
      )

      await act(async () => {
        await result.current.startTyping('field-123')
      })

      expect(result.current.isTyping).toBe(true)

      await act(async () => {
        await result.current.stopTyping()
      })

      expect(result.current.isTyping).toBe(false)
      expect(result.current.currentField).toBeNull()
      expect(mockManager.broadcastTyping).toHaveBeenLastCalledWith('field-123', false)
    })

    it('should handle typing updates', async () => {
      const { result } = renderHook(() =>
        useTypingIndicator(mockSupabaseClient, mockUser, { timeout: 2000 })
      )

      await act(async () => {
        await result.current.updateTyping('field-123')
      })

      expect(result.current.isTyping).toBe(true)
      expect(mockManager.broadcastTyping).toHaveBeenCalledWith('field-123', true)

      await act(async () => {
        await result.current.updateTyping('field-123')
      })

      expect(mockManager.broadcastTyping).toHaveBeenCalledTimes(1)

      act(() => {
        vi.advanceTimersByTime(1500)
      })

      await act(async () => {
        await result.current.updateTyping('field-123')
      })

      expect(result.current.isTyping).toBe(true)

      act(() => {
        vi.advanceTimersByTime(2500)
      })

      expect(result.current.isTyping).toBe(false)
      expect(mockManager.broadcastTyping).toHaveBeenLastCalledWith('field-123', false)
    })

    it('should switch fields when typing in different field', async () => {
      const { result } = renderHook(() =>
        useTypingIndicator(mockSupabaseClient, mockUser)
      )

      await act(async () => {
        await result.current.startTyping('field-123')
      })

      expect(result.current.currentField).toBe('field-123')
      expect(mockManager.broadcastTyping).toHaveBeenCalledWith('field-123', true)

      await act(async () => {
        await result.current.startTyping('field-456')
      })

      expect(result.current.currentField).toBe('field-456')
      expect(mockManager.broadcastTyping).toHaveBeenCalledWith('field-123', false)
      expect(mockManager.broadcastTyping).toHaveBeenCalledWith('field-456', true)
    })
  })

  describe('Typing Timeout', () => {
    it('should auto-stop typing after timeout', async () => {
      const { result } = renderHook(() =>
        useTypingIndicator(mockSupabaseClient, mockUser, { timeout: 1000 })
      )

      await act(async () => {
        await result.current.startTyping('field-123')
      })

      expect(result.current.isTyping).toBe(true)

      act(() => {
        vi.advanceTimersByTime(1500)
      })

      expect(result.current.isTyping).toBe(false)
      expect(mockManager.broadcastTyping).toHaveBeenLastCalledWith('field-123', false)
    })

    it('should reset timeout on updateTyping', async () => {
      const { result } = renderHook(() =>
        useTypingIndicator(mockSupabaseClient, mockUser, { timeout: 1000 })
      )

      await act(async () => {
        await result.current.startTyping('field-123')
      })

      act(() => {
        vi.advanceTimersByTime(800)
      })

      expect(result.current.isTyping).toBe(true)

      await act(async () => {
        await result.current.updateTyping('field-123')
      })

      act(() => {
        vi.advanceTimersByTime(800)
      })

      expect(result.current.isTyping).toBe(true)

      act(() => {
        vi.advanceTimersByTime(300)
      })

      expect(result.current.isTyping).toBe(false)
    })
  })

  describe('Remote Typing Indicators', () => {
    it('should track remote typing users', () => {
      let typingCallback: ((data: any) => void) | undefined

      mockManager.subscribe.mockImplementation((event: string, callback: any) => {
        if (event === 'typing') {
          typingCallback = callback
        }
        return vi.fn()
      })

      const { result } = renderHook(() =>
        useTypingIndicator(mockSupabaseClient, mockUser)
      )

      act(() => {
        typingCallback?.({
          user_id: 'user-2',
          user_email: 'user2@example.com',
          field_id: 'field-123',
          is_typing: true,
          timestamp: new Date().toISOString()
        })
      })

      expect(result.current.typingUsers).toHaveLength(1)
      expect(result.current.typingUsers[0]).toMatchObject({
        user_id: 'user-2',
        field_id: 'field-123',
        is_typing: true
      })
    })

    it('should update existing typing user', () => {
      let typingCallback: ((data: any) => void) | undefined

      mockManager.subscribe.mockImplementation((event: string, callback: any) => {
        if (event === 'typing') {
          typingCallback = callback
        }
        return vi.fn()
      })

      const { result } = renderHook(() =>
        useTypingIndicator(mockSupabaseClient, mockUser)
      )

      act(() => {
        typingCallback?.({
          user_id: 'user-2',
          user_email: 'user2@example.com',
          field_id: 'field-123',
          is_typing: true,
          timestamp: new Date().toISOString()
        })
      })

      expect(result.current.typingUsers).toHaveLength(1)

      act(() => {
        typingCallback?.({
          user_id: 'user-2',
          user_email: 'user2@example.com',
          field_id: 'field-123',
          is_typing: false,
          timestamp: new Date().toISOString()
        })
      })

      expect(result.current.typingUsers).toHaveLength(0)
    })

    it('should ignore own typing broadcasts', () => {
      let typingCallback: ((data: any) => void) | undefined

      mockManager.subscribe.mockImplementation((event: string, callback: any) => {
        if (event === 'typing') {
          typingCallback = callback
        }
        return vi.fn()
      })

      const { result } = renderHook(() =>
        useTypingIndicator(mockSupabaseClient, mockUser)
      )

      act(() => {
        typingCallback?.({
          user_id: mockUser.id,
          user_email: mockUser.email,
          field_id: 'field-123',
          is_typing: true,
          timestamp: new Date().toISOString()
        })
      })

      expect(result.current.typingUsers).toHaveLength(0)
    })

    it('should get typing users for specific field', () => {
      let typingCallback: ((data: any) => void) | undefined

      mockManager.subscribe.mockImplementation((event: string, callback: any) => {
        if (event === 'typing') {
          typingCallback = callback
        }
        return vi.fn()
      })

      const { result } = renderHook(() =>
        useTypingIndicator(mockSupabaseClient, mockUser)
      )

      act(() => {
        typingCallback?.({
          user_id: 'user-1',
          user_email: 'user1@example.com',
          field_id: 'field-123',
          is_typing: true,
          timestamp: new Date().toISOString()
        })
        typingCallback?.({
          user_id: 'user-2',
          user_email: 'user2@example.com',
          field_id: 'field-456',
          is_typing: true,
          timestamp: new Date().toISOString()
        })
        typingCallback?.({
          user_id: 'user-3',
          user_email: 'user3@example.com',
          field_id: 'field-123',
          is_typing: true,
          timestamp: new Date().toISOString()
        })
      })

      const field123Users = result.current.getTypingUsersForField('field-123')
      expect(field123Users).toHaveLength(2)
      expect(field123Users.map(u => u.user_id)).toContain('user-1')
      expect(field123Users.map(u => u.user_id)).toContain('user-3')

      const field456Users = result.current.getTypingUsersForField('field-456')
      expect(field456Users).toHaveLength(1)
      expect(field456Users[0].user_id).toBe('user-2')
    })

    it('should check if user is typing in field', () => {
      let typingCallback: ((data: any) => void) | undefined

      mockManager.subscribe.mockImplementation((event: string, callback: any) => {
        if (event === 'typing') {
          typingCallback = callback
        }
        return vi.fn()
      })

      const { result } = renderHook(() =>
        useTypingIndicator(mockSupabaseClient, mockUser)
      )

      act(() => {
        typingCallback?.({
          user_id: 'user-2',
          user_email: 'user2@example.com',
          field_id: 'field-123',
          is_typing: true,
          timestamp: new Date().toISOString()
        })
      })

      expect(result.current.isUserTyping('user-2', 'field-123')).toBe(true)
      expect(result.current.isUserTyping('user-2', 'field-456')).toBe(false)
      expect(result.current.isUserTyping('user-3', 'field-123')).toBe(false)
    })
  })

  describe('Typing Expiration', () => {
    it('should remove expired typing indicators', () => {
      let typingCallback: ((data: any) => void) | undefined

      mockManager.subscribe.mockImplementation((event: string, callback: any) => {
        if (event === 'typing') {
          typingCallback = callback
        }
        return vi.fn()
      })

      const { result } = renderHook(() =>
        useTypingIndicator(mockSupabaseClient, mockUser, { expirationMs: 3000 })
      )

      const oldTimestamp = new Date(Date.now() - 4000).toISOString()
      const newTimestamp = new Date().toISOString()

      act(() => {
        typingCallback?.({
          user_id: 'user-1',
          user_email: 'user1@example.com',
          field_id: 'field-123',
          is_typing: true,
          timestamp: oldTimestamp
        })
        typingCallback?.({
          user_id: 'user-2',
          user_email: 'user2@example.com',
          field_id: 'field-456',
          is_typing: true,
          timestamp: newTimestamp
        })
      })

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(result.current.typingUsers).toHaveLength(1)
      expect(result.current.typingUsers[0].user_id).toBe('user-2')
    })
  })

  describe('Cleanup', () => {
    it('should clear timers on unmount', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval')

      const { unmount, result } = renderHook(() =>
        useTypingIndicator(mockSupabaseClient, mockUser)
      )

      act(() => {
        result.current.startTyping('field-123')
      })

      unmount()

      expect(clearTimeoutSpy).toHaveBeenCalled()
      expect(clearIntervalSpy).toHaveBeenCalled()
    })

    it('should broadcast stop typing on unmount if typing', async () => {
      const { unmount, result } = renderHook(() =>
        useTypingIndicator(mockSupabaseClient, mockUser)
      )

      await act(async () => {
        await result.current.startTyping('field-123')
      })

      unmount()

      expect(mockManager.broadcastTyping).toHaveBeenLastCalledWith('field-123', false)
    })

    it('should unsubscribe from typing events on unmount', () => {
      const unsubscribeFn = vi.fn()
      mockManager.subscribe.mockReturnValue(unsubscribeFn)

      const { unmount } = renderHook(() =>
        useTypingIndicator(mockSupabaseClient, mockUser)
      )

      unmount()

      expect(unsubscribeFn).toHaveBeenCalled()
    })
  })
})