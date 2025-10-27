'use client';
import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, ReactNode } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { UserProfile } from '@/packages/types';
import { resolveAccessScope, UserAccessScope } from '@/lib/auth/access-control';
import { ParsedFilters, buildQueryString, parseQueryParams } from '@/lib/utils/query-parser';
import { AEDDevice, AEDDataResponse } from '@/packages/types/aed';
import { ROLE_QUERY_CRITERIA, QueryCriteria } from '@/lib/constants/query-criteria';
import { getCitiesByRegion } from '@/lib/constants/cities';
import {
  EXPIRY_FILTER_LABELS,
  DEVICE_STATUS_LABELS,
  EXTERNAL_DISPLAY_FILTER_LABELS,
} from '@/lib/constants/aed-filters';
import { REGION_CODE_TO_LABEL } from '@/lib/constants/regions';
import { getCityName } from '@/lib/constants/cities';
import { ToastProvider } from '@/components/ui/Toast';
import { getDefaultFilters, useAEDFiltersStore, withPaginationReset } from '@/lib/state/aed-filters-store';
import { useCurrentSnapshotId } from '@/lib/hooks/use-aed-data-cache';

interface AEDDataContextType {
  data?: AEDDevice[];
  isLoading: boolean;
  isFetching: boolean;
  error?: string;
  summary?: AEDDataResponse['summary'];
  filters: ParsedFilters;
  setFilters: (filters: ParsedFilters) => void;
  pagination?: {
    page: number;
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
  accessScope?: UserAccessScope;
  filterCapabilities?: AEDDataResponse['filters']['available'];
  appliedFilters?: AEDDataResponse['filters']['applied'];
  enforcedFilters?: AEDDataResponse['filters']['enforced'];
  appliedFilterBadges: Array<{ key: string; label: string; value: string; rawValue?: string; removable: boolean }>;
  enforcedFilterLabels: string[];
  userProfile: UserProfile;
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
  refetch: () => void;
  nextPage: () => void;
  prevPage: () => void;
  resetFilters: () => void;
  viewMode: 'admin' | 'inspection';
  mapCenterRegion?: { sido: string; gugun: string };
  setMapCenterRegion: (region: { sido: string; gugun: string } | undefined) => void;
  // ✅ 일정추가된 장비 목록 (includeSchedule=true일 때만 존재)
  scheduled?: string[];
}

const AEDDataContext = createContext<AEDDataContextType | undefined>(undefined);

interface AEDDataProviderProps {
  children: ReactNode;
  initialFilters: Record<string, string | string[] | undefined>;
  userProfile: UserProfile;
  viewMode?: 'admin' | 'inspection';
  // ✅ 일정추가 정보 포함 여부
  includeSchedule?: boolean;
}

async function fetcher(url: string): Promise<AEDDataResponse> {
  console.log('[AEDDataProvider fetcher] Fetching URL:', url);
  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json();
    const errorMessage = error.error || 'Failed to fetch data';
    const statusCode = response.status;

    // 403 에러에 대한 친화적인 메시지
    if (statusCode === 403) {
      throw new Error(`권한 없음: ${errorMessage}`);
    }

    throw new Error(errorMessage);
  }
  return response.json();
}

const arraysEqual = (a?: string[] | null, b?: string[] | null) => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  return a.every((value) => b.includes(value));
};

// ✅ 커서 히스토리 메모리 누수 방지
const MAX_CURSOR_HISTORY = 100;

export function AEDDataProvider({ children, initialFilters, userProfile, viewMode = 'admin', includeSchedule = false }: AEDDataProviderProps) {
  console.log('[AEDDataProvider] viewMode received:', viewMode, 'includeSchedule:', includeSchedule);
  const [accessScope, setAccessScope] = useState<UserAccessScope>();
  const filters = useAEDFiltersStore((state) => state.filters);
  const setFiltersInStore = useAEDFiltersStore((state) => state.setFilters);
  const resetFiltersInStore = useAEDFiltersStore((state) => state.resetFilters);
  const cursorHistoryRef = useRef<string[]>([]);

  // 지도 중심 지역 상태 (MapView ↔ FilterBar 동기화용)
  const [mapCenterRegion, setMapCenterRegion] = useState<{ sido: string; gugun: string } | undefined>();

  // 🚫 기본 시도 설정 제거 - 사용자 위치 기반으로 자동 설정됨
  const defaultRegionFromOrg = useMemo(() => {
    // 조직 기반 지역 기본값 제거
    return undefined;
  }, [userProfile.email, userProfile.organization?.name]);

  // 🚫 기본 구군 설정 제거 - 사용자 위치 기반으로 자동 설정됨
  const defaultCityFromRegion = useMemo(() => {
    return undefined;
  }, []);

  const defaultCriteria = useMemo(
    () => ROLE_QUERY_CRITERIA[userProfile.role]?.defaultCriteria || 'address',
    [userProfile.role],
  );

  const initialFilterSnapshot = useMemo(() => {
    console.log('[AEDDataProvider useMemo] initialFilters:', JSON.stringify(initialFilters));
    const parsed = parseInitialFilters(initialFilters, userProfile.role);
    console.log('[AEDDataProvider useMemo] Parsed filters:', JSON.stringify(parsed));
    if (!parsed.queryCriteria) {
      parsed.queryCriteria = defaultCriteria as QueryCriteria;
    }

    // 🚫 시도/구군 기본값 설정 제거 - AEDDataPageClient에서 현재 위치 기반으로 설정

    const defaultFilters = getDefaultFilters(parsed);
    console.log('[AEDDataProvider useMemo] Default filters:', JSON.stringify(defaultFilters));
    return defaultFilters;
  }, [defaultCriteria, defaultRegionFromOrg, defaultCityFromRegion, initialFilters, userProfile.role]);

  const hasInitializedFilters = useRef(false);

  // Initialize store in useEffect (runs after first render but before paint)
  useEffect(() => {
    if (hasInitializedFilters.current) {
      return;
    }
    console.log('[AEDDataProvider useEffect] Initializing filters:', JSON.stringify(initialFilterSnapshot));
    setFiltersInStore(initialFilterSnapshot);
    cursorHistoryRef.current = [];
    hasInitializedFilters.current = true;
  }, [initialFilterSnapshot, setFiltersInStore]);

  useEffect(() => {
    try {
      const scope = resolveAccessScope(userProfile);
      setAccessScope(scope);
      cursorHistoryRef.current = [];
    } catch (error) {
      console.error('Failed to resolve access scope:', error);
    }
  }, [userProfile]);

  useEffect(() => {
    // 필터 초기화가 완료되기 전까지는 실행하지 않음
    if (!hasInitializedFilters.current) {
      return;
    }

    if (!accessScope) {
      return;
    }

    const next = { ...filters };
    let changed = false;

    if (accessScope.allowedRegionCodes && accessScope.allowedRegionCodes.length > 0) {
      if (!arraysEqual(filters.regionCodes, accessScope.allowedRegionCodes)) {
        next.regionCodes = [...accessScope.allowedRegionCodes];
        changed = true;
      }
    }

    if (Array.isArray(accessScope.allowedCityCodes) && accessScope.allowedCityCodes.length > 0) {
      if (!arraysEqual(filters.cityCodes, accessScope.allowedCityCodes)) {
        next.cityCodes = [...accessScope.allowedCityCodes];
        changed = true;
      }
    } else if (
      accessScope.allowedRegionCodes &&
      accessScope.allowedRegionCodes.length > 0 &&
      filters.cityCodes &&
      filters.cityCodes.length > 0
    ) {
      const allowedSet = new Set(accessScope.allowedCityCodes ?? []);
      if (allowedSet.size > 0) {
        const filteredCities = filters.cityCodes.filter((code) => allowedSet.has(code));
        if (!arraysEqual(filters.cityCodes, filteredCities)) {
          next.cityCodes = filteredCities.length > 0 ? filteredCities : undefined;
          changed = true;
        }
      }
    }

    if (!changed) {
      return;
    }

    console.log('[AEDDataProvider accessScope effect] Updating filters based on accessScope:', next);
    setFiltersInStore(withPaginationReset(next));
    cursorHistoryRef.current = [];
  }, [accessScope, filters, setFiltersInStore]);

  // 🔥 CRITICAL FIX: Use initialFilterSnapshot on first render to prevent race condition
  // On first render, filters from store might be DEFAULT_FILTERS, so use initialFilterSnapshot instead
  const effectiveFilters = hasInitializedFilters.current ? filters : initialFilterSnapshot;

  const queryString = useMemo(() => {
    const qs = buildQueryString(effectiveFilters);
    // viewMode 파라미터 추가
    const separator = qs.includes('?') ? '&' : '?';
    let fullQs = `${qs}${separator}viewMode=${viewMode}`;
    // ✅ includeSchedule 파라미터 추가
    if (includeSchedule) {
      fullQs += `&includeSchedule=true`;
    }
    console.log('[AEDDataProvider] Built queryString:', fullQs);
    console.log('[AEDDataProvider] Using filters:', hasInitializedFilters.current ? 'from store' : 'initialFilterSnapshot');
    console.log('[AEDDataProvider] effectiveFilters.regionCodes:', effectiveFilters.regionCodes);
    console.log('[AEDDataProvider] viewMode:', viewMode, 'includeSchedule:', includeSchedule);
    return fullQs;
  }, [effectiveFilters, viewMode, includeSchedule]);

  // ✅ 매일 교체되는 데이터셋을 위한 snapshot_id 포함
  // 자정이 지나면 자동으로 업데이트되는 React Hook 사용
  const currentSnapshotId = useCurrentSnapshotId();
  const queryKey = useMemo(
    () => ['aed-data', effectiveFilters, viewMode, includeSchedule, currentSnapshotId] as const,
    [effectiveFilters, viewMode, includeSchedule, currentSnapshotId]
  );

  const queryResult = useQuery<AEDDataResponse, Error>({
    queryKey,
    queryFn: () => {
      const url = `/api/aed-data${queryString}`;
      console.log('[AEDDataProvider queryFn] About to fetch:', url);
      return fetcher(url);
    },
    // enabled removed - filters are now initialized synchronously above
    placeholderData: keepPreviousData,
    // ✅ 매일 교체되는 데이터셋 최적화
    staleTime: 1000 * 60 * 30, // 30분 (매일 교체이므로 긴 staleTime 가능)
    gcTime: 1000 * 60 * 60, // 1시간 (구 cacheTime)
    refetchOnWindowFocus: false, // 매일 교체이므로 불필요
    // refetchOnMount는 기본값(true) 사용 - staleTime이 지나지 않으면 재조회 안 함
  });

  const response = queryResult.data;
  const queryError = queryResult.error;
  const data = response?.data ?? [];
  const isInitialLoad = queryResult.isPending && data.length === 0;
  const isLoading = isInitialLoad;
  const isFetching = queryResult.isFetching;

  const setFilters = useCallback(
    (nextFilters: ParsedFilters | ((prev: ParsedFilters) => ParsedFilters)) => {
      console.log('[AEDDataProvider setFilters] Called with:', typeof nextFilters === 'function' ? 'updater function' : nextFilters);
      const resolvedFilters = typeof nextFilters === 'function'
        ? nextFilters(effectiveFilters)
        : nextFilters;
      console.log('[AEDDataProvider setFilters] Resolved filters:', JSON.stringify(resolvedFilters));
      setFiltersInStore(withPaginationReset(resolvedFilters));
      cursorHistoryRef.current = [];
    },
    [setFiltersInStore, effectiveFilters],
  );

  const nextCursorValue = response?.pagination?.nextCursor ?? null;
  const hasMorePages = response?.pagination?.hasMore ?? false;

  const nextPage = useCallback(() => {
    if (!nextCursorValue || !hasMorePages) {
      return;
    }

    // ✅ 커서 히스토리에 현재 커서 저장
    const newHistory = [...cursorHistoryRef.current, filters.cursor ?? ''];

    // ✅ 히스토리 크기 제한 (메모리 누수 방지)
    if (newHistory.length > MAX_CURSOR_HISTORY) {
      newHistory.shift();  // 가장 오래된 항목 제거
    }

    cursorHistoryRef.current = newHistory;

    setFiltersInStore((prev) => ({
      ...prev,
      cursor: nextCursorValue,
      page: (prev.page ?? 1) + 1,
    }));
  }, [filters.cursor, hasMorePages, nextCursorValue, setFiltersInStore]);

  const prevPage = useCallback(() => {
    const currentPage = filters.page ?? 1;
    if (currentPage <= 1) {
      return;
    }

    const history = [...cursorHistoryRef.current];
    const previousCursor = history.pop();
    cursorHistoryRef.current = history;
    const newPage = currentPage - 1;
    setFiltersInStore((prevFilters) => ({
      ...prevFilters,
      cursor: previousCursor && previousCursor.length > 0 ? previousCursor : undefined,
      page: newPage,
    }));
  }, [filters.page, setFiltersInStore]);

  const resetFilters = useCallback(() => {
    const regionLabel = defaultRegionFromOrg ? REGION_CODE_TO_LABEL[defaultRegionFromOrg] || defaultRegionFromOrg : undefined;
    resetFiltersInStore({
      queryCriteria: defaultCriteria,
      regionCodes: regionLabel ? [regionLabel] : undefined,
    });
    cursorHistoryRef.current = [];
  }, [defaultCriteria, defaultRegionFromOrg, resetFiltersInStore]);

  const refetch = useCallback(() => {
    void queryResult.refetch();
  }, [queryResult]);

  const applied = response?.filters?.applied ?? {
    battery_expiry_date: filters.battery_expiry_date,
    patch_expiry_date: filters.patch_expiry_date,
    replacement_date: filters.replacement_date,
    last_inspection_date: filters.last_inspection_date,
    status: filters.status,
    regions: filters.regionCodes,
    cities: filters.cityCodes,
    category_1: filters.category_1,
    category_2: filters.category_2,
    category_3: filters.category_3,
    external_display: filters.external_display,
    search: filters.search,
  };
  const enforcedDefaults = response?.filters?.enforced?.appliedDefaults ?? [];

  const appliedFilterBadges = (() => {
    const badges: Array<{ key: string; label: string; value: string; rawValue?: string; removable: boolean }> = [];
    if (!applied) return badges;

    if (applied.battery_expiry_date) {
      badges.push({
        key: 'battery_expiry_date',
        label: 'battery_expiry_date',
        value:
          EXPIRY_FILTER_LABELS[applied.battery_expiry_date as keyof typeof EXPIRY_FILTER_LABELS] || applied.battery_expiry_date,
        rawValue: applied.battery_expiry_date,
        removable: true,
      });
    }

    if (applied.patch_expiry_date) {
      badges.push({
        key: 'patch_expiry_date',
        label: 'patch_expiry_date',
        value: EXPIRY_FILTER_LABELS[applied.patch_expiry_date as keyof typeof EXPIRY_FILTER_LABELS] || applied.patch_expiry_date,
        rawValue: applied.patch_expiry_date,
        removable: true,
      });
    }

    if (applied.replacement_date) {
      badges.push({
        key: 'replacement_date',
        label: 'replacement_date',
        value:
          EXPIRY_FILTER_LABELS[applied.replacement_date as keyof typeof EXPIRY_FILTER_LABELS] || applied.replacement_date,
        rawValue: applied.replacement_date,
        removable: true,
      });
    }

    if (applied.last_inspection_date) {
      badges.push({
        key: 'last_inspection_date',
        label: '최근 점검일',
        value:
          EXPIRY_FILTER_LABELS[applied.last_inspection_date as keyof typeof EXPIRY_FILTER_LABELS] || applied.last_inspection_date,
        rawValue: applied.last_inspection_date,
        removable: true,
      });
    }

    if (applied.status && applied.status.length > 0) {
      applied.status.forEach((status) => {
        badges.push({
          key: 'status',
          label: '상태',
          value: DEVICE_STATUS_LABELS[status as keyof typeof DEVICE_STATUS_LABELS] || status,
          rawValue: status,
          removable: true,
        });
      });
    }

    if (applied.regions && applied.regions.length > 0) {
      badges.push({
        key: 'regionCodes',
        label: '시도',
        value: applied.regions
          .map((code) => REGION_CODE_TO_LABEL[code] || code)
          .join(', '),
        rawValue: applied.regions.join(','),
        removable: true,
      });
    }

    if (applied.cities && applied.cities.length > 0) {
      badges.push({
        key: 'cityCodes',
        label: '시군구',
        value: applied.cities.map((code) => getCityName(code)).join(', '),
        rawValue: applied.cities.join(','),
        removable: true,
      });
    }

    if (applied.category_1 && applied.category_1.length > 0) {
      applied.category_1.forEach((category: string) => {
        badges.push({
          key: 'category_1',
          label: '분류1',
          value: category,
          rawValue: category,
          removable: true,
        });
      });
    }

    if (applied.category_2 && applied.category_2.length > 0) {
      applied.category_2.forEach((category: string) => {
        badges.push({
          key: 'category_2',
          label: '분류2',
          value: category,
          rawValue: category,
          removable: true,
        });
      });
    }

    if (applied.category_3 && applied.category_3.length > 0) {
      applied.category_3.forEach((category: string) => {
        badges.push({
          key: 'category_3',
          label: '분류3',
          value: category,
          rawValue: category,
          removable: true,
        });
      });
    }

    if (applied.external_display) {
      badges.push({
        key: 'external_display',
        label: '외부표출',
        value: EXTERNAL_DISPLAY_FILTER_LABELS[applied.external_display as keyof typeof EXTERNAL_DISPLAY_FILTER_LABELS] || applied.external_display,
        rawValue: applied.external_display,
        removable: true,
      });
    }

    if (applied.search) {
      badges.push({
        key: 'search',
        label: '검색',
        value: applied.search,
        rawValue: applied.search,
        removable: true,
      });
    }

    return badges;
  })();

  const enforcedFilterLabels = enforcedDefaults.map((key) => {
    switch (key) {
      case 'sido':
        return '시도 기본값이 자동 적용되었습니다.';
      case 'gugun':
        return '시군구 기본값이 자동 적용되었습니다.';
      case 'category':
        return '기관 구분 기본값이 자동 적용되었습니다.';
      default:
        return key;
    }
  });

  const contextValue: AEDDataContextType = {
    data,
    isLoading,
    isFetching,
    error: queryError?.message,
    summary: response?.summary,
    filters: effectiveFilters, // Use effectiveFilters instead of store filters
    setFilters,
    pagination: response?.pagination,
    accessScope,
    filterCapabilities: response?.filters?.available,
    appliedFilters: response?.filters?.applied,
    enforcedFilters: response?.filters?.enforced,
    appliedFilterBadges,
    enforcedFilterLabels,
    userProfile,
    searchQuery: undefined,
    setSearchQuery: undefined,
    refetch,
    nextPage,
    prevPage,
    resetFilters,
    viewMode,
    mapCenterRegion,
    setMapCenterRegion,
    // ✅ includeSchedule=true일 때만 scheduled 배열 포함
    scheduled: (response as any)?.scheduled,
  };

  return (
    <ToastProvider>
      <AEDDataContext.Provider value={contextValue}>{children}</AEDDataContext.Provider>
    </ToastProvider>
  );
}

export function useAEDData() {
  const context = useContext(AEDDataContext);
  if (context === undefined) {
    throw new Error('useAEDData must be used within an AEDDataProvider');
  }
  return context;
}

function parseInitialFilters(
  searchParams: Record<string, string | string[] | undefined>,
  userRole: string,
): Partial<ParsedFilters> {
  const params = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, v));
    } else if (value) {
      params.set(key, value);
    }
  });

  const parsed = parseQueryParams(params);

  const criteria = params.get('criteria');
  if (criteria === 'address' || criteria === 'jurisdiction') {
    parsed.queryCriteria = criteria as QueryCriteria;
  } else {
    const rolePermissions = ROLE_QUERY_CRITERIA[userRole];
    parsed.queryCriteria = rolePermissions?.defaultCriteria || 'address';
  }

  return parsed;
}
