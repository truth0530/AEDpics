import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

const DEBUG = env.NEXT_PUBLIC_DEBUG ?? false;

interface TimestampResponse {
  latest_updated_at: string;
  cache_key: string;
  snapshot_date: string;
}

/**
 * useAEDDataFreshness
 *
 * aed_data 테이블의 최신 타임스탬프를 주기적으로 체크하여
 * 데이터가 교체되었을 때 React Query 캐시를 자동으로 무효화합니다.
 *
 * 매일 전체 교체되는 aed_data의 특성을 고려하여:
 * - 5분마다 서버의 최신 타임스탬프 확인
 * - 로컬 캐시 타임스탬프와 비교
 * - 변경 감지 시 aed-data 관련 쿼리 무효화
 *
 * @returns {Object}
 * @returns {boolean} isDataFresh - 타임스탬프 조회 성공 여부
 * @returns {string} lastUpdated - 최신 updated_at 값
 * @returns {string} snapshotDate - 스냅샷 날짜 (YYYY-MM-DD)
 */
export function useAEDDataFreshness() {
  const queryClient = useQueryClient();

  // 1. 서버의 최신 updated_at 조회
  const { data: serverTimestamp, isLoading } = useQuery<TimestampResponse>({
    queryKey: ['aed-data-timestamp'],
    queryFn: async () => {
      const response = await fetch('/api/aed-data/timestamp');
      if (!response.ok) {
        throw new Error('Failed to fetch timestamp');
      }
      return response.json();
    },
    staleTime: 1000 * 60 * 5, // 5분마다 체크
    refetchInterval: 1000 * 60 * 5, // 5분마다 자동 체크
    refetchOnWindowFocus: false, // 매일 교체이므로 포커스 시 체크 불필요
  });

  // 2. 로컬 캐시의 타임스탬프와 비교
  useEffect(() => {
    if (!serverTimestamp) return;

    // SSR 안전성 확인
    if (typeof window === 'undefined') return;

    try {
      const cachedTimestamp = localStorage.getItem('aed-data-cache-timestamp');

      if (cachedTimestamp !== serverTimestamp.latest_updated_at) {
        // 서버 데이터가 갱신됨 → 캐시 무효화
        if (DEBUG) {
          logger.info('Cache:AEDData', 'AED data refreshed on server, invalidating cache', {
            old: cachedTimestamp,
            new: serverTimestamp.latest_updated_at
          });
        }

        // aed-data 관련 모든 쿼리 무효화
        queryClient.invalidateQueries({ queryKey: ['aed-data'] });

        // 새 타임스탬프 저장
        localStorage.setItem('aed-data-cache-timestamp', serverTimestamp.latest_updated_at);

        // 사용자에게 알림 (선택사항)
        if (cachedTimestamp) {
          // 최초 로드가 아닌 경우만 알림
          logger.info('Cache:AEDData', 'AED data updated, refreshing cache');
        }
      }
    } catch (error) {
      logger.error('Cache:AEDData', 'localStorage access error', error instanceof Error ? error : { error });
      // localStorage 접근 불가 시에도 캐시 무효화는 진행
      queryClient.invalidateQueries({ queryKey: ['aed-data'] });
    }
  }, [serverTimestamp, queryClient]);

  return {
    isDataFresh: !!serverTimestamp && !isLoading,
    lastUpdated: serverTimestamp?.latest_updated_at,
    snapshotDate: serverTimestamp?.snapshot_date,
  };
}

/**
 * getCurrentSnapshotId
 *
 * 현재 스냅샷 ID를 반환합니다.
 * 매일 교체되는 데이터의 특성상 날짜를 스냅샷 ID로 사용합니다.
 *
 * @returns {string} 현재 날짜 (YYYY-MM-DD)
 */
export function getCurrentSnapshotId(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * useCurrentSnapshotId
 *
 * React Hook으로 현재 스냅샷 ID를 반환합니다.
 * 자정이 지나면 자동으로 업데이트됩니다.
 *
 * @returns {string} 현재 날짜 (YYYY-MM-DD)
 */
export function useCurrentSnapshotId(): string {
  const [snapshotId, setSnapshotId] = useState(() => getCurrentSnapshotId());

  useEffect(() => {
    // 자정까지 남은 시간 계산
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    // 자정에 스냅샷 ID 업데이트
    const timer = setTimeout(() => {
      setSnapshotId(getCurrentSnapshotId());
      if (DEBUG) {
        logger.info('Cache:Snapshot', 'Date changed, updating snapshot ID', { newId: getCurrentSnapshotId() });
      }
    }, msUntilMidnight);

    return () => clearTimeout(timer);
  }, [snapshotId]); // snapshotId가 바뀌면 다음 자정 타이머 설정

  return snapshotId;
}
