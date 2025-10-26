'use client';

import { useCallback, useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { useAEDData } from '@/app/aed-data/components/AEDDataProvider';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function InspectionFilterBar() {
  const { setFilters } = useAEDData();
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobileLayout, setIsMobileLayout] = useState(false);

  useEffect(() => {
    const updateLayoutFlags = () => {
      const width = window.innerWidth;
      setIsMobileLayout(width < 768);
    };

    updateLayoutFlags();
    window.addEventListener('resize', updateLayoutFlags);
    return () => window.removeEventListener('resize', updateLayoutFlags);
  }, []);

  // 검색 필터 적용
  const handleApply = useCallback(() => {
    setFilters({
      search: searchTerm.trim() || undefined,
    });
  }, [searchTerm, setFilters]);

  // Enter 키로 검색
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleApply();
    }
  }, [handleApply]);

  return (
    <div className="bg-gray-900 border-b border-gray-800 overflow-x-hidden">
      <div className={cn(
        "px-2 py-1.5 flex-wrap gap-2",
        isMobileLayout ? "flex flex-col" : "flex items-center"
      )}>
        {/* 통합검색창 */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-1.5 top-1/2 h-3 w-3 lg:h-3.5 lg:w-3.5 xl:h-4 xl:w-4 -translate-y-1/2 text-gray-400 flex-shrink-0" />
            <Input
              type="text"
              placeholder="통합검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-5 h-6 lg:h-7 xl:h-8 text-[10px] lg:text-xs xl:text-sm w-full min-w-0"
            />
          </div>

          {/* 조회 버튼 */}
          <button
            onClick={handleApply}
            className="h-6 lg:h-7 xl:h-8 px-2 sm:px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-md transition-colors flex-shrink-0 text-[10px] lg:text-xs xl:text-sm whitespace-nowrap"
          >
            조회
          </button>
        </div>
      </div>
    </div>
  );
}
