/**
 * 알림 관리자
 * 브라우저 알림, 인앱 알림, 알림 설정 관리
 */

import { ServiceWorkerManager } from '@/lib/realtime/ServiceWorkerManager'
import { logger } from '@/lib/logger'
// TODO: Supabase 클라이언트 임시 비활성화
// import { createClient } from '@/lib/supabase/client'

// 임시: Supabase createClient stub
const createClient = (): any => {
  return null;
};

export type NotificationType =
  | 'task_assigned'
  | 'task_completed'
  | 'task_overdue'
  | 'schedule_reminder'
  | 'inspection_due'
  | 'team_update'
  | 'system'

export interface NotificationPayload {
  id: string
  type: NotificationType
  title: string
  body: string
  data?: Record<string, unknown>
  icon?: string
  badge?: string
  tag?: string
  requireInteraction?: boolean
  silent?: boolean
  actions?: NotificationAction[]
  timestamp?: number
}

export interface NotificationAction {
  action: string
  title: string
  icon?: string
}

export interface NotificationSettings {
  enabled: boolean
  types: Partial<Record<NotificationType, boolean>>
  quietHours?: {
    enabled: boolean
    start: string // "22:00"
    end: string   // "08:00"
  }
  sound: boolean
  vibration: boolean
}

export class NotificationManager {
  private static instance: NotificationManager | null = null
  private swManager: ServiceWorkerManager
  private supabase = createClient()
  private settings: NotificationSettings = {
    enabled: true,
    types: {
      task_assigned: true,
      task_completed: true,
      task_overdue: true,
      schedule_reminder: true,
      inspection_due: true,
      team_update: true,
      system: true
    },
    sound: true,
    vibration: true
  }
  private permissionStatus: NotificationPermission = 'default'

  private constructor() {
    this.swManager = ServiceWorkerManager.getInstance()
    this.loadSettings()
    this.checkPermission()
  }

  static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager()
    }
    return NotificationManager.instance
  }

  /**
   * 설정 불러오기
   */
  private async loadSettings(): Promise<void> {
    try {
      // localStorage에서 설정 불러오기
      const saved = localStorage.getItem('notification_settings')
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) }
      }

      // 서버에서 사용자 설정 불러오기
      const { data: { user } } = await this.supabase.auth.getUser()
      if (user) {
        const { data } = await this.supabase
          .from('user_notification_settings')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (data) {
          this.settings = { ...this.settings, ...data.settings }
        }
      }
    } catch (error) {
      logger.error('NotificationManager:loadSettings', 'Failed to load notification settings', error instanceof Error ? error : { error })
    }
  }

  /**
   * 설정 저장
   */
  async saveSettings(settings: Partial<NotificationSettings>): Promise<void> {
    this.settings = { ...this.settings, ...settings }

    // localStorage에 저장
    localStorage.setItem('notification_settings', JSON.stringify(this.settings))

    // 서버에 저장
    try {
      const { data: { user } } = await this.supabase.auth.getUser()
      if (user) {
        await this.supabase
          .from('user_notification_settings')
          .upsert({
            user_id: user.id,
            settings: this.settings,
            updated_at: new Date().toISOString()
          })
      }
    } catch (error) {
      logger.error('NotificationManager:saveSettings', 'Failed to save notification settings', error instanceof Error ? error : { error })
    }
  }

  /**
   * 권한 확인
   */
  private checkPermission(): void {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      this.permissionStatus = Notification.permission
    }
  }

  /**
   * 권한 요청
   */
  async requestPermission(): Promise<NotificationPermission> {
    this.permissionStatus = await this.swManager.requestNotificationPermission()

    if (this.permissionStatus === 'granted') {
      await this.saveSettings({ enabled: true })
    }

    return this.permissionStatus
  }

  /**
   * 알림 표시 가능 여부 확인
   */
  private canShowNotification(type: NotificationType): boolean {
    // 전역 설정 확인
    if (!this.settings.enabled) return false

    // 타입별 설정 확인
    if (this.settings.types[type] === false) return false

    // 권한 확인
    if (this.permissionStatus !== 'granted') return false

    // 조용한 시간대 확인
    if (this.settings.quietHours?.enabled) {
      const now = new Date()
      const currentTime = now.getHours() * 60 + now.getMinutes()

      const [startHour, startMin] = this.settings.quietHours.start.split(':').map(Number)
      const [endHour, endMin] = this.settings.quietHours.end.split(':').map(Number)

      const startTime = startHour * 60 + startMin
      const endTime = endHour * 60 + endMin

      if (startTime <= endTime) {
        // 같은 날 (예: 09:00 - 18:00)
        if (currentTime >= startTime && currentTime <= endTime) return false
      } else {
        // 자정을 넘는 경우 (예: 22:00 - 08:00)
        if (currentTime >= startTime || currentTime <= endTime) return false
      }
    }

    return true
  }

  /**
   * 알림 표시
   */
  async showNotification(payload: NotificationPayload): Promise<void> {
    // 표시 가능 여부 확인
    if (!this.canShowNotification(payload.type)) {
      logger.info('NotificationManager:showNotification', 'Notification blocked by settings', { type: payload.type })
      return
    }

    // Service Worker를 통한 알림 표시
    if (this.swManager.getStatus().registered && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        payload: {
          ...payload,
          silent: !this.settings.sound,
          vibrate: this.settings.vibration ? [200, 100, 200] : undefined,
          timestamp: payload.timestamp || Date.now()
        }
      })
    } else {
      // Fallback: 브라우저 직접 알림
      await this.showBrowserNotification(payload)
    }

    // 알림 히스토리 저장
    await this.saveToHistory(payload)
  }

  /**
   * 브라우저 직접 알림
   */
  private async showBrowserNotification(payload: NotificationPayload): Promise<void> {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return
    }

    const notification = new Notification(payload.title, {
      body: payload.body,
      icon: payload.icon || '/icon-192x192.png',
      badge: payload.badge || '/badge-72x72.png',
      tag: payload.tag || payload.id,
      data: payload.data,
      requireInteraction: payload.requireInteraction,
      silent: payload.silent || !this.settings.sound
      // vibrate는 Notification API에서 직접 지원하지 않음
    })

    // 클릭 이벤트
    notification.onclick = () => {
      window.focus()
      if (payload.data?.url && typeof payload.data.url === 'string') {
        window.location.href = payload.data.url
      }
      notification.close()
    }

    // 자동 닫기
    if (!payload.requireInteraction) {
      setTimeout(() => notification.close(), 5000)
    }
  }

  /**
   * 알림 히스토리 저장
   */
  private async saveToHistory(payload: NotificationPayload): Promise<void> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser()
      if (!user) return

      await this.supabase
        .from('notification_history')
        .insert({
          user_id: user.id,
          type: payload.type,
          title: payload.title,
          body: payload.body,
          data: payload.data,
          read: false,
          created_at: new Date().toISOString()
        })
    } catch (error) {
      logger.error('NotificationManager:saveToHistory', 'Failed to save notification history', error instanceof Error ? error : { error })
    }
  }

  /**
   * 팀 알림 브로드캐스트
   */
  async broadcastToTeam(teamId: string, payload: NotificationPayload): Promise<void> {
    // Supabase Realtime으로 팀 전체에 알림
    const channel = this.supabase.channel(`team:${teamId}`)

    channel
      .on('broadcast', { event: 'notification' }, ({ payload: notification }) => {
        this.showNotification(notification)
      })
      .subscribe()

    // 알림 전송
    await channel.send({
      type: 'broadcast',
      event: 'notification',
      payload
    })
  }

  /**
   * 예약 알림 설정
   */
  async scheduleNotification(
    payload: NotificationPayload,
    scheduledTime: Date
  ): Promise<string> {
    const delay = scheduledTime.getTime() - Date.now()

    if (delay <= 0) {
      // 즉시 표시
      await this.showNotification(payload)
      return payload.id
    }

    // 타이머로 예약
    setTimeout(() => {
      this.showNotification(payload)
    }, delay)

    // 서버에 예약 정보 저장
    try {
      const { data: { user } } = await this.supabase.auth.getUser()
      if (user) {
        await this.supabase
          .from('scheduled_notifications')
          .insert({
            id: payload.id,
            user_id: user.id,
            payload,
            scheduled_time: scheduledTime.toISOString(),
            status: 'pending'
          })
      }
    } catch (error) {
      logger.error('NotificationManager:scheduleNotification', 'Failed to save scheduled notification', error instanceof Error ? error : { error })
    }

    return payload.id
  }

  /**
   * 알림 취소
   */
  async cancelNotification(notificationId: string): Promise<void> {
    try {
      await this.supabase
        .from('scheduled_notifications')
        .update({ status: 'cancelled' })
        .eq('id', notificationId)
    } catch (error) {
      logger.error('NotificationManager:cancelNotification', 'Failed to cancel notification', error instanceof Error ? error : { error })
    }
  }

  /**
   * 읽지 않은 알림 개수
   */
  async getUnreadCount(): Promise<number> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser()
      if (!user) return 0

      const { count } = await this.supabase
        .from('notification_history')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false)

      return count || 0
    } catch (error) {
      logger.error('NotificationManager:getUnreadCount', 'Failed to get unread notification count', error instanceof Error ? error : { error })
      return 0
    }
  }

  /**
   * 알림 읽음 처리
   */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      await this.supabase
        .from('notification_history')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId)
    } catch (error) {
      logger.error('NotificationManager:markAsRead', 'Failed to mark notification as read', error instanceof Error ? error : { error })
    }
  }

  /**
   * 모든 알림 읽음 처리
   */
  async markAllAsRead(): Promise<void> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser()
      if (!user) return

      await this.supabase
        .from('notification_history')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('read', false)
    } catch (error) {
      logger.error('NotificationManager:markAllAsRead', 'Failed to mark all notifications as read', error instanceof Error ? error : { error })
    }
  }

  /**
   * 현재 설정 반환
   */
  getSettings(): NotificationSettings {
    return { ...this.settings }
  }

  /**
   * 권한 상태 반환
   */
  getPermissionStatus(): NotificationPermission {
    this.checkPermission()
    return this.permissionStatus
  }
}