/**
 * AED Data Page
 *
 * Features:
 * - AED device listing
 * - Filter controls
 * - Cursor-based pagination
 * - Device detail modal
 */

'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import AEDDataTable from '@/components/aed/AEDDataTable';
import AEDFilterBar from '@/components/aed/AEDFilterBar';

export interface AEDDevice {
  id: number;
  deviceCode: string;
  location: string;
  region: string;
  status: string;
  latitude?: number;
  longitude?: number;
  lastInspectionDate?: string;
  manufacturer?: string;
  modelName?: string;
  serialNumber?: string;
}

export interface AEDFilters {
  region?: string;
  status?: string[];
  search?: string;
}

export default function AEDDataPage() {
  const [devices, setDevices] = useState<AEDDevice[]>([]);
  const [filters, setFilters] = useState<AEDFilters>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({
    limit: 30,
    hasMore: false,
    nextCursor: null as string | null,
  });

  useEffect(() => {
    fetchDevices();
  }, [filters]);

  async function fetchDevices(cursor?: string) {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (filters.region) params.append('region', filters.region);
      if (filters.status && filters.status.length > 0) {
        params.append('status', filters.status.join(','));
      }
      if (filters.search) params.append('search', filters.search);
      if (cursor) params.append('cursor', cursor);
      params.append('limit', pagination.limit.toString());

      const response = await fetch(`/api/aed-data?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch AED data');
      }

      const data = await response.json();

      if (cursor) {
        // Append for "Load More"
        setDevices((prev) => [...prev, ...data.data]);
      } else {
        // Replace for new query
        setDevices(data.data);
      }

      setPagination({
        limit: data.pagination.limit,
        hasMore: data.pagination.hasMore,
        nextCursor: data.pagination.nextCursor,
      });

      setLoading(false);
    } catch (err) {
      console.error('[AED Data Page] Error:', err);
      setError('데이터를 불러오는데 실패했습니다.');
      setLoading(false);
    }
  }

  function handleLoadMore() {
    if (pagination.nextCursor) {
      fetchDevices(pagination.nextCursor);
    }
  }

  function handleFilterChange(newFilters: AEDFilters) {
    setFilters(newFilters);
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">AED 장비 현황</h1>
          <div className="text-sm text-gray-500">
            총 {devices.length}개 장비
          </div>
        </div>

        {/* Filter bar */}
        <AEDFilterBar filters={filters} onChange={handleFilterChange} />

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Data table */}
        <AEDDataTable
          devices={devices}
          loading={loading}
          onLoadMore={handleLoadMore}
          hasMore={pagination.hasMore}
        />
      </div>
    </DashboardLayout>
  );
}
