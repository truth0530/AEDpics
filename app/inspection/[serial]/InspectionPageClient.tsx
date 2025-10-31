'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { InspectionWorkflow } from '@/components/inspection/InspectionWorkflow';
import { LoadingSkeleton } from '@/components/inspection/LoadingSkeleton';
import { useInspectionSession, useInspectionSessions, useStartInspectionSession } from '@/hooks/useInspectionSession';
import { useInspectionSessionStore } from '@/lib/state/inspection-session-store';
import { useQuery } from '@tanstack/react-query';

interface InspectionPageClientProps {
  serial: string;
}

async function fetchDeviceData(serial: string) {
  // URL 파라미터를 인코딩하여 특수문자가 있는 시리얼 번호도 안전하게 처리
  const response = await fetch(`/api/aed-data?equipment_serial=${encodeURIComponent(serial)}`);
  if (!response.ok) {
    throw new Error('장비 데이터를 가져올 수 없습니다.');
  }
  const result = await response.json();
  return result.data?.[0] || null;
}

export function InspectionPageClient({ serial }: InspectionPageClientProps) {
  const router = useRouter();
  const session = useInspectionSessionStore((state) => state.session);
  const loadSession = useInspectionSessionStore((state) => state.loadSession);
  const resetSession = useInspectionSessionStore((state) => state.resetSession);
  const isLoading = useInspectionSessionStore((state) => state.isLoading);
  const storeError = useInspectionSessionStore((state) => state.error);
  const [startupError, setStartupError] = useState<string | null>(null);

  const startMutation = useStartInspectionSession();
  useInspectionSession(session?.id ?? null);
  const activeSessionsQuery = useInspectionSessions('active');
  const [conflictEquipmentSerial, setConflictEquipmentSerial] = useState<string | null>(null);

  // Fetch device data
  const { data: deviceData, isLoading: isLoadingDevice, error: deviceError } = useQuery({
    queryKey: ['device-data', serial],
    queryFn: () => fetchDeviceData(serial),
    enabled: Boolean(serial),
    staleTime: 1000 * 60 * 5,
  });

  // Debug logging
  useEffect(() => {
    console.log('Device data fetch status:', { deviceData, isLoadingDevice, deviceError });
  }, [deviceData, isLoadingDevice, deviceError]);

  useEffect(() => {
    resetSession();
     
  }, []); // Only run once on mount

  useEffect(() => {
    // Skip if we already have the correct session
    if (session && session.equipment_serial === serial) {
      return;
    }

    // Skip if already creating a session
    if (startMutation.isPending) {
      return;
    }

    // activeSessionsQuery가 로딩 중이면 기다림
    if (activeSessionsQuery.isLoading) {
      console.log('[InspectionPageClient] Waiting for active sessions to load...');
      return;
    }

    let cancelled = false;

    async function bootstrapSession() {
      try {
        // 먼저 현재 serial에 대한 기존 활성 세션이 있는지 확인
        const existingSession = activeSessionsQuery.data?.find((item) => item.equipment_serial === serial);

        if (existingSession) {
          // 기존 세션이 있으면 로드
          console.log(`[InspectionPageClient] Found existing session for ${serial}, loading...`);
          await loadSession(existingSession.id);
          if (!cancelled) {
            setStartupError(null);
            setConflictEquipmentSerial(null);
          }
          return;
        }

        // 기존 세션이 없으면 새로 시작
        console.log(`[InspectionPageClient] No existing session found for ${serial}, starting new session...`);
        await startMutation.mutateAsync(serial);
        if (!cancelled) {
          setStartupError(null);
          setConflictEquipmentSerial(null);
        }
      } catch (error: any) {
        const message = error instanceof Error ? error.message : '점검 세션을 시작할 수 없습니다.';

        // 409 에러: 다른 장비에 활성 세션이 있는 경우
        if (error.status === 409 && error.data?.equipmentSerial) {
          if (!cancelled) {
            setConflictEquipmentSerial(error.data.equipmentSerial);
            setStartupError(message);
          }
          return;
        }

        // 기존 로직: 같은 장비에 세션이 있는 경우 (fallback)
        if (message.includes('이미 진행 중')) {
          const existingSession = activeSessionsQuery.data?.find((item) => item.equipment_serial === serial)
            ?? activeSessionsQuery.data?.[0];
          if (existingSession) {
            await loadSession(existingSession.id);
            if (!cancelled) {
              setStartupError(null);
              setConflictEquipmentSerial(null);
            }
            return;
          }
        }

        if (!cancelled) {
          setStartupError(message);
          setConflictEquipmentSerial(null);
        }
      }
    }

    void bootstrapSession();

    return () => {
      cancelled = true;
    };
  }, [serial, session?.equipment_serial, session?.id, activeSessionsQuery.isLoading]); // Wait for active sessions to load

  const heading = useMemo(() => {
    if (session) {
      return `장비 ${session.equipment_serial} 점검`;
    }
    return `장비 ${serial} 점검`;
  }, [serial, session]);

  if (startupError && !session) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-lg font-semibold text-red-400">점검 세션을 준비하는 중 문제가 발생했습니다.</p>
        <p className="text-sm text-gray-300">{startupError}</p>

        {conflictEquipmentSerial && (
          <div className="mt-4 p-4 bg-yellow-900/30 border border-yellow-700 rounded-lg">
            <p className="text-sm text-yellow-200 mb-3">
              다른 장비를 점검하기 전에 <span className="font-semibold">{conflictEquipmentSerial}</span> 장비의 점검을 먼저 완료하거나 취소해야 합니다.
            </p>
            <p className="text-xs text-gray-400 mb-4">
              {conflictEquipmentSerial} 장비 점검 화면으로 이동하여 점검을 이어서 진행하거나 취소하세요.
            </p>
            <button
              type="button"
              onClick={() => {
                // 상태 초기화 후 페이지 이동
                setStartupError(null);
                setConflictEquipmentSerial(null);
                resetSession();
                window.location.href = `/inspection/${encodeURIComponent(conflictEquipmentSerial)}`;
              }}
              className="rounded bg-yellow-600 hover:bg-yellow-700 px-4 py-2 text-sm font-semibold text-white transition-colors"
            >
              {conflictEquipmentSerial} 장비 점검으로 이동
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => router.push('/inspection')}
          className="rounded bg-green-600 hover:bg-green-700 px-4 py-2 text-sm font-semibold text-white transition-colors"
        >
          장치 목록으로 돌아가기
        </button>
      </main>
    );
  }

  if (!session && (isLoading || startMutation.isPending)) {
    return <LoadingSkeleton />;
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      {storeError && (
        <div className="rounded border border-red-500 bg-red-900/30 px-3 py-2 text-sm text-red-300">{storeError}</div>
      )}
      <InspectionWorkflow
        deviceSerial={serial}
        deviceData={deviceData || session?.current_snapshot || session?.device_info}
        heading={heading}
      />
    </main>
  );
}
