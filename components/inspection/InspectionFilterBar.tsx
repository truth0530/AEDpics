'use client';

import { useCallback, useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { useAEDData } from '@/app/aed-data/components/AEDDataProvider';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { getRegionCode, CITY_CODE_TO_GUGUN_MAP } from '@/lib/constants/regions';

export function InspectionFilterBar() {
  const { setFilters } = useAEDData();
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [regionFilter, setRegionFilter] = useState<{ sido?: string; gugun?: string }>({});

  useEffect(() => {
    const updateLayoutFlags = () => {
      const width = window.innerWidth;
      setIsMobileLayout(width < 768);
    };

    updateLayoutFlags();
    window.addEventListener('resize', updateLayoutFlags);
    return () => window.removeEventListener('resize', updateLayoutFlags);
  }, []);

  // 헤더의 RegionFilter에서 발송하는 이벤트 수신
  useEffect(() => {
    const handleRegionSelected = (e: CustomEvent) => {
      const { sido, gugun } = e.detail;
      console.log('[InspectionFilterBar] Region selected from header:', { sido, gugun });

      setRegionFilter({ sido, gugun });

      // sessionStorage에도 저장 (페이지 새로고침 시 유지)
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('selectedSido', sido);
        window.sessionStorage.setItem('selectedGugun', gugun);
      }
    };

    window.addEventListener('regionSelected', handleRegionSelected as EventListener);

    // 초기값 로드
    if (typeof window !== 'undefined') {
      const storedSido = window.sessionStorage.getItem('selectedSido');
      const storedGugun = window.sessionStorage.getItem('selectedGugun');
      if (storedSido || storedGugun) {
        setRegionFilter({ sido: storedSido || undefined, gugun: storedGugun || undefined });
      }
    }

    return () => {
      window.removeEventListener('regionSelected', handleRegionSelected as EventListener);
    };
  }, []);

  // 검색 필터 적용
  const handleApply = useCallback(() => {
    // 지역 필터 변환: 라벨 → 코드로 중앙 관리 유틸 사용
    let regionCodes: string[] | undefined;
    let cityCodes: string[] | undefined;

    // 필터 입력 → 코드 변환 → 중앙 매핑으로 라벨 비교 (CLAUDE.md 정책)
    if (regionFilter.sido && regionFilter.sido !== '시도') {
      // 중앙 유틸 getRegionCode()를 사용하여 라벨(예: '서울', '서울특별시')을 코드(예: 'SEO')로 변환
      const regionCode = getRegionCode(regionFilter.sido);
      if (regionCode && regionCode !== regionFilter.sido) {
        // 변환 성공: 코드를 저장
        regionCodes = [regionCode];
      }
    }

    // 시군구 필터: 이미 한글 라벨 형식 (예: '강남구')
    // mapCityCodeToGugun()의 역함수가 필요한 경우 CITY_CODE_TO_GUGUN_MAP 역매핑 사용
    if (regionFilter.gugun && regionFilter.gugun !== '구군') {
      cityCodes = [regionFilter.gugun];
    }

    console.log('[InspectionFilterBar] Applying filters (labels→codes):', {
      search: searchTerm,
      regionInput: regionFilter.sido,
      regionCodes,
      cityInput: regionFilter.gugun,
      cityCodes
    });

    setFilters({
      search: searchTerm.trim() || undefined,
      regionCodes,
      cityCodes,
    } as any);
  }, [searchTerm, regionFilter, setFilters]);

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
