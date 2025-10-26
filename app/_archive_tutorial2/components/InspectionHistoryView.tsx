'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { inspectionService, AEDInspectionRecord } from '../services/InspectionService';
import InspectionContextInfo from './InspectionContextInfo';

interface InspectionHistoryViewProps {
  equipmentSerial: string;
  limit?: number;
  showContextInfo?: boolean;
}

export const InspectionHistoryView: React.FC<InspectionHistoryViewProps> = ({
  equipmentSerial,
  limit = 10,
  showContextInfo = true
}) => {
  const [inspections, setInspections] = useState<(AEDInspectionRecord & {
    interpretation?: {
      batteryInterpretation?: string;
      padInterpretation?: string;
      deviceInterpretation?: string;
      contextNote?: string;
    }
  })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInspectionHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const history = await inspectionService.getInspectionHistory(equipmentSerial, limit);
      setInspections(history);
    } catch (err) {
      setError('점검 이력을 불러오는데 실패했습니다.');
      console.error('점검 이력 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  }, [equipmentSerial, limit]);

  useEffect(() => {
    loadInspectionHistory();
  }, [loadInspectionHistory]);


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'pass':
        return 'bg-green-100 text-green-800';
      case 'fail':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'partial':
        return 'bg-blue-100 text-blue-800';
      case 'requires_attention':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">점검 이력을 불러오는 중...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <span className="text-red-600">⚠️</span>
          <span className="ml-2 text-red-700">{error}</span>
        </div>
        <button
          onClick={loadInspectionHistory}
          className="mt-2 px-3 py-1 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (inspections.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-500 mb-4">
          <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <p className="text-gray-500">아직 점검 이력이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          점검 이력 ({inspections.length}건)
        </h3>
        {inspections.length === limit && (
          <button
            onClick={() => loadInspectionHistory()}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            더 보기
          </button>
        )}
      </div>

      {inspections.map((inspection, index) => (
        <div key={inspection.id} className="bg-white border border-gray-200 rounded-lg p-6">
          {/* 점검 기본 정보 */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-lg font-medium text-gray-900">
                  {index + 1}. {formatDate(inspection.inspection_date)}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(inspection.overall_status)}`}>
                  {inspection.overall_status}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                점검자: {inspection.inspector_name || '미기록'} |
                점검 유형: {inspection.inspection_type}
              </div>
            </div>
          </div>

          {/* 점검 결과 요약 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-gray-50 rounded p-3">
              <div className="text-sm font-medium text-gray-700">배터리</div>
              <div className="text-sm text-gray-600">{inspection.battery_status}</div>
              {inspection.battery_expiry_checked && (
                <div className="text-xs text-gray-500">유효기간: {inspection.battery_expiry_checked}</div>
              )}
            </div>
            <div className="bg-gray-50 rounded p-3">
              <div className="text-sm font-medium text-gray-700">패드</div>
              <div className="text-sm text-gray-600">{inspection.pad_status}</div>
              {inspection.pad_expiry_checked && (
                <div className="text-xs text-gray-500">유효기간: {inspection.pad_expiry_checked}</div>
              )}
            </div>
            <div className="bg-gray-50 rounded p-3">
              <div className="text-sm font-medium text-gray-700">장치</div>
              <div className="text-sm text-gray-600">{inspection.device_status}</div>
              {inspection.indicator_status && (
                <div className="text-xs text-gray-500">표시등: {inspection.indicator_status}</div>
              )}
            </div>
          </div>

          {/* 맥락 정보 표시 */}
          {showContextInfo && inspection.interpretation && (
            <InspectionContextInfo
              record={inspection}
              interpretation={inspection.interpretation}
              showDetailsButton={true}
            />
          )}

          {/* 발견된 문제 및 조치사항 */}
          {(inspection.issues_found || inspection.action_taken) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-3">
              {inspection.issues_found && (
                <div className="mb-2">
                  <span className="font-medium text-yellow-800">발견된 문제:</span>
                  <p className="text-sm text-yellow-700 mt-1">{inspection.issues_found}</p>
                </div>
              )}
              {inspection.action_taken && (
                <div>
                  <span className="font-medium text-yellow-800">조치사항:</span>
                  <p className="text-sm text-yellow-700 mt-1">{inspection.action_taken}</p>
                </div>
              )}
            </div>
          )}

          {/* 메모 */}
          {inspection.notes && (
            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <span className="font-medium text-blue-800">메모:</span>
              <p className="text-sm text-blue-700 mt-1">{inspection.notes}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default InspectionHistoryView;