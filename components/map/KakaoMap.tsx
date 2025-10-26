'use client';

import { useEffect, useRef, useState } from 'react';
import { waitForKakaoMaps } from '@/lib/constants/kakao';

// Type definitions are in /types/kakao-maps.d.ts

interface KakaoMapProps {
  latitude: number;
  longitude: number;
  onLocationChange?: (lat: number, lng: number) => void;
  editable?: boolean;
  markers?: Array<{
    id: string;
    lat: number;
    lng: number;
    title: string;
    status?: 'normal' | 'warning' | 'danger';
  }>;
}

export default function KakaoMap({
  latitude,
  longitude,
  onLocationChange,
  editable = false,
  markers = []
}: KakaoMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
   
  const mapInstance = useRef<any>(null);
   
  const markerInstance = useRef<any>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // 카카오맵 초기화
  const initializeMap = () => {
    if (!mapContainer.current || !window.kakao?.maps) return;

    const options = {
      center: new window.kakao.maps.LatLng(latitude, longitude),
      level: 3
    };

    const map = new window.kakao.maps.Map(mapContainer.current, options);
    mapInstance.current = map;

    // 줌 컨트롤 추가
    const zoomControl = new window.kakao.maps.ZoomControl();
    map.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT);

    // 메인 마커 추가
    const markerPosition = new window.kakao.maps.LatLng(latitude, longitude);
    const marker = new window.kakao.maps.Marker({
      position: markerPosition,
      map: map,
      draggable: editable
    });
    markerInstance.current = marker;

    // 편집 가능한 경우 드래그 이벤트 추가
    if (editable && onLocationChange) {
      window.kakao.maps.event.addListener(marker, 'dragend', function() {
        const position = marker.getPosition();
        onLocationChange(position.getLat(), position.getLng());
      });

      // 지도 클릭 시 마커 이동
       
      window.kakao.maps.event.addListener(map, 'click', function(mouseEvent?: any) {
        if (!mouseEvent) return;
        const latlng = mouseEvent.latLng;
        marker.setPosition(latlng);
        onLocationChange(latlng.getLat(), latlng.getLng());
      });
    }

    // 추가 마커들 표시
    markers.forEach(m => {
      const markerImage = getMarkerImage(m.status);
      const markerPos = new window.kakao.maps.LatLng(m.lat, m.lng);
      
      const additionalMarker = new window.kakao.maps.Marker({
        position: markerPos,
        map: map,
        title: m.title,
        image: markerImage
      });

      // 인포윈도우 추가
      const infowindow = new window.kakao.maps.InfoWindow({
        content: `<div style="padding:5px;font-size:12px;">${m.title}</div>`
      });

      window.kakao.maps.event.addListener(additionalMarker, 'mouseover', function() {
        infowindow.open(map, additionalMarker);
      });

      window.kakao.maps.event.addListener(additionalMarker, 'mouseout', function() {
        infowindow.close();
      });
    });
  };

  // 마커 이미지 생성
  const getMarkerImage = (status?: string) => {
    if (!window.kakao?.maps) return null;

    let imageSrc = '';
    switch(status) {
      case 'danger':
        imageSrc = 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png';
        break;
      case 'warning':
        imageSrc = 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_red.png';
        break;
      default:
        return null;
    }

    const imageSize = new window.kakao.maps.Size(24, 35);
    return new window.kakao.maps.MarkerImage(imageSrc, imageSize);
  };

  // 위치 업데이트
  useEffect(() => {
    if (isMapLoaded && mapInstance.current && markerInstance.current) {
      const newPosition = new window.kakao.maps.LatLng(latitude, longitude);
      mapInstance.current.setCenter(newPosition);
      markerInstance.current.setPosition(newPosition);
    }
  }, [latitude, longitude, isMapLoaded]);

  // 맵 초기화
  useEffect(() => {
    if (isMapLoaded) {
      initializeMap();
    }
   
  }, [isMapLoaded]);

  useEffect(() => {
    let cancelled = false;

    waitForKakaoMaps()
      .then(() => {
        if (!cancelled) {
          setIsMapLoaded(true);
        }
      })
      .catch((error) => {
        console.error('KakaoMap: Failed to load SDK', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full rounded-lg" />
      {editable && (
        <div className="absolute top-2 left-2 bg-black/80 text-white px-3 py-1 rounded text-sm">
          지도를 클릭하거나 마커를 드래그하여 위치 수정
        </div>
      )}
    </div>
  );
}
