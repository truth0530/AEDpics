import { useState, useEffect, useCallback, useRef } from 'react'
import { useRealtime } from './useRealtime'
import { TypingIndicator } from '@/packages/types/team'

interface UseTypingIndicatorOptions {
  enabled?: boolean
  fieldId: string
  typingTimeout?: number // ms to wait before considering typing stopped
}

interface UseTypingIndicatorReturn {
  typingUsers: TypingIndicator[]
  setTyping: (isTyping: boolean) => void
  isAnyoneTyping: boolean
  typingUserNames: string[]
}

export function useTypingIndicator(options: UseTypingIndicatorOptions): UseTypingIndicatorReturn {
  const {
    enabled = true,
    fieldId,
    typingTimeout = 1500
  } = options

  const [typingUsers, setTypingUsers] = useState<TypingIndicator[]>([])
  const [isLocalTyping, setIsLocalTyping] = useState(false)
  const typingTimers = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const localTypingTimer = useRef<NodeJS.Timeout | null>(null)

  const { broadcast, subscribe, isConnected } = useRealtime({
    autoConnect: enabled
  })

  // Handle incoming typing indicators
  useEffect(() => {
    if (!enabled || !isConnected) return

    const unsubscribe = subscribe('typing', (payload: unknown) => {
      const indicator = payload as TypingIndicator

      // Only process indicators for this field
      if (indicator.field_id !== fieldId) return

      setTypingUsers(prev => {
        // Clear existing timer for this user
        const existingTimer = typingTimers.current.get(indicator.user_id)
        if (existingTimer) {
          clearTimeout(existingTimer)
        }

        if (indicator.is_typing) {
          // Add or update typing user
          const filtered = prev.filter(u => u.user_id !== indicator.user_id)
          const updated = [...filtered, indicator]

          // Set timer to remove after timeout
          const timer = setTimeout(() => {
            setTypingUsers(current =>
              current.filter(u => u.user_id !== indicator.user_id)
            )
            typingTimers.current.delete(indicator.user_id)
          }, typingTimeout)

          typingTimers.current.set(indicator.user_id, timer)

          return updated
        } else {
          // Remove typing user immediately
          typingTimers.current.delete(indicator.user_id)
          return prev.filter(u => u.user_id !== indicator.user_id)
        }
      })
    })

    return () => {
      unsubscribe()
    }
  }, [enabled, isConnected, subscribe, fieldId, typingTimeout])

  // Broadcast local typing status
  const broadcastTyping = useCallback((isTyping: boolean) => {
    if (!enabled || !isConnected) return

    broadcast('typing', {
      field_id: fieldId,
      is_typing: isTyping,
      timestamp: new Date().toISOString()
    })
  }, [enabled, isConnected, broadcast, fieldId])

  // Set typing status with automatic timeout
  const setTyping = useCallback((isTyping: boolean) => {
    if (!enabled) return

    // Clear existing local timer
    if (localTypingTimer.current) {
      clearTimeout(localTypingTimer.current)
      localTypingTimer.current = null
    }

    if (isTyping && !isLocalTyping) {
      // Start typing
      setIsLocalTyping(true)
      broadcastTyping(true)

      // Auto-stop typing after timeout
      localTypingTimer.current = setTimeout(() => {
        setIsLocalTyping(false)
        broadcastTyping(false)
        localTypingTimer.current = null
      }, typingTimeout)
    } else if (isTyping && isLocalTyping) {
      // Continue typing - reset timer
      localTypingTimer.current = setTimeout(() => {
        setIsLocalTyping(false)
        broadcastTyping(false)
        localTypingTimer.current = null
      }, typingTimeout)
    } else if (!isTyping && isLocalTyping) {
      // Stop typing
      setIsLocalTyping(false)
      broadcastTyping(false)
    }
  }, [enabled, isLocalTyping, broadcastTyping, typingTimeout])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear all timers
      typingTimers.current.forEach(timer => clearTimeout(timer))
      typingTimers.current.clear()

      if (localTypingTimer.current) {
        clearTimeout(localTypingTimer.current)
      }

      // Broadcast stop typing
      if (isLocalTyping) {
        broadcastTyping(false)
      }
    }
  }, [isLocalTyping, broadcastTyping])

  // Computed values
  const isAnyoneTyping = typingUsers.length > 0
  const typingUserNames = typingUsers.map(u => u.user_email || u.user_id)

  return {
    typingUsers,
    setTyping,
    isAnyoneTyping,
    typingUserNames
  }
}

// Helper hook for input fields
export function useTypingField(fieldId: string, enabled = true) {
  const { setTyping, typingUserNames, isAnyoneTyping } = useTypingIndicator({
    enabled,
    fieldId
  })

  const handleChange = useCallback(() => {
    setTyping(true)
  }, [setTyping])

  const handleBlur = useCallback(() => {
    setTyping(false)
  }, [setTyping])

  return {
    onInput: handleChange,
    onChange: handleChange,
    onBlur: handleBlur,
    typingUsers: typingUserNames,
    isAnyoneTyping
  }
}