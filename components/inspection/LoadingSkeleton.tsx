'use client';

export function LoadingSkeleton() {
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 bg-gray-700 rounded animate-pulse" />
        <div className="h-9 w-24 bg-gray-700 rounded animate-pulse" />
      </div>

      {/* Progress steps skeleton */}
      <div className="flex space-x-2">
        {[1, 2, 3, 4, 5].map((step) => (
          <div
            key={step}
            className="flex-1 h-1 bg-gray-700 rounded animate-pulse"
            style={{ animationDelay: `${step * 100}ms` }}
          />
        ))}
      </div>

      {/* Main content skeleton */}
      <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
        <div className="h-6 w-32 bg-gray-700 rounded mb-4 animate-pulse" />
        <div className="space-y-3">
          <div className="h-4 w-full bg-gray-700 rounded animate-pulse" />
          <div className="h-4 w-3/4 bg-gray-700 rounded animate-pulse" />
          <div className="h-32 w-full bg-gray-700 rounded animate-pulse" />
        </div>
      </div>

      {/* Status message */}
      <div className="rounded-lg border border-green-700/30 bg-green-900/10 p-4">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          <div className="space-y-1 flex-1">
            <p className="text-sm text-green-400 font-medium">점검 준비 중...</p>
            <p className="text-xs text-gray-500">장비 정보를 불러오고 있습니다</p>
          </div>
        </div>
      </div>
    </main>
  );
}
