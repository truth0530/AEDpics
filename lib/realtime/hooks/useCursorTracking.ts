import { useEffect, useCallback, useState, useRef } from 'react'
import { useRealtime } from './useRealtime'
import { CursorPosition } from '@/packages/types/team'

interface RemoteCursor extends CursorPosition {
  color: string
}

interface UseCursorTrackingOptions {
  enabled?: boolean
  throttleMs?: number
  containerRef?: React.RefObject<HTMLElement>
}

interface UseCursorTrackingReturn {
  remoteCursors: RemoteCursor[]
  broadcastCursor: (x: number, y: number, elementId?: string) => void
  clearCursor: () => void
}

// Generate a consistent color for each user
function getUserColor(userId: string): string {
  const colors = [
    '#EF4444', // red
    '#F59E0B', // amber
    '#10B981', // emerald
    '#3B82F6', // blue
    '#8B5CF6', // violet
    '#EC4899', // pink
    '#F97316', // orange
    '#06B6D4', // cyan
  ]

  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

export function useCursorTracking(options: UseCursorTrackingOptions = {}): UseCursorTrackingReturn {
  const {
    enabled = true,
    throttleMs = 50,
    containerRef
  } = options

  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([])
  const cursorTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const lastBroadcast = useRef<number>(0)

  const { broadcast, subscribe, isConnected } = useRealtime({
    autoConnect: enabled,
    onConnectionChange: (data) => {
      if (data.status === 'disconnected') {
        // Clear all remote cursors on disconnect
        setRemoteCursors([])
        cursorTimeouts.current.forEach(timeout => clearTimeout(timeout))
        cursorTimeouts.current.clear()
      }
    }
  })

  // Handle incoming cursor updates
  useEffect(() => {
    if (!enabled || !isConnected) return

    const unsubscribe = subscribe('cursor', (payload: unknown) => {
      const cursor = payload as CursorPosition

      setRemoteCursors(prev => {
        const existing = prev.find(c => c.user_id === cursor.user_id)
        const color = existing?.color || getUserColor(cursor.user_id)

        const updated = prev.filter(c => c.user_id !== cursor.user_id)
        updated.push({ ...cursor, color })

        // Clear existing timeout for this user
        const existingTimeout = cursorTimeouts.current.get(cursor.user_id)
        if (existingTimeout) {
          clearTimeout(existingTimeout)
        }

        // Remove cursor after 5 seconds of inactivity
        const timeout = setTimeout(() => {
          setRemoteCursors(prev => prev.filter(c => c.user_id !== cursor.user_id))
          cursorTimeouts.current.delete(cursor.user_id)
        }, 5000)

        cursorTimeouts.current.set(cursor.user_id, timeout)

        return updated
      })
    })

    return () => {
      unsubscribe()
    }
  }, [enabled, isConnected, subscribe])

  // Broadcast local cursor position
  const broadcastCursor = useCallback((x: number, y: number, elementId?: string) => {
    if (!enabled || !isConnected) return

    const now = Date.now()
    if (now - lastBroadcast.current < throttleMs) return

    lastBroadcast.current = now
    broadcast('cursor', {
      x,
      y,
      element_id: elementId,
      timestamp: new Date().toISOString()
    })
  }, [enabled, isConnected, broadcast, throttleMs])

  // Clear cursor (when mouse leaves the tracked area)
  const clearCursor = useCallback(() => {
    if (!enabled || !isConnected) return

    broadcast('cursor', {
      x: -1,
      y: -1,
      timestamp: new Date().toISOString()
    })
  }, [enabled, isConnected, broadcast])

  // Track mouse movement if container is provided
  useEffect(() => {
    if (!enabled || !containerRef?.current) return

    const container = containerRef.current

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      // Get the element ID if hovering over something specific
      const target = e.target as HTMLElement
      const elementId = target.dataset.trackable || target.id

      broadcastCursor(x, y, elementId)
    }

    const handleMouseLeave = () => {
      clearCursor()
    }

    container.addEventListener('mousemove', handleMouseMove)
    container.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      container.removeEventListener('mousemove', handleMouseMove)
      container.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [enabled, containerRef, broadcastCursor, clearCursor])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cursorTimeouts.current.forEach(timeout => clearTimeout(timeout))
      cursorTimeouts.current.clear()
    }
  }, [])

  return {
    remoteCursors,
    broadcastCursor,
    clearCursor
  }
}