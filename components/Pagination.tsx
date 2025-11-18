'use client';

import { useState, useEffect } from 'react';
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
  const [isLandscape, setIsLandscape] = useState(false);

  // 가로 모드 감지
  useEffect(() => {
    const checkLandscape = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setIsLandscape(width > height);
    };
    checkLandscape();
    window.addEventListener('resize', checkLandscape);
    window.addEventListener('orientationchange', checkLandscape);
    return () => {
      window.removeEventListener('resize', checkLandscape);
      window.removeEventListener('orientationchange', checkLandscape);
    };
  }, []);

  const canGoPrev = currentPage > 1;
  const canGoNext = hasMore;

  // ✅ 수정: pageItemCount를 사용하여 정확한 범위 계산
  const startItem = pageItemCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = pageItemCount === 0 ? 0 : startItem + pageItemCount - 1;

  // 가로 모드일 때는 PC 레이아웃 사용
  const showDesktop = isLandscape;

  return (
    <div className={`flex items-center justify-between bg-gray-800/50 border-t border-gray-700/50 ${showDesktop ? 'gap-2 py-2 px-2' : 'gap-1 py-1.5 px-1.5'}`}>
      {/* 왼쪽: 항목 정보 및 페이지 크기 선택 - 모바일 1줄 */}
      <div className={`flex items-center text-gray-400 ${showDesktop ? 'gap-2 text-[10px]' : 'gap-1 text-xs'}`}>
        {/* 모바일: 초압축 1줄 */}
        {!showDesktop && (
          <div className="flex items-center gap-1">
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
        )}

        {/* PC/가로모드: 컴팩트 표시 */}
        {showDesktop && (
          <>
            <span className="font-medium whitespace-nowrap">
              {startItem.toLocaleString()}-{endItem.toLocaleString()}
              {totalCount ? `/${totalCount.toLocaleString()}` : ''}
              {summaryText && <span className="text-green-400 ml-1">({summaryText})</span>}
            </span>

            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 text-[10px] text-white focus:outline-none"
            >
              <option value={10}>10개</option>
              <option value={20}>20개</option>
              <option value={30}>30개</option>
              <option value={50}>50개</option>
            </select>
          </>
        )}
      </div>

      {/* 오른쪽: 페이지 네비게이션 - 모바일 압축 */}
      <div className={`flex items-center ${showDesktop ? 'gap-1' : 'gap-1'}`}>
        {/* 이전 버튼 */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!canGoPrev}
          className={`rounded transition-colors ${
            showDesktop ? 'p-1' : 'p-0.5'
          } ${
            canGoPrev
              ? 'text-gray-400 hover:bg-gray-700 hover:text-white'
              : 'text-gray-600 cursor-not-allowed'
          }`}
          title="이전 페이지"
          aria-label="이전 페이지"
        >
          <ChevronLeft className={showDesktop ? 'w-3.5 h-3.5' : 'w-3 h-3'} />
        </button>

        {/* 페이지 번호 버튼 (PC 및 가로 모드만) */}
        {showDesktop && (
          <div className="flex items-center gap-0.5">
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
                  className={`min-w-[24px] h-6 px-1 text-[10px] rounded transition-colors ${
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
        )}

        {/* 현재 페이지 표시 (모바일) */}
        {!showDesktop && (
          <span className="text-[10px] font-medium text-gray-300 px-1">
            {currentPage}페이지
          </span>
        )}

        {/* 다음 버튼 */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!canGoNext}
          className={`rounded transition-colors ${
            showDesktop ? 'p-1' : 'p-0.5'
          } ${
            canGoNext
              ? 'text-gray-400 hover:bg-gray-700 hover:text-white'
              : 'text-gray-600 cursor-not-allowed'
          }`}
          title="다음 페이지"
          aria-label="다음 페이지"
        >
          <ChevronRight className={showDesktop ? 'w-3.5 h-3.5' : 'w-3 h-3'} />
        </button>
      </div>
    </div>
  );
}
