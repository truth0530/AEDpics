'use client'

import { useState, useEffect } from 'react'
import { Bell, BellOff, X } from 'lucide-react'
import { NotificationManager } from '@/lib/notifications/NotificationManager'

export default function NotificationPermissionPrompt() {
  const [show, setShow] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [requesting, setRequesting] = useState(false)

  useEffect(() => {
    const manager = NotificationManager.getInstance()
    const currentPermission = manager.getPermissionStatus()
    setPermission(currentPermission)

    // 권한이 default인 경우 프롬프트 표시
    if (currentPermission === 'default') {
      // 이전에 닫았는지 확인
      const dismissed = localStorage.getItem('notification_prompt_dismissed')
      const dismissedTime = dismissed ? parseInt(dismissed) : 0
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24)

      // 7일 후 다시 표시
      if (!dismissed || daysSinceDismissed > 7) {
        setTimeout(() => setShow(true), 3000) // 3초 후 표시
      }
    }
  }, [])

  const handleAllow = async () => {
    setRequesting(true)
    try {
      const manager = NotificationManager.getInstance()
      const result = await manager.requestPermission()
      setPermission(result)

      if (result === 'granted') {
        // 테스트 알림
        await manager.showNotification({
          id: 'test-' + Date.now(),
          type: 'system',
          title: '알림이 활성화되었습니다',
          body: 'AED 점검 시스템의 중요한 알림을 받을 수 있습니다.',
          icon: '/icon-192x192.png'
        })
        setShow(false)
      } else if (result === 'denied') {
        setShow(false)
      }
    } finally {
      setRequesting(false)
    }
  }

  const handleDismiss = () => {
    localStorage.setItem('notification_prompt_dismissed', Date.now().toString())
    setShow(false)
  }

  if (!show || permission !== 'default') {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
      <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-4 max-w-sm">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="p-2 bg-blue-100 rounded-full">
              <Bell className="w-6 h-6 text-blue-600" />
            </div>
          </div>

          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900">
              알림을 받으시겠습니까?
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              작업 할당, 일정 리마인더, 점검 마감일 등 중요한 알림을 실시간으로 받을 수 있습니다.
            </p>

            <div className="mt-3 flex gap-2">
              <button
                onClick={handleAllow}
                disabled={requesting}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {requesting ? '요청 중...' : '알림 허용'}
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"
              >
                나중에
              </button>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * 권한 거부 시 대체 UI
 */
export function NotificationBlockedAlert() {
  const [permission, setPermission] = useState<NotificationPermission>('default')

  useEffect(() => {
    const manager = NotificationManager.getInstance()
    setPermission(manager.getPermissionStatus())
  }, [])

  if (permission !== 'denied') {
    return null
  }

  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
      <div className="flex items-center">
        <BellOff className="w-5 h-5 text-yellow-700 mr-2" />
        <div className="flex-1">
          <p className="text-sm text-yellow-700">
            알림이 차단되어 있습니다. 브라우저 설정에서 이 사이트의 알림을 허용해주세요.
          </p>
        </div>
      </div>
    </div>
  )
}