'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import {
  REGION_LABELS,
  EXPIRY_LABELS,
  STATUS_LABELS,
  CITY_LABELS,
  EXTERNAL_DISPLAY_LABELS,
} from '@/lib/constants/filter-labels';
import { QUERY_CRITERIA_LABELS } from '@/lib/constants/query-criteria';
import type { FilterActions, FilterState } from '@/types/filters';

interface FilterBadgesProps {
  filters: FilterState;
  actions: FilterActions;
}

export function FilterBadges({ filters, actions }: FilterBadgesProps) {
  const { onRemove, onClear } = actions;

  const safeFilters = filters ?? {};
  const entries = Object.values(safeFilters);
  const hasActiveFilters = entries.some((value) => {
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    return value !== undefined && value !== null;
  });

  if (!hasActiveFilters) {
    return null;
  }

  // 반응형 배지 스타일: 모바일(작게) / PC(기본 크기)
  const badgeClass = "gap-0.5 lg:gap-1 px-1 lg:px-2.5 py-0 lg:py-0.5 text-[9px] lg:text-xs h-4 lg:h-auto";
  const iconClass = "h-2 w-2 lg:h-3 lg:w-3 cursor-pointer";

  return (
    <div className="flex flex-wrap gap-0.5 lg:gap-2">
      {safeFilters.regions?.map((region) => (
        <Badge key={`region-${region}`} className={`${badgeClass} bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border-blue-500/30`}>
          {REGION_LABELS[region] ?? region}
          <X className={`${iconClass} hover:text-blue-200`} onClick={() => onRemove('regions', region)} />
        </Badge>
      ))}

      {safeFilters.cities?.map((city) => (
        <Badge key={`city-${city}`} className={`${badgeClass} bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border-cyan-500/30`}>
          {CITY_LABELS[city] ?? city}
          <X className={`${iconClass} hover:text-cyan-200`} onClick={() => onRemove('cities', city)} />
        </Badge>
      ))}

      {safeFilters.battery_expiry_date && (
        <Badge className={`${badgeClass} bg-orange-500/20 text-orange-300 hover:bg-orange-500/30 border-orange-500/30`}>
          배터리
          {` ${EXPIRY_LABELS[safeFilters.battery_expiry_date] ?? safeFilters.battery_expiry_date}`}
          <X className={`${iconClass} hover:text-orange-200`} onClick={() => onRemove('battery_expiry_date')} />
        </Badge>
      )}

      {safeFilters.patch_expiry_date && (
        <Badge className={`${badgeClass} bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border-amber-500/30`}>
          패드
          {` ${EXPIRY_LABELS[safeFilters.patch_expiry_date] ?? safeFilters.patch_expiry_date}`}
          <X className={`${iconClass} hover:text-amber-200`} onClick={() => onRemove('patch_expiry_date')} />
        </Badge>
      )}

      {safeFilters.replacement_date && (
        <Badge className={`${badgeClass} bg-red-500/20 text-red-300 hover:bg-red-500/30 border-red-500/30`}>
          교체시기
          {` ${EXPIRY_LABELS[safeFilters.replacement_date] ?? safeFilters.replacement_date}`}
          <X className={`${iconClass} hover:text-red-200`} onClick={() => onRemove('replacement_date')} />
        </Badge>
      )}

      {safeFilters.last_inspection_date && (
        <Badge className={`${badgeClass} bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border-purple-500/30`}>
          최근 점검일
          {` ${EXPIRY_LABELS[safeFilters.last_inspection_date] ?? safeFilters.last_inspection_date}`}
          <X className={`${iconClass} hover:text-purple-200`} onClick={() => onRemove('last_inspection_date')} />
        </Badge>
      )}

      {safeFilters.status?.map((status) => (
        <Badge key={`status-${status}`} className={`${badgeClass} bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 border-yellow-500/30`}>
          {STATUS_LABELS[status] ?? status}
          <X className={`${iconClass} hover:text-yellow-200`} onClick={() => onRemove('status', status)} />
        </Badge>
      ))}

      {safeFilters.category_1?.map((category: string) => (
        <Badge key={`category_1-${category}`} className={`${badgeClass} bg-green-500/20 text-green-300 hover:bg-green-500/30 border-green-500/30`}>
          분류1: {category}
          <X className={`${iconClass} hover:text-green-200`} onClick={() => onRemove('category_1', category)} />
        </Badge>
      ))}

      {safeFilters.category_2?.map((category: string) => (
        <Badge key={`category_2-${category}`} className={`${badgeClass} bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border-emerald-500/30`}>
          분류2: {category}
          <X className={`${iconClass} hover:text-emerald-200`} onClick={() => onRemove('category_2', category)} />
        </Badge>
      ))}

      {safeFilters.category_3?.map((category: string) => (
        <Badge key={`category_3-${category}`} className={`${badgeClass} bg-teal-500/20 text-teal-300 hover:bg-teal-500/30 border-teal-500/30`}>
          분류3: {category}
          <X className={`${iconClass} hover:text-teal-200`} onClick={() => onRemove('category_3', category)} />
        </Badge>
      ))}

      {safeFilters.external_display && (
        <Badge className={`${badgeClass} bg-pink-500/20 text-pink-300 hover:bg-pink-500/30 border-pink-500/30`}>
          외부표출
          {` ${EXTERNAL_DISPLAY_LABELS[safeFilters.external_display] ?? safeFilters.external_display}`}
          <X className={`${iconClass} hover:text-pink-200`} onClick={() => onRemove('external_display')} />
        </Badge>
      )}

      {safeFilters.queryCriteria && (
        <Badge className={`${badgeClass} bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border-indigo-500/30`}>
          조회 기준
          {` ${QUERY_CRITERIA_LABELS[safeFilters.queryCriteria] ?? safeFilters.queryCriteria}`}
          <X className={`${iconClass} hover:text-indigo-200`} onClick={() => onRemove('queryCriteria')} />
        </Badge>
      )}

      {safeFilters.search && (
        <Badge className={`${badgeClass} bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 border-violet-500/30`}>
          검색: {safeFilters.search}
          <X className={`${iconClass} hover:text-violet-200`} onClick={() => onRemove('search')} />
        </Badge>
      )}
    </div>
  );
}
