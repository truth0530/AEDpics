'use client';

import { create } from 'zustand';
import type { ParsedFilters } from '@/lib/utils/query-parser';

const DEFAULT_FILTERS: ParsedFilters = {
  page: 1,
  limit: 100,  // ✅ 50 → 100으로 증가 (Phase 0)
  cursor: undefined,
  queryCriteria: 'address',
  // category_1 제거: 사용자가 선택한 값 존중
};

const sanitizeArray = (values?: string[] | null) => {
  if (!values || values.length === 0) {
    return undefined;
  }
  const filtered = values.filter((value) => typeof value === 'string' && value.trim().length > 0);
  return filtered.length > 0 ? [...new Set(filtered)] : undefined;
};

const sanitizeFilters = (next: Partial<ParsedFilters>): ParsedFilters => {
  const merged = {
    ...DEFAULT_FILTERS,
    ...next,
  } satisfies ParsedFilters;

  const result: ParsedFilters = {
    page: merged.page && merged.page > 0 ? merged.page : 1,
    limit: merged.limit && merged.limit > 0 ? merged.limit : DEFAULT_FILTERS.limit,
    cursor: merged.cursor ?? undefined,
    queryCriteria: merged.queryCriteria ?? DEFAULT_FILTERS.queryCriteria,
  };

  if (merged.battery_expiry_date) {
    result.battery_expiry_date = merged.battery_expiry_date;
  }

  if (merged.patch_expiry_date) {
    result.patch_expiry_date = merged.patch_expiry_date;
  }

  if (merged.replacement_date) {
    result.replacement_date = merged.replacement_date;
  }

  if (merged.last_inspection_date) {
    result.last_inspection_date = merged.last_inspection_date;
  }

  const status = sanitizeArray(merged.status ?? undefined);
  if (status) {
    result.status = status as any;
  }

  const regions = sanitizeArray(merged.regionCodes ?? undefined);
  if (regions) {
    result.regionCodes = regions;
  }

  const cities = sanitizeArray(merged.cityCodes ?? undefined);
  if (cities) {
    result.cityCodes = cities;
  }

  const category1 = sanitizeArray(merged.category_1 ?? undefined);
  if (category1) {
    result.category_1 = category1;
  }

  const category2 = sanitizeArray(merged.category_2 ?? undefined);
  if (category2) {
    result.category_2 = category2;
  }

  const category3 = sanitizeArray(merged.category_3 ?? undefined);
  if (category3) {
    result.category_3 = category3;
  }

  if (merged.external_display) {
    result.external_display = merged.external_display;
  }

  if (typeof merged.search === 'string' && merged.search.trim().length > 0) {
    result.search = merged.search.trim();
  }

  if (merged.cursor && merged.cursor.length > 0) {
    result.cursor = merged.cursor;
  }

  return result;
};

type AEDFiltersStore = {
  filters: ParsedFilters;
  setFilters: (updater: ParsedFilters | ((prev: ParsedFilters) => ParsedFilters)) => void;
  patchFilters: (partial: Partial<ParsedFilters>) => void;
  resetFilters: (overrides?: Partial<ParsedFilters>) => void;
};

export const useAEDFiltersStore = create<AEDFiltersStore>((set) => ({
  filters: DEFAULT_FILTERS,
  setFilters: (updater) => {
    set((state) => {
      const next = typeof updater === 'function' ? updater(state.filters) : updater;
      return { filters: sanitizeFilters(next) };
    });
  },
  patchFilters: (partial) => {
    set((state) => ({ filters: sanitizeFilters({ ...state.filters, ...partial }) }));
  },
  resetFilters: (overrides) => {
    set({ filters: sanitizeFilters({ ...DEFAULT_FILTERS, ...overrides }) });
  },
}));

export const getDefaultFilters = (overrides?: Partial<ParsedFilters>) => sanitizeFilters({
  ...DEFAULT_FILTERS,
  ...overrides,
});

export const withPaginationReset = (filters: ParsedFilters): ParsedFilters =>
  sanitizeFilters({
    ...filters,
    page: 1,
    cursor: undefined,
  });

