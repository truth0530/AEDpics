'use client';

import React from 'react';

interface SyncProgressBarProps {
  showSyncProgress?: boolean;
  syncProgress?: number;
  syncStatus?: 'synced' | 'syncing' | 'offline' | 'error';
}

export const SyncProgressBar: React.FC<SyncProgressBarProps> = ({
  showSyncProgress = true,
  syncProgress = 0,
  syncStatus = 'syncing'
}) => {
  if (!showSyncProgress) return null;

  return (
    <div className="fixed top-10 left-4 right-4 z-40 bg-white rounded-lg shadow-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">데이터 동기화</span>
        <span className="text-xs text-gray-500">{syncProgress}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${syncProgress}%` }}
        />
      </div>
      <div className="text-xs text-gray-500 mt-1">
        {syncStatus === 'syncing' ? '오프라인 데이터를 서버와 동기화하는 중...' : '동기화 완료'}
      </div>
    </div>
  );
};