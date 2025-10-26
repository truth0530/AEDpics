import { REGION_CODE_TO_LABEL } from '@/lib/constants/regions';
import { CITIES } from '@/lib/constants/cities';
import {
  EXPIRY_FILTER_LABELS,
  DEVICE_STATUS_LABELS,
  INSTITUTION_CATEGORY_LABELS,
  EXTERNAL_DISPLAY_FILTER_LABELS,
} from '@/lib/constants/aed-filters';

export const REGION_LABELS = REGION_CODE_TO_LABEL;
export const EXPIRY_LABELS = EXPIRY_FILTER_LABELS;
export const STATUS_LABELS = DEVICE_STATUS_LABELS;
export const CATEGORY_LABELS = INSTITUTION_CATEGORY_LABELS;
export const EXTERNAL_DISPLAY_LABELS = EXTERNAL_DISPLAY_FILTER_LABELS;
export const CITY_LABELS: Record<string, string> = CITIES.reduce(
  (acc, city) => ({ ...acc, [city.code]: city.name }),
  {} as Record<string, string>,
);
