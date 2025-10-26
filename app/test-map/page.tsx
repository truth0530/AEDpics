'use client';

import { useState } from 'react';
import KakaoMap from '@/components/map/KakaoMap';

export default function TestMapPage() {
  const [location, setLocation] = useState({
    lat: 37.5662952,
    lng: 126.9779451
  });

  const handleLocationChange = (lat: number, lng: number) => {
    setLocation({ lat, lng });
    console.log('새 위치:', lat, lng);
  };

  // 샘플 AED 마커들
  const sampleMarkers = [
    {
      id: '1',
      lat: 37.5672952,
      lng: 126.9789451,
      title: '서울시청 본관 AED',
      status: 'normal' as const
    },
    {
      id: '2',
      lat: 37.5652952,
      lng: 126.9769451,
      title: '덕수궁 AED - 점검필요',
      status: 'warning' as const
    },
    {
      id: '3',
      lat: 37.5682952,
      lng: 126.9799451,
      title: '광화문 AED - 긴급',
      status: 'danger' as const
    }
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">카카오맵 테스트</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 읽기 전용 맵 */}
        <div>
          <h2 className="text-lg font-semibold mb-2">일반 보기 모드</h2>
          <div className="h-[400px] border border-gray-700 rounded-lg overflow-hidden">
            <KakaoMap
              latitude={location.lat}
              longitude={location.lng}
              markers={sampleMarkers}
            />
          </div>
        </div>

        {/* 편집 가능한 맵 */}
        <div>
          <h2 className="text-lg font-semibold mb-2">위치 수정 모드</h2>
          <div className="h-[400px] border border-gray-700 rounded-lg overflow-hidden">
            <KakaoMap
              latitude={location.lat}
              longitude={location.lng}
              onLocationChange={handleLocationChange}
              editable={true}
            />
          </div>
          <div className="mt-2 p-2 bg-gray-800 rounded">
            <p className="text-sm">
              현재 위치: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-blue-900/20 border border-green-500 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">카카오맵 API 설정 안내</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li>카카오 개발자 콘솔에서 JavaScript 키 확인</li>
          <li>.env.local 파일에 NEXT_PUBLIC_KAKAO_MAP_APP_KEY 설정</li>
          <li>도메인 등록:
            <ul className="list-disc list-inside ml-4 mt-1">
              <li>http://localhost:3000</li>
              <li>https://aed-check-system.vercel.app</li>
              <li>실제 운영 도메인</li>
            </ul>
          </li>
        </ol>
      </div>
    </div>
  );
}