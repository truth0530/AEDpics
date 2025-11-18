'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  hasMore: boolean;
  onPageChange: (page: number) => void;
  pageSize: number;
  pageItemCount: number;        // ✅ 현재 페이지의 아이템 개수
  totalCount?: number;          // ✅ 전체 아이템 개수 (표시용, 선택적)
  onPageSizeChange: (size: number) => void;
  summaryText?: string; // 추가 요약 정보 (예: "일정추가 필요")
}

export function Pagination({
  currentPage,
  hasMore,
  onPageChange,
  pageSize,
  pageItemCount,
  totalCount,
  onPageSizeChange,
  summaryText,
}: PaginationProps) {
  const canGoPrev = currentPage > 1;
  const canGoNext = hasMore;

  // ✅ 수정: pageItemCount를 사용하여 정확한 범위 계산
  const startItem = pageItemCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = pageItemCount === 0 ? 0 : startItem + pageItemCount - 1;

  return (
    <div className="flex items-center justify-between gap-1 sm:gap-4 py-1.5 sm:py-4 px-1.5 sm:px-3 bg-gray-800/50 border-t border-gray-700/50">
      {/* 왼쪽: 항목 정보 및 페이지 크기 선택 - 모바일 1줄 */}
      <div className="flex items-center gap-1 sm:gap-4 text-xs sm:text-sm text-gray-400">
        {/* 모바일: 초압축 1줄 */}
        <div className="flex items-center gap-1 sm:hidden">
          <span className="font-medium text-[10px] leading-none">
            {startItem}-{endItem}{totalCount ? `/${totalCount.toLocaleString()}` : ''}
            {summaryText && <span className="text-green-400 ml-0.5">({summaryText})</span>}
          </span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-[10px] text-white focus:outline-none"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={30}>30</option>
            <option value={50}>50</option>
          </select>
        </div>

        {/* PC: 상세한 표시 */}
        <span className="hidden sm:block font-medium">
          {totalCount ? `총 ${totalCount.toLocaleString()}건 중 ` : ''}
          {startItem.toLocaleString()}-{endItem.toLocaleString()}번째 표시
          {summaryText && <span className="text-green-400 ml-2">({summaryText})</span>}
        </span>

        <div className="hidden sm:flex items-center gap-2">
          <span className="text-gray-500">페이지당</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={10}>10개</option>
            <option value={20}>20개</option>
            <option value={30}>30개</option>
            <option value={50}>50개</option>
          </select>
        </div>
      </div>

      {/* 오른쪽: 페이지 네비게이션 - 모바일 압축 */}
      <div className="flex items-center gap-1 sm:gap-2">
        <div className="hidden sm:flex items-center gap-1 text-sm text-gray-400">
          <span className="text-gray-500">페이지</span>
          <span className="font-semibold text-white">{currentPage}</span>
        </div>

        {/* 이전 버튼 */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!canGoPrev}
          className={`p-0.5 sm:p-1.5 rounded transition-colors ${
            canGoPrev
              ? 'text-gray-400 hover:bg-gray-700 hover:text-white'
              : 'text-gray-600 cursor-not-allowed'
          }`}
          title="이전 페이지"
          aria-label="이전 페이지"
        >
          <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
        </button>

        {/* 페이지 번호 버튼 (데스크톱만) */}
        <div className="hidden sm:flex items-center gap-1">
          {Array.from({ length: 15 }, (_, i) => {
            // 현재 페이지를 중심으로 15개 페이지 번호 표시
            let pageNum;
            if (currentPage <= 7) {
              // 현재 페이지가 7 이하면 1-15 표시
              pageNum = i + 1;
            } else {
              // 현재 페이지가 8 이상이면 (currentPage - 7)부터 표시
              pageNum = currentPage - 7 + i;
            }

            // 페이지 번호가 1보다 작으면 표시하지 않음
            if (pageNum < 1) return null;

            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={`min-w-[32px] h-8 px-2 text-sm rounded transition-colors ${
                  currentPage === pageNum
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        {/* 현재 페이지 표시 (모바일) */}
        <span className="sm:hidden text-[10px] font-medium text-gray-300 px-1">
          {currentPage}페이지
        </span>

        {/* 다음 버튼 */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!canGoNext}
          className={`p-0.5 sm:p-1.5 rounded transition-colors ${
            canGoNext
              ? 'text-gray-400 hover:bg-gray-700 hover:text-white'
              : 'text-gray-600 cursor-not-allowed'
          }`}
          title="다음 페이지"
          aria-label="다음 페이지"
        >
          <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
        </button>
      </div>
    </div>
  );
}
