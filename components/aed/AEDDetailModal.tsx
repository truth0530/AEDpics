/**
 * AED Device Detail Modal
 *
 * Features:
 * - Device information display
 * - Location map (placeholder)
 * - Inspection history link
 * - Close button
 */

'use client';

import { useRouter } from 'next/navigation';
import { AEDDevice } from '@/app/(authenticated)/aed-data/page';

interface AEDDetailModalProps {
  device: AEDDevice;
  onClose: () => void;
}

export default function AEDDetailModal({ device, onClose }: AEDDetailModalProps) {
  const router = useRouter();

  function handleInspectionHistory() {
    router.push(`/inspections?deviceId=${device.id}`);
    onClose();
  }

  function handleStartInspection() {
    router.push(`/inspection/${device.serialNumber || device.deviceCode}`);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-gray-600 bg-opacity-75 transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              AED 장비 상세정보
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            {/* Basic Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">기본 정보</h3>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">장비 코드</dt>
                  <dd className="mt-1 text-sm text-gray-900">{device.deviceCode}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">시리얼 번호</dt>
                  <dd className="mt-1 text-sm text-gray-900">{device.serialNumber || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">제조사</dt>
                  <dd className="mt-1 text-sm text-gray-900">{device.manufacturer || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">모델명</dt>
                  <dd className="mt-1 text-sm text-gray-900">{device.modelName || '-'}</dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">설치 위치</dt>
                  <dd className="mt-1 text-sm text-gray-900">{device.location}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">지역</dt>
                  <dd className="mt-1 text-sm text-gray-900">{device.region}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">상태</dt>
                  <dd className="mt-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      device.status === 'active' ? 'bg-green-100 text-green-800' :
                      device.status === 'maintenance' ? 'bg-yellow-100 text-yellow-800' :
                      device.status === 'defective' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {device.status === 'active' ? '정상' :
                       device.status === 'maintenance' ? '점검중' :
                       device.status === 'defective' ? '고장' : '비활성'}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>

            {/* Location */}
            {device.latitude && device.longitude && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">위치 정보</h3>
                <dl className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">위도</dt>
                    <dd className="mt-1 text-sm text-gray-900">{device.latitude.toFixed(6)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">경도</dt>
                    <dd className="mt-1 text-sm text-gray-900">{device.longitude.toFixed(6)}</dd>
                  </div>
                </dl>
                {/* Map placeholder */}
                <div className="bg-gray-200 rounded h-48 flex items-center justify-center text-gray-500">
                  지도 (향후 구현 예정)
                </div>
              </div>
            )}

            {/* Inspection Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">점검 정보</h3>
              <dl className="grid grid-cols-1 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">최근 점검일</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {device.lastInspectionDate
                      ? new Date(device.lastInspectionDate).toLocaleDateString('ko-KR')
                      : '점검 이력 없음'}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
            <button
              onClick={handleInspectionHistory}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              점검 이력 보기
            </button>
            <button
              onClick={handleStartInspection}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
            >
              점검 시작
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
