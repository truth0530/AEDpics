/**
 * Real-time Subscriptions for Inspection Assignments
 * Supabase Realtime을 사용한 실시간 업데이트
 */

// TODO: Supabase 클라이언트 임시 비활성화
// import { createClient } from '@/lib/supabase/client';

// 임시: Supabase createClient stub
const createClient = (): any => {
  return null;
};

import type { RealtimeChannel } from '@supabase/supabase-js';

export interface AssignmentChangePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: any;
  old: any;
  timestamp: string;
}

export type AssignmentChangeHandler = (payload: AssignmentChangePayload) => void;

/**
 * 사용자별 일정 할당 실시간 구독
 */
export class AssignmentSubscription {
  private channel: RealtimeChannel | null = null;
  private supabase = createClient();
  private userId: string;
  private handlers: {
    insert?: AssignmentChangeHandler;
    update?: AssignmentChangeHandler;
    delete?: AssignmentChangeHandler;
  } = {};

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * INSERT 이벤트 핸들러 등록
   */
  onInsert(handler: AssignmentChangeHandler): this {
    this.handlers.insert = handler;
    return this;
  }

  /**
   * UPDATE 이벤트 핸들러 등록
   */
  onUpdate(handler: AssignmentChangeHandler): this {
    this.handlers.update = handler;
    return this;
  }

  /**
   * DELETE 이벤트 핸들러 등록
   */
  onDelete(handler: AssignmentChangeHandler): this {
    this.handlers.delete = handler;
    return this;
  }

  /**
   * 구독 시작
   */
  async subscribe(): Promise<void> {
    if (this.channel) {
      console.warn('[Realtime] Already subscribed');
      return;
    }

    this.channel = this.supabase
      .channel(`assignments:${this.userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'inspection_assignments',
          filter: `assigned_to=eq.${this.userId}`
        },
        (payload) => {
          if (this.handlers.insert) {
            this.handlers.insert({
              eventType: 'INSERT',
              new: payload.new,
              old: payload.old,
              timestamp: new Date().toISOString()
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'inspection_assignments',
          filter: `assigned_to=eq.${this.userId}`
        },
        (payload) => {
          if (this.handlers.update) {
            this.handlers.update({
              eventType: 'UPDATE',
              new: payload.new,
              old: payload.old,
              timestamp: new Date().toISOString()
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'inspection_assignments',
          filter: `assigned_to=eq.${this.userId}`
        },
        (payload) => {
          if (this.handlers.delete) {
            this.handlers.delete({
              eventType: 'DELETE',
              new: payload.new,
              old: payload.old,
              timestamp: new Date().toISOString()
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] Subscribed to assignments for user ${this.userId}`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Channel error');
        } else if (status === 'TIMED_OUT') {
          console.error('[Realtime] Connection timed out');
        } else if (status === 'CLOSED') {
          console.log('[Realtime] Connection closed');
        }
      });
  }

  /**
   * 구독 해제
   */
  async unsubscribe(): Promise<void> {
    if (this.channel) {
      await this.supabase.removeChannel(this.channel);
      this.channel = null;
      console.log(`[Realtime] Unsubscribed from assignments for user ${this.userId}`);
    }
  }

  /**
   * 현재 구독 상태
   */
  isSubscribed(): boolean {
    return this.channel !== null;
  }
}

/**
 * 전체 일정 할당 변경사항 구독 (관리자용)
 */
export class AllAssignmentsSubscription {
  private channel: RealtimeChannel | null = null;
  private supabase = createClient();
  private handlers: {
    insert?: AssignmentChangeHandler;
    update?: AssignmentChangeHandler;
    delete?: AssignmentChangeHandler;
  } = {};

  /**
   * INSERT 이벤트 핸들러 등록
   */
  onInsert(handler: AssignmentChangeHandler): this {
    this.handlers.insert = handler;
    return this;
  }

  /**
   * UPDATE 이벤트 핸들러 등록
   */
  onUpdate(handler: AssignmentChangeHandler): this {
    this.handlers.update = handler;
    return this;
  }

  /**
   * DELETE 이벤트 핸들러 등록
   */
  onDelete(handler: AssignmentChangeHandler): this {
    this.handlers.delete = handler;
    return this;
  }

  /**
   * 구독 시작
   */
  async subscribe(): Promise<void> {
    if (this.channel) {
      console.warn('[Realtime] Already subscribed');
      return;
    }

    this.channel = this.supabase
      .channel('all-assignments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inspection_assignments'
        },
        (payload) => {
          const eventType = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
          const handler = this.handlers[eventType.toLowerCase() as keyof typeof this.handlers];

          if (handler) {
            handler({
              eventType,
              new: payload.new,
              old: payload.old,
              timestamp: new Date().toISOString()
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Subscribed to all assignments');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Channel error');
        }
      });
  }

  /**
   * 구독 해제
   */
  async unsubscribe(): Promise<void> {
    if (this.channel) {
      await this.supabase.removeChannel(this.channel);
      this.channel = null;
      console.log('[Realtime] Unsubscribed from all assignments');
    }
  }
}

/**
 * React Hook for Assignment Subscriptions
 */
export function useAssignmentSubscription(
  userId: string | null,
  options?: {
    onInsert?: AssignmentChangeHandler;
    onUpdate?: AssignmentChangeHandler;
    onDelete?: AssignmentChangeHandler;
  }
) {
  const [isConnected, setIsConnected] = React.useState(false);
  const subscriptionRef = React.useRef<AssignmentSubscription | null>(null);

  React.useEffect(() => {
    if (!userId) return;

    const subscription = new AssignmentSubscription(userId);

    if (options?.onInsert) subscription.onInsert(options.onInsert);
    if (options?.onUpdate) subscription.onUpdate(options.onUpdate);
    if (options?.onDelete) subscription.onDelete(options.onDelete);

    subscription.subscribe().then(() => {
      setIsConnected(true);
    });

    subscriptionRef.current = subscription;

    return () => {
      subscription.unsubscribe().then(() => {
        setIsConnected(false);
      });
    };
  }, [userId, options?.onInsert, options?.onUpdate, options?.onDelete]);

  return {
    isConnected,
    subscription: subscriptionRef.current
  };
}

// React import for hooks (conditional)
import React from 'react';
