'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 에러를 콘솔에 로깅
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <html lang="ko">
      <body className="bg-black text-white">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <div className="rounded-lg border border-red-500/20 bg-red-900/10 p-6 text-center">
              <h1 className="text-2xl font-bold text-red-500 mb-4">
                ⚠️ 오류가 발생했습니다
              </h1>
              <p className="text-gray-300 mb-2 text-sm leading-relaxed">
                응용 프로그램을 처리하는 중에 오류가 발생했습니다.
              </p>
              <p className="text-gray-400 mb-6 text-xs bg-gray-900 p-3 rounded border border-gray-700 max-h-32 overflow-y-auto font-mono">
                {error.message || '알 수 없는 오류가 발생했습니다.'}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => window.location.href = '/'}
                  className="flex-1 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  홈으로 이동
                </button>
                <button
                  onClick={() => reset()}
                  className="flex-1 rounded bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600 transition-colors"
                >
                  다시 시도
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-4">
                문제가 계속되면 관리자에게 문의하세요.
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
