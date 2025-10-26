/**
 * Team Dashboard Data Models
 * Stage 2 - Sprint 1
 */

/**
 * 팀 멤버 정보
 */
export interface TeamMember {
  id: string;
  user_id: string;
  team_id: string;
  role: 'leader' | 'member' | 'viewer';
  full_name: string;
  email: string;
  assigned_tasks: number;
  completed_tasks: number;
  status: 'online' | 'offline' | 'busy';
  last_active_at?: Date;
  avatar_url?: string;
}

/**
 * 팀 작업 정보
 */
export interface TeamTask {
  id: string;
  title: string;
  description?: string;
  device_id: string;
  device_name: string;
  device_location: string;
  assigned_to: string;
  assigned_by: string;
  scheduled_for: Date;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
  notes?: string;
  tags?: string[];
}

/**
 * 팀 일정 정보
 */
export interface TeamSchedule {
  date: Date;
  tasks: TeamTask[];
  members: TeamMember[];
  stats: {
    total_tasks: number;
    completed_tasks: number;
    in_progress_tasks: number;
    pending_tasks: number;
    urgent_tasks: number;
  };
}

/**
 * 캘린더 이벤트
 */
export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: 'inspection' | 'maintenance' | 'meeting' | 'other';
  priority: 'urgent' | 'high' | 'normal' | 'low';
  assigned_to: string[];
  device_id?: string;
  color?: string;
  recurring?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    until?: Date;
  };
}

/**
 * 실시간 동기화 이벤트
 */
export interface RealtimeEvent<T = unknown> {
  type: 'created' | 'updated' | 'deleted';
  table: string;
  data: T;
  old_data?: T; // For update events
  timestamp: string;
  user_id: string;
}

/**
 * 브로드캐스트 이벤트 타입 (Day 7)
 */
export interface CursorPosition {
  user_id: string;
  user_email?: string;
  x: number;
  y: number;
  element_id?: string;
  timestamp: string;
}

export interface TypingIndicator {
  user_id: string;
  user_email?: string;
  field_id: string;
  is_typing: boolean;
  timestamp: string;
}

export interface TeamNotification {
  id: string;
  type: 'task_assigned' | 'task_completed' | 'mention' | 'deadline' | 'system';
  title: string;
  message: string;
  from_user_id: string;
  to_user_ids?: string[];
  metadata?: Record<string, string | number | boolean | null>;
  timestamp: string;
}

/**
 * 오프라인 변경사항
 */
export interface OfflineChange<T = unknown> {
  id: string;
  type: 'create' | 'update' | 'delete';
  table: string;
  data: T;
  timestamp: Date;
  synced: boolean;
  conflict?: {
    type: 'version' | 'delete' | 'permission';
    server_data: T;
    resolution?: 'local' | 'server' | 'merge';
  };
}

/**
 * 알림 설정
 */
export interface NotificationSettings {
  user_id: string;
  enabled: boolean;
  types: {
    task_assigned: boolean;
    task_completed: boolean;
    task_overdue: boolean;
    reminder: boolean;
    team_update: boolean;
  };
  channels: {
    browser: boolean;
    email: boolean;
    sms: boolean;
  };
  quiet_hours?: {
    enabled: boolean;
    start: string; // "22:00"
    end: string;   // "08:00"
  };
}

/**
 * 알림 히스토리
 */
export interface NotificationHistory {
  id: string;
  user_id: string;
  type: 'task_assigned' | 'reminder' | 'status_change' | 'team_update';
  title: string;
  body: string;
  read: boolean;
  created_at: Date;
  read_at?: Date;
  action_url?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

/**
 * 팀 대시보드 통계
 */
export interface TeamDashboardStats {
  period: 'today' | 'week' | 'month';
  team_id: string;
  metrics: {
    total_inspections: number;
    completed_inspections: number;
    pending_inspections: number;
    average_completion_time: number; // minutes
    team_productivity: number; // percentage
    devices_inspected: number;
    issues_found: number;
    issues_resolved: number;
  };
  top_performers: Array<{
    user_id: string;
    name: string;
    completed_tasks: number;
    efficiency_score: number;
  }>;
  priority_distribution: {
    urgent: number;
    high: number;
    normal: number;
    low: number;
  };
}

/**
 * 드래그앤드롭 페이로드
 */
export interface DragDropPayload {
  task_id: string;
  source: {
    date?: Date;
    assigned_to?: string;
    status?: string;
  };
  target: {
    date?: Date;
    assigned_to?: string;
    status?: string;
  };
}

/**
 * 충돌 해결 옵션
 */
export interface ConflictResolution<T = unknown> {
  conflict_id: string;
  type: 'version' | 'delete' | 'permission';
  local_data: T;
  server_data: T;
  suggested_resolution: 'local' | 'server' | 'merge';
  user_choice?: 'local' | 'server' | 'merge' | 'manual';
  merged_data?: T;
}