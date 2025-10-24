/**
 * AED Filter Bar Component
 *
 * Features:
 * - Region filter dropdown
 * - Status filter checkboxes
 * - Search input
 * - Reset filters button
 */

'use client';

import { useState, useEffect } from 'react';
import { AEDFilters } from '@/app/(authenticated)/aed-data/page';

interface AEDFilterBarProps {
  filters: AEDFilters;
  onChange: (filters: AEDFilters) => void;
}

const REGIONS = [
  { code: 'ALL', name: '전체' },
  { code: 'DAE', name: '대구광역시' },
  { code: 'SEL', name: '서울특별시' },
  { code: 'BUS', name: '부산광역시' },
  { code: 'INC', name: '인천광역시' },
  { code: 'GWA', name: '광주광역시' },
  { code: 'DAJ', name: '대전광역시' },
  { code: 'ULS', name: '울산광역시' },
  { code: 'SEJ', name: '세종특별자치시' },
  { code: 'GYE', name: '경기도' },
  { code: 'GAN', name: '강원도' },
  { code: 'CUN', name: '충청북도' },
  { code: 'CUS', name: '충청남도' },
  { code: 'JEN', name: '전라북도' },
  { code: 'JES', name: '전라남도' },
  { code: 'GYN', name: '경상북도' },
  { code: 'GYS', name: '경상남도' },
  { code: 'JEJ', name: '제주특별자치도' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: '정상' },
  { value: 'inactive', label: '비활성' },
  { value: 'maintenance', label: '점검중' },
  { value: 'defective', label: '고장' },
];

export default function AEDFilterBar({ filters, onChange }: AEDFilterBarProps) {
  const [region, setRegion] = useState(filters.region || 'ALL');
  const [statusFilters, setStatusFilters] = useState<string[]>(filters.status || []);
  const [search, setSearch] = useState(filters.search || '');
  const [searchInput, setSearchInput] = useState(filters.search || '');

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
    }, 500); // Debounce search input

    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    onChange({
      region: region === 'ALL' ? undefined : region,
      status: statusFilters.length > 0 ? statusFilters : undefined,
      search: search || undefined,
    });
  }, [region, statusFilters, search]);

  function handleStatusChange(status: string, checked: boolean) {
    if (checked) {
      setStatusFilters([...statusFilters, status]);
    } else {
      setStatusFilters(statusFilters.filter((s) => s !== status));
    }
  }

  function handleReset() {
    setRegion('ALL');
    setStatusFilters([]);
    setSearch('');
    setSearchInput('');
  }

  const hasActiveFilters =
    region !== 'ALL' || statusFilters.length > 0 || search.length > 0;

  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-4">
      {/* Top row: Region and Search */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Region filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            지역
          </label>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {REGIONS.map((r) => (
              <key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            검색
          </label>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="장비코드, 위치, 시리얼번호..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Status filters */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          상태
        </label>
        <div className="flex flex-wrap gap-4">
          {STATUS_OPTIONS.map((status) => (
            <label key={status.value} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={statusFilters.includes(status.value)}
                onChange={(e) => handleStatusChange(status.value, e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">{status.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Reset button */}
      {hasActiveFilters && (
        <div className="flex justify-end">
          <button
            onClick={handleReset}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            필터 초기화
          </button>
        </div>
      )}
    </div>
  );
}
