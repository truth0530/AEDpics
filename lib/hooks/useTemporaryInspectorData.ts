import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';

interface InspectorDataState {
  devices: any[] | null;
  loading: boolean;
  error: string | null;
  lastSync: Date | null;
}

export function useTemporaryInspectorData() {
  const { user } = useAuth();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const [state, setState] = useState<InspectorDataState>({
    devices: null,
    loading: true,
    error: null,
    lastSync: null
  });

  // 함수형 setState로 closure 문제 방지
  const loadAssignedDevices = useCallback(async () => {
    if (user?.role !== 'temporary_inspector') return;

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch('/api/inspections/assigned-devices');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to load devices: ${response.statusText}`);
      }

      const data = await response.json();

      setState(prev => ({
        ...prev,
        devices: data.devices || [],
        loading: false,
        error: data.devices?.length === 0 ? 'NO_DEVICES_ASSIGNED' : null,
        lastSync: new Date()
      }));

    } catch (error) {
      setState(prev => ({
        ...prev,
        devices: null,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        lastSync: prev.lastSync // 에러 시 이전 sync 시간 유지
      }));
    }
  }, [user?.role]);

  // 초기 로드 및 주기적 동기화
  useEffect(() => {
    if (user?.role !== 'temporary_inspector') {
      setState({
        devices: null,
        loading: false,
        error: 'NOT_TEMPORARY_INSPECTOR',
        lastSync: null
      });
      return;
    }

    // 초기 로드
    loadAssignedDevices();

    // 30초마다 동기화 (5초는 너무 잦음)
    intervalRef.current = setInterval(loadAssignedDevices, 30000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [user?.role, loadAssignedDevices]);

  const retry = useCallback(() => {
    // 기존 interval 정리
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // 즉시 재시도
    loadAssignedDevices();

    // 새 interval 시작
    if (user?.role === 'temporary_inspector') {
      intervalRef.current = setInterval(loadAssignedDevices, 30000);
    }
  }, [loadAssignedDevices, user?.role]);

  return {
    ...state,
    retry,
    isStale: state.lastSync ?
      (new Date().getTime() - state.lastSync.getTime() > 60000) : false
  };
}