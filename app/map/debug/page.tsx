'use client';

import { useEffect, useState } from 'react';
import { KAKAO_MAP_CONFIG, waitForKakaoMaps } from '@/lib/constants/kakao';

export default function DebugMapPage() {
  const [status, setStatus] = useState<string[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    const updates: string[] = [];

    const push = (message: string) => {
      updates.push(message);
      setStatus(prev => [...prev, message]);
    };

    const apiKey = KAKAO_MAP_CONFIG.JS_KEY;
    push(`✅ API Key resolved: ${apiKey}`);

    const script = document.getElementById('kakao-map-sdk') as HTMLScriptElement | null;
    if (script) {
      push('✅ SDK script tag found in <head>');
      push(`📝 Script URL: ${script.src}`);
    } else {
      push('❌ SDK script tag not found. 루트 레이아웃에서 스크립트가 주입되는지 확인하세요.');
    }

    waitForKakaoMaps()
      .then(() => {
        push('✅ Kakao maps load callback executed');

        if (!window.kakao?.maps) {
          push('❌ window.kakao.maps unavailable even after load');
          return;
        }

        const container = document.getElementById('map');
        if (!container) {
          push('❌ Map container element not found');
          return;
        }

        try {
          const map = new window.kakao.maps.Map(container, {
            center: new window.kakao.maps.LatLng(37.5665, 126.9780),
            level: 3,
          });
          if (map) {
            push('✅ Map instance created successfully');
            setMapLoaded(true);
          }
        } catch (error) {
          console.error('Map creation error:', error);
          push(`❌ Map creation error: ${(error as Error).message}`);
        }
      })
      .catch((error) => {
        console.error('Kakao Maps loader error:', error);
        push(`❌ Failed to load Kakao Maps SDK: ${(error as Error).message}`);
      });

    console.log('Debug logs:', updates);
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">카카오맵 디버깅 페이지</h1>

      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-2">로딩 상태:</h2>
        <div className="space-y-2 bg-gray-100 p-4 rounded">
          {status.map((s, i) => (
            <div key={i} className="font-mono text-sm">{s}</div>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-2">환경 정보:</h2>
        <div className="bg-gray-100 p-4 rounded font-mono text-sm">
          <div>Node Env: {process.env.NODE_ENV}</div>
          <div>API Key from env: {process.env.NEXT_PUBLIC_KAKAO_MAP_KEY || 'Not found'}</div>
          <div>Fallback Key: 6e3339a5cbd61f1f3b08e3a06071795b</div>
        </div>
      </div>

      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-2">지도 컨테이너:</h2>
        <div
          id="map"
          className={`w-full h-[400px] border-2 ${mapLoaded ? 'border-green-500' : 'border-red-500'} rounded`}
        >
          {!mapLoaded && (
            <div className="flex items-center justify-center h-full text-gray-500">
              지도 로딩 중...
            </div>
          )}
        </div>
      </div>

      <div className="mt-4">
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          페이지 새로고침
        </button>
      </div>
    </div>
  );
}

// Global kakao type is already defined in lib/types/kakao-maps.d.ts
