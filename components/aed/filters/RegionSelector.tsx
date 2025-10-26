'use client';

import { useMemo } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useRegionData } from '@/hooks/useRegionData';

interface RegionSelectorProps {
  selectedRegions: string[];
  selectedCities: string[];
  onRegionsChange: (regions: string[]) => void;
  onCitiesChange: (cities: string[]) => void;
}

export function RegionSelector({
  selectedRegions,
  selectedCities,
  onRegionsChange,
  onCitiesChange,
}: RegionSelectorProps) {
  const { regions, getCitiesByRegion, loading } = useRegionData();

  const toggleRegion = (regionCode: string) => {
    const isSelected = selectedRegions.includes(regionCode);
    if (isSelected) {
      const remainingRegions = selectedRegions.filter((code) => code !== regionCode);
      const citiesToRemove = new Set(getCitiesByRegion(regionCode).map((city) => city.code));
      const remainingCities = selectedCities.filter((code) => !citiesToRemove.has(code));

      onRegionsChange(remainingRegions);
      if (remainingCities.length !== selectedCities.length) {
        onCitiesChange(remainingCities);
      }
      return;
    }

    onRegionsChange([...selectedRegions, regionCode]);
  };

  const toggleCity = (cityCode: string) => {
    const isSelected = selectedCities.includes(cityCode);
    if (isSelected) {
      onCitiesChange(selectedCities.filter((code) => code !== cityCode));
    } else {
      onCitiesChange([...selectedCities, cityCode]);
    }
  };

  const availableCities = useMemo(() => {
    if (selectedRegions.length === 0) {
      return [];
    }

    const deduped = new Map<string, { code: string; name: string }>();
    selectedRegions.forEach((regionCode) => {
      getCitiesByRegion(regionCode).forEach((city) => {
        if (!deduped.has(city.code)) {
          deduped.set(city.code, { code: city.code, name: city.name });
        }
      });
    });

    return Array.from(deduped.values());
  }, [selectedRegions, getCitiesByRegion]);

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">지역 정보를 불러오는 중...</div>;
  }

  return (
    <Command>
      <CommandInput placeholder="지역 또는 시군구 검색" />
      <CommandList>
        <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
        <CommandGroup heading="시도">
          {regions.map((region) => (
            <CommandItem
              key={region.code}
              value={region.code}
              onSelect={() => toggleRegion(region.code)}
            >
              <Check
                className={cn(
                  'mr-2 h-4 w-4',
                  selectedRegions.includes(region.code) ? 'opacity-100' : 'opacity-0'
                )}
              />
              {region.label}
            </CommandItem>
          ))}
        </CommandGroup>

        {availableCities.length > 0 && (
          <CommandGroup heading="시군구">
            {availableCities.map((city) => (
              <CommandItem key={city.code} value={city.code} onSelect={() => toggleCity(city.code)}>
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    selectedCities.includes(city.code) ? 'opacity-100' : 'opacity-0'
                  )}
                />
                {city.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  );
}
