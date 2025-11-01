'use client';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-900/10 p-6 text-center">
          <h1 className="text-2xl font-bold text-yellow-500 mb-4">
            오프라인 상태
          </h1>
          <p className="text-gray-300 mb-2 text-sm leading-relaxed">
            인터넷 연결이 끊어졌습니다.
          </p>
          <p className="text-gray-400 mb-6 text-xs">
            네트워크 연결을 확인한 후 다시 시도해주세요.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
          >
            다시 시도
          </button>
          <p className="text-xs text-gray-500 mt-4">
            문제가 계속되면 관리자에게 문의하세요.
          </p>
        </div>
      </div>
    </div>
  );
}
