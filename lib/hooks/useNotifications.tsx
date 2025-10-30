'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
// TODO: Supabase 클라이언트 임시 비활성화 - NextAuth로 전환 필요
// import { useSupabase } // TODO: Supabase 클라이언트 임시 비활성화
// from '@/lib/supabase/client';
import { AppNotification } from '@/packages/types';

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  // TODO: Supabase 의존성 제거 후 재활성화 - NextAuth + Prisma로 전환 필요
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false); // 임시로 항상 로딩 완료 상태
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    // TODO: Temporary stub - implement with NextAuth + API endpoints
    // NotificationProvider is temporarily disabled - needs NextAuth migration
    mountedRef.current = true;
    setIsLoading(false);

    return () => {
      mountedRef.current = false;
    };
  }, []);

  /* TODO: 아래 코드는 Supabase 의존성 제거 후 재활성화
  const supabase = useSupabase();

  useEffect(() => {
    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const initialize = async () => {
      try {
        // 현재 사용자 확인
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsLoading(false);
          return;
        }

        // 초기 알림 로드
        await loadNotifications();

        // 실시간 구독 설정
        if (mounted) {
          channel = subscribeToNotifications(user.id);
        }
      } catch (err) {
        console.error('Failed to initialize notifications:', err);
        if (mounted) {
          setError('알림을 불러오는데 실패했습니다.');
          setIsLoading(false);
        }
      }
    };

    initialize();

    // 브라우저 알림 권한 요청
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }

    return () => {
      mounted = false;
      mountedRef.current = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);
  */  

  const loadNotifications = useCallback(async (retryCount = 0) => {
    const maxRetries = 3;
    if (!mountedRef.current) return;

    try {
      setError(null);
      const response = await fetch('/api/notifications/create');

      if (!mountedRef.current) return;

      if (!response.ok) {
        // 서버 에러인 경우 재시도
        if (response.status >= 500 && retryCount < maxRetries) {
          console.warn(`Server error loading notifications, retrying... (${retryCount + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
          return loadNotifications(retryCount + 1);
        }

        const data = await response.json();
        throw new Error(data.error || 'Failed to load notifications');
      }

      const data = await response.json();

      if (mountedRef.current) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
      if (mountedRef.current) {
        const errorMessage = err instanceof Error ? err.message : '알림을 불러오는데 실패했습니다.';

        // 네트워크 에러 등의 경우 더 자세한 안내
        if (errorMessage.includes('NetworkError') || errorMessage.includes('Failed to fetch')) {
          setError('네트워크 연결을 확인해 주세요.');
        } else if (retryCount >= maxRetries) {
          setError('알림 로드에 계속 실패하고 있습니다. 페이지를 새로고침해 주세요.');
        } else {
          setError('알림을 불러오는데 실패했습니다.');
        }
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // TODO: subscribeToNotifications - Supabase Realtime 의존성 제거 후 재활성화
  const subscribeToNotifications = useCallback((userId: string) => {
    // TODO: Implement with SSE or polling
    console.warn('subscribeToNotifications is temporarily disabled');
    return null;
  }, [loadNotifications]);

  /* TODO: 아래 코드는 Supabase Realtime 의존성 제거 후 재활성화
  const subscribeToNotifications = useCallback((userId: string) => {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on('presence', { event: 'sync' }, () => {
        console.log('Realtime connection established');
      })
      .on('broadcast', { event: 'reconnect' }, () => {
        console.log('Realtime connection recovered');
        // 연결 복구 시 최신 알림 다시 로드
        loadNotifications().catch(console.error);
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`
        },
        (payload) => {
          if (!mountedRef.current) return;
          console.log('New notification received:', payload);

          const newNotification = payload.new as AppNotification;

          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);

          // 브라우저 알림 표시
          if (typeof window !== 'undefined' &&
              'Notification' in window &&
              Notification.permission === 'granted') {
            try {
              new Notification(newNotification.title, {
                body: newNotification.message,
                icon: '/favicon.svg',
                tag: newNotification.id,
                requireInteraction: false,
                silent: false
              });
            } catch (err) {
              console.warn('Failed to show browser notification:', err);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`
        },
        (payload) => {
          if (!mountedRef.current) return;
          console.log('Notification updated:', payload);

          const updatedNotification = payload.new as AppNotification;

          setNotifications(prev =>
            prev.map(n => n.id === updatedNotification.id ? updatedNotification : n)
          );

          // 읽음 상태 변경 시 unreadCount 업데이트
          const oldNotification = payload.old as AppNotification;
          if (!oldNotification.is_read && updatedNotification.is_read) {
            setUnreadCount(prev => Math.max(0, prev - 1));
          } else if (oldNotification.is_read && !updatedNotification.is_read) {
            setUnreadCount(prev => prev + 1);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`
        },
        (payload) => {
          if (!mountedRef.current) return;
          console.log('Notification deleted:', payload);

          const deletedNotification = payload.old as AppNotification;

          setNotifications(prev => prev.filter(n => n.id !== deletedNotification.id));

          // 읽지 않은 알림이 삭제된 경우 unreadCount 감소
          if (!deletedNotification.is_read) {
            setUnreadCount(prev => Math.max(0, prev - 1));
          }
        }
      )
      .subscribe();

    return channel;
  }, [loadNotifications, supabase]);
  */

  const markAsRead = async (id: string, retryCount = 0) => {
    const maxRetries = 3;

    try {
      const response = await fetch('/api/notifications/create', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'mark_read' })
      });

      if (!response.ok) {
        const data = await response.json();

        // 서버 에러인 경우 재시도
        if (response.status >= 500 && retryCount < maxRetries) {
          console.warn(`Server error, retrying... (${retryCount + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000)); // 지수 백오프
          return markAsRead(id, retryCount + 1);
        }

        throw new Error(data.error || 'Failed to mark notification as read');
      }

      // 낙관적 업데이트 - 실시간 구독에서 실제 업데이트를 받지만
      // UI 반응성을 위해 즉시 로컬 상태 업데이트
      if (mountedRef.current) {
        setNotifications(prev =>
          prev.map(n => n.id === id ? { ...n, is_read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));

        // 성공 시 에러 상태 클리어
        if (error) {
          setError(null);
        }
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
      if (mountedRef.current) {
        const errorMessage = err instanceof Error ? err.message : '알림 읽음 처리에 실패했습니다.';

        // 네트워크 에러 등의 경우 더 자세한 안내
        if (errorMessage.includes('NetworkError') || errorMessage.includes('Failed to fetch')) {
          setError('네트워크 연결을 확인해 주세요.');
        } else if (retryCount >= maxRetries) {
          setError('알림 처리에 계속 실패하고 있습니다. 페이지를 새로고침해 주세요.');
        } else {
          setError('알림 읽음 처리에 실패했습니다.');
        }

        // 낙관적 업데이트를 롤백
        if (retryCount >= maxRetries) {
          setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, is_read: false } : n)
          );
          setUnreadCount(prev => prev + 1);
        }
      }
    }
  };

  const markAllAsRead = async (retryCount = 0) => {
    const maxRetries = 3;
    const originalNotifications = notifications;
    const originalUnreadCount = unreadCount;

    try {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'POST'
      });

      if (!response.ok) {
        const data = await response.json();

        // 서버 에러인 경우 재시도
        if (response.status >= 500 && retryCount < maxRetries) {
          console.warn(`Server error, retrying markAllAsRead... (${retryCount + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
          return markAllAsRead(retryCount + 1);
        }

        throw new Error(data.error || 'Failed to mark all notifications as read');
      }

      // 낙관적 업데이트
      if (mountedRef.current) {
        setNotifications(prev =>
          prev.map(n => ({ ...n, is_read: true }))
        );
        setUnreadCount(0);

        // 성공 시 에러 상태 클리어
        if (error) {
          setError(null);
        }
      }
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
      if (mountedRef.current) {
        const errorMessage = err instanceof Error ? err.message : '모든 알림 읽음 처리에 실패했습니다.';

        // 네트워크 에러 등의 경우 더 자세한 안내
        if (errorMessage.includes('NetworkError') || errorMessage.includes('Failed to fetch')) {
          setError('네트워크 연결을 확인해 주세요.');
        } else if (retryCount >= maxRetries) {
          setError('알림 처리에 계속 실패하고 있습니다. 페이지를 새로고침해 주세요.');
        } else {
          setError('모든 알림 읽음 처리에 실패했습니다.');
        }

        // 낙관적 업데이트를 롤백
        if (retryCount >= maxRetries) {
          setNotifications(originalNotifications);
          setUnreadCount(originalUnreadCount);
        }
      }
    }
  };

  const deleteNotification = async (id: string, retryCount = 0) => {
    const maxRetries = 3;
    const notification = notifications.find(n => n.id === id);

    try {
      const response = await fetch(`/api/notifications/create?id=${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const data = await response.json();

        // 서버 에러인 경우 재시도
        if (response.status >= 500 && retryCount < maxRetries) {
          console.warn(`Server error, retrying deleteNotification... (${retryCount + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
          return deleteNotification(id, retryCount + 1);
        }

        throw new Error(data.error || 'Failed to delete notification');
      }

      // 낙관적 업데이트
      if (mountedRef.current) {
        setNotifications(prev => prev.filter(n => n.id !== id));

        if (notification && !notification.is_read) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }

        // 성공 시 에러 상태 클리어
        if (error) {
          setError(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete notification:', err);
      if (mountedRef.current) {
        const errorMessage = err instanceof Error ? err.message : '알림 삭제에 실패했습니다.';

        // 네트워크 에러 등의 경우 더 자세한 안내
        if (errorMessage.includes('NetworkError') || errorMessage.includes('Failed to fetch')) {
          setError('네트워크 연결을 확인해 주세요.');
        } else if (retryCount >= maxRetries) {
          setError('알림 처리에 계속 실패하고 있습니다. 페이지를 새로고침해 주세요.');
        } else {
          setError('알림 삭제에 실패했습니다.');
        }

        // 낙관적 업데이트를 롤백 (알림을 다시 추가)
        if (retryCount >= maxRetries && notification) {
          setNotifications(prev => [notification, ...prev]);
          if (!notification.is_read) {
            setUnreadCount(prev => prev + 1);
          }
        }
      }
    }
  };

  const refresh = async () => {
    if (mountedRef.current) {
      setIsLoading(true);
      await loadNotifications();
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        isLoading,
        error,
        refresh
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}

// 브라우저 알림 권한 관리 훅
export function useBrowserNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }

    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  };

  return {
    permission,
    requestPermission,
    isSupported: typeof window !== 'undefined' && 'Notification' in window
  };
}
