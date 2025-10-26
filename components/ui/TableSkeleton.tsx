import { Skeleton } from "./skeleton"

interface TableSkeletonProps {
  rows?: number
  columns?: number
  showHeader?: boolean
}

/**
 * TableSkeleton
 *
 * 테이블 로딩 상태를 표시하는 Skeleton UI 컴포넌트
 *
 * @param rows - 표시할 행 개수 (기본값: 10)
 * @param columns - 표시할 열 개수 (기본값: 6)
 * @param showHeader - 헤더 표시 여부 (기본값: true)
 */
export function TableSkeleton({
  rows = 10,
  columns = 6,
  showHeader = true
}: TableSkeletonProps) {
  return (
    <div className="w-full space-y-3">
      {/* Header */}
      {showHeader && (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={`header-${i}`} className="h-8" />
          ))}
        </div>
      )}

      {/* Rows */}
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton
                key={`cell-${rowIndex}-${colIndex}`}
                className="h-12"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
