/**
 * Inspection Form Page
 *
 * Features:
 * - Device information display
 * - Inspection form fields
 * - Photo upload
 * - Submit inspection
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PhotoUpload from '@/components/inspection/PhotoUpload';

export default function InspectionFormPage() {
  const router = useRouter();
  const params = useParams();
  const serial = params.serial as string;

  const [device, setDevice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    status: 'pass',
    batteryStatus: 'good',
    paddleStatus: 'good',
    notes: '',
    photoPaths: [] as string[],
  });

  useEffect(() => {
    fetchDeviceInfo();
  }, [serial]);

  async function fetchDeviceInfo() {
    try {
      // In real implementation, fetch by serial number
      // For now, we'll use a placeholder
      setDevice({
        id: 1,
        deviceCode: serial,
        location: '대구광역시청 1층',
        region: 'DAE',
      });
      setLoading(false);
    } catch (err) {
      console.error('[Inspection Form] Error fetching device:', err);
      setError('장비 정보를 불러오는데 실패했습니다.');
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await fetch('/api/inspections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: device.id,
          inspectionDate: new Date().toISOString(),
          status: formData.status,
          batteryStatus: formData.batteryStatus,
          paddleStatus: formData.paddleStatus,
          notes: formData.notes,
          photoPaths: formData.photoPaths,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit inspection');
      }

      const data = await response.json();
      console.log('[Inspection Form] Success:', data);

      // Redirect to inspection detail
      router.push(`/inspections/${data.inspection.id}`);
    } catch (err) {
      console.error('[Inspection Form] Error:', err);
      setError('점검 기록 저장에 실패했습니다.');
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-500">장비 정보를 불러오는 중...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!device) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-red-600">장비를 찾을 수 없습니다.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AED 점검</h1>
          <p className="mt-1 text-sm text-gray-500">
            {device.deviceCode} - {device.location}
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              점검 결과 *
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="pass">정상</option>
              <option value="fail">이상</option>
              <option value="pending">재점검 필요</option>
            </select>
          </div>

          {/* Battery Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              배터리 상태
            </label>
            <select
              value={formData.batteryStatus}
              onChange={(e) => setFormData({ ...formData, batteryStatus: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="good">정상</option>
              <option value="low">낮음</option>
              <option value="replace">교체 필요</option>
            </select>
          </div>

          {/* Paddle Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              패들 상태
            </label>
            <select
              value={formData.paddleStatus}
              onChange={(e) => setFormData({ ...formData, paddleStatus: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="good">정상</option>
              <option value="damaged">손상</option>
              <option value="missing">분실</option>
              <option value="replace">교체 필요</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              비고
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="특이사항을 입력하세요..."
            />
          </div>

          {/* Photo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              점검 사진
            </label>
            <PhotoUpload
              onUploadComplete={(urls) => setFormData({ ...formData, photoPaths: urls })}
              category="inspection-photos"
              maxFiles={5}
            />
          </div>

          {/* Submit buttons */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {submitting ? '저장 중...' : '점검 완료'}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
