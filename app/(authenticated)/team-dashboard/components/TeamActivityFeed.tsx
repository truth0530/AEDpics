'use client';

import { useState, useEffect, useRef } from 'react';
import { useRealtime } from '@/lib/realtime/hooks/useRealtime';
import { RealtimeEvent } from '@/packages/types/team';

interface EventData {
  device_name?: string;
  device_id?: string;
  [key: string]: unknown;
}
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface Activity {
  id: string;
  type: 'task' | 'inspection' | 'notification' | 'presence';
  event: 'created' | 'updated' | 'deleted' | 'joined' | 'left';
  title: string;
  description: string;
  user_name?: string;
  user_email?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface TeamActivityFeedProps {
  maxItems?: number;
  autoScroll?: boolean;
  showNotifications?: boolean;
  className?: string;
}

export function TeamActivityFeed({
  maxItems = 50,
  autoScroll = true,
  showNotifications = true,
  className = ''
}: TeamActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);

  const { isConnected } = useRealtime({
    autoConnect: true,
    onScheduleChange: (event: RealtimeEvent<unknown>) => {
      const typedEvent = event as RealtimeEvent<EventData>;
      addActivity({
        id: `schedule_${Date.now()}`,
        type: 'task',
        event: typedEvent.type,
        title: getEventTitle('schedule', typedEvent.type),
        description: getEventDescription('schedule', typedEvent),
        user_email: typedEvent.user_id,
        timestamp: typedEvent.timestamp,
        metadata: typedEvent.data as Record<string, unknown>
      });
    },
    onInspectionChange: (event: RealtimeEvent<unknown>) => {
      const typedEvent = event as RealtimeEvent<EventData>;
      addActivity({
        id: `inspection_${Date.now()}`,
        type: 'inspection',
        event: typedEvent.type,
        title: getEventTitle('inspection', typedEvent.type),
        description: getEventDescription('inspection', typedEvent),
        user_email: typedEvent.user_id,
        timestamp: typedEvent.timestamp,
        metadata: typedEvent.data as Record<string, unknown>
      });
    },
    onPresenceChange: (data) => {
      if (data.type === 'join' && data.user) {
        addActivity({
          id: `presence_join_${Date.now()}`,
          type: 'presence',
          event: 'joined',
          title: '팀원 참여',
          description: `${data.user.user_email || data.user.user_id}님이 참여했습니다`,
          user_email: data.user.user_email,
          timestamp: new Date().toISOString()
        });
      } else if (data.type === 'leave' && data.user) {
        addActivity({
          id: `presence_leave_${Date.now()}`,
          type: 'presence',
          event: 'left',
          title: '팀원 나감',
          description: `${data.user.user_email || data.user.user_id}님이 나갔습니다`,
          user_email: data.user.user_email,
          timestamp: new Date().toISOString()
        });
      }
    }
  });

  // Subscribe to notifications
  useEffect(() => {
    if (!showNotifications || !isConnected) return;

    // This would subscribe to notification broadcasts
    // For now, we'll just show the structure
  }, [showNotifications, isConnected]);

  const addActivity = (activity: Activity) => {
    setActivities(prev => {
      const updated = [activity, ...prev];
      return updated.slice(0, maxItems);
    });

    // Auto scroll to top if enabled
    if (autoScroll && feedRef.current) {
      feedRef.current.scrollTop = 0;
    }
  };

  const getEventTitle = (
    table: string,
    eventType: 'created' | 'updated' | 'deleted'
  ): string => {
    const titles = {
      schedule: {
        created: '일정 추가',
        updated: '일정 수정',
        deleted: '일정 삭제'
      },
      inspection: {
        created: '점검 시작',
        updated: '점검 업데이트',
        deleted: '점검 삭제'
      }
    };

    return titles[table as keyof typeof titles]?.[eventType] || eventType;
  };

  const getEventDescription = (table: string, event: RealtimeEvent<EventData>): string => {
    const data = event.data;

    if (table === 'schedule' && data) {
      const device = data.device_name || data.device_id || '장치';
      switch (event.type) {
        case 'created':
          return `${device}의 점검 일정이 추가되었습니다`;
        case 'updated':
          return `${device}의 점검 일정이 변경되었습니다`;
        case 'deleted':
          return `${device}의 점검 일정이 취소되었습니다`;
      }
    }

    if (table === 'inspection' && data) {
      const device = data.device_name || data.device_id || '장치';
      switch (event.type) {
        case 'created':
          return `${device} 점검이 시작되었습니다`;
        case 'updated':
          return `${device} 점검 상태가 업데이트되었습니다`;
        case 'deleted':
          return `${device} 점검이 취소되었습니다`;
      }
    }

    return '활동이 감지되었습니다';
  };

  const getActivityIcon = (activity: Activity) => {
    const icons = {
      task: {
        created: '➕',
        updated: '✏️',
        deleted: '🗑️'
      },
      inspection: {
        created: '🔍',
        updated: '🔄',
        deleted: '❌'
      },
      notification: {
        created: '🔔',
        updated: '📝',
        deleted: '🔕'
      },
      presence: {
        joined: '👋',
        left: '👋'
      }
    };

    return icons[activity.type]?.[activity.event as keyof typeof icons[typeof activity.type]] || '📌';
  };

  const getActivityColor = (activity: Activity) => {
    const colors = {
      created: 'text-green-400',
      updated: 'text-blue-400',
      deleted: 'text-red-400',
      joined: 'text-emerald-400',
      left: 'text-gray-400'
    };

    return colors[activity.event] || 'text-gray-300';
  };

  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-xl ${className}`}>
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">팀 활동 피드</h3>
          <div className="flex items-center gap-2">
            {isConnected && (
              <span className="flex items-center gap-1 text-xs text-green-400">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                실시간
              </span>
            )}
            <span className="text-xs text-gray-500">
              {activities.length}개 활동
            </span>
          </div>
        </div>
      </div>

      <div
        ref={feedRef}
        className="h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900"
      >
        {activities.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 text-sm">아직 활동이 없습니다</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800/70 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className="text-lg mt-0.5">
                    {getActivityIcon(activity)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${getActivityColor(activity)}`}>
                          {activity.title}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {activity.description}
                        </p>
                        {activity.user_email && (
                          <p className="text-xs text-gray-500 mt-1">
                            by {activity.user_email}
                          </p>
                        )}
                      </div>
                      <time
                        className="text-xs text-gray-500 whitespace-nowrap"
                        title={new Date(activity.timestamp).toLocaleString('ko-KR')}
                      >
                        {formatDistanceToNow(new Date(activity.timestamp), {
                          addSuffix: true,
                          locale: ko
                        })}
                      </time>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}