'use client';

import { useState, useEffect } from 'react';
import { UserRole } from '@/packages/types';
import { getGuidelineStats, getApprovalGuidelines } from '@/lib/utils/approval-helpers';
import { StatCardSkeleton } from '@/components/ui/StatCardSkeleton';

interface AdminStats {
  totalUsers: number;
  pendingApprovalCount: number;
  approvedTodayCount: number;
  rejectedTodayCount: number;
  averageApprovalScore: number;
  highRiskApplications: number;
  roleDistribution: Record<UserRole, number>;
}

interface AdminDashboardStatsProps {
  currentUserRole: UserRole;
}

export function AdminDashboardStats({ }: AdminDashboardStatsProps) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAdminStats = async () => {
    try {
      // API 엔드포인트에서 사용자 및 감사 로그 데이터 가져오기
      const response = await fetch('/api/admin/stats');

      if (!response.ok) {
        throw new Error('Failed to fetch admin stats');
      }

      const { users: allUsers, auditLogs } = await response.json();

      if (!allUsers) return;

      // 승인 대기 중인 사용자
      const pendingUsers = allUsers.filter((user: any) => user.role === 'pending_approval');

      const safeAuditLogs = auditLogs || [];

      const approvedToday = safeAuditLogs.filter((log: any) =>
        log.action === 'user_approved' || log.action === 'user_bulk_approved'
      ).length;

      const rejectedToday = safeAuditLogs.filter((log: any) =>
        log.action === 'user_rejected' || log.action === 'user_bulk_rejected'
      ).length;

      // 역할별 분포
      const roleDistribution = allUsers.reduce((acc: Record<UserRole, number>, user: any) => {
        const role = user.role as UserRole;
        acc[role] = (acc[role] || 0) + 1;
        return acc;
      }, {} as Record<UserRole, number>);

      // 승인 가이드라인 분석 (승인 대기 사용자만)
      let totalScore = 0;
      let highRiskCount = 0;

      for (const user of pendingUsers) {
        const guidelines = getApprovalGuidelines(
          user.email,
          user.organization_name,
          user.phone,
          user.remarks
        );
        const guidelineStats = getGuidelineStats(guidelines);
        totalScore += guidelineStats.passRate;

        if (guidelineStats.riskLevel === 'high') {
          highRiskCount++;
        }
      }

      const averageApprovalScore = pendingUsers.length > 0 ?
        Math.round(totalScore / pendingUsers.length) : 0;

      setStats({
        totalUsers: allUsers.length,
        pendingApprovalCount: pendingUsers.length,
        approvedTodayCount: approvedToday,
        rejectedTodayCount: rejectedToday,
        averageApprovalScore,
        highRiskApplications: highRiskCount,
        roleDistribution
      });
    } catch (error) {
      console.error('Error fetching admin stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadStats = async () => {
      await fetchAdminStats();
    };
    loadStats();
   
  }, []);

  if (loading) {
    return <StatCardSkeleton count={4} />;
  }

  if (!stats) {
    return (
      <div className="text-center py-8 text-gray-400">
        관리자 통계를 불러올 수 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 승인 관리 통계 */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">승인 관리 현황</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <div className="text-gray-400 text-sm">승인 대기</div>
              {stats.pendingApprovalCount > 0 && (
                <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
              )}
            </div>
            <div className="text-3xl font-bold text-yellow-400">
              {stats.pendingApprovalCount}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              평균 점수: {stats.averageApprovalScore}%
            </div>
          </div>

          <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
            <div className="text-gray-400 text-sm mb-2">오늘 승인</div>
            <div className="text-3xl font-bold text-green-400">
              {stats.approvedTodayCount}
            </div>
          </div>

          <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
            <div className="text-gray-400 text-sm mb-2">오늘 거부</div>
            <div className="text-3xl font-bold text-red-400">
              {stats.rejectedTodayCount}
            </div>
          </div>

          <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <div className="text-gray-400 text-sm">고위험 신청</div>
              {stats.highRiskApplications > 0 && (
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              )}
            </div>
            <div className="text-3xl font-bold text-red-400">
              {stats.highRiskApplications}
            </div>
          </div>
        </div>
      </div>

      {/* 사용자 분포 */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">사용자 역할 분포</h2>
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(stats.roleDistribution).map(([role, count]) => {
              if (count === 0) return null;

              const roleNames: Record<string, string> = {
                master: 'Master',
                emergency_center_admin: '중앙응급센터',
                ministry_admin: '보건복지부',
                regional_admin: '시도 관리자',
                local_admin: '보건소',
                temporary_inspector: '임시 점검원',
                pending_approval: '승인 대기',
                email_verified: '이메일 인증됨'
              };

              const roleColors: Record<string, string> = {
                master: 'text-purple-400',
                emergency_center_admin: 'text-red-400',
                ministry_admin: 'text-blue-400',
                regional_admin: 'text-green-400',
                local_admin: 'text-yellow-400',
                temporary_inspector: 'text-orange-400',
                pending_approval: 'text-gray-400',
                email_verified: 'text-gray-400'
              };

              return (
                <div key={role} className="text-center">
                  <div className={`text-2xl font-bold ${roleColors[role] || 'text-white'}`}>
                    {count}
                  </div>
                  <div className="text-sm text-gray-400">
                    {roleNames[role] || role}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-800">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">
                {stats.totalUsers}
              </div>
              <div className="text-sm text-gray-400">전체 사용자</div>
            </div>
          </div>
        </div>
      </div>

      {/* 빠른 작업 */}
      {stats.pendingApprovalCount > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">빠른 작업</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => window.location.href = '/admin/users?filter=pending'}
              className="bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg p-4 text-left transition-colors"
            >
              <div className="font-semibold">
                승인 대기자 검토 ({stats.pendingApprovalCount}명)
              </div>
              <div className="text-sm opacity-90">
                {stats.highRiskApplications > 0 &&
                  `고위험 ${stats.highRiskApplications}건 포함`
                }
              </div>
            </button>

            <button
              onClick={() => window.location.href = '/admin/users?filter=approved'}
              className="bg-gray-800 hover:bg-gray-700 text-white rounded-lg p-4 text-left transition-colors"
            >
              <div className="font-semibold">전체 사용자 관리</div>
              <div className="text-sm text-gray-400">
                {stats.totalUsers}명의 사용자 현황
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
