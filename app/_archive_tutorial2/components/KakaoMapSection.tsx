'use client';

import React, { useEffect, useRef, useState } from 'react';
import { waitForKakaoMaps } from '@/lib/constants/kakao';

interface KakaoMapSectionProps {
  latitude?: number;
  longitude?: number;
  address?: string;
  institution?: string;
  onLocationUpdate?: (lat: number, lng: number) => void;
}

export default function KakaoMapSection({
  latitude = 37.5665,
  longitude = 126.9780,
  address = '서울시청',
  institution = 'AED 설치 위치',
  onLocationUpdate
}: KakaoMapSectionProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [marker, setMarker] = useState<any>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [mapError, setMapError] = useState<string>('');

  // 카카오맵 초기화
  useEffect(() => {
    let cancelled = false;

    console.log('[KakaoMapSection] 카카오맵 로딩 시작...');
    console.log('[KakaoMapSection] window.kakao:', typeof window.kakao);
    console.log('[KakaoMapSection] mapRef.current:', mapRef.current);

    waitForKakaoMaps()
      .then(() => {
        console.log('[KakaoMapSection] 카카오맵 SDK 로드 완료');
        if (cancelled || !mapRef.current) {
          console.log('[KakaoMapSection] 취소됨 또는 mapRef 없음');
          return;
        }

        console.log('[KakaoMapSection] 지도 생성 중...', { latitude, longitude });
        const options = {
          center: new window.kakao.maps.LatLng(latitude, longitude),
          level: 3,
        };

        const mapInstance = new window.kakao.maps.Map(mapRef.current, options);
        console.log('[KakaoMapSection] 지도 생성 완료');
        setMap(mapInstance);

        // AED 마커 추가 (연두색 하트 + 흰색 번개)
        const markerSvg = `
            <svg width="40" height="48" viewBox="0 0 40 48" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
                  <feOffset dx="0" dy="2" result="offsetblur"/>
                  <feFlood flood-color="#000000" flood-opacity="0.3"/>
                  <feComposite in2="offsetblur" operator="in"/>
                  <feMerge>
                    <feMergeNode/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              <path d="M20 10C18 3 11 0 7 5C3 9 3 14 3 16C3 25 20 42 20 42S37 25 37 16C37 14 37 9 33 5C29 0 22 3 20 10Z"
                    fill="#84cc16" stroke="white" stroke-width="2" filter="url(#shadow)"/>
              <path d="M25 14L17 24H23L15 34L23 24H17L25 14Z"
                    fill="white" stroke="#4ade80" stroke-width="0.5"/>
            </svg>
          `;
        const markerImage = new window.kakao.maps.MarkerImage(
          'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(markerSvg))),
          new window.kakao.maps.Size(40, 48),
          { offset: new window.kakao.maps.Point(20, 48) }
        );

        const markerPosition = new window.kakao.maps.LatLng(latitude, longitude);
        const markerInstance = new window.kakao.maps.Marker({
          position: markerPosition,
          map: mapInstance,
          image: markerImage,
          draggable: true,
          title: institution
        });

        setMarker(markerInstance);

        // 마커 드래그 이벤트
        window.kakao.maps.event.addListener(markerInstance, 'dragstart', () => {
          setIsDragging(true);
        });

        window.kakao.maps.event.addListener(markerInstance, 'dragend', () => {
          const position = markerInstance.getPosition();
          const newLat = position.getLat();
          const newLng = position.getLng();

          if (onLocationUpdate) {
            onLocationUpdate(newLat, newLng);
          }
          setIsDragging(false);
        });

        // 정보창 추가
        const infoContent = `
          <div style="padding:10px;min-width:200px;line-height:1.5;">
            <div style="font-weight:bold;margin-bottom:5px;">${institution}</div>
            <div style="font-size:12px;color:#666;">${address}</div>
            <div style="font-size:11px;color:#999;margin-top:5px;">마커를 드래그하여 위치 수정</div>
          </div>
        `;

        const infowindow = new window.kakao.maps.InfoWindow({
          content: infoContent
        });

        // 마커 클릭 시 정보창 표시
        window.kakao.maps.event.addListener(markerInstance, 'click', () => {
          infowindow.open(mapInstance, markerInstance);
        });

        // 줌 컨트롤 추가
        const zoomControl = new window.kakao.maps.ZoomControl();
        mapInstance.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT);

        setIsMapLoaded(true);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Failed to load Kakao Maps:', error);
        setMapError('지도를 불러올 수 없습니다');
      });

    return () => {
      cancelled = true;
    };
  }, [latitude, longitude, address, institution, onLocationUpdate]);

  // 현재 위치로 이동
  const moveToCurrentLocation = () => {
    if (navigator.geolocation && map && marker) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const newPosition = new window.kakao.maps.LatLng(lat, lng);

          map.setCenter(newPosition);
          marker.setPosition(newPosition);

          if (onLocationUpdate) {
            onLocationUpdate(lat, lng);
          }
        },
        (error) => {
          console.error('위치 정보를 가져올 수 없습니다:', error);
        }
      );
    }
  };

  // 초기 위치로 리셋
  const resetToInitialPosition = () => {
    if (map && marker) {
      const initialPosition = new window.kakao.maps.LatLng(latitude, longitude);
      map.setCenter(initialPosition);
      marker.setPosition(initialPosition);

      if (onLocationUpdate) {
        onLocationUpdate(latitude, longitude);
      }
    }
  };

  return (
    <div className="bg-gray-800/50 rounded-2xl p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-white">설치 위치 확인</h3>
        {isDragging && (
          <div className="text-xs text-yellow-400 animate-pulse">
            위치 수정 중...
          </div>
        )}
      </div>

      {/* 카카오 지도 컨테이너 */}
      <div className="relative">
        <div
          ref={mapRef}
          className="w-full h-64 rounded-xl overflow-hidden border border-gray-700"
        />

        {/* 로딩 오버레이 */}
        {!isMapLoaded && !mapError && (
          <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center rounded-xl">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin mb-2"></div>
              <p className="text-gray-300 text-sm">지도 로딩 중...</p>
            </div>
          </div>
        )}

        {/* 에러 메시지 */}
        {mapError && (
          <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center rounded-xl">
            <div className="text-center">
              <p className="text-red-400 text-sm mb-2">{mapError}</p>
              <button
                onClick={() => window.location.reload()}
                className="text-xs text-gray-400 underline"
              >
                페이지 새로고침
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 컨트롤 버튼 */}
      <div className="grid grid-cols-2 gap-2 mt-3">
        <button
          onClick={moveToCurrentLocation}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-xl text-sm transition-colors"
          disabled={!isMapLoaded}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
          </svg>
          현재 위치
        </button>
        <button
          onClick={resetToInitialPosition}
          className="flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-700 text-white py-2 px-3 rounded-xl text-sm transition-colors"
          disabled={!isMapLoaded}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/>
          </svg>
          초기 위치
        </button>
      </div>

      {/* 안내 텍스트 */}
      <div className="mt-3 p-2 bg-gray-700/50 rounded-lg">
        <p className="text-xs text-gray-300">
          💡 마커를 드래그하여 정확한 위치를 지정할 수 있습니다
        </p>
      </div>
    </div>
  );
}