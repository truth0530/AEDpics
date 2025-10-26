/**
 * 오프라인 큐 상태 표시 컴포넌트
 * TODO: Supabase Realtime을 폴링 또는 SSE로 대체 필요
 */

'use client'

import { useMemo } from 'react'
// TODO: Realtime 기능 임시 비활성화
// import { useOfflineSync } from '@/lib/realtime/hooks/useOfflineSync'
import {
  Cloud,
  CloudOff,
  AlertCircle,
  XCircle,
  RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
// TODO: Supabase 클라이언트 임시 비활성화
// import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
// TODO: Supabase 타입 임시 비활성화
// import type { SupabaseClient } from '@supabase/supabase-js'

export interface QueueStatusProps {
  className?: string
  showDetails?: boolean
  compact?: boolean
  supabaseClient?: any  // TODO: 임시로 any 타입 사용
}

/**
 * 오프라인 큐 상태 표시 (임시 비활성화)
 *
 * TODO: 다음 기능 재구현 필요:
 * - 온라인/오프라인 상태 감지
 * - 오프라인 큐 관리
 * - 동기화 진행률 표시
 * - 실패한 작업 재시도
 *
 * 대체 구현 방안:
 * - Server-Sent Events (SSE)
 * - 폴링 (Polling)
 * - WebSocket
 */
export function QueueStatus({
  className,
  showDetails = true,
  compact = false,
  supabaseClient
}: QueueStatusProps) {
  // TODO: Realtime 기능 임시 비활성화 - 컴포넌트를 null로 반환
  // 향후 폴링 또는 SSE로 대체 필요
  console.warn('[QueueStatus] Component is temporarily disabled - needs migration from Supabase Realtime');
  return null;
}
