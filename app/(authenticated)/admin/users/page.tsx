'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { user_role as UserRole } from '@prisma/client';
import { Search, User, Clock, CheckCircle, XCircle, AlertCircle, Shield, Building2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  APPROVABLE_ROLES,
  getRoleLabel,
  getRoleDescription,
  getRoleBadgeClass,
  getAccessLevelLabel,
  getRegionDisplay,
} from '@/lib/utils/user-roles';
import { suggestDefaultRole, getAllowedRolesForDomain } from '@/lib/auth/access-control';

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
 * 최신 shadcn/ui 디자인 및 통합 권한 체계 적용 (2025-10-31)
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

  // 현재 로그인한 사용자 정보 조회
  const { data: currentUserData } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await fetch('/api/auth/me');
      if (!res.ok) throw new Error('Failed to fetch current user');
      return res.json();
    },
  });

  // 마스터 계정 여부 확인 (truth0530@nmc.or.kr)
  const isMasterAccount = currentUserData?.user?.email === 'truth0530@nmc.or.kr';

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
    },
    onError: (error: Error) => {
      alert(`거부 실패: ${error.message}`);
    }
  });

  const handleApprove = (user: UserProfile) => {
    setSelectedUser(user);
    // 이메일 도메인 기반으로 기본 역할 설정
    const defaultRole = suggestDefaultRole(user.email);
    setApprovalRole(defaultRole);
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

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 헤더 */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">사용자 관리</h1>
          <p className="text-gray-400">신규 가입 승인 및 사용자 권한 관리</p>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-3">
              <CardDescription className="text-gray-400">승인 대기</CardDescription>
              <CardTitle className="text-2xl text-yellow-400">
                {filter === 'pending' ? data?.pagination.total || 0 : '-'}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-3">
              <CardDescription className="text-gray-400">승인 완료</CardDescription>
              <CardTitle className="text-2xl text-green-400">
                {filter === 'approved' ? data?.pagination.total || 0 : '-'}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-3">
              <CardDescription className="text-gray-400">전체 사용자</CardDescription>
              <CardTitle className="text-2xl text-blue-400">
                {filter === 'all' ? data?.pagination.total || 0 : '-'}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* 필터 및 검색 */}
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex gap-2">
                <Button
                  onClick={() => setFilter('pending')}
                  variant={filter === 'pending' ? 'default' : 'outline'}
                  className={
                    filter === 'pending'
                      ? 'bg-yellow-600 hover:bg-yellow-700'
                      : 'border-gray-700 text-gray-300 hover:bg-gray-800'
                  }
                >
                  승인 대기
                </Button>
                <Button
                  onClick={() => setFilter('approved')}
                  variant={filter === 'approved' ? 'default' : 'outline'}
                  className={
                    filter === 'approved'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'border-gray-700 text-gray-300 hover:bg-gray-800'
                  }
                >
                  승인 완료
                </Button>
                <Button
                  onClick={() => setFilter('all')}
                  variant={filter === 'all' ? 'default' : 'outline'}
                  className={
                    filter === 'all'
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'border-gray-700 text-gray-300 hover:bg-gray-800'
                  }
                >
                  전체
                </Button>
              </div>

              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  type="text"
                  placeholder="이름 또는 이메일로 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-gray-800 border-gray-700 text-white placeholder-gray-400"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 로딩 상태 */}
        {isLoading && (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="py-12">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                <p className="text-gray-400 mt-4">사용자 목록을 불러오는 중...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 오류 상태 */}
        {error && (
          <Card className="bg-red-500/10 border-red-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="w-5 h-5" />
                <p>오류가 발생했습니다: {(error as Error).message}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 사용자 목록 테이블 */}
        {!isLoading && !error && (
          <Card className="bg-gray-900 border-gray-800">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800 hover:bg-gray-800/50">
                  <TableHead className="text-gray-400">사용자</TableHead>
                  <TableHead className="text-gray-400">조직 및 지역</TableHead>
                  <TableHead className="text-gray-400">역할 및 권한</TableHead>
                  <TableHead className="text-gray-400">가입일</TableHead>
                  <TableHead className="text-gray-400 text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <User className="w-12 h-12 text-gray-600 mb-3" />
                        <p className="text-gray-400">사용자가 없습니다.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.users.map((user) => (
                    <TableRow
                      key={user.email}
                      className="border-gray-800 hover:bg-gray-800/50"
                    >
                      {/* 사용자 정보 */}
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium text-white">
                            {user.full_name || '이름 없음'}
                          </div>
                          <div className="text-sm text-gray-400">{user.email}</div>
                          {user.phone && (
                            <div className="text-xs text-gray-500">{user.phone}</div>
                          )}
                        </div>
                      </TableCell>

                      {/* 조직 및 지역 */}
                      <TableCell>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-gray-500" />
                            <span className="text-sm text-gray-300">
                              {user.organizations?.name || '조직 없음'}
                            </span>
                          </div>
                          {user.region_code && (
                            <div className="text-xs text-gray-400 pl-6">
                              {getRegionDisplay(user.region_code)}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      {/* 역할 및 권한 */}
                      <TableCell>
                        <div className="space-y-2">
                          <Badge
                            className={getRoleBadgeClass(user.role)}
                            variant="outline"
                          >
                            <Shield className="w-3 h-3 mr-1" />
                            {getRoleLabel(user.role)}
                          </Badge>
                          <div className="text-xs text-gray-500">
                            {getAccessLevelLabel(user.role)} 권한
                          </div>
                        </div>
                      </TableCell>

                      {/* 가입일 */}
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm text-gray-400">
                          <Clock className="w-4 h-4" />
                          {new Date(user.created_at).toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </div>
                      </TableCell>

                      {/* 작업 버튼 */}
                      <TableCell className="text-right">
                        {user.role === 'pending_approval' ? (
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              onClick={() => handleApprove(user)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              승인
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleReject(user)}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              거부
                            </Button>
                          </div>
                        ) : (
                          <Badge variant="outline" className="bg-gray-800/50 border-gray-700">
                            승인 완료
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* 페이지네이션 */}
        {data && data.pagination.totalPages > 1 && (
          <div className="flex justify-center gap-2">
            {Array.from({ length: data.pagination.totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant={page === data.pagination.page ? 'default' : 'outline'}
                className={
                  page === data.pagination.page
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'border-gray-700 text-gray-300 hover:bg-gray-800'
                }
              >
                {page}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* 승인 모달 */}
      <Dialog open={showApproveModal} onOpenChange={setShowApproveModal}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle>사용자 승인</DialogTitle>
            <DialogDescription className="text-gray-400">
              권한을 선택하여 사용자를 승인합니다
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <div className="font-medium text-white">
                      {selectedUser.full_name}
                    </div>
                    <div className="text-sm text-gray-400">{selectedUser.email}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role" className="text-gray-300">
                  역할 선택
                </Label>

                {/* 이메일 도메인 기반 권장 역할 안내 */}
                {!isMasterAccount && (
                  <div className="text-sm text-yellow-400 bg-yellow-900/20 p-3 rounded border border-yellow-700/50">
                    <div className="font-medium mb-1">도메인 기반 권장 역할</div>
                    <div>
                      이메일 도메인 (@{selectedUser.email.split('@')[1]}): <strong>{getRoleLabel(suggestDefaultRole(selectedUser.email))}</strong>
                    </div>
                    <div className="text-xs text-yellow-300 mt-1">
                      다른 역할로 변경하려면 마스터 계정이 필요합니다.
                    </div>
                  </div>
                )}

                {isMasterAccount && (
                  <div className="text-sm text-blue-400 bg-blue-900/20 p-3 rounded border border-blue-700/50">
                    <div className="font-medium mb-1">마스터 계정 권한</div>
                    <div className="text-xs">
                      모든 역할 선택 가능 (도메인 제약 무시)
                    </div>
                  </div>
                )}

                <Select
                  value={approvalRole}
                  onValueChange={(value) => setApprovalRole(value as UserRole)}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    {(isMasterAccount
                      ? APPROVABLE_ROLES
                      : getAllowedRolesForDomain(selectedUser.email)
                    ).map((role) => (
                      <SelectItem
                        key={role}
                        value={role}
                        className="text-white hover:bg-gray-700"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{getRoleLabel(role)}</span>
                          <span className="text-xs text-gray-400">
                            {getRoleDescription(role)}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  선택한 역할에 따라 사용자의 접근 권한이 결정됩니다
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApproveModal(false)}
              disabled={approveMutation.isPending}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              취소
            </Button>
            <Button
              onClick={confirmApprove}
              disabled={approveMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {approveMutation.isPending ? '처리 중...' : '승인'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 거부 모달 */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle>사용자 거부</DialogTitle>
            <DialogDescription className="text-gray-400">
              가입 신청을 거부하고 사유를 입력합니다
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-600/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <div className="font-medium text-white">
                      {selectedUser.full_name}
                    </div>
                    <div className="text-sm text-gray-400">{selectedUser.email}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason" className="text-gray-300">
                  거부 사유 (필수)
                </Label>
                <Textarea
                  id="reason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="거부 사유를 입력해주세요..."
                  className="bg-gray-800 border-gray-700 text-white placeholder-gray-500 resize-none"
                  rows={4}
                />
                <p className="text-xs text-gray-500">
                  거부 사유는 사용자에게 이메일로 전달됩니다
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRejectModal(false)}
              disabled={rejectMutation.isPending}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              취소
            </Button>
            <Button
              onClick={confirmReject}
              disabled={rejectMutation.isPending || !rejectReason.trim()}
              variant="destructive"
            >
              {rejectMutation.isPending ? '처리 중...' : '거부'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
