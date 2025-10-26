'use client';

import { useCallback, useMemo } from 'react';
import { REGIONS } from '@/lib/constants/regions';
import { CITIES, type City } from '@/lib/constants/cities';

export function useRegionData() {
  const regions = useMemo(() => REGIONS, []);

  const getCitiesByRegion = useCallback(
    (regionCode: string): City[] => CITIES.filter((city) => city.regionCode === regionCode),
    []
  );

  return {
    regions,
    getCitiesByRegion,
    loading: false,
    error: undefined as undefined,
  };
}
