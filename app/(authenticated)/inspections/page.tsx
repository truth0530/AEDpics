/**
 * Inspections List Page
 *
 * Features:
 * - Inspection records listing
 * - Filter by device, status, date
 * - Create new inspection
 * - View inspection details
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import InspectionTable from '@/components/inspection/InspectionTable';
import InspectionFilters from '@/components/inspection/InspectionFilters';

export interface InspectionRecord {
  id: number;
  deviceId: number;
  inspectorId: number;
  inspectionDate: string;
  status: string;
  notes?: string;
  photoPaths: string[];
  batteryStatus?: string;
  paddleStatus?: string;
  device: {
    deviceCode: string;
    location: string;
  };
  inspector: {
    name?: string;
    email: string;
  };
}

export default function InspectionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deviceId = searchParams.get('deviceId');

  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    deviceId: deviceId || '',
    status: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    fetchInspections();
  }, [filters]);

  async function fetchInspections() {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (filters.deviceId) params.append('deviceId', filters.deviceId);
      if (filters.status) params.append('status', filters.status);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const response = await fetch(`/api/inspections?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch inspections');
      }

      const data = await response.json();
      setInspections(data.data);
      setLoading(false);
    } catch (err) {
      console.error('[Inspections Page] Error:', err);
      setError('점검 기록을 불러오는데 실패했습니다.');
      setLoading(false);
    }
  }

  function handleViewDetails(inspection: InspectionRecord) {
    router.push(`/inspections/${inspection.id}`);
  }

  function handleCreateInspection() {
    router.push('/inspection/new');
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">점검 관리</h1>
          <button
            onClick={handleCreateInspection}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            새 점검 생성
          </button>
        </div>

        {/* Filters */}
        <InspectionFilters filters={filters} onChange={setFilters} />

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Inspection table */}
        <InspectionTable
          inspections={inspections}
          loading={loading}
          onViewDetails={handleViewDetails}
        />
      </div>
    </DashboardLayout>
  );
}
