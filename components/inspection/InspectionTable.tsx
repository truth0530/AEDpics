/**
 * Inspection Table Component
 *
 * Features:
 * - Responsive table layout
 * - Status badges
 * - Click to view details
 */

'use client';

import { InspectionRecord } from '@/app/(authenticated)/inspections/page';

interface InspectionTableProps {
  inspections: InspectionRecord[];
  loading: boolean;
  onViewDetails: (inspection: InspectionRecord) => void;
}

export default function InspectionTable({
  inspections,
  loading,
  onViewDetails,
}: InspectionTableProps) {
  function getStatusBadge(status: string) {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      pass: { bg: 'bg-green-100', text: 'text-green-800', label: '정상' },
      fail: { bg: 'bg-red-100', text: 'text-red-800', label: '이상' },
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '대기중' },
    };

    const badge = badges[status] || badges.pending;

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}
      >
        {badge.label}
      </span>
    );
  }

  function formatDateTime(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-8 text-center text-gray-500">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (inspections.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-8 text-center text-gray-500">
          <p>조회된 점검 기록이 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                점검일시
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                장비코드
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                위치
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                점검자
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                상태
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                배터리
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                패들
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                작업
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {inspections.map((inspection) => (
              <tr
                key={inspection.id}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => onViewDetails(inspection)}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatDateTime(inspection.inspectionDate)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {inspection.device.deviceCode}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {inspection.device.location}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {inspection.inspector.name || inspection.inspector.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(inspection.status)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {inspection.batteryStatus || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {inspection.paddleStatus || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewDetails(inspection);
                    }}
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
        {inspections.map((inspection) => (
          <div
            key={inspection.id}
            className="p-4 cursor-pointer hover:bg-gray-50"
            onClick={() => onViewDetails(inspection)}
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {inspection.device.deviceCode}
                </p>
                <p className="text-sm text-gray-500">{inspection.device.location}</p>
              </div>
              {getStatusBadge(inspection.status)}
            </div>
            <div className="text-xs text-gray-500 space-y-1">
              <p>점검일: {formatDateTime(inspection.inspectionDate)}</p>
              <p>점검자: {inspection.inspector.name || inspection.inspector.email}</p>
              {inspection.batteryStatus && <p>배터리: {inspection.batteryStatus}</p>}
              {inspection.paddleStatus && <p>패들: {inspection.paddleStatus}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
