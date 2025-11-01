'use client';

export default function NotFound() {
  return (
    <html lang="ko">
      <body className="bg-black text-white">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <div className="rounded-lg border border-red-500/20 bg-red-900/10 p-6 text-center">
              <h1 className="text-2xl font-bold text-red-500 mb-4">
                404 - 페이지를 찾을 수 없습니다
              </h1>
              <p className="text-gray-300 mb-6 text-sm leading-relaxed">
                요청하신 페이지를 찾을 수 없습니다.
              </p>
              <button
                onClick={() => window.location.href = '/'}
                className="w-full rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
              >
                홈으로 이동
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
