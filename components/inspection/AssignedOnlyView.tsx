'use client';

import { useState, useEffect } from 'react';
import { UserProfile } from '@/packages/types';
import { RefreshCw, AlertTriangle, Clock, Calendar } from 'lucide-react';
import { toast } from 'sonner';

interface DeviceCardProps {
  device: any;
  onInspectionStart: (serial: string) => void;
}

function DeviceInspectionCard({ device, onInspectionStart }: DeviceCardProps) {
  const today = new Date();
  const issues: string[] = [];

  // 배터리 만료 확인
  if (device.battery_expiry_date) {
    const batteryExpiry = new Date(device.battery_expiry_date);
    if (batteryExpiry < today) {
      issues.push('배터리 만료');
    }
  }

  // 패드 만료 확인
  if (device.patch_expiry_date) {
    const padExpiry = new Date(device.patch_expiry_date);
    if (padExpiry < today) {
      issues.push('패드 만료');
    }
  }

  // 최근 점검 60일 경과 확인
  if (device.last_inspection_date) {
    const lastInspection = new Date(device.last_inspection_date);
    const daysSinceInspection = Math.floor((today.getTime() - lastInspection.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceInspection > 60) {
      issues.push(`점검 ${daysSinceInspection}일 경과`);
    }
  } else {
    issues.push('미점검');
  }

  // 좌표 없음 확인
  if (!device.latitude || !device.longitude) {
    issues.push('좌표 없음');
  }

  // 교체일 만료 확인
  if (device.replacement_date) {
    const replacementDate = new Date(device.replacement_date);
    if (replacementDate < today) {
      issues.push('교체일 만료');
    }
  }

  // 외부 표출 차단 확인 (이동식 장비 제외)
  const isMobileEquipment = device.external_non_display_reason?.includes('구비의무기관(119구급차');
  if (device.external_non_display_reason && !isMobileEquipment) {
    issues.push('외부 표출 차단');
  }

  const isNormal = issues.length === 0;

  // 긴급도 뱃지 결정
  const getUrgencyBadge = () => {
    if (device.inspection_urgency === 'overdue') {
      return <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-800 border border-red-200">기한초과</span>;
    } else if (device.inspection_urgency === 'today') {
      return <span className="px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-800 border border-orange-200">오늘</span>;
    } else if (device.inspection_urgency === 'upcoming') {
      return <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800 border border-blue-200">예정</span>;
    }
    return null;
  };

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:bg-gray-800/70 transition-all">
      <div className="space-y-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-semibold text-gray-100">{device.equipment_serial}</p>
              {getUrgencyBadge()}
            </div>
            <p className="text-sm text-gray-400">{device.management_number || '관리번호 없음'}</p>
          </div>
          <span className={`px-2 py-1 text-xs rounded-full whitespace-nowrap ${
            isNormal
              ? 'bg-green-900/20 text-green-300 border border-green-600/30'
              : 'bg-red-900/20 text-red-300 border border-red-600/30'
          }`}>
            {isNormal ? '정상' : `${issues.length}건`}
          </span>
        </div>

        {/* 일정 정보 */}
        {device.scheduled_date && (
          <div className="flex items-center gap-2 text-sm text-gray-300 bg-gray-900/50 px-3 py-2 rounded">
            <Calendar className="w-4 h-4" />
            <span>예정일: {new Date(device.scheduled_date).toLocaleDateString('ko-KR')}</span>
          </div>
        )}

        {/* 이슈 표시 */}
        {!isNormal && (
          <div className="flex flex-wrap gap-1">
            {issues.map((issue, index) => (
              <span key={index} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-900/20 text-red-300 border border-red-600/30">
                {issue}
              </span>
            ))}
          </div>
        )}

        <div className="space-y-1 text-sm text-gray-400">
          <p>설치장소: {device.installation_org || device.installation_institution || '-'}</p>
          <p>주소: {device.address || device.installation_address || '-'}</p>
          {device.last_inspection_date && (
            <p>최종점검: {new Date(device.last_inspection_date).toLocaleDateString('ko-KR')}</p>
          )}
        </div>

        <button
          onClick={() => onInspectionStart(device.equipment_serial)}
          className="w-full mt-3 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition-colors text-sm font-medium"
        >
          점검 시작
        </button>
      </div>
    </div>
  );
}

export function AssignedOnlyView({ user }: { user: UserProfile }) {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const loadAssignedDevices = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/inspections/field/assigned');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load assigned devices');
      }

      const result = await response.json();
      setDevices(result.data || []);
      setStats(result.stats || null);
      setLastSync(new Date());
    } catch (err: any) {
      console.error('Error loading assigned devices:', err);
      setError(err.message || '할당된 장비를 불러오는데 실패했습니다.');
      toast.error(err.message || '데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssignedDevices();
  }, []);

  const handleInspectionStart = (serial: string) => {
    window.location.href = `/inspection/${serial}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
        <p className="mt-4 text-gray-300">할당된 장비를 불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="max-w-md mx-auto">
          <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-300">데이터 로드 실패</h3>
                <p className="text-sm text-red-400 mt-1">{error}</p>
              </div>
            </div>
          </div>
          <button
            onClick={loadAssignedDevices}
            className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="p-8">
        <div className="max-w-md mx-auto text-center">
          <AlertTriangle className="w-16 h-16 mx-auto text-yellow-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-100 mb-2">배정된 장비가 없습니다</h2>
          <p className="text-gray-400 mb-6">
            관할보건소에서 현장점검대상 장비를 추가해야 점검을 진행할 수 있습니다.
          </p>
          <button
            onClick={loadAssignedDevices}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg inline-flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            새로고침
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-7xl mx-auto">
      {/* 헤더 및 통계 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">할당된 점검 목록</h1>
            <p className="text-sm text-gray-400 mt-1">
              총 {devices.length}개의 장비가 할당되었습니다.
            </p>
          </div>
          <div className="flex items-center gap-4">
            {lastSync && (
              <span className="text-gray-500 text-sm">
                마지막 동기화: {lastSync.toLocaleTimeString('ko-KR')}
              </span>
            )}
            <button
              onClick={loadAssignedDevices}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              title="새로고침"
            >
              <RefreshCw className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* 통계 - 한 줄로 압축 */}
        {stats && (
          <div className="flex flex-wrap gap-3 text-sm mb-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/50 border border-gray-700 rounded">
              <span className="text-gray-400">기한초과</span>
              <span className="font-bold text-red-400">{stats.overdue || 0}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/50 border border-gray-700 rounded">
              <span className="text-gray-400">오늘</span>
              <span className="font-bold text-orange-400">{stats.today || 0}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/50 border border-gray-700 rounded">
              <span className="text-gray-400">예정</span>
              <span className="font-bold text-blue-400">{stats.upcoming || 0}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/50 border border-gray-700 rounded">
              <span className="text-gray-400">진행중</span>
              <span className="font-bold text-green-400">{stats.in_progress || 0}</span>
            </div>
          </div>
        )}
      </div>

      {/* 장비 목록 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {devices.map(device => (
          <DeviceInspectionCard
            key={device.id || device.equipment_serial}
            device={device}
            onInspectionStart={handleInspectionStart}
          />
        ))}
      </div>
    </div>
  );
}