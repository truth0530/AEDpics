import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useEffect } from 'react';

interface InspectionSession {
  id: string;
  equipment_serial: string;
  inspector_id: string;
  status: string;
  current_step: number;
  step_data: Record<string, unknown> | null;
  field_changes?: Record<string, unknown> | null;
  started_at: string;
  completed_at?: string | null;
  updated_at?: string | null;
  current_snapshot?: Record<string, unknown> | null;
  original_snapshot?: Record<string, unknown> | null;
  device_info?: Record<string, unknown> | null;
  refresh_status?: 'idle' | 'refreshing' | 'success' | 'failed';
  refresh_error?: string | null;
  notes?: string | null;
}

interface SessionResponse {
  session: InspectionSession;
  refreshing?: boolean;
  refreshStatus?: 'idle' | 'refreshing' | 'success' | 'failed';
  message?: string;
}

// 🆕 Week 3: 세션 조회 훅
export function useInspectionSession(sessionId: string) {
  return useQuery<SessionResponse>({
    queryKey: ['inspection-session', sessionId],
    queryFn: async () => {
      const response = await fetch(
        `/api/inspections/sessions?sessionId=${sessionId}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch session');
      }
      return response.json();
    },
    staleTime: 1000 * 60 * 5,  // 5분간 캐시
    refetchOnWindowFocus: false,
  });
}

// 🆕 Week 3: 갱신 중일 때 폴링하는 훅 (타임스탬프 기반 타임아웃)
export function useSessionRefreshPoller(
  sessionId: string,
  isRefreshing: boolean
) {
  const pollStartTime = useRef<number | null>(null);
  const MAX_POLL_DURATION = 60000; // 1분

  // 폴링 시작 시간 기록
  useEffect(() => {
    if (isRefreshing && !pollStartTime.current) {
      pollStartTime.current = Date.now();
    } else if (!isRefreshing) {
      pollStartTime.current = null;
    }
  }, [isRefreshing]);

  // 타임아웃 확인
  const isTimeout = pollStartTime.current !== null &&
    Date.now() - pollStartTime.current > MAX_POLL_DURATION;

  return useQuery<SessionResponse>({
    queryKey: ['session-refresh-poll', sessionId],
    queryFn: async () => {
      const response = await fetch(
        `/api/inspections/sessions?sessionId=${sessionId}`
      );
      return response.json();
    },
    enabled: isRefreshing && !isTimeout,
    refetchInterval: 2000,       // 2초마다 체크
    refetchOnWindowFocus: false,
    retry: false,
  });
}

// 🆕 Week 3: 수동 갱신 뮤테이션
export function useRefreshSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await fetch(
        `/api/inspections/sessions/${sessionId}/refresh`,
        { method: 'POST' }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to refresh session');
      }

      return response.json();
    },
    onSuccess: (_, sessionId) => {
      // 캐시 무효화하여 최신 데이터 다시 가져오기
      queryClient.invalidateQueries({ queryKey: ['inspection-session', sessionId] });
    },
  });
}
