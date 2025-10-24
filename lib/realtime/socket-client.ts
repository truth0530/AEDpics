/**
 * Socket.IO Client for Real-time Updates
 *
 * Supabase Realtime 클라이언트를 대체하는 Socket.IO 클라이언트
 * - 자동 재연결
 * - Presence tracking
 * - Event subscriptions
 */

import { io, Socket } from 'socket.io-client';

export interface PresenceUser {
  userId: string;
  userEmail?: string;
  onlineAt: string;
  currentPage?: string;
  currentTask?: string;
  isTyping?: boolean;
  cursorPosition?: { x: number; y: number };
}

export interface RealtimeEvent {
  type: 'created' | 'updated' | 'deleted';
  table: string;
  data: any;
  oldData?: any;
  timestamp: string;
  userId: string;
}

interface ChannelListener {
  id: string;
  callback: (payload: unknown) => void;
}

export class RealtimeClient {
  private static instance: RealtimeClient | null = null;
  private socket: Socket | null = null;
  private listeners: Map<string, ChannelListener[]> = new Map();
  private presenceState: Map<string, PresenceUser> = new Map();
  private userId: string | null = null;
  private userEmail: string | null = null;
  private connectionState: 'connected' | 'connecting' | 'disconnected' = 'disconnected';

  private constructor() {}

  static getInstance(): RealtimeClient {
    if (!RealtimeClient.instance) {
      RealtimeClient.instance = new RealtimeClient();
    }
    return RealtimeClient.instance;
  }

  static destroyInstance() {
    if (RealtimeClient.instance) {
      RealtimeClient.instance.disconnect();
      RealtimeClient.instance = null;
    }
  }

  /**
   * Socket.IO 서버에 연결
   */
  async connect(userId: string, userEmail?: string): Promise<void> {
    if (this.socket?.connected) {
      console.warn('[Realtime Client] Already connected');
      return;
    }

    this.userId = userId;
    this.userEmail = userEmail || null;
    this.connectionState = 'connecting';

    const serverUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    this.socket = io(serverUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    this.setupEventHandlers();

    // 인증
    this.socket.emit('authenticate', { userId, userEmail });
  }

  /**
   * 이벤트 핸들러 설정
   */
  private setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[Realtime Client] Connected');
      this.connectionState = 'connected';
      this.notifyListeners('connection', { status: 'connected' });

      // 재인증 (재연결 시)
      if (this.userId) {
        this.socket!.emit('authenticate', {
          userId: this.userId,
          userEmail: this.userEmail,
        });
      }
    });

    this.socket.on('disconnect', () => {
      console.log('[Realtime Client] Disconnected');
      this.connectionState = 'disconnected';
      this.notifyListeners('connection', { status: 'disconnected' });
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Realtime Client] Connection error:', error);
      this.notifyListeners('connection', { status: 'error', error });
    });

    // Presence 이벤트
    this.socket.on('presence:sync', (data: { type: string; user?: PresenceUser; users: PresenceUser[] }) => {
      this.presenceState.clear();
      data.users.forEach((user) => {
        this.presenceState.set(user.userId, user);
      });

      this.notifyListeners('presence', data);
    });

    this.socket.on('presence:update', (data: { type: string; user: PresenceUser }) => {
      this.presenceState.set(data.user.userId, data.user);
      this.notifyListeners('presence', data);
    });

    // 데이터베이스 변경 이벤트
    this.socket.on('assignment:change', (event: RealtimeEvent) => {
      this.notifyListeners('assignment:change', event);
    });

    this.socket.on('inspection:change', (event: RealtimeEvent) => {
      this.notifyListeners('inspection:change', event);
    });

    this.socket.on('schedule:change', (event: RealtimeEvent) => {
      this.notifyListeners('schedule:change', event);
    });

    // 커서 이벤트
    this.socket.on('cursor:update', (data) => {
      this.notifyListeners('cursor', data);
    });

    // 타이핑 이벤트
    this.socket.on('typing:update', (data) => {
      this.notifyListeners('typing', data);
    });

    // 알림 이벤트
    this.socket.on('notification:receive', (data) => {
      this.notifyListeners('notification', data);
    });
  }

  /**
   * 관리자 room 참가
   */
  joinAdminRoom() {
    this.socket?.emit('join:admin');
  }

  /**
   * 특정 room 참가
   */
  joinRoom(roomId: string) {
    this.socket?.emit('join:room', roomId);
  }

  /**
   * Presence 업데이트
   */
  updatePresence(data: Partial<PresenceUser>) {
    this.socket?.emit('presence:update', data);
  }

  /**
   * 커서 위치 브로드캐스트
   */
  broadcastCursor(x: number, y: number, elementId?: string) {
    this.socket?.emit('cursor:move', { x, y, elementId });
  }

  /**
   * 타이핑 상태 브로드캐스트
   */
  broadcastTyping(fieldId: string, isTyping: boolean) {
    if (isTyping) {
      this.socket?.emit('typing:start', { fieldId });
    } else {
      this.socket?.emit('typing:stop', { fieldId });
    }
  }

  /**
   * 알림 전송
   */
  sendNotification(data: {
    type: 'task_assigned' | 'task_completed' | 'mention' | 'deadline' | 'system';
    title: string;
    message: string;
    toUserIds?: string[];
    metadata?: Record<string, any>;
  }) {
    this.socket?.emit('notification:send', data);
  }

  /**
   * 이벤트 구독
   */
  subscribe(event: string, callback: (payload: unknown) => void): () => void {
    const listener: ChannelListener = {
      id: `${event}_${Date.now()}_${Math.random()}`,
      callback,
    };

    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    this.listeners.get(event)!.push(listener);

    // Unsubscribe 함수 반환
    return () => {
      const eventListeners = this.listeners.get(event);
      if (eventListeners) {
        const index = eventListeners.findIndex((l) => l.id === listener.id);
        if (index !== -1) {
          eventListeners.splice(index, 1);
        }
      }
    };
  }

  /**
   * 리스너에게 이벤트 전달
   */
  private notifyListeners(event: string, payload: unknown) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((listener) => {
        try {
          listener.callback(payload);
        } catch (error) {
          console.error(`[Realtime Client] Error in listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * 온라인 사용자 목록 조회
   */
  getOnlineUsers(): PresenceUser[] {
    return Array.from(this.presenceState.values());
  }

  /**
   * 특정 사용자 온라인 여부 확인
   */
  isUserOnline(userId: string): boolean {
    return this.presenceState.has(userId);
  }

  /**
   * 연결 상태 조회
   */
  getConnectionState(): string {
    return this.connectionState;
  }

  /**
   * 연결 해제
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.connectionState = 'disconnected';
    this.listeners.clear();
    this.presenceState.clear();
  }

  /**
   * 재연결
   */
  async reconnect() {
    this.disconnect();
    if (this.userId) {
      await this.connect(this.userId, this.userEmail || undefined);
    }
  }
}

// Singleton instance 조회
export function getRealtimeClient(): RealtimeClient {
  return RealtimeClient.getInstance();
}

// React Hook
export function useRealtimeClient(userId: string | null, userEmail?: string) {
  const [isConnected, setIsConnected] = React.useState(false);
  const [onlineUsers, setOnlineUsers] = React.useState<PresenceUser[]>([]);

  React.useEffect(() => {
    if (!userId) return;

    const client = getRealtimeClient();

    client.connect(userId, userEmail).then(() => {
      setIsConnected(true);
    });

    const unsubscribeConnection = client.subscribe('connection', (data: any) => {
      setIsConnected(data.status === 'connected');
    });

    const unsubscribePresence = client.subscribe('presence', () => {
      setOnlineUsers(client.getOnlineUsers());
    });

    return () => {
      unsubscribeConnection();
      unsubscribePresence();
      client.disconnect();
    };
  }, [userId, userEmail]);

  return {
    isConnected,
    onlineUsers,
    client: getRealtimeClient(),
  };
}

// React import
import React from 'react';
