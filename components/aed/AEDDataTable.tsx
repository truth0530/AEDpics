/**
 * AED Data Table Component
 *
 * Features:
 * - Responsive table layout
 * - Device status badges
 * - Load more button (cursor pagination)
 * - Device detail modal
 */

'use client';

import { useState } from 'react';
import { AEDDevice } from '@/app/(authenticated)/aed-data/page';
import AEDDetailModal from './AEDDetailModal';

interface AEDDataTableProps {
  devices: AEDDevice[];
  loading: boolean;
  onLoadMore: () => void;
  hasMore: boolean;
}

export default function AEDDataTable({
  devices,
  loading,
  onLoadMore,
  hasMore,
}: AEDDataTableProps) {
  const [selectedDevice, setSelectedDevice] = useState<AEDDevice | null>(null);

  function getStatusBadge(status: string) {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      active: { bg: 'bg-green-100', text: 'text-green-800', label: '정상' },
      inactive: { bg: 'bg-gray-100', text: 'text-gray-800', label: '비활성' },
      maintenance: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '점검중' },
      defective: { bg: 'bg-red-100', text: 'text-red-800', label: '고장' },
    };

    const badge = badges[status] || badges.inactive;

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}
      >
        {badge.label}
      </span>
    );
  }

  function formatDate(dateString?: string) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR');
  }

  if (loading && devices.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-8 text-center text-gray-500">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-8 text-center text-gray-500">
          <p>조회된 장비가 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  장비코드
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  위치
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  지역
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  최근 점검일
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  제조사
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {devices.map((device) => (
                <tr key={device.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {device.deviceCode}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {device.location}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {device.region}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(device.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(device.lastInspectionDate)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {device.manufacturer || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => setSelectedDevice(device)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      상세보기
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-gray-200">
          {devices.map((device) => (
            <div key={device.id} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {device.deviceCode}
                  </p>
                  <p className="text-sm text-gray-500">{device.location}</p>
                </div>
                {getStatusBadge(device.status)}
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                <p>지역: {device.region}</p>
                <p>최근 점검: {formatDate(device.lastInspectionDate)}</p>
                {device.manufacturer && <p>제조사: {device.manufacturer}</p>}
              </div>
              <button
                onClick={() => setSelectedDevice(device)}
                className="mt-2 text-sm text-blue-600 hover:text-blue-900 font-medium"
              >
                상세보기
              </button>
            </div>
          ))}
        </div>

        {/* Load more button */}
        {hasMore && (
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
            <button
              onClick={onLoadMore}
              disabled={loading}
              className="w-full md:w-auto px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 disabled:text-gray-400"
            >
              {loading ? '불러오는 중...' : '더 보기'}
            </button>
          </div>
        )}
      </div>

      {/* Device detail modal */}
      {selectedDevice && (
        <AEDDetailModal
          device={selectedDevice}
          onClose={() => setSelectedDevice(null)}
        />
      )}
    </>
  );
}
