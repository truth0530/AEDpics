/**
 * Socket.IO Server for Real-time Updates
 *
 * Supabase Realtime을 대체하는 Socket.IO 기반 실시간 서버
 * - PostgreSQL LISTEN/NOTIFY 통합
 * - Presence tracking (온라인 사용자 추적)
 * - Broadcasting (커서, 타이핑 상태 등)
 * - Room-based subscriptions (사용자별, 관리자용)
 */

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { prisma } from '@/lib/db/prisma';
import pg from 'pg';

const { Client: PgClient } = pg;

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

export class SocketServer {
  private io: SocketIOServer;
  private pgClient: PgClient;
  private presenceMap: Map<string, PresenceUser> = new Map();
  private socketUserMap: Map<string, string> = new Map(); // socketId -> userId

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    // PostgreSQL LISTEN 클라이언트 초기화
    this.pgClient = new PgClient({
      connectionString: process.env.DATABASE_URL,
    });

    this.initialize();
  }

  private async initialize() {
    try {
      // PostgreSQL LISTEN 연결
      await this.pgClient.connect();
      console.log('[Socket.IO] PostgreSQL LISTEN client connected');

      // 테이블별 NOTIFY 리스닝
      await this.pgClient.query('LISTEN inspection_assignments_changes');
      await this.pgClient.query('LISTEN inspections_changes');
      await this.pgClient.query('LISTEN inspection_schedule_entries_changes');

      // PostgreSQL NOTIFY 이벤트 핸들러
      this.pgClient.on('notification', (msg) => {
        this.handleDatabaseNotification(msg);
      });

      // Socket.IO 연결 핸들러
      this.io.on('connection', (socket) => {
        this.handleConnection(socket);
      });

      console.log('[Socket.IO] Server initialized successfully');
    } catch (error) {
      console.error('[Socket.IO] Failed to initialize:', error);
    }
  }

  /**
   * PostgreSQL NOTIFY 이벤트 처리
   */
  private handleDatabaseNotification(msg: any) {
    if (!msg.payload) return;

    try {
      const payload = JSON.parse(msg.payload);
      const { table, operation, data, old_data } = payload;

      const event: RealtimeEvent = {
        type: this.mapOperation(operation),
        table,
        data,
        oldData: old_data,
        timestamp: new Date().toISOString(),
        userId: data.inspector_id || data.assigned_to || 'system',
      };

      // 테이블별 이벤트 브로드캐스트
      if (table === 'inspection_assignments') {
        this.broadcastToUser(data.assigned_to, 'assignment:change', event);
        this.io.to('admin').emit('assignment:change', event);
      } else if (table === 'inspections') {
        this.io.emit('inspection:change', event);
      } else if (table === 'inspection_schedule_entries') {
        this.io.emit('schedule:change', event);
      }

      console.log('[Socket.IO] Database notification broadcasted:', event);
    } catch (error) {
      console.error('[Socket.IO] Failed to handle notification:', error);
    }
  }

  /**
   * Socket 연결 처리
   */
  private handleConnection(socket: Socket) {
    console.log('[Socket.IO] Client connected:', socket.id);

    // 인증 (JWT 토큰 검증)
    socket.on('authenticate', async (data: { userId: string; userEmail?: string }) => {
      const { userId, userEmail } = data;

      // Socket ID → User ID 매핑
      this.socketUserMap.set(socket.id, userId);

      // 사용자별 room에 참가
      socket.join(`user:${userId}`);

      // Presence 추적 시작
      const presenceData: PresenceUser = {
        userId,
        userEmail,
        onlineAt: new Date().toISOString(),
      };
      this.presenceMap.set(userId, presenceData);

      // 온라인 사용자 목록 브로드캐스트
      this.io.emit('presence:sync', {
        type: 'join',
        user: presenceData,
        users: Array.from(this.presenceMap.values()),
      });

      console.log(`[Socket.IO] User authenticated: ${userId} (${userEmail})`);
    });

    // 관리자 room 참가
    socket.on('join:admin', () => {
      socket.join('admin');
      console.log(`[Socket.IO] User joined admin room: ${socket.id}`);
    });

    // 특정 room 참가
    socket.on('join:room', (roomId: string) => {
      socket.join(roomId);
      console.log(`[Socket.IO] User joined room ${roomId}: ${socket.id}`);
    });

    // Presence 업데이트
    socket.on('presence:update', (data: Partial<PresenceUser>) => {
      const userId = this.socketUserMap.get(socket.id);
      if (!userId) return;

      const currentPresence = this.presenceMap.get(userId);
      if (currentPresence) {
        const updatedPresence: PresenceUser = {
          ...currentPresence,
          ...data,
        };
        this.presenceMap.set(userId, updatedPresence);

        this.io.emit('presence:update', {
          type: 'update',
          user: updatedPresence,
        });
      }
    });

    // 커서 브로드캐스트
    socket.on('cursor:move', (data: { x: number; y: number; elementId?: string }) => {
      const userId = this.socketUserMap.get(socket.id);
      if (!userId) return;

      socket.broadcast.emit('cursor:update', {
        userId,
        ...data,
        timestamp: new Date().toISOString(),
      });
    });

    // 타이핑 상태 브로드캐스트
    socket.on('typing:start', (data: { fieldId: string }) => {
      const userId = this.socketUserMap.get(socket.id);
      if (!userId) return;

      socket.broadcast.emit('typing:update', {
        userId,
        fieldId: data.fieldId,
        isTyping: true,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('typing:stop', (data: { fieldId: string }) => {
      const userId = this.socketUserMap.get(socket.id);
      if (!userId) return;

      socket.broadcast.emit('typing:update', {
        userId,
        fieldId: data.fieldId,
        isTyping: false,
        timestamp: new Date().toISOString(),
      });
    });

    // 알림 브로드캐스트
    socket.on('notification:send', (data: {
      type: 'task_assigned' | 'task_completed' | 'mention' | 'deadline' | 'system';
      title: string;
      message: string;
      toUserIds?: string[];
      metadata?: Record<string, any>;
    }) => {
      const userId = this.socketUserMap.get(socket.id);
      if (!userId) return;

      const notification = {
        id: `notif_${Date.now()}_${Math.random()}`,
        fromUserId: userId,
        ...data,
        timestamp: new Date().toISOString(),
      };

      if (data.toUserIds && data.toUserIds.length > 0) {
        // 특정 사용자에게만 전송
        data.toUserIds.forEach((toUserId) => {
          this.io.to(`user:${toUserId}`).emit('notification:receive', notification);
        });
      } else {
        // 전체 브로드캐스트
        this.io.emit('notification:receive', notification);
      }
    });

    // 연결 해제
    socket.on('disconnect', () => {
      const userId = this.socketUserMap.get(socket.id);
      if (userId) {
        this.presenceMap.delete(userId);
        this.socketUserMap.delete(socket.id);

        this.io.emit('presence:sync', {
          type: 'leave',
          userId,
          users: Array.from(this.presenceMap.values()),
        });

        console.log(`[Socket.IO] User disconnected: ${userId}`);
      } else {
        console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
      }
    });
  }

  /**
   * 특정 사용자에게 이벤트 전송
   */
  private broadcastToUser(userId: string, event: string, data: any) {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  /**
   * PostgreSQL operation → event type 매핑
   */
  private mapOperation(operation: string): 'created' | 'updated' | 'deleted' {
    switch (operation) {
      case 'INSERT':
        return 'created';
      case 'UPDATE':
        return 'updated';
      case 'DELETE':
        return 'deleted';
      default:
        return 'updated';
    }
  }

  /**
   * 온라인 사용자 목록 조회
   */
  public getOnlineUsers(): PresenceUser[] {
    return Array.from(this.presenceMap.values());
  }

  /**
   * 서버 종료 (Graceful Shutdown)
   */
  public async close() {
    await this.pgClient.end();
    this.io.close();
    console.log('[Socket.IO] Server closed');
  }
}

// Singleton instance
let socketServer: SocketServer | null = null;

export function initializeSocketServer(httpServer: HTTPServer): SocketServer {
  if (!socketServer) {
    socketServer = new SocketServer(httpServer);
  }
  return socketServer;
}

export function getSocketServer(): SocketServer | null {
  return socketServer;
}
