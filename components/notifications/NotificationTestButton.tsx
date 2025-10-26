'use client'

import { Bell } from 'lucide-react'
import { useNotifications } from '@/lib/notifications/useNotifications'

export default function NotificationTestButton() {
  const { permission, requestPermission, showNotification } = useNotifications()

  const handleTestNotification = async () => {
    if (permission !== 'granted') {
      const result = await requestPermission()
      if (result !== 'granted') {
        alert('알림 권한이 필요합니다.')
        return
      }
    }

    await showNotification({
      id: 'test-' + Date.now(),
      type: 'task_assigned',
      title: '새 작업이 할당되었습니다',
      body: 'AED #12345 점검 작업이 할당되었습니다.',
      data: {
        url: '/team-dashboard'
      },
      requireInteraction: true,
      actions: [
        { action: 'view', title: '확인' },
        { action: 'dismiss', title: '나중에' }
      ]
    })
  }

  return (
    <button
      onClick={handleTestNotification}
      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
    >
      <Bell className="w-4 h-4" />
      테스트 알림 보내기
    </button>
  )
}