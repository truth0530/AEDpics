'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { user_role as UserRole } from '@prisma/client';
import { Search, User, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  region_code: string | null;
  organization_id: string | null;
  is_active: boolean;
  created_at: Date;
  approved_at: Date | null;
  approved_by: string | null;
  organizations: {
    id: string;
    name: string;
    type: string;
    region_code: string | null;
  } | null;
}

interface UsersResponse {
  users: UserProfile[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * 사용자 관리 페이지
 * Prisma API 기반으로 완전히 재구축됨 (2025-10-26)
 */
export default function AdminUsersPage() {
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [approvalRole, setApprovalRole] = useState<UserRole>('local_admin');
  const [rejectReason, setRejectReason] = useState('');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  const queryClient = useQueryClient();

  // 사용자 목록 조회
  const { data, isLoading, error } = useQuery<UsersResponse>({
    queryKey: ['admin', 'users', filter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter === 'pending') {
        params.append('role', 'pending_approval');
      } else if (filter === 'approved') {
        params.append('role', 'local_admin');
      }
      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to fetch users');
      }
      return res.json();
    },
    retry: 1
  });

  // 사용자 승인
  const approveMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: UserRole }) => {
      const res = await fetch(`/api/admin/users/${userId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to approve user');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setShowApproveModal(false);
      setSelectedUser(null);
      alert('사용자가 승인되었습니다.');
    },
    onError: (error: Error) => {
      alert(`승인 실패: ${error.message}`);
    }
  });

  // 사용자 거부
  const rejectMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
      const res = await fetch(`/api/admin/users/${userId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to reject user');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setShowRejectModal(false);
      setSelectedUser(null);
      setRejectReason('');
      alert('사용자가 거부되었습니다.');
    },
    onError: (error: Error) => {
      alert(`거부 실패: ${error.message}`);
    }
  });

  const handleApprove = (user: UserProfile) => {
    setSelectedUser(user);
    setApprovalRole('local_admin');
    setShowApproveModal(true);
  };

  const handleReject = (user: UserProfile) => {
    setSelectedUser(user);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const confirmApprove = () => {
    if (!selectedUser) return;
    approveMutation.mutate({ userId: selectedUser.id, role: approvalRole });
  };

  const confirmReject = () => {
    if (!selectedUser || !rejectReason.trim()) {
      alert('거부 사유를 입력해주세요.');
      return;
    }
    rejectMutation.mutate({ userId: selectedUser.id, reason: rejectReason });
  };

  const getRoleLabel = (role: UserRole): string => {
    const labels: Record<UserRole, string> = {
      master: 'Master 관리자',
      emergency_center_admin: '중앙응급의료센터',
      regional_emergency_center_admin: '지역응급의료지원센터',
      ministry_admin: '보건복지부',
      regional_admin: '지역 관리자',
      local_admin: '로컬 관리자',
      temporary_inspector: '임시 점검원',
      pending_approval: '승인 대기',
      email_verified: '이메일 인증 완료',
      rejected: '거부됨'
    };
    return labels[role] || role;
  };

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">사용자 관리</h1>
          <p className="text-gray-400">신규 가입 승인 및 사용자 관리</p>
        </div>

        {/* 필터 및 검색 */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'pending'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              승인 대기
            </button>
            <button
              onClick={() => setFilter('approved')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'approved'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              승인 완료
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              전체
            </button>
          </div>

          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="이름 또는 이메일로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* 로딩 상태 */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            <p className="text-gray-400 mt-4">사용자 목록을 불러오는 중...</p>
          </div>
        )}

        {/* 오류 상태 */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="w-5 h-5" />
              <p>오류가 발생했습니다: {(error as Error).message}</p>
            </div>
          </div>
        )}

        {/* 사용자 목록 */}
        {!isLoading && !error && (
          <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-800 border-b border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">사용자</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">조직</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">역할</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">가입일</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {data?.users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <User className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-400">사용자가 없습니다.</p>
                    </td>
                  </tr>
                ) : (
                  data?.users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-white">
                            {user.full_name || '이름 없음'}
                          </div>
                          <div className="text-sm text-gray-400">{user.email}</div>
                          {user.phone && (
                            <div className="text-xs text-gray-500 mt-1">{user.phone}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-300">
                          {user.organizations?.name || '조직 없음'}
                        </div>
                        {user.region_code && (
                          <div className="text-xs text-gray-500">{user.region_code}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.role === 'pending_approval'
                              ? 'bg-yellow-900 text-yellow-300'
                              : 'bg-green-900 text-green-300'
                          }`}
                        >
                          {getRoleLabel(user.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-sm text-gray-400">
                          <Clock className="w-4 h-4" />
                          {new Date(user.created_at).toLocaleDateString('ko-KR')}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {user.role === 'pending_approval' ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApprove(user)}
                              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-md transition-colors flex items-center gap-1"
                            >
                              <CheckCircle className="w-4 h-4" />
                              승인
                            </button>
                            <button
                              onClick={() => handleReject(user)}
                              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-md transition-colors flex items-center gap-1"
                            >
                              <XCircle className="w-4 h-4" />
                              거부
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">승인 완료</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 페이지네이션 */}
        {data && data.pagination.totalPages > 1 && (
          <div className="mt-6 flex justify-center gap-2">
            {Array.from({ length: data.pagination.totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                className={`px-4 py-2 rounded-lg ${
                  page === data.pagination.page
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {page}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 승인 모달 */}
      {showApproveModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4">사용자 승인</h2>
            <div className="mb-4">
              <p className="text-gray-300 mb-2">
                <span className="font-medium">{selectedUser.full_name}</span>님을 승인하시겠습니까?
              </p>
              <p className="text-sm text-gray-400">{selectedUser.email}</p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                역할 선택
              </label>
              <select
                value={approvalRole}
                onChange={(e) => setApprovalRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:border-blue-500"
              >
                <option value="local_admin">로컬 관리자</option>
                <option value="inspector">점검원</option>
                <option value="temporary_inspector">임시 점검원</option>
                <option value="regional_admin">지역 관리자</option>
              </select>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowApproveModal(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-md transition-colors"
                disabled={approveMutation.isPending}
              >
                취소
              </button>
              <button
                onClick={confirmApprove}
                disabled={approveMutation.isPending}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors disabled:opacity-50"
              >
                {approveMutation.isPending ? '처리 중...' : '승인'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 거부 모달 */}
      {showRejectModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4">사용자 거부</h2>
            <div className="mb-4">
              <p className="text-gray-300 mb-2">
                <span className="font-medium">{selectedUser.full_name}</span>님의 가입을 거부하시겠습니까?
              </p>
              <p className="text-sm text-gray-400">{selectedUser.email}</p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                거부 사유 (필수)
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="거부 사유를 입력해주세요..."
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-red-500 resize-none"
                rows={4}
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-md transition-colors"
                disabled={rejectMutation.isPending}
              >
                취소
              </button>
              <button
                onClick={confirmReject}
                disabled={rejectMutation.isPending || !rejectReason.trim()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors disabled:opacity-50"
              >
                {rejectMutation.isPending ? '처리 중...' : '거부'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
