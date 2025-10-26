'use client';

import { useState } from 'react';
import { useBrowserNotifications } from '@/lib/hooks/useNotifications';

export function NotificationSettings() {
  const { permission, requestPermission, isSupported } = useBrowserNotifications();
  const [isRequesting, setIsRequesting] = useState(false);

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    try {
      await requestPermission();
    } catch (error) {
      console.error('Failed to request notification permission:', error);
    } finally {
      setIsRequesting(false);
    }
  };

  if (!isSupported) {
    return (
      <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="text-white font-medium">브라우저 알림 미지원</h3>
            <p className="text-gray-400 text-sm">
              현재 브라우저에서는 데스크톱 알림을 지원하지 않습니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${
            permission === 'granted' ? 'bg-green-500' :
            permission === 'denied' ? 'bg-red-500' : 'bg-yellow-500'
          }`} />
          <div>
            <h3 className="text-white font-medium">데스크톱 알림</h3>
            <p className="text-gray-400 text-sm">
              {permission === 'granted' && '새 알림을 데스크톱으로 받습니다'}
              {permission === 'denied' && '알림이 차단되었습니다'}
              {permission === 'default' && '알림 권한이 필요합니다'}
            </p>
          </div>
        </div>

        {permission === 'default' && (
          <button
            onClick={handleRequestPermission}
            disabled={isRequesting}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {isRequesting ? '요청 중...' : '허용하기'}
          </button>
        )}

        {permission === 'denied' && (
          <div className="text-xs text-gray-500 max-w-xs">
            브라우저 설정에서 알림을 허용해주세요
          </div>
        )}

        {permission === 'granted' && (
          <div className="text-sm text-green-400 font-medium">
            활성화됨
          </div>
        )}
      </div>

      {permission === 'granted' && (
        <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            <span className="text-green-400 text-sm font-medium">
              새로운 회원가입, 시스템 업데이트 등의 알림을 실시간으로 받습니다
            </span>
          </div>
        </div>
      )}
    </div>
  );
}