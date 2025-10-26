'use client';

import { useAEDDataFreshness } from '@/lib/hooks/use-aed-data-cache';
import { useState, useEffect } from 'react';
import { X, RefreshCw } from 'lucide-react';

/**
 * DataRefreshBanner
 *
 * AED 데이터가 업데이트되었을 때 사용자에게 알림을 표시하는 배너 컴포넌트
 *
 * 기능:
 * - 데이터 스냅샷 날짜 변경 감지
 * - 5초 후 자동 숨김
 * - 사용자가 수동으로 닫기 가능
 * - 부드러운 애니메이션
 */
export function DataRefreshBanner() {
  const { isDataFresh, lastUpdated, snapshotDate } = useAEDDataFreshness();
  const [showBanner, setShowBanner] = useState(false);
  const [previousSnapshotDate, setPreviousSnapshotDate] = useState<string>();

  useEffect(() => {
    if (snapshotDate && previousSnapshotDate && snapshotDate !== previousSnapshotDate) {
      // 스냅샷 날짜가 변경됨 → 배너 표시
      setShowBanner(true);

      // 5초 후 자동 숨김
      const timer = setTimeout(() => setShowBanner(false), 5000);
      return () => clearTimeout(timer);
    }

    if (snapshotDate && !previousSnapshotDate) {
      // 최초 로드 시 이전 스냅샷 날짜 저장 (배너 표시 안 함)
      setPreviousSnapshotDate(snapshotDate);
    }
  }, [snapshotDate, previousSnapshotDate]);

  if (!showBanner) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 bg-blue-500 text-white py-3 px-4 shadow-lg animate-in slide-in-from-top duration-300"
      role="alert"
      aria-live="polite"
    >
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-5 h-5 animate-spin" aria-hidden="true" />
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
            <span className="font-medium">
              AED 데이터가 업데이트되었습니다.
            </span>
            <span className="text-sm text-blue-100">
              ({snapshotDate})
            </span>
          </div>
        </div>
        <button
          onClick={() => setShowBanner(false)}
          className="hover:bg-blue-600 rounded p-1 transition-colors"
          aria-label="알림 닫기"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
