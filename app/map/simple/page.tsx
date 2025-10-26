'use client';

import { useEffect, useRef, useState } from 'react';
import { waitForKakaoMaps } from '@/lib/constants/kakao';

// Global kakao type is already defined in lib/types/kakao-maps.d.ts

export default function SimpleMapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    waitForKakaoMaps()
      .then(() => {
        if (cancelled || !mapRef.current || !window.kakao?.maps) return;

        window.kakao.maps.load(() => {
          if (!cancelled && mapRef.current) {
            const options = {
              center: new window.kakao.maps.LatLng(37.5665, 126.9780),
              level: 5
            };
            new window.kakao.maps.Map(mapRef.current, options);
          }
        });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to ensure Kakao Maps SDK is ready:', err);
        setError('카카오맵을 불러올 수 없습니다. API 키와 도메인 설정을 확인해주세요.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">카카오맵 테스트</h1>
        {error && (
          <div className="bg-red-100 text-red-700 p-4 rounded mb-4">
            {error}
            <div className="mt-2 text-sm">
              <p>해결 방법:</p>
              <ol className="list-decimal ml-4">
                <li>카카오 개발자 사이트에서 앱 설정 확인</li>
                <li>사이트 도메인에 localhost:3000 추가</li>
                <li>JavaScript 키 확인: 6e3339a5cbd61f1f3b08e3a06071795b</li>
              </ol>
            </div>
          </div>
        )}
        <div
          ref={mapRef}
          className="w-full h-[500px] border border-gray-300 rounded"
        />
      </div>
    </div>
  );
}
