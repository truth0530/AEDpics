'use client';

import { useAEDData } from '@/app/aed-data/components/AEDDataProvider';

export function InspectionSearchBar() {
  const { searchQuery, setSearchQuery } = useAEDData();

  const handleSearch = () => {
    // 검색은 이미 searchQuery 상태에 의해 실시간으로 작동
    // 조회 버튼은 시각적인 요소로 제공
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="bg-gray-900 px-3 py-3 border-b border-gray-800 overflow-x-hidden">
      <div className="flex gap-2 items-center justify-end min-w-0">
        {/* 통합 검색창 - 우측 배치 */}
        <div className="relative flex-1 min-w-0">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="기관명, 주소, 위치 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            className="pl-9 h-9 text-sm w-full min-w-0 bg-gray-800 border border-gray-700 rounded-md text-gray-100 placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
          />
        </div>
        <button
          onClick={handleSearch}
          className="h-9 px-3 sm:px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-medium rounded-md transition-colors flex-shrink-0 whitespace-nowrap"
        >
          조회
        </button>
      </div>
    </div>
  );
}