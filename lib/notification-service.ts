// Notification service for push and email notifications

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  actions?: NotificationAction[];
  requireInteraction?: boolean;
}

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export class NotificationService {
  private static instance: NotificationService;
  private pushSubscription: PushSubscription | null = null;
  
  private constructor() {}
  
  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // Initialize push notifications
  async initializePush(): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      logger.warn('Notification:Push', 'Push notifications not supported in this browser');
      return false;
    }

    try {
      // Request notification permission
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        logger.warn('Notification:Push', 'Notification permission denied by user');
        return false;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push notifications
      const vapidKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        logger.warn('Notification:Push', 'VAPID public key not configured');
        return false;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer
      });

      this.pushSubscription = subscription;

      // Send subscription to server
      await this.sendSubscriptionToServer(subscription);

      return true;
    } catch (error) {
      logger.error('Notification:Push', 'Failed to initialize push notifications', error instanceof Error ? error : { error });
      return false;
    }
  }

  // Request notification permission
  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      logger.warn('Notification:Permission', 'Notifications API not supported in this browser');
      return 'denied';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission !== 'denied') {
      return await Notification.requestPermission();
    }

    return Notification.permission;
  }

  // Show local notification
  async showNotification(payload: NotificationPayload): Promise<void> {
    const permission = await this.requestPermission();
    if (permission !== 'granted') {
      logger.warn('Notification:Show', 'Cannot show notification: permission denied');
      return;
    }

    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(payload.title, {
        body: payload.body,
        icon: payload.icon || '/icon-192.png',
        badge: payload.badge || '/icon-96.png',
        tag: payload.tag,
        data: payload.data,
        actions: payload.actions as NotificationAction[],
        requireInteraction: payload.requireInteraction
      } as NotificationOptions);
    } else {
      // Fallback to Notification API (actions not supported)
      new Notification(payload.title, {
        body: payload.body,
        icon: payload.icon || '/icon-192.png',
        badge: payload.badge || '/icon-96.png',
        tag: payload.tag,
        data: payload.data
      });
    }
  }

  // Send push notification via server
  async sendPushNotification(
    userId: string,
    payload: NotificationPayload
  ): Promise<void> {
    try {
      const response = await fetch('/api/notifications/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          notification: payload
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send push notification');
      }
    } catch (error) {
      logger.error('Notification:Push', 'Push notification error', error instanceof Error ? error : { error });
      throw error;
    }
  }

  // Send email notification
  async sendEmail(payload: EmailPayload): Promise<void> {
    try {
      const response = await fetch('/api/notifications/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Failed to send email');
      }
    } catch (error) {
      logger.error('Notification:Email', 'Email notification error', error instanceof Error ? error : { error });
      throw error;
    }
  }

  // Schedule notification
  async scheduleNotification(
    payload: NotificationPayload,
    scheduledTime: Date
  ): Promise<void> {
    const delay = scheduledTime.getTime() - Date.now();
    
    if (delay <= 0) {
      await this.showNotification(payload);
      return;
    }

    setTimeout(() => {
      this.showNotification(payload);
    }, delay);
  }

  // Send inspection reminder
  async sendInspectionReminder(
    deviceId: string,
    deviceName: string,
    daysUntilDue: number
  ): Promise<void> {
    const payload: NotificationPayload = {
      title: '점검 알림',
      body: `${deviceName} AED 점검이 ${daysUntilDue}일 후 만료됩니다.`,
      icon: '/icon-192.png',
      badge: '/icon-96.png',
      tag: `inspection-${deviceId}`,
      data: { deviceId, type: 'inspection-reminder' },
      actions: [
        { action: 'inspect', title: '점검하기' },
        { action: 'snooze', title: '나중에' }
      ],
      requireInteraction: true
    };

    await this.showNotification(payload);
  }

  // Send urgent alert
  async sendUrgentAlert(
    message: string,
    devices: Array<{ id: string; name: string }>
  ): Promise<void> {
    const payload: NotificationPayload = {
      title: '긴급 알림',
      body: message,
      icon: '/icon-192.png',
      badge: '/icon-96.png',
      tag: 'urgent-alert',
      data: { devices, type: 'urgent' },
      requireInteraction: true
    };

    await this.showNotification(payload);

    // Also send email for urgent alerts
    const emailPayload: EmailPayload = {
      to: await this.getAdminEmails(),
      subject: '[긴급] AED 점검 알림',
      html: `
        <h2>긴급 AED 점검 알림</h2>
        <p>${message}</p>
        <h3>해당 장비:</h3>
        <ul>
          ${devices.map(d => `<li>${d.name} (ID: ${d.id})</li>`).join('')}
        </ul>
        <p>즉시 점검이 필요합니다.</p>
      `,
      text: `긴급 AED 점검 알림\n\n${message}\n\n해당 장비:\n${devices.map(d => `- ${d.name} (ID: ${d.id})`).join('\n')}`
    };

    await this.sendEmail(emailPayload);
  }

  // Send daily summary
  async sendDailySummary(stats: {
    totalInspected: number;
    pending: number;
    urgent: number;
    completionRate: number;
  }): Promise<void> {
    const payload: NotificationPayload = {
      title: '일일 점검 요약',
      body: `오늘 ${stats.totalInspected}대 점검 완료 (${stats.completionRate}%)`,
      icon: '/icon-192.png',
      badge: '/icon-96.png',
      tag: 'daily-summary',
      data: { stats, type: 'summary' }
    };

    await this.showNotification(payload);
  }

  // Helper: Send subscription to server
  private async sendSubscriptionToServer(
    subscription: PushSubscription
  ): Promise<void> {
    await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription)
    });
  }

  // Helper: Convert VAPID key
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Get admin emails (mock)
  private async getAdminEmails(): Promise<string[]> {
    // In production, fetch from database
    return ['admin@aed-check.kr'];
  }

  // Unsubscribe from push notifications
  async unsubscribePush(): Promise<void> {
    if (this.pushSubscription) {
      await this.pushSubscription.unsubscribe();
      this.pushSubscription = null;
    }
  }
}

// Singleton instance
export const notificationService = NotificationService.getInstance();