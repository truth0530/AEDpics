/**
 * Inspection Filters Component
 *
 * Features:
 * - Device filter
 * - Status filter
 * - Date range filter
 */

'use client';

interface InspectionFiltersProps {
  filters: {
    deviceId: string;
    status: string;
    startDate: string;
    endDate: string;
  };
  onChange: (filters: any) => void;
}

const STATUS_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'pass', label: '정상' },
  { value: 'fail', label: '이상' },
  { value: 'pending', label: '대기중' },
];

export default function InspectionFilters({ filters, onChange }: InspectionFiltersProps) {
  function handleChange(key: string, value: string) {
    onChange({ ...filters, [key]: value });
  }

  function handleReset() {
    onChange({
      deviceId: '',
      status: '',
      startDate: '',
      endDate: '',
    });
  }

  const hasActiveFilters =
    filters.deviceId || filters.status || filters.startDate || filters.endDate;

  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Device ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            장비 ID
          </label>
          <input
            type="text"
            value={filters.deviceId}
            onChange={(e) => handleChange('deviceId', e.target.value)}
            placeholder="예: 123"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            상태
          </label>
          <select
            value={filters.status}
            onChange={(e) => handleChange('status', e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Start date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            시작일
          </label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => handleChange('startDate', e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* End date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            종료일
          </label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => handleChange('endDate', e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
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
