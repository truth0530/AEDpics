import type {
  ExpiryFilter,
  DeviceStatus,
  InstitutionCategory,
  ExternalDisplayFilter,
} from '@/lib/constants/aed-filters';
import type { QueryCriteria } from '@/lib/constants/query-criteria';

export interface FilterState {
  regions?: string[];
  cities?: string[];
  battery_expiry_date?: ExpiryFilter;
  patch_expiry_date?: ExpiryFilter;
  replacement_date?: ExpiryFilter;
  last_inspection_date?: ExpiryFilter;
  status?: DeviceStatus[];
  category_1?: string[];
  category_2?: string[];
  category_3?: string[];
  external_display?: ExternalDisplayFilter;
  matching_status?: 'all' | 'matched' | 'unmatched';
  search?: string;
  queryCriteria?: QueryCriteria;
}

export interface FilterActions {
  onRemove: (filterType: keyof FilterState, value?: string) => void;
  onClear?: () => void;
  onApply?: () => void;
}
