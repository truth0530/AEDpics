/**
 * 실시간 동기화 관련 타입 정의
 */

export interface SyncOperation {
  id: string;
  table: string;
  operation: 'insert' | 'update' | 'delete';
  data: Record<string, unknown>;
  timestamp: number;
  version?: number;
}

export interface SyncResult {
  id: string;
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
}

export interface QueuedOperation {
  id: string;
  operation: SyncOperation;
  priority: number;
  retryCount: number;
  status: 'pending' | 'processing' | 'failed';
  createdAt: Date;
  nextRetryAt?: Date;
}

export interface ConflictResolution {
  strategy: 'client-wins' | 'server-wins' | 'merge' | 'manual';
  resolved: boolean;
  mergedData?: Record<string, unknown>;
  conflictDetails?: {
    clientValue: unknown;
    serverValue: unknown;
    field: string;
  }[];
}

export interface BatchSyncRequest {
  operations: SyncOperation[];
  batchId: string;
  timestamp: number;
}

export interface BatchSyncResponse {
  batchId: string;
  results: SyncResult[];
  timestamp: number;
}

export interface ServiceWorkerMessage {
  type: string;
  payload?: Record<string, unknown>;
  config?: Record<string, string>;
  results?: SyncResult[];
  timestamp?: number;
}

export interface NotificationData {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
  timestamp?: number;
}

export type SyncHandler = (operations: SyncOperation[]) => Promise<SyncResult[]>;