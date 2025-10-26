// Kakao Map API 설정 및 로더 유틸리티
const FALLBACK_KEY = '6e3339a5cbd61f1f3b08e3a06071795b';

export const KAKAO_MAP_CONFIG = {
  // JavaScript 키 (브라우저용)
  JS_KEY: process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY || FALLBACK_KEY,

  // 스크립트 URL 생성
  getScriptUrl: ({
    libraries = ['services', 'clusterer'],
    autoload = false,
  }: {
    libraries?: string[];
    autoload?: boolean;
  } = {}) => {
    const key = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY || FALLBACK_KEY;
    const libs = libraries.length > 0 ? `&libraries=${libraries.join(',')}` : '';
    const autoloadParam = autoload ? '' : '&autoload=false';
    return `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}${libs}${autoloadParam}`;
  }
};

let kakaoLoadPromise: Promise<void> | null = null;

/**
 * Kakao Maps SDK 로딩을 보장한다.
 * 루트 레이아웃(head)에서 SDK 스크립트를 동기적으로 삽입한 후
 * 개별 페이지에서는 이 함수만 호출하면 된다.
 */
export function waitForKakaoMaps(timeoutMs = 8000): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Kakao Maps SDK는 브라우저 환경에서만 로드됩니다.'));
  }

  // 이미 로드된 경우 즉시 resolve
  if (window.kakao?.maps) {
    return new Promise((resolve) => {
      window.kakao.maps.load(() => resolve());
    });
  }

  if (kakaoLoadPromise) {
    return kakaoLoadPromise;
  }

  kakaoLoadPromise = new Promise<void>((resolve, reject) => {
    const script = document.getElementById('kakao-map-sdk') as HTMLScriptElement | null;
    const startedAt = Date.now();

    const pollId = window.setInterval(() => {
      if (window.kakao?.maps) {
        window.clearInterval(pollId);
        script?.removeEventListener('error', handleError);
        window.kakao.maps.load(() => {
          resolve();
          kakaoLoadPromise = Promise.resolve();
        });
      } else if (Date.now() - startedAt > timeoutMs) {
        window.clearInterval(pollId);
        script?.removeEventListener('error', handleError);
        kakaoLoadPromise = null;
        reject(new Error('카카오맵 SDK가 제한 시간 내에 로드되지 않았습니다.'));
      }
    }, 50);

    const handleError = () => {
      window.clearInterval(pollId);
      kakaoLoadPromise = null;
      reject(new Error('카카오맵 SDK 스크립트를 불러오지 못했습니다.'));
    };

    if (script) {
      script.addEventListener('error', handleError, { once: true });
    }
  });

  return kakaoLoadPromise;
}

// 디버깅용 로그
if (typeof window !== 'undefined') {
  console.log('Kakao Map API Key loaded:', KAKAO_MAP_CONFIG.JS_KEY);
  console.log('Current domain:', window.location.origin);
}
