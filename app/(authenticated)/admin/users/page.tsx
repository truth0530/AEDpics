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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { REGION_FULL_NAMES } from '@/lib/constants/regions';

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
  const [approvalRegionCode, setApprovalRegionCode] = useState<string>('');
  const [approvalOrgId, setApprovalOrgId] = useState<string>('');
  const [orgSearchQuery, setOrgSearchQuery] = useState('');
  const [orgSearchResults, setOrgSearchResults] = useState<any[]>([]);
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
    mutationFn: async ({
      userId,
      role,
      regionCode,
      organizationId
    }: {
      userId: string;
      role: UserRole;
      regionCode: string;
      organizationId: string;
    }) => {
      const res = await fetch(`/api/admin/users/${userId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, regionCode, organizationId })
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
    // 사용자의 기존 지역과 소속 기관 설정
    setApprovalRegionCode(user.region_code || '');
    setApprovalOrgId(user.organization_id || '');
    setOrgSearchQuery(user.organizations?.name || '');
    setOrgSearchResults([]);
    setShowApproveModal(true);
  };

  const handleReject = (user: UserProfile) => {
    setSelectedUser(user);
    setRejectReason('');
    setShowRejectModal(true);
  };

  // 조직 검색
  const searchOrganizations = async (query: string) => {
    if (!query || query.length < 2) {
      setOrgSearchResults([]);
      return;
    }

    try {
      const params = new URLSearchParams({
        search: query,
        limit: '10'
      });
      if (approvalRegionCode) {
        params.append('region', approvalRegionCode);
      }

      const res = await fetch(`/api/admin/organizations?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setOrgSearchResults(data.organizations || []);
      }
    } catch (error) {
      console.error('조직 검색 오류:', error);
    }
  };

  // 조직 선택
  const handleSelectOrganization = (org: any) => {
    setApprovalOrgId(org.id);
    setOrgSearchQuery(org.name);
    setOrgSearchResults([]);
  };

  const confirmApprove = () => {
    if (!selectedUser) return;
    if (!approvalRegionCode) {
      alert('지역을 선택해주세요.');
      return;
    }
    if (!approvalOrgId) {
      alert('소속 기관을 선택해주세요.');
      return;
    }
    approveMutation.mutate({
      userId: selectedUser.id,
      role: approvalRole,
      regionCode: approvalRegionCode,
      organizationId: approvalOrgId
    });
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
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-2xl">
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-xl font-semibold">사용자 승인</DialogTitle>
            <DialogDescription className="text-gray-400 text-sm">
              역할과 소속 정보를 확인하고 사용자를 승인합니다
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-6 mt-2">
              <div className="p-4 bg-gradient-to-br from-gray-800/80 to-gray-800/40 rounded-xl border border-gray-700/50">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600/30 to-blue-500/10 flex items-center justify-center ring-2 ring-blue-500/20">
                    <User className="w-6 h-6 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white text-base">
                      {selectedUser.full_name}
                    </div>
                    <div className="text-sm text-gray-400 mt-0.5">{selectedUser.email}</div>
                    {selectedUser.phone && (
                      <div className="text-xs text-gray-500 mt-1">{selectedUser.phone}</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="role" className="text-sm font-medium text-gray-200">
                  역할 선택
                </Label>

                {/* 이메일 도메인 기반 권장 역할 안내 */}
                {!isMasterAccount && (
                  <Alert className="border-yellow-900/50 bg-yellow-950/30">
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                    <AlertTitle className="text-yellow-400 text-sm">도메인 기반 권장 역할</AlertTitle>
                    <AlertDescription className="text-yellow-200/80 text-xs mt-1">
                      이메일 도메인 (@{selectedUser.email.split('@')[1]})에 권장되는 역할은
                      <span className="font-semibold text-yellow-300"> {getRoleLabel(suggestDefaultRole(selectedUser.email))}</span>입니다.
                      {' '}다른 역할이 필요한 경우 마스터 계정(053-427-0530)에 문의하세요.
                    </AlertDescription>
                  </Alert>
                )}

                {isMasterAccount && (
                  <Alert className="border-blue-900/50 bg-blue-950/30">
                    <Shield className="h-4 w-4 text-blue-500" />
                    <AlertTitle className="text-blue-400 text-sm">마스터 계정 권한</AlertTitle>
                    <AlertDescription className="text-blue-200/80 text-xs mt-1">
                      모든 역할을 자유롭게 선택할 수 있습니다. 도메인 제약이 적용되지 않습니다.
                    </AlertDescription>
                  </Alert>
                )}

                <Select
                  value={approvalRole}
                  onValueChange={(value) => setApprovalRole(value as UserRole)}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white hover:bg-gray-750">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 max-h-80">
                    {(isMasterAccount
                      ? APPROVABLE_ROLES
                      : getAllowedRolesForDomain(selectedUser.email)
                    ).map((role) => (
                      <SelectItem
                        key={role}
                        value={role}
                        className="text-white hover:bg-gray-700 focus:bg-gray-700"
                      >
                        <div className="flex flex-col gap-0.5 py-1">
                          <span className="font-medium text-sm">{getRoleLabel(role)}</span>
                          <span className="text-xs text-gray-400">
                            {getRoleDescription(role)}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-400 leading-relaxed">
                  선택한 역할에 따라 사용자의 접근 권한이 결정됩니다
                </p>
              </div>

              {/* 지역 선택 */}
              <div className="space-y-3">
                <Label htmlFor="region" className="text-sm font-medium text-gray-200">
                  지역 선택
                </Label>
                <Select
                  value={approvalRegionCode}
                  onValueChange={setApprovalRegionCode}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white hover:bg-gray-750">
                    <SelectValue placeholder="지역을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 max-h-80">
                    {REGION_FULL_NAMES.map((region) => (
                      <SelectItem
                        key={region.code}
                        value={region.code}
                        className="text-white hover:bg-gray-700 focus:bg-gray-700"
                      >
                        {region.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-400 leading-relaxed">
                  실수로 잘못 선택한 지역은 수정할 수 있습니다
                </p>
              </div>

              {/* 소속 기관 선택 */}
              <div className="space-y-3">
                <Label htmlFor="organization" className="text-sm font-medium text-gray-200">
                  소속 기관
                </Label>
                <div className="relative">
                  <Input
                    value={orgSearchQuery}
                    onChange={(e) => {
                      setOrgSearchQuery(e.target.value);
                      searchOrganizations(e.target.value);
                    }}
                    placeholder="기관명을 입력하세요 (예: 서울응급의료지원센터)"
                    className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                  />
                  {orgSearchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1.5 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                      {orgSearchResults.map((org) => (
                        <button
                          key={org.id}
                          type="button"
                          onClick={() => handleSelectOrganization(org)}
                          className="w-full text-left px-4 py-3 text-sm text-white hover:bg-gray-700 transition-colors first:rounded-t-lg last:rounded-b-lg flex items-center gap-3"
                        >
                          <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{org.name}</div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {getRegionDisplay(org.region_code)}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  실수로 잘못 선택한 기관은 수정할 수 있습니다
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowApproveModal(false)}
              disabled={approveMutation.isPending}
              className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            >
              취소
            </Button>
            <Button
              onClick={confirmApprove}
              disabled={approveMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white transition-colors"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {approveMutation.isPending ? '처리 중...' : '승인'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 거부 모달 */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-2xl">
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-xl font-semibold">사용자 거부</DialogTitle>
            <DialogDescription className="text-gray-400 text-sm">
              가입 신청을 거부하고 사유를 입력합니다
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-6 mt-2">
              <div className="p-4 bg-gradient-to-br from-red-900/20 to-gray-800/40 rounded-xl border border-red-900/30">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-600/30 to-red-500/10 flex items-center justify-center ring-2 ring-red-500/20">
                    <User className="w-6 h-6 text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white text-base">
                      {selectedUser.full_name}
                    </div>
                    <div className="text-sm text-gray-400 mt-0.5">{selectedUser.email}</div>
                    {selectedUser.phone && (
                      <div className="text-xs text-gray-500 mt-1">{selectedUser.phone}</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="reason" className="text-sm font-medium text-gray-200">
                  거부 사유 (필수)
                </Label>
                <Textarea
                  id="reason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="거부 사유를 입력해주세요..."
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 resize-none focus:ring-2 focus:ring-red-500/20"
                  rows={4}
                />
                <p className="text-xs text-gray-400 leading-relaxed">
                  거부 사유는 사용자에게 이메일로 전달됩니다
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowRejectModal(false)}
              disabled={rejectMutation.isPending}
              className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            >
              취소
            </Button>
            <Button
              onClick={confirmReject}
              disabled={rejectMutation.isPending || !rejectReason.trim()}
              variant="destructive"
              className="transition-colors"
            >
              <XCircle className="w-4 h-4 mr-2" />
              {rejectMutation.isPending ? '처리 중...' : '거부'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
