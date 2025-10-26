import { Skeleton } from "./skeleton"

interface StatCardSkeletonProps {
  count?: number
}

/**
 * StatCardSkeleton
 *
 * 대시보드 통계 카드 로딩 상태를 표시하는 Skeleton UI 컴포넌트
 *
 * @param count - 표시할 카드 개수 (기본값: 4)
 */
export function StatCardSkeleton({ count = 4 }: StatCardSkeletonProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={`stat-card-${i}`}
          className="rounded-lg border border-gray-800 bg-gray-900/50 p-6"
        >
          {/* Icon */}
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-6 w-16" />
          </div>

          {/* Title */}
          <Skeleton className="h-4 w-24 mb-2" />

          {/* Value */}
          <Skeleton className="h-8 w-32" />
        </div>
      ))}
    </div>
  )
}
