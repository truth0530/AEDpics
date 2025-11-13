'use client';

import { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { ChevronsUpDown, Check, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { useAEDData } from './AEDDataProvider';
import type { FilterState } from '@/types/filters';
import { FilterBadges } from '@/components/aed/filters';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { REGION_LABELS } from '@/lib/constants/filter-labels';
import type { ExpiryFilter, ExternalDisplayFilter } from '@/lib/constants/aed-filters';
import type { QueryCriteria } from '@/lib/constants/query-criteria';
import { cn } from '@/lib/utils';
import { getCitiesByRegion } from '@/lib/constants/cities';

// 각 필터별 옵션 정의
const BATTERY_EXPIRY_OPTIONS: Array<{ value: ExpiryFilter | 'all'; label: string }> = [
  { value: 'all', label: '배터리 전체' },
  { value: 'expired', label: '배터리만료일 지남' },
  { value: 'in30', label: '배터리만료일 30일 이내' },
  { value: 'in60', label: '배터리만료일 60일 이내' },
  { value: 'in90', label: '배터리만료일 90일 이내' },
  { value: 'in180', label: '배터리만료일 180일 이내' },
  { value: 'in365', label: '배터리만료일 365일 이내' },
];

const PATCH_EXPIRY_OPTIONS: Array<{ value: ExpiryFilter | 'all'; label: string }> = [
  { value: 'all', label: '패드 전체' },
  { value: 'expired', label: '패드만료일 지남' },
  { value: 'in30', label: '패드만료일 30일 이내' },
  { value: 'in60', label: '패드만료일 60일 이내' },
  { value: 'in90', label: '패드만료일 90일 이내' },
  { value: 'in180', label: '패드만료일 180일 이내' },
  { value: 'in365', label: '패드만료일 365일 이내' },
];

const REPLACEMENT_OPTIONS: Array<{ value: ExpiryFilter | 'all'; label: string }> = [
  { value: 'all', label: '교체 전체' },
  { value: 'expired', label: '교체시기 지남' },
  { value: 'in30', label: '30일 이내 교체' },
  { value: 'in60', label: '60일 이내 교체' },
  { value: 'in90', label: '90일 이내 교체' },
  { value: 'in180', label: '180일 이내 교체' },
  { value: 'in365', label: '365일 이내 교체' },
];

const INSPECTION_OPTIONS: Array<{ value: ExpiryFilter | 'all'; label: string }> = [
  { value: 'all', label: '점검 전체' },
  { value: 'never', label: '점검미실시' },
  { value: 'over365', label: '1년이상 미점검' },
  { value: 'over180', label: '6개월 미점검' },
  { value: 'over90', label: '3개월 미점검' },
  { value: 'over60', label: '2개월 미점검' },
  { value: 'over30', label: '1개월 미점검' },
];

const EXTERNAL_DISPLAY_OPTIONS: Array<{ value: ExternalDisplayFilter | 'all'; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'Y', label: 'Y' },
  { value: 'N', label: 'N' },
  { value: 'blocked', label: '차단' },
];

const QUERY_CRITERIA_OPTIONS: Array<{ value: QueryCriteria; label: string }> = [
  { value: 'address', label: '시군구 기준 (설치 주소)' },
  { value: 'jurisdiction', label: '관할보건소 기준' },
];

interface CategorySelectProps {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  options: string[];
}

function CategorySelect({ label, value, onChange, options }: CategorySelectProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-6 lg:h-7 xl:h-8 min-w-[75px] justify-between text-[10px] lg:text-xs xl:text-sm font-normal px-1.5 py-0"
        >
          <span className="truncate">
            {value.length > 0 ? `${label}: ${value.length}` : label}
          </span>
          <ChevronsUpDown className="ml-1 h-2.5 w-2.5 lg:h-3 lg:w-3 xl:h-3.5 xl:w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] lg:w-[220px] xl:w-[240px] p-0" align="start">
        <Command>
          <CommandInput placeholder={`${label} 검색...`} className="text-xs lg:text-sm xl:text-base" />
          <CommandList>
            <CommandEmpty className="text-xs lg:text-sm xl:text-base">결과가 없습니다.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option}
                  onSelect={() => {
                    const newValue = value.includes(option)
                      ? value.filter((v) => v !== option)
                      : [...value, option];
                    onChange(newValue);
                  }}
                  className="text-xs lg:text-sm xl:text-base py-1"
                >
                  <Check
                    className={cn(
                      "mr-1.5 h-3 w-3 lg:h-3.5 lg:w-3.5 xl:h-4 xl:w-4",
                      value.includes(option) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function AEDFilterBar() {
  const { filters, setFilters, viewMode, accessScope, mapCenterRegion } = useAEDData();
  const defaultCriteria: QueryCriteria = useMemo(() =>
    viewMode === 'inspection' ? 'jurisdiction' : 'address',
    [viewMode]
  );
  const [draftFilters, setDraftFilters] = useState<FilterState>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [queryCriteria, setQueryCriteria] = useState<QueryCriteria>(defaultCriteria);
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [isTabletLayout, setIsTabletLayout] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showMobileBadges, setShowMobileBadges] = useState(false);

  // 🔍 디버깅: 컴포넌트 마운트 시 초기 상태 로그
  useEffect(() => {
    console.log('🔍 [AEDFilterBar] 컴포넌트 마운트:', {
      viewMode,
      isMobileLayout,
      isTabletLayout,
      showMobileBadges,
      timestamp: new Date().toISOString()
    });
  }, []);

  // 🔍 디버깅: showMobileBadges 상태 변화 모니터링
  useEffect(() => {
    console.log('🔍 [AEDFilterBar] showMobileBadges 상태 변경:', {
      showMobileBadges,
      viewMode,
      isMobileLayout,
      timestamp: new Date().toISOString()
    });
  }, [showMobileBadges, viewMode, isMobileLayout]);

  useEffect(() => {
    const updateLayoutFlags = () => {
      const width = window.innerWidth;
      const mobile = width < 768;
      setIsMobileLayout(mobile);
      setIsTabletLayout(width >= 768 && width < 1024);
      // PC에서는 항상 필터 펼침, 모바일에서는 기본 접힘
      if (!mobile) {
        setShowFilters(true);
      } else if (mobile && showFilters) {
        setShowFilters(false);
      }
    };

    updateLayoutFlags();
    window.addEventListener('resize', updateLayoutFlags);
    return () => window.removeEventListener('resize', updateLayoutFlags);
  }, []);

  const isCondensedLayout = isMobileLayout || isTabletLayout;

  // 분류별 옵션을 동적으로 로드
  const [category1Options, setCategory1Options] = useState<string[]>([]);
  const [category2Options, setCategory2Options] = useState<string[]>([]);
  const [category3Options, setCategory3Options] = useState<string[]>([]);
  const [categoryHierarchy, setCategoryHierarchy] = useState<Record<string, Record<string, string[]>>>({});
  const [, setCategoriesLoading] = useState(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastAppliedRegionRef = useRef<{ sido: string; gugun: string } | null>(null);

  // ✅ mapRegionChanged 이벤트 제거 - MapView가 더 이상 이 이벤트를 발송하지 않음
  // 드롭다운 선택만 필터 업데이트 (regionSelected 이벤트는 아래 lines 295-346에서 처리)

  // AppHeader에서 발송하는 regionSelected 이벤트 리스너 (Header -> FilterBar)
  useEffect(() => {
    const handleRegionSelected = (event: CustomEvent) => {
      const { sido, gugun } = event.detail;
      console.log('[AEDFilterBar] 📍 regionSelected received from header:', { sido, gugun });

      // "시도"는 전체 선택을 의미함
      if (sido === '시도') {
        // 전체 시도 선택 - 필터 초기화
        setDraftFilters(prev => ({
          ...prev,
          regions: [],
          cities: []
        }) as any);

        (setFilters as any)((prev: any) => ({
          ...prev,
          regionCodes: undefined,
          cityCodes: undefined,
        }));
        return;
      }

      // 지역 라벨 → 코드 변환
      const regionCode = Object.entries(REGION_LABELS).find(([_, label]) => label === sido)?.[0];

      if (!regionCode) {
        console.warn('[AEDFilterBar] Region code not found for:', sido);
        return;
      }

      // draftFilters 업데이트 (드롭다운 UI 동기화)
      setDraftFilters(prev => ({
        ...prev,
        regions: [regionCode],
        cities: gugun === '구군' ? [] : [gugun]
      }) as any);

      // 필터 즉시 적용 (API 호출) - 기존 필터 유지하면서 지역만 업데이트
      (setFilters as any)((prev: any) => ({
        ...prev,
        regionCodes: [sido],
        cityCodes: gugun === '구군' ? undefined : [gugun],
      }));
    };

    window.addEventListener('regionSelected', handleRegionSelected as EventListener);

    return () => {
      window.removeEventListener('regionSelected', handleRegionSelected as EventListener);
    };
  }, [setFilters]);

  // 권한에 따른 허용된 시도 필터링
  const allowedRegions = useMemo(() => {
    const allRegions = Object.entries(REGION_LABELS)
      .filter(([code]) => code !== 'KR') // KR(중앙)은 실제 AED 데이터가 없으므로 제외
      .map(([code, label]) => ({ code, label }) as any);

    // accessScope가 없으면 빈 배열 반환 (권한 미확인 상태)
    if (!accessScope) {
      return [];
    }

    // allowedRegionCodes가 null이면 모든 시도 허용 (전국 권한)
    if (!accessScope.allowedRegionCodes) {
      return allRegions;
    }

    // 권한에 따라 허용된 시도만 필터링
    return allRegions.filter(region =>
      accessScope.allowedRegionCodes!.includes(region.code)
    );
  }, [accessScope]);

  // 선택된 시도에 따른 시군구 옵션 계산 (권한 필터링 포함)
  const cityOptions = useMemo(() => {
    if (!draftFilters.regions || draftFilters.regions.length === 0) {
      return [];
    }
    const cities: Array<{ code: string; name: string }> = [];
    draftFilters.regions.forEach(regionCode => {
      const regionCities = getCitiesByRegion(regionCode);
      regionCities.forEach(city => {
        // 권한 기반 필터링
        if (!accessScope?.allowedCityCodes || accessScope.allowedCityCodes.includes(city.code)) {
          cities.push({ code: city.code, name: city.name });
        }
      });
    });
    return cities;
  }, [draftFilters.regions, accessScope?.allowedCityCodes]);

  useEffect(() => {
    // 실제 DB에서 카테고리 옵션 로드
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/aed-data/categories');
        if (response.ok) {
          const data = await response.json();
          setCategory1Options(data.category_1 || []);
          setCategory2Options(data.category_2 || []);
          setCategory3Options(data.category_3 || []);
          setCategoryHierarchy(data.hierarchical || {});
        } else {
          console.error('Failed to fetch categories');
          // 폴백 데이터
          setCategory1Options(['구비의무기관', '구비의무기관 외']);
          setCategory2Options(['공공시설', '의료기관', '교통시설', '기타']);
          setCategory3Options(['기타']);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
        // 폴백 데이터
        setCategory1Options(['구비의무기관', '구비의무기관 외']);
        setCategory2Options(['공공시설', '의료기관', '교통시설', '기타']);
        setCategory3Options(['기타']);
      } finally {
        setCategoriesLoading(false);
      }
    };

    fetchCategories();
  }, []);

  // 지도 중심 변경 시 필터 초안 업데이트 (MapView -> FilterBar)
  useEffect(() => {
    if (mapCenterRegion) {
      const { sido, gugun } = mapCenterRegion;
      console.log('[AEDFilterBar] 🗺️ Map center changed, updating draft filters:', { sido, gugun });

      // "시도"는 전체 선택을 의미함
      if (sido === '시도') {
        setDraftFilters(prev => ({
          ...prev,
          regions: [],
          cities: []
        }) as any);

        (setFilters as any)((prev: any) => ({ ...prev, regionCodes: undefined, cityCodes: undefined }));
        return;
      }

      const regionCode = Object.entries(REGION_LABELS).find(([_, label]) => label === sido)?.[0];
      if (!regionCode) {
        console.warn('[AEDFilterBar] Region code not found for:', sido);
        return;
      }

      // draftFilters 업데이트 (UI 동기화)
      setDraftFilters(prev => ({
        ...prev,
        regions: [regionCode],
        cities: gugun && gugun !== '구군' ? [gugun] : [],
      }) as any);

      // 필터 즉시 적용 (API 호출)
      (setFilters as any)((prev: any) => ({ ...prev, regionCodes: [sido], cityCodes: gugun && gugun !== '구군' ? [gugun] : undefined }));
    }
  }, [mapCenterRegion, setFilters]);

  // 분류1 선택에 따른 동적 분류2 옵션
  const filteredCategory2Options = useMemo(() => {
    if (!draftFilters.category_1 || draftFilters.category_1.length === 0) {
      return category2Options; // 전체 표시
    }

    const validCat2 = new Set<string>();
    draftFilters.category_1.forEach(cat1 => {
      if (categoryHierarchy[cat1]) {
        Object.keys(categoryHierarchy[cat1]).forEach(cat2 => {
          validCat2.add(cat2);
        });
      }
    });

    return Array.from(validCat2).sort();
  }, [draftFilters.category_1, category2Options, categoryHierarchy]);

  // 분류1, 분류2 선택에 따른 동적 분류3 옵션
  const filteredCategory3Options = useMemo(() => {
    if (!draftFilters.category_1 || draftFilters.category_1.length === 0) {
      return category3Options; // 전체 표시
    }

    const validCat3 = new Set<string>();
    draftFilters.category_1.forEach(cat1 => {
      if (categoryHierarchy[cat1]) {
        const cat2Map = categoryHierarchy[cat1];

        // 분류2가 선택된 경우
        if (draftFilters.category_2 && draftFilters.category_2.length > 0) {
          draftFilters.category_2.forEach(cat2 => {
            if (cat2Map[cat2]) {
              cat2Map[cat2].forEach(cat3 => validCat3.add(cat3));
            }
          });
        } else {
          // 분류2가 선택되지 않은 경우 해당 분류1의 모든 분류3 표시
          Object.values(cat2Map).forEach(cat3Array => {
            cat3Array.forEach(cat3 => validCat3.add(cat3));
          });
        }
      }
    });

    return Array.from(validCat3).sort();
  }, [draftFilters.category_1, draftFilters.category_2, category3Options, categoryHierarchy]);

  // 분류1 변경 시 유효하지 않은 분류2, 분류3 제거
  useEffect(() => {
    if (!draftFilters.category_1 || draftFilters.category_1.length === 0) {
      return; // 분류1이 선택되지 않으면 필터링 안함
    }

    const validCat2 = filteredCategory2Options;
    const validCat3 = filteredCategory3Options;

    let needsUpdate = false;
    const updates: Partial<FilterState> = {};

    // 분류2 검증
    if (draftFilters.category_2 && draftFilters.category_2.length > 0) {
      const filteredCat2 = draftFilters.category_2.filter(cat2 => validCat2.includes(cat2));
      if (filteredCat2.length !== draftFilters.category_2.length) {
        updates.category_2 = filteredCat2;
        needsUpdate = true;
      }
    }

    // 분류3 검증
    if (draftFilters.category_3 && draftFilters.category_3.length > 0) {
      const filteredCat3 = draftFilters.category_3.filter(cat3 => validCat3.includes(cat3));
      if (filteredCat3.length !== draftFilters.category_3.length) {
        updates.category_3 = filteredCat3;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      setDraftFilters(prev => ({ ...prev, ...updates }) as any);
    }
  }, [draftFilters.category_1, filteredCategory2Options, filteredCategory3Options]);

  // 지역 코드 변환 메모이제이션
  const convertedRegionCodes = useMemo(() => {
    let filteredRegions = filters.regionCodes;
    if (filteredRegions) {
      // 먼저 KR(중앙) 제거
      filteredRegions = filteredRegions.filter(code => code !== 'KR');

      // 권한에 따른 필터링
      if (accessScope?.allowedRegionCodes) {
        filteredRegions = filteredRegions.filter(code =>
          accessScope.allowedRegionCodes!.includes(code)
        );
      }
    }

    // 지역 라벨 → 코드 변환 (드롭다운 UI용)
    return filteredRegions?.map(regionLabel => {
      // 이미 코드 형식이면 그대로 사용
      if (regionLabel.length === 3 && regionLabel === regionLabel.toUpperCase()) {
        return regionLabel;
      }
      // 라벨 → 코드 변환
      const code = Object.entries(REGION_LABELS).find(([_, label]) => label === regionLabel)?.[0];
      return code || regionLabel;
    });
  }, [filters.regionCodes, accessScope?.allowedRegionCodes]);

  // 시군구 필터링 메모이제이션
  const filteredCities = useMemo(() => {
    let cities = filters.cityCodes;
    if (cities && accessScope?.allowedCityCodes) {
      cities = cities.filter(code =>
        accessScope.allowedCityCodes!.includes(code)
      );
    }
    return cities;
  }, [filters.cityCodes, accessScope?.allowedCityCodes]);

  // 필터 동기화를 위한 메모이제이션된 객체
  const syncedDraftFilters = useMemo(() => ({
    regions: convertedRegionCodes,
    cities: filteredCities,
    battery_expiry_date: filters.battery_expiry_date,
    patch_expiry_date: filters.patch_expiry_date,
    replacement_date: filters.replacement_date,
    last_inspection_date: filters.last_inspection_date,
    status: filters.status,
    category_1: filters.category_1, // fallback 제거: 사용자 선택 존중
    category_2: filters.category_2,
    category_3: filters.category_3,
    external_display: filters.external_display,
    search: filters.search,
    queryCriteria: filters.queryCriteria || defaultCriteria,
  }), [convertedRegionCodes, filteredCities, filters, defaultCriteria]);

  useEffect(() => {
    console.log('[AEDFilterBar] 🔄 Syncing filters from context to draft:', {
      from: {
        regions: filters.regionCodes,
        cities: filters.cityCodes,
      },
      to: {
        regions: syncedDraftFilters.regions,
        cities: syncedDraftFilters.cities,
      }
    });
    setDraftFilters(syncedDraftFilters);
    setSearchTerm(filters.search || '');
    setQueryCriteria(filters.queryCriteria || defaultCriteria);
  }, [syncedDraftFilters, filters.search, filters.queryCriteria, defaultCriteria]);

  // 컴포넌트 마운트 시 sessionStorage 값으로 draftFilters 초기화 (위치 기반 우선)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const selectedSido = window.sessionStorage.getItem('selectedSido');
    const selectedGugun = window.sessionStorage.getItem('selectedGugun');

    if (!selectedSido || selectedSido === '시도') return;

    console.log('[AEDFilterBar] 📍 Initial sessionStorage sync:', { selectedSido, selectedGugun });

    // 라벨 → 코드 변환
    const regionCode = Object.entries(REGION_LABELS).find(([_, label]) => label === selectedSido)?.[0];

    if (!regionCode) {
      console.warn('[AEDFilterBar] Region code not found for:', selectedSido);
      return;
    }

    // 권한 체크: 허용되지 않은 지역이면 무시
    if (accessScope?.allowedRegionCodes && !accessScope.allowedRegionCodes.includes(regionCode)) {
      console.warn('[AEDFilterBar] Region not allowed for current user:', regionCode);
      return;
    }

    // 구군 권한 체크
    let validGugun: string[] = [];
    if (selectedGugun && selectedGugun !== '구군') {
      // 구군 권한이 있는지 확인 (accessScope.allowedCityCodes가 null이면 모든 구군 허용)
      if (!accessScope?.allowedCityCodes || accessScope.allowedCityCodes.includes(selectedGugun)) {
        validGugun = [selectedGugun];
      } else {
        console.warn('[AEDFilterBar] City not allowed for current user:', selectedGugun);
      }
    }

    // draftFilters 초기화 (드롭다운 동기화)
    setDraftFilters(prev => ({
      ...prev,
      regions: [regionCode],
      cities: validGugun,
    }) as any);

    console.log('[AEDFilterBar] ✅ Initial draft filters updated:', { regionCode, gugun: validGugun });
  }, []); // 마운트 시 한 번만 실행

  const normalizeExpiryFilter = (value?: ExpiryFilter | 'all') => (value && value !== 'all' ? value : undefined);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (draftFilters.regions && draftFilters.regions.length > 0) count += 1;
    if (draftFilters.cities && draftFilters.cities.length > 0) count += 1;
    if (draftFilters.battery_expiry_date) count += 1;
    if (draftFilters.patch_expiry_date) count += 1;
    if (draftFilters.replacement_date) count += 1;
    if (draftFilters.last_inspection_date) count += 1;
    if (draftFilters.status && draftFilters.status.length > 0) count += 1;
    if (draftFilters.category_1 && draftFilters.category_1.length > 0) count += 1;
    if (draftFilters.category_2 && draftFilters.category_2.length > 0) count += 1;
    if (draftFilters.category_3 && draftFilters.category_3.length > 0) count += 1;
    if (draftFilters.external_display) count += 1;
    if (searchTerm.trim().length > 0) count += 1;
    if (queryCriteria && queryCriteria !== defaultCriteria) count += 1;
    return count;
  }, [draftFilters, searchTerm, queryCriteria, defaultCriteria]);

  const filterBadgesData = useMemo<FilterState>(() => {
    const next: FilterState = { ...draftFilters };
    if (queryCriteria !== defaultCriteria) {
      next.queryCriteria = queryCriteria;
    } else {
      delete next.queryCriteria;
    }
    return next;
  }, [draftFilters, queryCriteria, defaultCriteria]);

  const filtersLayoutClass = isCondensedLayout
    ? 'flex flex-col gap-3'
    : 'flex flex-nowrap gap-3 overflow-x-auto';

  const handleApply = useCallback(() => {
    // 사용자가 필터를 수정했음을 기록 (세션 스토리지)
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('aed_filters_user_modified', 'true');
    }

    // sessionStorage에서 시도/구군 값 읽기 (헤더의 RegionFilter에서 설정한 값)
    const selectedSido = typeof window !== 'undefined' ? window.sessionStorage.getItem('selectedSido') : null;
    const selectedGugun = typeof window !== 'undefined' ? window.sessionStorage.getItem('selectedGugun') : null;

    // 라벨 → 코드 변환 (sessionStorage는 라벨('대구')을 저장)
    let regionCodesToUse = draftFilters.regions;
    if (selectedSido && selectedSido !== '시도') {
      const regionCode = Object.entries(REGION_LABELS).find(([_, label]) => label === selectedSido)?.[0];
      if (regionCode) {
        // 권한 체크: 시도 접근 권한 검증
        if (accessScope?.allowedRegionCodes && !accessScope.allowedRegionCodes.includes(regionCode)) {
          console.error('[AEDFilterBar] Access denied: User cannot access region:', selectedSido);
          alert(`접근 권한이 없는 지역입니다: ${selectedSido}`);
          return;
        }
        regionCodesToUse = [regionCode];
      }
    }

    // 코드 → 라벨 배열로 변환 (API route는 라벨 배열을 기대: ['서울'], ['대구'] 등)
    const regionLabels = regionCodesToUse?.map(code => REGION_LABELS[code]).filter(Boolean);

    // 구군 필터링 ('구군' 기본값 및 '전체' 제거)
    const cityToUse = (selectedGugun && selectedGugun !== '구군' && selectedGugun !== '전체')
      ? [selectedGugun]
      : draftFilters.cities;

    // 권한 체크: 구군 접근 권한 검증 ('전체' 옵션은 제외)
    if (cityToUse && cityToUse.length > 0 && accessScope?.allowedCityCodes) {
      const citiesToCheck = cityToUse.filter(city => city !== '전체'); // '전체'는 권한 검사에서 제외
      const unauthorizedCities = citiesToCheck.filter(city => !accessScope.allowedCityCodes!.includes(city));
      if (unauthorizedCities.length > 0) {
        console.error('[AEDFilterBar] Access denied: User cannot access cities:', unauthorizedCities);
        alert(`접근 권한이 없는 시군구입니다: ${unauthorizedCities.join(', ')}`);
        return;
      }
    }

    console.log('[AEDFilterBar] handleApply - Region conversion:', {
      selectedSido,
      regionCode: regionCodesToUse?.[0],
      regionLabels,
      selectedGugun,
      cityToUse,
      accessScope: {
        allowedRegions: accessScope?.allowedRegionCodes,
        allowedCities: accessScope?.allowedCityCodes,
      }
    });

    // 헤더에서 선택한 값이 있으면 우선 사용, 없으면 draftFilters 사용
    const finalFilters = {
      regionCodes: regionLabels,
      cityCodes: cityToUse,
      battery_expiry_date: normalizeExpiryFilter(draftFilters.battery_expiry_date),
      patch_expiry_date: normalizeExpiryFilter(draftFilters.patch_expiry_date),
      replacement_date: normalizeExpiryFilter(draftFilters.replacement_date),
      last_inspection_date: normalizeExpiryFilter(draftFilters.last_inspection_date),
      status: draftFilters.status,
      category_1: draftFilters.category_1,
      category_2: draftFilters.category_2,
      category_3: draftFilters.category_3,
      external_display: draftFilters.external_display || undefined,
      search: searchTerm.trim() || undefined,
      queryCriteria: queryCriteria,
    };

    // 필터 적용
    setFilters(finalFilters);

    // 지도 이동은 데이터 로드 후 자동으로 처리됨 (regionSelected 이벤트 발송 제거)
    // 이유: handleApply에서 이벤트를 발송하면 regionSelected 핸들러가 트리거되어
    // 필터가 덮어씌워지는 문제 발생
  }, [draftFilters, searchTerm, queryCriteria, setFilters, accessScope]);

  const handleClear = useCallback(() => {
    // 초기화 시 세션 플래그 제거 (다음 페이지 로드 시 기본값 다시 적용)
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('aed_filters_user_modified');
    }

    // 모든 필터를 초기화 (사용자 선택 존중)
    setDraftFilters({
      queryCriteria: defaultCriteria
    });
    setSearchTerm('');
    setQueryCriteria(defaultCriteria);
    setFilters({
      queryCriteria: defaultCriteria
    });
  }, [defaultCriteria, setFilters]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleApply();
    }
  }, [handleApply]);

  const hasActiveFilters = activeFilterCount > 0;

  return (
    <div className="bg-gray-900 border-b border-gray-800 overflow-visible" data-filter-bar>
      {/* 반응형 레이아웃: 모바일/태블릿/PC 대응 - 모바일 padding 제거 */}
      <div className={cn(
        "py-0.5 sm:py-1.5",
        isMobileLayout ? "space-y-1 sm:space-y-2 px-0" : "flex items-center gap-0.5 overflow-x-auto overflow-y-hidden px-2 flex-nowrap"
      )}>
        {/* 현장점검 모드에서는 검색창과 버튼만 표시 */}
        {viewMode === 'inspection' ? (
          <div className="flex items-center gap-1 w-full min-w-0">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-1.5 top-1/2 h-3 w-3 lg:h-3.5 lg:w-3.5 xl:h-4 xl:w-4 -translate-y-1/2 text-gray-400 flex-shrink-0" />
              <Input
                type="text"
                placeholder="검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-5 h-6 lg:h-7 xl:h-8 text-[10px] lg:text-xs xl:text-sm w-full min-w-0 pr-1"
              />
            </div>

            {/* 초기화 버튼 */}
            <Button
              variant="outline"
              onClick={handleClear}
              disabled={!hasActiveFilters}
              size="sm"
              className="h-6 lg:h-7 xl:h-8 px-1.5 sm:px-2 text-[10px] lg:text-xs xl:text-sm flex-shrink-0 whitespace-nowrap"
            >
              초기화
            </Button>

            {/* 조회 버튼 */}
            <Button
              onClick={handleApply}
              size="sm"
              className="h-6 lg:h-7 xl:h-8 px-1.5 sm:px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex-shrink-0 text-[10px] lg:text-xs xl:text-sm whitespace-nowrap"
            >
              조회
            </Button>
          </div>
        ) : (
          <>
        {/* 첫 번째 줄 (모바일) 또는 인라인 (PC) - 모바일에서 균등 분배 */}
        <div className={cn("flex items-center", isMobileLayout ? "w-full" : "flex-shrink-0 gap-0.5")}>
          {/* 조회기준: 드롭다운 */}
          <Select
            value={queryCriteria}
            onValueChange={(value) => setQueryCriteria(value as QueryCriteria)}
          >
            <SelectTrigger className={cn("h-6 lg:h-7 xl:h-8 text-[10px] lg:text-xs xl:text-sm px-0.5 py-0 border-r rounded-none", isMobileLayout ? "flex-1" : "w-[40px] lg:w-[55px] xl:w-[80px]")}>
              <SelectValue className="truncate">
                {queryCriteria === 'address' ? (isMobileLayout ? '기준' : '구분') : '보건소'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="address" className="text-[10px] lg:text-xs xl:text-sm py-1">구군기준</SelectItem>
              <SelectItem value="jurisdiction" className="text-[10px] lg:text-xs xl:text-sm py-1">관할보건소기준</SelectItem>
            </SelectContent>
          </Select>

          {/* 분류1 */}
          <Select
            value={
              !draftFilters.category_1 || draftFilters.category_1.length === 0
                ? 'all'
                : draftFilters.category_1.length === 1 && draftFilters.category_1[0] === '구비의무기관'
                ? 'mandatory'
                : draftFilters.category_1.length === 1 && draftFilters.category_1[0] === '구비의무기관 외'
                ? 'non-mandatory'
                : 'all'
            }
            onValueChange={(value) => {
              if (typeof window !== 'undefined') {
                window.sessionStorage.setItem('aed_filters_user_modified', 'true');
              }
              setDraftFilters((prev) => ({
                ...prev,
                category_1:
                  value === 'all'
                    ? undefined
                    : value === 'mandatory'
                    ? ['구비의무기관']
                    : ['구비의무기관 외'],
              }) as any);
            }}
          >
            <SelectTrigger className={cn("h-6 lg:h-7 xl:h-8 text-[10px] lg:text-xs xl:text-sm px-0.5 py-0 border-r rounded-none", isMobileLayout ? "flex-1" : "w-[42px] lg:w-[50px] xl:w-[70px]")}>
              <SelectValue className="truncate">
                {(() => {
                  const value = !draftFilters.category_1 || draftFilters.category_1.length === 0
                    ? 'all'
                    : draftFilters.category_1.length === 1 && draftFilters.category_1[0] === '구비의무기관'
                    ? 'mandatory'
                    : draftFilters.category_1.length === 1 && draftFilters.category_1[0] === '구비의무기관 외'
                    ? 'non-mandatory'
                    : 'all';

                  if (value === 'all') return '분류1';
                  if (value === 'mandatory') return '의무';
                  return '외';
                })()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-[10px] lg:text-xs xl:text-sm py-1">전체</SelectItem>
              <SelectItem value="mandatory" className="text-[10px] lg:text-xs xl:text-sm py-1">구비의무기관</SelectItem>
              <SelectItem value="non-mandatory" className="text-[10px] lg:text-xs xl:text-sm py-1">구비의무기관 외</SelectItem>
            </SelectContent>
          </Select>

          {/* 분류2 */}
          <Select
            value={draftFilters.category_2?.[0] || 'all'}
            onValueChange={(value) => {
              if (typeof window !== 'undefined') {
                window.sessionStorage.setItem('aed_filters_user_modified', 'true');
              }
              setDraftFilters((prev) => ({
                ...prev,
                category_2: value === 'all' ? undefined : [value],
              }) as any);
            }}
          >
            <SelectTrigger
              className={cn("h-6 lg:h-7 xl:h-8 text-[10px] lg:text-xs xl:text-sm px-0.5 py-0 border-r rounded-none", isMobileLayout ? "flex-1" : "w-[40px] lg:w-[50px] xl:w-[70px]")}
              title={(draftFilters.category_2?.[0] && draftFilters.category_2[0] !== 'all') ? draftFilters.category_2[0] : '분류2'}
            >
              <SelectValue className="truncate overflow-hidden text-ellipsis whitespace-nowrap block">
                {(() => {
                  const value = draftFilters.category_2?.[0];
                  if (!value || value === 'all') return '분류2';
                  // PC에서는 최대 4글자만 표시
                  return isMobileLayout ? value : (value.length > 4 ? value.substring(0, 4) + '..' : value);
                })()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-[10px] lg:text-xs xl:text-sm py-1">전체</SelectItem>
              {filteredCategory2Options.map((option) => (
                <SelectItem key={option} value={option} className="text-[10px] lg:text-xs xl:text-sm py-1">
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 분류3 - 모바일에서 숨김 */}
          {!isMobileLayout && (
            <Select
              value={draftFilters.category_3?.[0] || 'all'}
              onValueChange={(value) => {
                if (typeof window !== 'undefined') {
                  window.sessionStorage.setItem('aed_filters_user_modified', 'true');
                }
                setDraftFilters((prev) => ({
                  ...prev,
                  category_3: value === 'all' ? undefined : [value],
                }) as any);
              }}
            >
              <SelectTrigger
                className="h-6 lg:h-7 xl:h-8 text-[10px] lg:text-xs xl:text-sm px-0.5 py-0 border-r rounded-none w-[40px] lg:w-[50px] xl:w-[70px]"
                title={(draftFilters.category_3?.[0] && draftFilters.category_3[0] !== 'all') ? draftFilters.category_3[0] : '분류3'}
              >
                <SelectValue className="truncate overflow-hidden text-ellipsis whitespace-nowrap block">
                  {(() => {
                    const value = draftFilters.category_3?.[0];
                    if (!value || value === 'all') return '분류3';
                    // PC에서는 최대 4글자만 표시
                    return value.length > 4 ? value.substring(0, 4) + '..' : value;
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-[10px] lg:text-xs xl:text-sm py-1">전체</SelectItem>
                {filteredCategory3Options.map((option) => (
                  <SelectItem key={option} value={option} className="text-[10px] lg:text-xs xl:text-sm py-1">
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* 배터리 */}
          <ExpirySelectControl
            label="배터리만료일"
            shortLabel="배터리"
            value={draftFilters.battery_expiry_date || 'all'}
            options={BATTERY_EXPIRY_OPTIONS}
            isMobile={isMobileLayout}
            withBorder={true}
            onChange={(value: string) => setDraftFilters((prev) => ({
              ...prev,
              battery_expiry_date: value === 'all' ? undefined : value as ExpiryFilter,
            }))}
          />

          {/* 패드 */}
          <ExpirySelectControl
            label="패드만료일"
            shortLabel="패드"
            value={draftFilters.patch_expiry_date || 'all'}
            options={PATCH_EXPIRY_OPTIONS}
            isMobile={isMobileLayout}
            withBorder={true}
            onChange={(value: string) => setDraftFilters((prev) => ({
              ...prev,
              patch_expiry_date: value === 'all' ? undefined : value as ExpiryFilter,
            }))}
          />

          {/* 교체 */}
          <ExpirySelectControl
            label="교체예정"
            shortLabel="교체"
            value={draftFilters.replacement_date || 'all'}
            options={REPLACEMENT_OPTIONS}
            isMobile={isMobileLayout}
            withBorder={true}
            onChange={(value: string) => setDraftFilters((prev) => ({
              ...prev,
              replacement_date: value === 'all' ? undefined : value as ExpiryFilter,
            }))}
          />

          {/* 점검 */}
          <ExpirySelectControl
            label="최근점검"
            shortLabel="점검"
            value={draftFilters.last_inspection_date || 'all'}
            options={INSPECTION_OPTIONS}
            isMobile={isMobileLayout}
            withBorder={false}
            onChange={(value: string) => setDraftFilters((prev) => ({
              ...prev,
              last_inspection_date: value === 'all' ? undefined : value as ExpiryFilter,
            }))}
          />
        </div>

        {/* 필터 섹션 (PC에서만 인라인 표시) */}
        {!isMobileLayout && showFilters && (
          <>
            {/* 배터리/패드/교체예정일/월간점검은 이미 위 첫 번째 줄에 표시되므로 PC 중복 제거 */}

            {/* PC에서도 외부표출 필터 표시 (드롭다운) */}
            <div className="flex items-center gap-0.5 border-r border-gray-700 pr-0.5 flex-shrink-0">
              <Select
                value={draftFilters.external_display || 'all'}
                onValueChange={(value) => setDraftFilters((prev) => ({
                  ...prev,
                  external_display: value === 'all' ? undefined : value as ExternalDisplayFilter | undefined,
                }))}
              >
                <SelectTrigger className="h-6 lg:h-7 xl:h-8 w-[55px] lg:w-[65px] xl:w-[85px] text-[10px] lg:text-xs xl:text-sm px-0.5 py-0">
                  <SelectValue className="truncate">
                    {draftFilters.external_display
                      ? (EXTERNAL_DISPLAY_OPTIONS.find(opt => opt.value === draftFilters.external_display)?.label || '외부표출')
                      : '외부표출'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {EXTERNAL_DISPLAY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-[10px] lg:text-xs xl:text-sm py-1">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

          </>
        )}

        {/* 검색창 + 버튼들 - PC에서만 표시 (모바일은 하단으로 이동) */}
        {!isMobileLayout && (
          <div className="flex items-center gap-0.5 ml-auto flex-shrink-0 min-w-0">
            <div className="relative w-[90px] lg:w-[110px] xl:w-[140px] min-w-0">
              <Search className="absolute left-1 top-1/2 h-3 w-3 lg:h-3.5 lg:w-3.5 xl:h-4 xl:w-4 -translate-y-1/2 text-gray-400 flex-shrink-0" />
              <Input
                type="text"
                placeholder="검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-4 lg:pl-5 xl:pl-6 h-6 lg:h-7 xl:h-8 text-[10px] lg:text-xs xl:text-sm w-full min-w-0 pr-1"
              />
            </div>

            {/* 초기화 버튼 - 크기 축소 */}
            <Button
              variant="outline"
              onClick={handleClear}
              disabled={!hasActiveFilters}
              size="sm"
              className="h-6 lg:h-7 xl:h-8 px-1 lg:px-1.5 xl:px-2 text-[10px] lg:text-xs xl:text-sm flex-shrink-0 whitespace-nowrap"
            >
              초기화
            </Button>

            {/* 조회 버튼 - 크기 축소 */}
            <Button
              onClick={handleApply}
              size="sm"
              className="h-6 lg:h-7 xl:h-8 px-1 lg:px-1.5 xl:px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex-shrink-0 text-[10px] lg:text-xs xl:text-sm whitespace-nowrap"
            >
              조회
            </Button>
          </div>
        )}
          </>
        )}
      </div>

      {/* 모바일 필터 컨트롤 - admin 모드에서만 표시 */}
      {isMobileLayout && viewMode !== 'inspection' && (
        <div className="px-2 pb-2">
          <div className="space-y-1">
            {false && (
              <FilterSection
                title="지역"
                forceOpen={false}
                defaultOpen={true}
                className=""
              >
                <div className="flex gap-1">
                  <RegionMultiSelect
                    selected={draftFilters.regions || []}
                    options={allowedRegions}
                    onToggle={(code: string, checked: boolean) => {
                      if (checked && accessScope?.allowedRegionCodes && !accessScope.allowedRegionCodes.includes(code)) {
                        console.warn(`Region code ${code} is not allowed for current user`);
                        return;
                      }

                      setDraftFilters((prev) => {
                        const newRegions = checked
                          ? [...(prev.regions || []), code]
                          : (prev.regions || []).filter((r) => r !== code);

                        const validCityCodes = new Set<string>();
                        newRegions.forEach(regionCode => {
                          const regionCities = getCitiesByRegion(regionCode);
                          regionCities.forEach(city => {
                            if (!accessScope?.allowedCityCodes || accessScope.allowedCityCodes.includes(city.code)) {
                              validCityCodes.add(city.code);
                            }
                          });
                        });

                        const filteredCities = newRegions.length === 0
                          ? []
                          : (prev.cities || []).filter(cityCode => validCityCodes.has(cityCode));

                        return {
                          ...prev,
                          regions: newRegions,
                          cities: filteredCities,
                        };
                      });
                    }}
                    triggerLabel={
                      draftFilters.regions && draftFilters.regions.length > 0
                        ? `시도: ${draftFilters.regions.length}개`
                        : '시도'
                    }
                  />

                  {cityOptions.length > 0 && (
                    <CityMultiSelect
                      selected={draftFilters.cities || []}
                      options={cityOptions}
                      onToggle={(code: string, checked: boolean) => {
                        if (checked && accessScope?.allowedCityCodes && !accessScope.allowedCityCodes.includes(code)) {
                          console.warn(`City code ${code} is not allowed for current user`);
                          return;
                        }
                        setDraftFilters((prev) => ({
                          ...prev,
                          cities: checked
                            ? [...(prev.cities || []), code]
                            : (prev.cities || []).filter((c) => c !== code),
                        }) as any);
                      }}
                      triggerLabel={
                        draftFilters.cities && draftFilters.cities.length > 0
                          ? `시군구: ${draftFilters.cities.length}개`
                          : '시군구'
                      }
                    />
                  )}
                </div>
              </FilterSection>
            )}

            {/* ✅ 분류2, 분류3, 배터리, 패드, 교체예정일, 월간점검은 상단 첫 번째 줄에 이미 표시되므로 모바일 섹션에서 제거 */}

            {/* 검색창 + 버튼들 - admin 모드에서만 모바일 하단에 배치 (inspection은 상단에 표시) */}
            {(viewMode as any) !== 'inspection' && (
              <div className="pt-1 px-0">
                <div className="flex items-center gap-0.5">
                  {/* 필터 배지 - 좌측에 배치, 필요한 만큼만 공간 차지 (모바일에서만) */}
                  {hasActiveFilters && (
                    <div className="lg:hidden overflow-x-auto scrollbar-hide flex-shrink-0 max-w-[50%]">
                      <FilterBadges
                        filters={filterBadgesData}
                        actions={{
                          onRemove: (key: keyof FilterState, value?: string) => {
                            if (key === 'search') {
                              setSearchTerm('');
                              setDraftFilters((prev) => {
                                const { search, ...rest } = prev;
                                void search;
                                return rest;
                              });
                            } else if (key === 'queryCriteria') {
                              setQueryCriteria(defaultCriteria);
                              setDraftFilters((prev) => {
                                const next = { ...prev };
                                delete next.queryCriteria;
                                return next;
                              });
                            } else {
                              setDraftFilters((prev) => {
                                const next = { ...prev };
                                if (Array.isArray(next[key])) {
                                  const arr = next[key] as string[];
                                  const updated = value ? arr.filter((v) => v !== value) : [];
                                  if (updated.length > 0) {
                                    next[key] = updated as never;
                                  } else {
                                    delete next[key];
                                  }
                                } else {
                                  delete next[key];
                                }
                                return next;
                              });
                            }
                          },
                          onClear: handleClear
                        }}
                      />
                    </div>
                  )}

                  {/* 검색창 - 반응형: 모바일에서는 남은 공간 차지, PC에서는 여유있게 */}
                  <div className="relative flex-1 min-w-[60px]">
                    <Search className="absolute left-2 lg:left-1.5 top-1/2 h-4 w-4 lg:h-3.5 lg:w-3.5 xl:h-4 xl:w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="검색..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="pl-8 lg:pl-5 h-10 lg:h-7 xl:h-8 text-sm lg:text-xs xl:text-sm w-full pr-2 lg:pr-1"
                    />
                  </div>

                  {/* 초기화 버튼 - 우측 고정 */}
                  <Button
                    variant="outline"
                    onClick={handleClear}
                    disabled={!hasActiveFilters}
                    size="sm"
                    className="h-10 lg:h-7 xl:h-8 px-3 lg:px-1.5 xl:px-2 text-sm lg:text-xs xl:text-sm flex-shrink-0 whitespace-nowrap"
                  >
                    초기화
                  </Button>

                  {/* 조회 버튼 - 우측 고정 */}
                  <Button
                    onClick={handleApply}
                    size="sm"
                    className="h-10 lg:h-7 xl:h-8 px-3 lg:px-1.5 xl:px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex-shrink-0 text-sm lg:text-xs xl:text-sm whitespace-nowrap"
                  >
                    조회
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 필터 배지 - PC에서만 하단에 표시 (모바일은 검색창 옆에 통합) */}
      {hasActiveFilters && viewMode !== 'inspection' && (
        <div className="border-t border-gray-800 hidden lg:block">
          <div className="px-3 py-2">
            <FilterBadges
              filters={filterBadgesData}
              actions={{
                onRemove: (key: keyof FilterState, value?: string) => {
                  if (key === 'search') {
                    setSearchTerm('');
                    setDraftFilters((prev) => {
                      const { search, ...rest } = prev;
                      void search;
                      return rest;
                    });
                  } else if (key === 'queryCriteria') {
                    setQueryCriteria(defaultCriteria);
                    setDraftFilters((prev) => {
                      const next = { ...prev };
                      delete next.queryCriteria;
                      return next;
                    });
                  } else {
                    setDraftFilters((prev) => {
                      const next = { ...prev };
                      if (Array.isArray(next[key])) {
                        const arr = next[key] as string[];
                        const updated = value ? arr.filter((v) => v !== value) : [];
                        if (updated.length > 0) {
                          next[key] = updated as never;
                        } else {
                          delete next[key];
                        }
                      } else {
                        delete next[key];
                      }
                      return next;
                    });
                  }
                },
                onClear: handleClear
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface FilterSectionProps {
  title: string;
  children: ReactNode;
  forceOpen?: boolean;
  defaultOpen?: boolean;
  className?: string;
}

function FilterSection({
  title,
  children,
  forceOpen = false,
  defaultOpen = true,
  className,
}: FilterSectionProps) {
  const normalizedId = title.replace(/[^a-zA-Z0-9가-힣]+/g, '-');
  const sectionId = `filter-section-${normalizedId}`.toLowerCase();

  return (
    <div className={cn('border-b border-gray-800 last:border-b-0', className)}>
      <div className="px-1.5 py-0.5">
        <div className="text-[9px] font-medium text-gray-500 mb-0.5">{title}</div>
        <div id={sectionId}>
          {children}
        </div>
      </div>
    </div>
  );
}

// 기존 컴포넌트들
interface RegionMultiSelectProps {
  selected: string[];
  options: Array<{ code: string; label: string }>;
  onToggle: (code: string, checked: boolean) => void;
  triggerLabel: string;
}

function RegionMultiSelect({ selected, options, onToggle, triggerLabel }: RegionMultiSelectProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-6 lg:h-7 xl:h-8 min-w-[65px] justify-between text-[10px] lg:text-xs xl:text-sm font-normal px-1.5 py-0"
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronsUpDown className="ml-1 h-2.5 w-2.5 lg:h-3 lg:w-3 xl:h-3.5 xl:w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[180px] lg:w-[200px] xl:w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder="지역 검색..." className="text-xs lg:text-sm xl:text-base h-7 lg:h-8 xl:h-9" />
          <CommandList>
            <CommandEmpty className="text-xs lg:text-sm xl:text-base">결과가 없습니다.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.code}
                  onSelect={() => onToggle(option.code, !selected.includes(option.code))}
                  className="text-xs lg:text-sm xl:text-base py-1"
                >
                  <Check
                    className={cn(
                      "mr-1.5 h-3 w-3 lg:h-3.5 lg:w-3.5 xl:h-4 xl:w-4",
                      selected.includes(option.code) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface ExpirySelectControlProps {
  label: string;
  shortLabel?: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  isMobile?: boolean;
  withBorder?: boolean;
}

function ExpirySelectControl({ label, shortLabel, value, options, onChange, isMobile, withBorder = true }: ExpirySelectControlProps) {
  // 선택된 옵션 찾기
  const selectedOption = options.find(opt => opt.value === value);
  const displayLabel = isMobile ? (shortLabel || label) : label;

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        className={cn(
          "h-6 lg:h-7 xl:h-8 text-[10px] lg:text-xs xl:text-sm px-0.5 py-0",
          withBorder && "border-r rounded-none",
          isMobile ? "flex-1" : "w-[40px] lg:w-[50px] xl:w-[70px]"
        )}
        title={label}
      >
        <SelectValue className="truncate">
          {(() => {
            if (value === 'all') return displayLabel;
            const label = selectedOption?.label || displayLabel;
            // PC에서는 짧게 표시 (예: "30일 이내" -> "30일")
            if (!isMobile && label) {
              if (label.includes('배터리')) return label.replace('배터리만료일 ', '');
              if (label.includes('패드')) return label.replace('패드만료일 ', '');
              if (label.includes('이내')) return label.replace(' 이내', '');
              if (label.includes('미점검')) return label.replace(' 미점검', '');
            }
            return label;
          })()}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className="text-[10px] lg:text-xs xl:text-sm py-1">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface CityMultiSelectProps {
  selected: string[];
  options: Array<{ code: string; name: string }>;
  onToggle: (code: string, checked: boolean) => void;
  triggerLabel: string;
}

function CityMultiSelect({ selected, options, onToggle, triggerLabel }: CityMultiSelectProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-6 lg:h-7 xl:h-8 min-w-[75px] justify-between text-[10px] lg:text-xs xl:text-sm font-normal px-1.5 py-0"
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronsUpDown className="ml-1 h-2.5 w-2.5 lg:h-3 lg:w-3 xl:h-3.5 xl:w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] lg:w-[220px] xl:w-[240px] p-0" align="start">
        <Command>
          <CommandInput placeholder="시군구 검색..." className="text-xs lg:text-sm xl:text-base h-7 lg:h-8 xl:h-9" />
          <CommandList>
            <CommandEmpty className="text-xs lg:text-sm xl:text-base">결과가 없습니다.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.code}
                  onSelect={() => onToggle(option.code, !selected.includes(option.code))}
                  className="text-xs lg:text-sm xl:text-base py-1"
                >
                  <Check
                    className={cn(
                      "mr-1.5 h-3 w-3 lg:h-3.5 lg:w-3.5 xl:h-4 xl:w-4",
                      selected.includes(option.code) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
