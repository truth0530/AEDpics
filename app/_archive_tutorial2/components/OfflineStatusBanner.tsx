'use client';

import React from 'react';

interface OfflineStatusBannerProps {
  isOnline: boolean;
}

export const OfflineStatusBanner: React.FC<OfflineStatusBannerProps> = ({ isOnline }) => {
  if (isOnline) return null;

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 px-4 py-2 text-sm font-medium text-center transition-colors bg-red-500 text-white`}>
      오프라인 모드 - 데이터가 로컬에 저장되며 온라인 복구 시 자동 동기화됩니다.
    </div>
  );
};