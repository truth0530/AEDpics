'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useInspectionSessionStore, InspectionSession } from '@/lib/state/inspection-session-store';

const API_ENDPOINT = '/api/inspections/sessions';

async function fetchInspectionSession(sessionId: string): Promise<InspectionSession> {
  const response = await fetch(`${API_ENDPOINT}?sessionId=${sessionId}`, {
    method: 'GET',
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(typeof payload?.error === 'string' ? payload.error : '세션을 조회하지 못했습니다.');
  }

  return payload.session as InspectionSession;
}

async function fetchInspectionSessions(status?: string) {
  const search = status ? `?status=${encodeURIComponent(status)}` : '';
  const response = await fetch(`${API_ENDPOINT}${search}`);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(typeof payload?.error === 'string' ? payload.error : '세션 목록을 조회하지 못했습니다.');
  }
  return (payload.sessions ?? []) as InspectionSession[];
}

export function useInspectionSession(sessionId: string | null) {
  const hydrateSession = useInspectionSessionStore((state) => state.hydrateSession);

  const query = useQuery({
    queryKey: ['inspection-session', sessionId],
    queryFn: () => fetchInspectionSession(sessionId as string),
    enabled: Boolean(sessionId),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30, // React Query v5: cacheTime → gcTime
  });

  useEffect(() => {
    if (query.data) {
      hydrateSession(query.data);
    }
     
  }, [query.data]); // hydrateSession is stable, no need to include

  return query;
}

export function useInspectionSessions(status?: string) {
  return useQuery({
    queryKey: ['inspection-sessions', status ?? 'all'],
    queryFn: () => fetchInspectionSessions(status),
    staleTime: 1000 * 30,
  });
}

export function useStartInspectionSession() {
  const queryClient = useQueryClient();
  const startSession = useInspectionSessionStore((state) => state.startSession);

  return useMutation({
    mutationFn: (equipmentSerial: string) => startSession(equipmentSerial),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inspection-sessions'] });
    },
  });
}

export function usePersistInspectionSession() {
  const persistProgress = useInspectionSessionStore((state) => state.persistProgress);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: persistProgress,
    onSuccess: (_, variables) => {
      const sessionId = useInspectionSessionStore.getState().session?.id;
      const status = variables?.status ?? 'all';
      if (sessionId) {
        void queryClient.invalidateQueries({ queryKey: ['inspection-session', sessionId] });
      }
      void queryClient.invalidateQueries({ queryKey: ['inspection-sessions', status] });
    },
  });
}

export function useCompleteInspectionSession() {
  const completeSession = useInspectionSessionStore((state) => state.completeSession);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: completeSession,
    onSuccess: () => {
      const sessionId = useInspectionSessionStore.getState().session?.id;
      if (sessionId) {
        void queryClient.invalidateQueries({ queryKey: ['inspection-session', sessionId] });
      }
      void queryClient.invalidateQueries({ queryKey: ['inspection-sessions'] });
    },
  });
}
