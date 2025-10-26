'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAEDData } from '@/app/aed-data/components/AEDDataProvider';
import type { FilterState } from '@/types/filters';
import type { ParsedFilters } from '@/lib/utils/query-parser';
import { buildQueryString } from '@/lib/utils/query-parser';

const toFilterState = (parsed: ParsedFilters): FilterState => ({
  regions: parsed.regionCodes,
  cities: parsed.cityCodes,
  battery_expiry_date: parsed.battery_expiry_date,
  patch_expiry_date: parsed.patch_expiry_date,
  replacement_date: parsed.replacement_date,
  last_inspection_date: parsed.last_inspection_date,
  status: parsed.status,
  category_1: parsed.category_1,
  category_2: parsed.category_2,
  category_3: parsed.category_3,
  external_display: parsed.external_display,
  search: parsed.search,
  queryCriteria: parsed.queryCriteria,
});

const toParsedFilters = (state: FilterState, base: ParsedFilters): ParsedFilters => ({
  ...base,
  regionCodes: state.regions,
  cityCodes: state.cities,
  battery_expiry_date: state.battery_expiry_date,
  patch_expiry_date: state.patch_expiry_date,
  replacement_date: state.replacement_date,
  last_inspection_date: state.last_inspection_date,
  status: state.status,
  category_1: state.category_1,
  category_2: state.category_2,
  category_3: state.category_3,
  external_display: state.external_display,
  search: state.search,
  queryCriteria: state.queryCriteria,
});

export function useFilterState() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { filters: parsedFilters, setFilters, resetFilters } = useAEDData();
  const [draftFilters, setDraftFilters] = useState<FilterState>(() => toFilterState(parsedFilters));

  useEffect(() => {
    setDraftFilters(toFilterState(parsedFilters));
  }, [parsedFilters]);

  const appliedFilters = useMemo(() => toFilterState(parsedFilters), [parsedFilters]);

  const syncRouter = useCallback(
    (nextFilters: ParsedFilters) => {
      const queryString = buildQueryString(nextFilters);
      const current = searchParams ? `?${searchParams.toString()}` : '';
      if (queryString && queryString !== current) {
        router.replace(`/aed-data${queryString}`);
      }
      if (!queryString && current) {
        router.replace('/aed-data');
      }
    },
    [router, searchParams]
  );

  const applyFilters = useCallback(() => {
    const nextFilters = toParsedFilters(draftFilters, parsedFilters);
    setFilters(nextFilters);
    syncRouter(nextFilters);
  }, [draftFilters, parsedFilters, setFilters, syncRouter]);

  const commitFilters = useCallback(
    (nextState: FilterState) => {
      setDraftFilters(nextState);
      const nextFilters = toParsedFilters(nextState, parsedFilters);
      setFilters(nextFilters);
      syncRouter(nextFilters);
    },
    [parsedFilters, setFilters, syncRouter]
  );

  const clearFilters = useCallback(() => {
    setDraftFilters({});
    resetFilters();
    router.replace('/aed-data');
  }, [resetFilters, router]);

  const hasActiveFilters = useMemo(() => {
    return Object.values(appliedFilters).some((value) => {
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      return value !== undefined && value !== null;
    });
  }, [appliedFilters]);

  return {
    draftFilters,
    appliedFilters,
    setDraftFilters,
    applyFilters,
    commitFilters,
    clearFilters,
    hasActiveFilters,
  };
}
