import type {
  SupabaseClient,
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  RealtimePresenceState,
  User
} from '@supabase/supabase-js'
import { RealtimeEvent } from '@/packages/types/team'

interface ChannelListener {
  id: string
  callback: (payload: unknown) => void
}

export interface PresenceUser {
  user_id: string
  user_email?: string
  online_at: string
  current_page?: string
  current_task?: string
  is_typing?: boolean
  cursor_position?: { x: number; y: number }
}

export class RealtimeManager {
  private static instance: RealtimeManager | null = null
  private channel: RealtimeChannel | null = null
  private listeners: Map<string, ChannelListener[]> = new Map()
  private presenceState: Map<string, PresenceUser> = new Map()
  private supabase: SupabaseClient<any, any>
  private user: User | null = null
  private connectionState: 'connected' | 'connecting' | 'disconnected' = 'disconnected'
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  private constructor(supabaseClient: SupabaseClient<any, any>, user: User) {
    this.supabase = supabaseClient
    this.user = user
  }

  static getInstance(
    supabaseClient: SupabaseClient<any, any>,
    user: User
  ): RealtimeManager {
    if (!RealtimeManager.instance) {
      RealtimeManager.instance = new RealtimeManager(supabaseClient, user)
    }
    return RealtimeManager.instance
  }

  static destroyInstance() {
    if (RealtimeManager.instance) {
      RealtimeManager.instance.disconnect()
      RealtimeManager.instance = null
    }
  }

  async initialize(): Promise<void> {
    if (this.channel) {
      console.warn('RealtimeManager already initialized')
      return
    }

    this.connectionState = 'connecting'

    try {
      this.channel = this.supabase
        .channel('team-updates', {
          config: {
            presence: {
              key: this.user?.id || 'anonymous'
            },
            broadcast: {
              self: false, // Don't receive own broadcasts
              ack: true    // Wait for acknowledgment
            }
          }
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'inspection_schedule_entries'
          },
          this.handleScheduleChange.bind(this)
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'inspections'
          },
          this.handleInspectionInsert.bind(this)
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'inspections'
          },
          this.handleInspectionUpdate.bind(this)
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'inspections'
          },
          this.handleInspectionDelete.bind(this)
        )
        // Additional tables for Day 7
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'team_tasks'
          },
          this.handleTeamTaskChange.bind(this)
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'team_activities'
          },
          this.handleActivityChange.bind(this)
        )
        // Broadcast events for custom team communications
        .on('broadcast', { event: 'cursor' }, this.handleCursorBroadcast.bind(this))
        .on('broadcast', { event: 'typing' }, this.handleTypingBroadcast.bind(this))
        .on('broadcast', { event: 'notification' }, this.handleNotificationBroadcast.bind(this))
        .on('presence', { event: 'sync' }, () => {
          this.handlePresenceSync()
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }: any) => {
          this.handlePresenceJoin(key, newPresences as PresenceUser[])
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }: any) => {
          this.handlePresenceLeave(key, leftPresences as PresenceUser[])
        })

      const { error } = (await this.channel.subscribe((status) => {
        console.log('Realtime subscription status:', status)
        if (status === 'SUBSCRIBED') {
          this.connectionState = 'connected'
          this.reconnectAttempts = 0
          this.trackPresence()
          this.notifyListeners('connection', { status: 'connected' })
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this.connectionState = 'disconnected'
          this.handleReconnect()
        }
      })) as any

      if (error) {
        console.error('Failed to subscribe to channel:', error)
        throw error
      }
    } catch (error) {
      console.error('Failed to initialize RealtimeManager:', error)
      this.connectionState = 'disconnected'
      throw error
    }
  }

  private async handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      this.notifyListeners('connection', {
        status: 'failed',
        message: 'Unable to establish realtime connection'
      })
      return
    }

    this.reconnectAttempts++
    console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`)

    setTimeout(async () => {
      try {
        await this.disconnect()
        await this.initialize()
      } catch (error) {
        console.error('Reconnection failed:', error)
        this.handleReconnect()
      }
    }, this.reconnectDelay * this.reconnectAttempts)
  }

  private async trackPresence(additionalData?: Partial<PresenceUser>) {
    if (!this.channel || !this.user) return

    const presenceData: PresenceUser = {
      user_id: this.user.id,
      user_email: this.user.email,
      online_at: new Date().toISOString(),
      ...additionalData
    }

    await this.channel.track(presenceData)
  }

  // Enhanced presence tracking methods for Day 7
  async updatePresenceActivity(activity: {
    current_page?: string
    current_task?: string
    is_typing?: boolean
    cursor_position?: { x: number; y: number }
  }): Promise<void> {
    if (!this.channel || !this.user) return

    const currentPresence = this.presenceState.get(this.user.id)
    const updatedPresence: PresenceUser = {
      user_id: this.user.id,
      user_email: this.user.email,
      online_at: currentPresence?.online_at || new Date().toISOString(),
      ...activity
    }

    await this.channel.track(updatedPresence)
    this.presenceState.set(this.user.id, updatedPresence)
  }

  private handlePresenceSync() {
    if (!this.channel) return

    const state = this.channel.presenceState() as RealtimePresenceState<PresenceUser>
    this.presenceState.clear()

    Object.entries(state).forEach(([key, presences]) => {
      if (presences && Array.isArray(presences) && presences.length > 0) {
        const presence = presences[0] as PresenceUser
        this.presenceState.set(key, presence)
      }
    })

    this.notifyListeners('presence', {
      type: 'sync',
      users: Array.from(this.presenceState.values())
    })
  }

  private handlePresenceJoin(key: string, newPresences: PresenceUser[]) {
    if (newPresences && newPresences.length > 0) {
      const presence = newPresences[0]
      this.presenceState.set(key, presence)

      this.notifyListeners('presence', {
        type: 'join',
        user: presence
      })
    }
  }

  private handlePresenceLeave(key: string, leftPresences: PresenceUser[]) {
    this.presenceState.delete(key)

    if (leftPresences && leftPresences.length > 0) {
      const presence = leftPresences[0]

      this.notifyListeners('presence', {
        type: 'leave',
        user: presence
      })
    }
  }

  private handleScheduleChange(
    payload: RealtimePostgresChangesPayload<Record<string, unknown>>
  ) {
    const event: RealtimeEvent = {
      type: this.mapPostgresEventType(payload.eventType),
      table: 'inspection_schedule_entries',
      data: payload.new || payload.old,
      timestamp: new Date().toISOString(),
      user_id: this.user?.id || 'unknown'
    }

    console.log('Schedule change detected:', event)
    this.notifyListeners('schedule', event)
  }

  private handleInspectionInsert(
    payload: RealtimePostgresChangesPayload<Record<string, unknown>>
  ) {
    const event: RealtimeEvent = {
      type: 'created',
      table: 'inspections',
      data: payload.new,
      timestamp: new Date().toISOString(),
      user_id: this.user?.id || 'unknown'
    }

    console.log('Inspection created:', event)
    this.notifyListeners('inspection:created', event)
    this.notifyListeners('inspection', event)
  }

  private handleInspectionUpdate(
    payload: RealtimePostgresChangesPayload<Record<string, unknown>>
  ) {
    const event: RealtimeEvent = {
      type: 'updated',
      table: 'inspections',
      data: payload.new,
      old_data: payload.old,
      timestamp: new Date().toISOString(),
      user_id: this.user?.id || 'unknown'
    }

    console.log('Inspection updated:', event)
    this.notifyListeners('inspection:updated', event)
    this.notifyListeners('inspection', event)
  }

  private handleInspectionDelete(
    payload: RealtimePostgresChangesPayload<Record<string, unknown>>
  ) {
    const event: RealtimeEvent = {
      type: 'deleted',
      table: 'inspections',
      data: payload.old,
      timestamp: new Date().toISOString(),
      user_id: this.user?.id || 'unknown'
    }

    console.log('Inspection deleted:', event)
    this.notifyListeners('inspection:deleted', event)
    this.notifyListeners('inspection', event)
  }

  private handleTeamTaskChange(
    payload: RealtimePostgresChangesPayload<Record<string, unknown>>
  ) {
    const event: RealtimeEvent = {
      type: this.mapPostgresEventType(payload.eventType),
      table: 'team_tasks',
      data: payload.new || payload.old,
      timestamp: new Date().toISOString(),
      user_id: this.user?.id || 'unknown'
    }

    console.log('Team task change:', event)
    this.notifyListeners('team-task', event)
  }

  private handleActivityChange(
    payload: RealtimePostgresChangesPayload<Record<string, unknown>>
  ) {
    const event: RealtimeEvent = {
      type: this.mapPostgresEventType(payload.eventType),
      table: 'team_activities',
      data: payload.new || payload.old,
      timestamp: new Date().toISOString(),
      user_id: this.user?.id || 'unknown'
    }

    console.log('Activity change:', event)
    this.notifyListeners('activity', event)
  }

  // Broadcast handlers
  private handleCursorBroadcast(payload: any) {
    console.log('Cursor broadcast received:', payload)
    this.notifyListeners('cursor', payload.payload)
  }

  private handleTypingBroadcast(payload: any) {
    console.log('Typing broadcast received:', payload)
    this.notifyListeners('typing', payload.payload)
  }

  private handleNotificationBroadcast(payload: any) {
    console.log('Notification broadcast received:', payload)
    this.notifyListeners('notification', payload.payload)
  }

  private mapPostgresEventType(
    eventType: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  ): 'created' | 'updated' | 'deleted' {
    switch (eventType) {
      case 'INSERT':
        return 'created'
      case 'UPDATE':
        return 'updated'
      case 'DELETE':
        return 'deleted'
      default:
        return 'updated'
    }
  }

  subscribe(
    event: string,
    callback: (payload: unknown) => void
  ): () => void {
    const listener: ChannelListener = {
      id: `${event}_${Date.now()}_${Math.random()}`,
      callback
    }

    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }

    this.listeners.get(event)!.push(listener)

    // Return unsubscribe function
    return () => {
      const eventListeners = this.listeners.get(event)
      if (eventListeners) {
        const index = eventListeners.findIndex(l => l.id === listener.id)
        if (index !== -1) {
          eventListeners.splice(index, 1)
        }
      }
    }
  }

  private notifyListeners(event: string, payload: unknown) {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      eventListeners.forEach(listener => {
        try {
          listener.callback(payload)
        } catch (error) {
          console.error(`Error in listener for ${event}:`, error)
        }
      })
    }
  }

  async broadcast(event: string, payload: unknown): Promise<void> {
    if (!this.channel) {
      console.warn('Cannot broadcast: channel not initialized')
      return
    }

    try {
      await this.channel.send({
        type: 'broadcast',
        event,
        payload
      })
    } catch (error) {
      console.error('Failed to broadcast event:', error)
      throw error
    }
  }

  // Enhanced broadcast methods for Day 7
  async broadcastCursor(x: number, y: number, elementId?: string): Promise<void> {
    const cursorData = {
      user_id: this.user?.id,
      user_email: this.user?.email,
      x,
      y,
      element_id: elementId,
      timestamp: new Date().toISOString()
    }
    await this.broadcast('cursor', cursorData)
  }

  async broadcastTyping(fieldId: string, isTyping: boolean): Promise<void> {
    const typingData = {
      user_id: this.user?.id,
      user_email: this.user?.email,
      field_id: fieldId,
      is_typing: isTyping,
      timestamp: new Date().toISOString()
    }
    await this.broadcast('typing', typingData)
  }

  async broadcastNotification(
    type: 'task_assigned' | 'task_completed' | 'mention' | 'deadline' | 'system',
    title: string,
    message: string,
    toUserIds?: string[],
    metadata?: Record<string, any>
  ): Promise<void> {
    const notification = {
      id: `notif_${Date.now()}_${Math.random()}`,
      type,
      title,
      message,
      from_user_id: this.user?.id || 'unknown',
      to_user_ids: toUserIds,
      metadata,
      timestamp: new Date().toISOString()
    }
    await this.broadcast('notification', notification)
  }

  getOnlineUsers(): PresenceUser[] {
    return Array.from(this.presenceState.values())
  }

  isUserOnline(userId: string): boolean {
    return this.presenceState.has(userId)
  }

  getConnectionState(): string {
    return this.connectionState
  }

  async disconnect(): Promise<void> {
    if (this.channel) {
      try {
        await this.channel.untrack()
        await this.channel.unsubscribe()
        this.channel = null
      } catch (error) {
        console.error('Error during disconnect:', error)
      }
    }

    this.connectionState = 'disconnected'
    this.listeners.clear()
    this.presenceState.clear()
  }

  async reconnect(): Promise<void> {
    await this.disconnect()
    await this.initialize()
  }
}
