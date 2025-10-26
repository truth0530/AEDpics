import { useState, useEffect, useCallback } from 'react'
import { useRealtime } from './useRealtime'

interface OnlineUser {
  user_id: string
  user_email?: string
  online_at: string
}

interface UsePresenceReturn {
  onlineUsers: OnlineUser[]
  isUserOnline: (userId: string) => boolean
  onlineCount: number
  myStatus: 'online' | 'offline'
}

interface UsePresenceOptions {
  enabled?: boolean
}

export function usePresence(options: UsePresenceOptions = {}): UsePresenceReturn {
  const { enabled = true } = options

  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])

  const { isConnected, onlineUsers: realtimeUsers } = useRealtime({
    autoConnect: enabled,
    onPresenceChange: enabled
      ? (data) => {
          if (data.type === 'sync') {
            setOnlineUsers(data.users || [])
          } else if (data.type === 'join') {
            setOnlineUsers(prev => {
              const exists = prev.some(u => u.user_id === data.user?.user_id)
              if (!exists && data.user) {
                return [...prev, data.user]
              }
              return prev
            })
          } else if (data.type === 'leave') {
            setOnlineUsers(prev =>
              prev.filter(u => u.user_id !== data.user?.user_id)
            )
          }
        }
      : undefined
  })

  const isUserOnline = useCallback((userId: string) => {
    if (!enabled) return false
    return onlineUsers.some(user => user.user_id === userId)
  }, [onlineUsers, enabled])

  useEffect(() => {
    if (!enabled) {
      setOnlineUsers([])
      return
    }

    if (isConnected && realtimeUsers.length > 0) {
      setOnlineUsers(realtimeUsers)
    }
  }, [enabled, isConnected, realtimeUsers])

  return {
    onlineUsers: enabled ? onlineUsers : [],
    isUserOnline,
    onlineCount: enabled ? onlineUsers.length : 0,
    myStatus: enabled && isConnected ? 'online' : 'offline'
  }
}
