'use client';

import { useState, useCallback, useEffect } from 'react';

export const useOfflineSync = () => {
  // 온라인/오프라인 상태
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline' | 'error'>('synced');
  const [offlineDataCount, setOfflineDataCount] = useState(0);
  const [showSyncProgress, setShowSyncProgress] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);

  // 동기화 시뮬레이션
  const simulateSync = useCallback(() => {
    if (!isOnline) return;
    
    setSyncStatus('syncing');
    setShowSyncProgress(true);
    setSyncProgress(0);

    const interval = setInterval(() => {
      setSyncProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setSyncStatus('synced');
          setOfflineDataCount(0);
          setShowSyncProgress(false);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  }, [isOnline]);

  // 오프라인 데이터 저장 시뮬레이션
  const saveOfflineData = useCallback(() => {
    if (!isOnline) {
      setOfflineDataCount(prev => prev + 1);
      setSyncStatus('offline');
    }
  }, [isOnline]);

  // 온라인/오프라인 상태 감지
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (offlineDataCount > 0) {
        simulateSync();
      }
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [offlineDataCount, simulateSync]);

  return {
    isOnline,
    setIsOnline,
    syncStatus,
    setSyncStatus,
    offlineDataCount,
    setOfflineDataCount,
    showSyncProgress,
    setShowSyncProgress,
    syncProgress,
    setSyncProgress,
    simulateSync,
    saveOfflineData
  };
};