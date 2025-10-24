/**
 * Dashboard Page
 *
 * Features:
 * - Overview statistics
 * - Recent inspections
 * - Online users (real-time)
 * - Quick actions
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { getRealtimeClient } from '@/lib/realtime/socket-client';
import { useRealtimeInspections } from '@/hooks/useRealtimeInspections';

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState({
    totalDevices: 0,
    activeDevices: 0,
    recentInspections: 0,
    pendingAssignments: 0,
  });
  const [recentInspections, setRecentInspections] = useState<any[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const { isConnected, latestUpdate } = useRealtimeInspections();

  useEffect(() => {
    fetchDashboardData();
    initializeRealtime();
  }, []);

  useEffect(() => {
    if (latestUpdate) {
      console.log('[Dashboard] New inspection update:', latestUpdate);
      fetchDashboardData(); // Refresh on updates
    }
  }, [latestUpdate]);

  async function fetchDashboardData() {
    try {
      // Fetch statistics
      const [devicesRes, inspectionsRes] = await Promise.all([
        fetch('/api/aed-data?limit=1'),
        fetch('/api/inspections?limit=5'),
      ]);

      if (devicesRes.ok) {
        const devicesData = await devicesRes.json();
        setStats((prev) => ({
          ...prev,
          totalDevices: devicesData.pagination?.total || 0,
          activeDevices: devicesData.data?.filter((d: any) => d.status === 'active').length || 0,
        }));
      }

      if (inspectionsRes.ok) {
        const inspectionsData = await inspectionsRes.json();
        setRecentInspections(inspectionsData.data || []);
        setStats((prev) => ({
          ...prev,
          recentInspections: inspectionsData.pagination?.total || 0,
        }));
      }

      setLoading(false);
    } catch (error) {
      console.error('[Dashboard] Error fetching data:', error);
      setLoading(false);
    }
  }

  function initializeRealtime() {
    const client = getRealtimeClient();

    // Subscribe to presence updates
    const unsubPresence = client.subscribe('presence', () => {
      setOnlineUsers(client.getOnlineUsers());
    });

    return () => {
      unsubPresence();
    };
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-500">대시보드를 불러오는 중...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Real-time connection indicator */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
          <div className="flex items-center space-x-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-sm text-gray-500">
              {isConnected ? '실시간 연결됨' : '연결 끊김'}
            </span>
          </div>
        </div>

        {/* Statistics cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="전체 장비"
            value={stats.totalDevices}
            icon="🚑"
            color="blue"
          />
          <StatCard
            title="정상 장비"
            value={stats.activeDevices}
            icon="✅"
            color="green"
          />
          <StatCard
            title="점검 기록"
            value={stats.recentInspections}
            icon="📋"
            color="purple"
          />
          <StatCard
            title="대기 중 배정"
            value={stats.pendingAssignments}
            icon="⏳"
            color="yellow"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent inspections */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">최근 점검</h2>
              <button
                onClick={() => router.push('/inspections')}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                전체보기
              </button>
            </div>
            {recentInspections.length > 0 ? (
              <div className="space-y-3">
                {recentInspections.map((inspection) => (
                  <div
                    key={inspection.id}
                    className="flex items-start justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                    onClick={() => router.push(`/inspections/${inspection.id}`)}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {inspection.device.deviceCode}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(inspection.inspectionDate).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        inspection.status === 'pass'
                          ? 'bg-green-100 text-green-800'
                          : inspection.status === 'fail'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {inspection.status === 'pass' ? '정상' : inspection.status === 'fail' ? '이상' : '대기'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                최근 점검 기록이 없습니다.
              </p>
            )}
          </div>

          {/* Online users */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              접속 중인 사용자 ({onlineUsers.length})
            </h2>
            {onlineUsers.length > 0 ? (
              <div className="space-y-2">
                {onlineUsers.map((user) => (
                  <div key={user.userId} className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {user.userEmail?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {user.userEmail || `User ${user.userId}`}
                      </p>
                      {user.currentPage && (
                        <p className="text-xs text-gray-500">{user.currentPage}</p>
                      )}
                    </div>
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                현재 접속 중인 사용자가 없습니다.
              </p>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">빠른 작업</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => router.push('/inspection/new')}
              className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              <span className="text-2xl mr-2">➕</span>
              <span className="text-sm font-medium text-gray-700">새 점검 생성</span>
            </button>
            <button
              onClick={() => router.push('/aed-data')}
              className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              <span className="text-2xl mr-2">🚑</span>
              <span className="text-sm font-medium text-gray-700">장비 조회</span>
            </button>
            <button
              onClick={() => router.push('/assignments')}
              className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              <span className="text-2xl mr-2">📋</span>
              <span className="text-sm font-medium text-gray-700">배정 관리</span>
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: string;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    yellow: 'bg-yellow-50 text-yellow-600',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <span className="text-2xl">{icon}</span>
        </div>
      </div>
    </div>
  );
}
