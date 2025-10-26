/**
 * LocationSection Component
 * 위치 정보 점검 섹션 - 모듈화된 컴포넌트
 */

'use client';

import React, { useState, useRef, useCallback } from 'react';

interface LocationSectionProps {
  latitude: number;
  longitude: number;
  address: string;
  detailLocation: string;
  onUpdate: (field: string, value: unknown) => void;
  onComplete: (itemKey: string) => void;
  completedItems: Set<string>;
}

export const LocationSection: React.FC<LocationSectionProps> = ({
  latitude,
  longitude,
  address,
  detailLocation,
  onUpdate,
  onComplete,
  completedItems,
}) => {
  const [isDraggingPin, setIsDraggingPin] = useState(false);
  const [pinPosition, setPinPosition] = useState({ x: 50, y: 50 });
  const [editingAddress, setEditingAddress] = useState(false);
  const [tempAddress, setTempAddress] = useState(address);
  const [editingDetail, setEditingDetail] = useState(false);
  const [tempDetail, setTempDetail] = useState(detailLocation);
  const mapRef = useRef<HTMLDivElement>(null);

  // 핀 드래그 핸들러
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingPin(true);

    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect) return;

    const handleMouseMove = (e: MouseEvent) => {
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setPinPosition({
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y)),
      });
    };

    const handleMouseUp = () => {
      setIsDraggingPin(false);
      // 좌표 업데이트
      const newLat = latitude + (pinPosition.y - 50) * 0.001;
      const newLng = longitude + (pinPosition.x - 50) * 0.001;
      onUpdate('latitude', newLat);
      onUpdate('longitude', newLng);
      onComplete('location');

      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [latitude, longitude, pinPosition, onUpdate, onComplete]);

  // 터치 이벤트 핸들러
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    setIsDraggingPin(true);

    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect) return;

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      const x = ((touch.clientX - rect.left) / rect.width) * 100;
      const y = ((touch.clientY - rect.top) / rect.height) * 100;
      setPinPosition({
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y)),
      });
    };

    const handleTouchEnd = () => {
      setIsDraggingPin(false);
      const newLat = latitude + (pinPosition.y - 50) * 0.001;
      const newLng = longitude + (pinPosition.x - 50) * 0.001;
      onUpdate('latitude', newLat);
      onUpdate('longitude', newLng);
      onComplete('location');

      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };

    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
  }, [latitude, longitude, pinPosition, onUpdate, onComplete]);

  return (
    <div className="bg-gray-800 rounded-xl p-4 space-y-4">
      <h3 className="text-lg font-bold text-white mb-4">위치 정보</h3>

      {/* 지도 영역 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-gray-300 text-sm">GPS 위치</span>
          {completedItems.has('location') && (
            <span className="text-xs text-green-400">✓ 확인됨</span>
          )}
        </div>

        <div
          ref={mapRef}
          className="relative bg-gray-700 rounded-lg h-48 overflow-hidden cursor-move"
          style={{
            backgroundImage: 'url("/api/placeholder/400/200")',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          {/* 격자 오버레이 */}
          <div className="absolute inset-0 opacity-20">
            <div className="grid grid-cols-10 grid-rows-10 h-full">
              {Array.from({ length: 100 }).map((_, i) => (
                <div key={i} className="border border-gray-600"></div>
              ))}
            </div>
          </div>

          {/* GPS 핀 */}
          <div
            className={`absolute transform -translate-x-1/2 -translate-y-full cursor-move transition-opacity ${
              isDraggingPin ? 'opacity-80' : 'opacity-100'
            }`}
            style={{
              left: `${pinPosition.x}%`,
              top: `${pinPosition.y}%`,
            }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
          >
            <svg className="h-8 w-8 text-red-500 drop-shadow-lg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          </div>

          {/* 좌표 표시 */}
          <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
            {latitude.toFixed(6)}, {longitude.toFixed(6)}
          </div>
        </div>

        {/* 드래그 안내 */}
        {isDraggingPin && (
          <p className="text-xs text-yellow-400 text-center animate-pulse">
            핀을 드래그하여 정확한 위치를 설정하세요
          </p>
        )}
      </div>

      {/* 주소 정보 */}
      <div className="space-y-3 pt-4 border-t border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-gray-300 text-sm">설치 주소</span>
          {completedItems.has('address') && (
            <span className="text-xs text-green-400">✓ 확인됨</span>
          )}
        </div>

        <div className="bg-gray-700 rounded-lg p-3">
          {editingAddress ? (
            <div className="space-y-2">
              <input
                type="text"
                value={tempAddress}
                onChange={(e) => setTempAddress(e.target.value)}
                className="w-full bg-gray-600 text-white px-3 py-2 rounded"
                placeholder="설치 주소 입력"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onUpdate('address', tempAddress);
                    onComplete('address');
                    setEditingAddress(false);
                  }}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm"
                >
                  저장
                </button>
                <button
                  onClick={() => {
                    setEditingAddress(false);
                    setTempAddress(address);
                  }}
                  className="px-3 py-1 bg-gray-600 text-white rounded text-sm"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-white text-sm">{address || '주소 미입력'}</p>
              <button
                onClick={() => setEditingAddress(true)}
                className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-500"
              >
                수정
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 상세 위치 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-gray-300 text-sm">상세 위치</span>
          {completedItems.has('detailLocation') && (
            <span className="text-xs text-green-400">✓ 확인됨</span>
          )}
        </div>

        <div className="bg-gray-700 rounded-lg p-3">
          {editingDetail ? (
            <div className="space-y-2">
              <textarea
                value={tempDetail}
                onChange={(e) => setTempDetail(e.target.value)}
                className="w-full bg-gray-600 text-white px-3 py-2 rounded resize-none"
                rows={2}
                placeholder="예: 1층 로비 안내데스크 옆"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onUpdate('detailLocation', tempDetail);
                    onComplete('detailLocation');
                    setEditingDetail(false);
                  }}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm"
                >
                  저장
                </button>
                <button
                  onClick={() => {
                    setEditingDetail(false);
                    setTempDetail(detailLocation);
                  }}
                  className="px-3 py-1 bg-gray-600 text-white rounded text-sm"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-white text-sm">{detailLocation || '상세 위치 미입력'}</p>
              <button
                onClick={() => setEditingDetail(true)}
                className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-500"
              >
                수정
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 카카오맵 연동 버튼 */}
      <div className="pt-4 border-t border-gray-700">
        <button
          onClick={() => {
            // TODO: 카카오맵 API 연동
            onComplete('kakaoMap');
          }}
          className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          카카오맵에서 위치 확인
        </button>
      </div>

      {/* 진행 상태 요약 */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">섹션 진행률</span>
          <span className="text-green-400">
            {[
              completedItems.has('location'),
              completedItems.has('address'),
              completedItems.has('detailLocation')
            ].filter(Boolean).length} / 3 완료
          </span>
        </div>
      </div>
    </div>
  );
};

export default LocationSection;