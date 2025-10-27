import { useState, useEffect, useCallback, useRef } from 'react'
// TODO: Supabase 클라이언트 임시 비활성화
// import { useSupabase } from '@/lib/supabase/client'

// 임시: useSupabase stub
const useSupabase = (): any => {
  return null;
};

import { useUser } from '@/lib/auth/hooks'
import { RealtimeManager, PresenceUser } from '../RealtimeManager'
import { RealtimeEvent } from '@/packages/types/team'

interface PresenceEvent {
  type: 'sync' | 'join' | 'leave'
  users?: PresenceUser[]
  user?: PresenceUser
}

interface ConnectionEvent {
  status: 'connected' | 'connecting' | 'disconnected' | 'failed'
  message?: string
}

interface UseRealtimeOptions {
  autoConnect?: boolean
  onScheduleChange?: (event: RealtimeEvent) => void
  onInspectionChange?: (event: RealtimeEvent) => void
  onPresenceChange?: (data: PresenceEvent) => void
  onConnectionChange?: (data: ConnectionEvent) => void
}

interface UseRealtimeReturn {
  isConnected: boolean
  onlineUsers: PresenceUser[]
  connectionState: string
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  broadcast: (event: string, payload: unknown) => Promise<void>
  subscribe: (event: string, callback: (payload: unknown) => void) => () => void
}

export function useRealtime(options: UseRealtimeOptions = {}): UseRealtimeReturn {
  const {
    autoConnect = true,
    onScheduleChange,
    onInspectionChange,
    onPresenceChange,
    onConnectionChange
  } = options

  const supabase = useSupabase()
  const { user } = useUser()
  const [isConnected, setIsConnected] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([])
  const [connectionState, setConnectionState] = useState('disconnected')
  const managerRef = useRef<RealtimeManager | null>(null)
  const unsubscribersRef = useRef<(() => void)[]>([])

  const connect = useCallback(async () => {
    if (!user || !supabase) return

    try {
      if (!managerRef.current) {
        managerRef.current = RealtimeManager.getInstance(supabase, user)
      }

      await managerRef.current.initialize()
      setIsConnected(true)
      setConnectionState('connected')
    } catch (error) {
      console.error('Failed to connect to realtime:', error)
      setIsConnected(false)
      setConnectionState('disconnected')
    }
  }, [user, supabase])

  const disconnect = useCallback(async () => {
    if (managerRef.current) {
      await managerRef.current.disconnect()
      setIsConnected(false)
      setConnectionState('disconnected')
      setOnlineUsers([])
    }
  }, [])

  const broadcast = useCallback(async (event: string, payload: unknown) => {
    if (managerRef.current) {
      await managerRef.current.broadcast(event, payload)
    }
  }, [])

  const subscribe = useCallback((event: string, callback: (payload: unknown) => void) => {
    if (managerRef.current) {
      return managerRef.current.subscribe(event, callback)
    }
    return () => {}
  }, [])

  useEffect(() => {
    if (!user || !supabase || !autoConnect) return

    connect()

    return () => {
      // Clean up subscriptions
      unsubscribersRef.current.forEach(unsub => unsub())
      unsubscribersRef.current = []

      // Disconnect on unmount
      disconnect()
    }
  }, [user, supabase, autoConnect, connect, disconnect])

  useEffect(() => {
    if (!managerRef.current) return

    const unsubscribers: (() => void)[] = []

    if (onScheduleChange) {
      unsubscribers.push(
        managerRef.current.subscribe('schedule', (payload: unknown) => {
          onScheduleChange(payload as RealtimeEvent)
        })
      )
    }

    if (onInspectionChange) {
      unsubscribers.push(
        managerRef.current.subscribe('inspection', (payload: unknown) => {
          onInspectionChange(payload as RealtimeEvent)
        })
      )
    }

    const presenceCallback = (payload: unknown) => {
      const data = payload as PresenceEvent
      if (data.type === 'sync') {
        setOnlineUsers(data.users || [])
      }
      onPresenceChange?.(data)
    }

    const connectionCallback = (payload: unknown) => {
      const data = payload as ConnectionEvent
      setConnectionState(data.status)
      setIsConnected(data.status === 'connected')
      onConnectionChange?.(data)
    }

    unsubscribers.push(managerRef.current.subscribe('presence', presenceCallback))
    unsubscribers.push(managerRef.current.subscribe('connection', connectionCallback))

    unsubscribersRef.current = unsubscribers

    return () => {
      unsubscribers.forEach(unsub => unsub())
    }
  }, [onScheduleChange, onInspectionChange, onPresenceChange, onConnectionChange])

  return {
    isConnected,
    onlineUsers,
    connectionState,
    connect,
    disconnect,
    broadcast,
    subscribe
  }
}
