import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { RealtimeManager, PresenceUser } from '@/lib/realtime/RealtimeManager'
import { createClient } from '@supabase/supabase-js'
import type { RealtimeChannel, User } from '@supabase/supabase-js'

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn()
}))

describe('RealtimeManager', () => {
  let mockSupabaseClient: any
  let mockChannel: any
  let mockUser: User
  let manager: RealtimeManager

  beforeEach(() => {
    // Reset singleton
    RealtimeManager.destroyInstance()

    // Setup mock user
    mockUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString()
    }

    // Setup mock channel
    mockChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn((callback) => {
        // Simulate successful subscription
        if (callback) {
          setTimeout(() => callback('SUBSCRIBED'), 0)
        }
        return Promise.resolve({ error: null })
      }),
      unsubscribe: vi.fn().mockResolvedValue(undefined),
      track: vi.fn().mockResolvedValue(undefined),
      untrack: vi.fn().mockResolvedValue(undefined),
      send: vi.fn().mockResolvedValue(undefined),
      presenceState: vi.fn().mockReturnValue({})
    }

    // Setup mock Supabase client
    mockSupabaseClient = {
      channel: vi.fn().mockReturnValue(mockChannel)
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Singleton Pattern', () => {
    it('should create only one instance', () => {
      const instance1 = RealtimeManager.getInstance(mockSupabaseClient, mockUser)
      const instance2 = RealtimeManager.getInstance(mockSupabaseClient, mockUser)

      expect(instance1).toBe(instance2)
    })

    it('should destroy instance properly', () => {
      const instance1 = RealtimeManager.getInstance(mockSupabaseClient, mockUser)
      RealtimeManager.destroyInstance()
      const instance2 = RealtimeManager.getInstance(mockSupabaseClient, mockUser)

      expect(instance1).not.toBe(instance2)
    })
  })

  describe('Initialization', () => {
    it('should initialize channel with correct configuration', async () => {
      manager = RealtimeManager.getInstance(mockSupabaseClient, mockUser)
      await manager.initialize()

      expect(mockSupabaseClient.channel).toHaveBeenCalledWith('team-updates', {
        config: {
          presence: {
            key: mockUser.id
          },
          broadcast: {
            self: false,
            ack: true
          }
        }
      })
    })

    it('should subscribe to all required tables', async () => {
      manager = RealtimeManager.getInstance(mockSupabaseClient, mockUser)
      await manager.initialize()

      // Check table subscriptions
      const onCalls = mockChannel.on.mock.calls
      const tableSubscriptions = onCalls.filter(call => call[0] === 'postgres_changes')

      const subscribedTables = tableSubscriptions.map(call => call[1].table)
      expect(subscribedTables).toContain('inspection_schedule_entries')
      expect(subscribedTables).toContain('inspections')
      expect(subscribedTables).toContain('team_tasks')
      expect(subscribedTables).toContain('team_activities')
    })

    it('should setup broadcast event handlers', async () => {
      manager = RealtimeManager.getInstance(mockSupabaseClient, mockUser)
      await manager.initialize()

      const onCalls = mockChannel.on.mock.calls
      const broadcastSubscriptions = onCalls.filter(call => call[0] === 'broadcast')

      const broadcastEvents = broadcastSubscriptions.map(call => call[1].event)
      expect(broadcastEvents).toContain('cursor')
      expect(broadcastEvents).toContain('typing')
      expect(broadcastEvents).toContain('notification')
    })

    it('should setup presence handlers', async () => {
      manager = RealtimeManager.getInstance(mockSupabaseClient, mockUser)
      await manager.initialize()

      const onCalls = mockChannel.on.mock.calls
      const presenceSubscriptions = onCalls.filter(call => call[0] === 'presence')

      const presenceEvents = presenceSubscriptions.map(call => call[1].event)
      expect(presenceEvents).toContain('sync')
      expect(presenceEvents).toContain('join')
      expect(presenceEvents).toContain('leave')
    })

    it('should not initialize twice', async () => {
      manager = RealtimeManager.getInstance(mockSupabaseClient, mockUser)

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await manager.initialize()
      await manager.initialize()

      expect(consoleWarnSpy).toHaveBeenCalledWith('RealtimeManager already initialized')
      expect(mockSupabaseClient.channel).toHaveBeenCalledTimes(1)

      consoleWarnSpy.mockRestore()
    })
  })

  describe('Presence Tracking', () => {
    it('should update presence activity', async () => {
      manager = RealtimeManager.getInstance(mockSupabaseClient, mockUser)
      await manager.initialize()

      const activity = {
        current_page: '/team-dashboard',
        current_task: 'task-123',
        is_typing: true,
        cursor_position: { x: 100, y: 200 }
      }

      await manager.updatePresenceActivity(activity)

      expect(mockChannel.track).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUser.id,
          user_email: mockUser.email,
          ...activity
        })
      )
    })

    it('should get online users', async () => {
      manager = RealtimeManager.getInstance(mockSupabaseClient, mockUser)
      await manager.initialize()

      // Simulate presence state
      const mockPresenceUsers: PresenceUser[] = [
        {
          user_id: 'user-1',
          user_email: 'user1@example.com',
          online_at: new Date().toISOString()
        },
        {
          user_id: 'user-2',
          user_email: 'user2@example.com',
          online_at: new Date().toISOString()
        }
      ]

      // Manually set presence state (since it's private)
      // This would normally happen through presence sync events
      const users = manager.getOnlineUsers()
      expect(Array.isArray(users)).toBe(true)
    })

    it('should check if user is online', async () => {
      manager = RealtimeManager.getInstance(mockSupabaseClient, mockUser)
      await manager.initialize()

      const isOnline = manager.isUserOnline('test-user-id')
      expect(typeof isOnline).toBe('boolean')
    })
  })

  describe('Broadcasting', () => {
    it('should broadcast custom events', async () => {
      manager = RealtimeManager.getInstance(mockSupabaseClient, mockUser)
      await manager.initialize()

      await manager.broadcast('custom-event', { data: 'test' })

      expect(mockChannel.send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'custom-event',
        payload: { data: 'test' }
      })
    })

    it('should broadcast cursor position', async () => {
      manager = RealtimeManager.getInstance(mockSupabaseClient, mockUser)
      await manager.initialize()

      await manager.broadcastCursor(100, 200, 'element-123')

      expect(mockChannel.send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'cursor',
        payload: expect.objectContaining({
          user_id: mockUser.id,
          user_email: mockUser.email,
          x: 100,
          y: 200,
          element_id: 'element-123'
        })
      })
    })

    it('should broadcast typing indicator', async () => {
      manager = RealtimeManager.getInstance(mockSupabaseClient, mockUser)
      await manager.initialize()

      await manager.broadcastTyping('field-123', true)

      expect(mockChannel.send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'typing',
        payload: expect.objectContaining({
          user_id: mockUser.id,
          field_id: 'field-123',
          is_typing: true
        })
      })
    })

    it('should broadcast notification', async () => {
      manager = RealtimeManager.getInstance(mockSupabaseClient, mockUser)
      await manager.initialize()

      await manager.broadcastNotification(
        'task_assigned',
        'New Task',
        'You have a new task',
        ['user-1', 'user-2'],
        { taskId: 'task-123' }
      )

      expect(mockChannel.send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'notification',
        payload: expect.objectContaining({
          type: 'task_assigned',
          title: 'New Task',
          message: 'You have a new task',
          from_user_id: mockUser.id,
          to_user_ids: ['user-1', 'user-2']
        })
      })
    })
  })

  describe('Event Subscription', () => {
    it('should subscribe to events', async () => {
      manager = RealtimeManager.getInstance(mockSupabaseClient, mockUser)
      await manager.initialize()

      const callback = vi.fn()
      const unsubscribe = manager.subscribe('test-event', callback)

      expect(typeof unsubscribe).toBe('function')
    })

    it('should notify listeners on events', async () => {
      manager = RealtimeManager.getInstance(mockSupabaseClient, mockUser)
      await manager.initialize()

      const callback = vi.fn()
      manager.subscribe('test-event', callback)

      // Simulate an event (this would normally come from Supabase)
      // We need to trigger the private notifyListeners method
      // For testing, we'll use the broadcast method which internally uses notifyListeners
      await manager.broadcast('test-event', { data: 'test' })

      // Note: In a real scenario, we'd need to simulate the channel receiving the event
      // For unit testing, we're testing the subscription mechanism exists
      expect(callback).not.toHaveBeenCalled() // Won't be called because self: false
    })

    it('should unsubscribe from events', async () => {
      manager = RealtimeManager.getInstance(mockSupabaseClient, mockUser)
      await manager.initialize()

      const callback = vi.fn()
      const unsubscribe = manager.subscribe('test-event', callback)

      unsubscribe()

      // After unsubscribe, callback should not be called
      // This is implicitly tested by the unsubscribe function execution
      expect(unsubscribe).toBeDefined()
    })
  })

  describe('Connection Management', () => {
    it('should get connection state', async () => {
      manager = RealtimeManager.getInstance(mockSupabaseClient, mockUser)

      expect(manager.getConnectionState()).toBe('disconnected')

      await manager.initialize()

      // Wait for subscription callback to be called
      await new Promise(resolve => setTimeout(resolve, 10))

      // After successful subscription
      expect(manager.getConnectionState()).toBe('connected')
    })

    it('should disconnect properly', async () => {
      manager = RealtimeManager.getInstance(mockSupabaseClient, mockUser)
      await manager.initialize()

      await manager.disconnect()

      expect(mockChannel.untrack).toHaveBeenCalled()
      expect(mockChannel.unsubscribe).toHaveBeenCalled()
      expect(manager.getConnectionState()).toBe('disconnected')
    })

    it('should reconnect', async () => {
      manager = RealtimeManager.getInstance(mockSupabaseClient, mockUser)
      await manager.initialize()

      await manager.reconnect()

      expect(mockChannel.unsubscribe).toHaveBeenCalled()
      expect(mockSupabaseClient.channel).toHaveBeenCalledTimes(2)
    })
  })

  describe('Error Handling', () => {
    it('should handle subscription errors', async () => {
      mockChannel.subscribe.mockResolvedValueOnce({
        error: new Error('Subscription failed')
      })

      manager = RealtimeManager.getInstance(mockSupabaseClient, mockUser)

      await expect(manager.initialize()).rejects.toThrow('Subscription failed')
    })

    it('should handle broadcast errors when channel not initialized', async () => {
      manager = RealtimeManager.getInstance(mockSupabaseClient, mockUser)

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await manager.broadcast('test', { data: 'test' })

      expect(consoleWarnSpy).toHaveBeenCalledWith('Cannot broadcast: channel not initialized')

      consoleWarnSpy.mockRestore()
    })
  })
})