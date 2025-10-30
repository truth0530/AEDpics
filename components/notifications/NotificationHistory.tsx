'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/Toast';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface Notification {
  id: string;
  newUserId: string;
  newUserEmail: string;
  newUserName: string;
  newUserRegion: string | null;
  newUserOrg: string | null;
  notificationType: string;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}

export function NotificationHistory() {
  const { showSuccess, showError } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    fetchNotifications();
  }, [filter]);

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      const unreadOnly = filter === 'unread';
      const response = await fetch(`/api/notifications/history?limit=100&unreadOnly=${unreadOnly}`);

      if (!response.ok) {
        throw new Error('알림 히스토리를 불러오는데 실패했습니다.');
      }

      const data = await response.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (error) {
      console.error('Failed to fetch notification history:', error);
      showError('알림 히스토리를 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch('/api/notifications/history', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      });

      if (!response.ok) {
        throw new Error('알림 읽음 처리에 실패했습니다.');
      }

      // UI 업데이트
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: true, readAt: new Date() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      showError('알림 읽음 처리에 실패했습니다.');
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications/history', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      });

      if (!response.ok) {
        throw new Error('모든 알림 읽음 처리에 실패했습니다.');
      }

      const data = await response.json();
      showSuccess(data.message);

      // UI 업데이트
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, readAt: new Date() })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      showError('모든 알림 읽음 처리에 실패했습니다.');
    }
  };

  const deleteNotification = async (notificationId: string) => {
    if (!confirm('이 알림을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await fetch(`/api/notifications/history?id=${notificationId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('알림 삭제에 실패했습니다.');
      }

      // UI 업데이트
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      showSuccess('알림이 삭제되었습니다.');
    } catch (error) {
      console.error('Failed to delete notification:', error);
      showError('알림 삭제에 실패했습니다.');
    }
  };

  const deleteAllRead = async () => {
    if (!confirm('읽은 알림을 모두 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await fetch('/api/notifications/history?deleteAll=true', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('알림 삭제에 실패했습니다.');
      }

      const data = await response.json();
      showSuccess(data.message);

      // UI 업데이트
      setNotifications((prev) => prev.filter((n) => !n.isRead));
    } catch (error) {
      console.error('Failed to delete read notifications:', error);
      showError('읽은 알림 삭제에 실패했습니다.');
    }
  };

  const getNotificationTypeLabel = (type: string) => {
    switch (type) {
      case 'new_signup':
        return '새로운 가입 신청';
      case 'reminder':
        return '미처리 신청 재알림';
      case 'approval_completed':
        return '승인 완료';
      case 'approval_rejected':
        return '승인 거부';
      default:
        return type;
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
        <p className="mt-2 text-sm text-gray-600">알림을 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">알림 히스토리</h2>
          {unreadCount > 0 && (
            <span className="rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white">
              {unreadCount}
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            전체
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              filter === 'unread'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            읽지 않음
          </button>
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="flex justify-end gap-2">
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            모두 읽음 처리
          </button>
        )}
        {notifications.some((n) => n.isRead) && (
          <button
            onClick={deleteAllRead}
            className="rounded-md bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200"
          >
            읽은 알림 모두 삭제
          </button>
        )}
      </div>

      {/* 알림 목록 */}
      <div className="space-y-2">
        {notifications.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
            {filter === 'unread' ? '읽지 않은 알림이 없습니다.' : '알림이 없습니다.'}
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`rounded-lg border p-4 transition-colors ${
                notification.isRead
                  ? 'border-gray-200 bg-white'
                  : 'border-blue-200 bg-blue-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        notification.isRead
                          ? 'bg-gray-100 text-gray-600'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {getNotificationTypeLabel(notification.notificationType)}
                    </span>
                    {!notification.isRead && (
                      <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                    )}
                  </div>

                  <p className="font-medium text-gray-900">{notification.newUserName}</p>
                  <p className="text-sm text-gray-600">{notification.newUserEmail}</p>
                  {notification.newUserOrg && (
                    <p className="text-sm text-gray-500">
                      {notification.newUserRegion} - {notification.newUserOrg}
                    </p>
                  )}

                  <p className="mt-2 text-xs text-gray-400">
                    {formatDistanceToNow(new Date(notification.createdAt), {
                      addSuffix: true,
                      locale: ko,
                    })}
                  </p>
                </div>

                <div className="flex gap-2">
                  {!notification.isRead && (
                    <button
                      onClick={() => markAsRead(notification.id)}
                      className="rounded-md bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700 hover:bg-blue-200"
                    >
                      읽음
                    </button>
                  )}
                  <button
                    onClick={() => deleteNotification(notification.id)}
                    className="rounded-md bg-red-100 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-200"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
