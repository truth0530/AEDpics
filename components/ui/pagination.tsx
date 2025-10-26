'use client';

import { useRouter, useSearchParams } from 'next/navigation';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  total: number;
  onPageChange?: (page: number) => void;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  pageSize,
  total,
  onPageChange,
  className = ''
}: PaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;

    if (onPageChange) {
      onPageChange(page);
    } else {
      // URL 파라미터 업데이트
      const params = new URLSearchParams(searchParams.toString());
      params.set('page', page.toString());
      router.push(`?${params.toString()}`);
    }
  };

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      // 모든 페이지 표시
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // 첫 페이지
      pages.push(1);

      if (currentPage > 3) {
        pages.push('...');
      }

      // 현재 페이지 주변
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('...');
      }

      // 마지막 페이지
      pages.push(totalPages);
    }

    return pages;
  };

  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, total);

  return (
    <div className={`flex items-center justify-between ${className}`}>
      {/* 정보 표시 */}
      <div className="text-sm text-gray-400">
        <span className="font-medium text-white">{startItem}-{endItem}</span> / 전체 {total}개
      </div>

      {/* 페이지 네비게이션 */}
      <div className="flex items-center gap-1">
        {/* 이전 페이지 */}
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1.5 text-sm bg-gray-800 text-gray-400 rounded hover:bg-gray-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="이전 페이지"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* 페이지 번호 */}
        {getPageNumbers().map((page, index) => (
          <button
            key={index}
            onClick={() => typeof page === 'number' && handlePageChange(page)}
            disabled={page === '...' || page === currentPage}
            className={`min-w-[32px] px-2 py-1.5 text-sm rounded transition-colors ${
              page === currentPage
                ? 'bg-green-500 text-white font-medium'
                : page === '...'
                ? 'text-gray-500 cursor-default'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
          >
            {page}
          </button>
        ))}

        {/* 다음 페이지 */}
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1.5 text-sm bg-gray-800 text-gray-400 rounded hover:bg-gray-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="다음 페이지"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 페이지 크기 선택 (선택적) */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-400">표시 개수:</label>
        <select
          value={pageSize}
          onChange={(e) => {
            const params = new URLSearchParams(searchParams.toString());
            params.set('pageSize', e.target.value);
            params.set('page', '1'); // 페이지 크기 변경 시 첫 페이지로
            router.push(`?${params.toString()}`);
          }}
          className="px-2 py-1 text-sm bg-gray-800 text-white border border-gray-700 rounded focus:border-green-500 focus:outline-none"
        >
          <option value="10">10개</option>
          <option value="20">20개</option>
          <option value="50">50개</option>
          <option value="100">100개</option>
        </select>
      </div>
    </div>
  );
}