'use client';

import React from 'react';
import { AEDDevice } from '../hooks/useInspectionData';

interface NotificationPanelProps {
  showNotifications: boolean;
  setShowNotifications: (show: boolean) => void;
  urgentDevices: AEDDevice[];
  syncStatus: 'synced' | 'syncing' | 'offline' | 'error';
  offlineDataCount: number;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  showNotifications,
  setShowNotifications,
  urgentDevices,
  syncStatus,
  offlineDataCount
}) => {
  if (!showNotifications) return null;

  return (
    <div className="fixed top-16 right-4 w-96 bg-gray-800 rounded-lg shadow-lg border border-gray-700 z-50 max-h-[80vh] flex flex-col">
      <div className="flex justify-between items-center p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
          <h3 className="text-white font-medium">알림 센터</h3>
        </div>
        <button 
          onClick={() => setShowNotifications(false)}
          className="text-gray-400 hover:text-white"
        >
          ×
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-3">
          {/* 동기화 상태 알림 */}
          {syncStatus === 'offline' && offlineDataCount > 0 && (
            <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <p className="text-yellow-400 font-medium text-sm">오프라인 데이터</p>
                  <p className="text-gray-300 text-xs mt-1">
                    {offlineDataCount}개의 변경사항이 로컬에 저장됨
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 긴급 장치 알림 */}
          {urgentDevices.slice(0, 3).map((device) => (
            <div key={device.id} className="bg-red-500/20 border border-red-500/30 rounded-lg p-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0 animate-pulse"></div>
                <div>
                  <p className="text-red-400 font-medium text-sm">긴급 점검 필요</p>
                  <p className="text-gray-300 text-xs mt-1">
                    {device.name} - {device.location}
                  </p>
                  <p className="text-gray-400 text-xs">
                    배터리 만료: {device.batteryExpiry}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {/* 일반 알림 */}
          <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-3">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <p className="text-blue-400 font-medium text-sm">월간 점검 리포트</p>
                <p className="text-gray-300 text-xs mt-1">
                  이번 달 점검률: 87% (목표: 90%)
                </p>
              </div>
            </div>
          </div>

          <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-3">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <p className="text-green-400 font-medium text-sm">시스템 업데이트</p>
                <p className="text-gray-300 text-xs mt-1">
                  새로운 점검 항목이 추가되었습니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-gray-700">
        <button className="w-full bg-gray-700 hover:bg-gray-600 text-white text-sm py-2 rounded-lg transition-colors">
          모든 알림 확인
        </button>
      </div>
    </div>
  );
};