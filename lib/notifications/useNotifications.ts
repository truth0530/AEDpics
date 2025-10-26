'use client'

import { useState, useEffect, useCallback } from 'react'
import { NotificationManager, NotificationPayload, NotificationSettings } from './NotificationManager'

interface UseNotificationsReturn {
  permission: NotificationPermission
  settings: NotificationSettings
  unreadCount: number
  requestPermission: () => Promise<NotificationPermission>
  showNotification: (payload: NotificationPayload) => Promise<void>
  updateSettings: (settings: Partial<NotificationSettings>) => Promise<void>
  markAsRead: (notificationId: string) => Promise<void>
  markAllAsRead: () => Promise<void>
}

export function useNotifications(): UseNotificationsReturn {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [settings, setSettings] = useState<NotificationSettings>({
    enabled: true,
    types: {},
    sound: true,
    vibration: true
  })
  const [unreadCount, setUnreadCount] = useState(0)
  const [manager] = useState(() => NotificationManager.getInstance())

  // 초기 상태 로드
  useEffect(() => {
    const loadInitialState = async () => {
      setPermission(manager.getPermissionStatus())
      setSettings(manager.getSettings())
      const count = await manager.getUnreadCount()
      setUnreadCount(count)
    }

    loadInitialState()

    // 주기적으로 읽지 않은 개수 업데이트
    const interval = setInterval(async () => {
      const count = await manager.getUnreadCount()
      setUnreadCount(count)
    }, 30000) // 30초마다

    return () => clearInterval(interval)
  }, [manager])

  // Service Worker 메시지 리스너
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'notification-read') {
        // 알림 읽음 처리 시 카운트 업데이트
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleMessage)
    }

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleMessage)
      }
    }
  }, [])

  const requestPermission = useCallback(async () => {
    const result = await manager.requestPermission()
    setPermission(result)
    return result
  }, [manager])

  const showNotification = useCallback(async (payload: NotificationPayload) => {
    await manager.showNotification(payload)
    // 알림 표시 시 카운트 증가
    setUnreadCount(prev => prev + 1)
  }, [manager])

  const updateSettings = useCallback(async (newSettings: Partial<NotificationSettings>) => {
    await manager.saveSettings(newSettings)
    setSettings(manager.getSettings())
  }, [manager])

  const markAsRead = useCallback(async (notificationId: string) => {
    await manager.markAsRead(notificationId)
    const count = await manager.getUnreadCount()
    setUnreadCount(count)
  }, [manager])

  const markAllAsRead = useCallback(async () => {
    await manager.markAllAsRead()
    setUnreadCount(0)
  }, [manager])

  return {
    permission,
    settings,
    unreadCount,
    requestPermission,
    showNotification,
    updateSettings,
    markAsRead,
    markAllAsRead
  }
}