'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { user_role as UserRole } from '@prisma/client';
import { Search, User, CheckCircle, XCircle, AlertCircle, Shield, Building2, Edit } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  last_login_at: Date | null;
  login_count: number;
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
 * 최적화된 테이블 레이아웃 (2025-11-02)
 */
export default function AdminUsersPage() {
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [approvalRole, setApprovalRole] = useState<UserRole>('local_admin');
  const [approvalRegionCode, setApprovalRegionCode] = useState<string>('');
  const [approvalOrgId, setApprovalOrgId] = useState<string>('');
  const [orgSearchQuery, setOrgSearchQuery] = useState('');
  const [orgSearchResults, setOrgSearchResults] = useState<any[]>([]);
  const [rejectReason, setRejectReason] = useState('');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
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

  // 마스터 계정 여부 확인
  const isMasterAccount = currentUserData?.user?.email === 'truth0530@nmc.or.kr';

  // 사용자 목록 조회
  const { data, isLoading, error } = useQuery<UsersResponse>({
    queryKey: ['admin', 'users', filter, searchQuery, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '20');

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
      setShowEditModal(false);
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
    const defaultRole = suggestDefaultRole(user.email);
    setApprovalRole(defaultRole);
    setApprovalRegionCode(user.region_code || '');
    setApprovalOrgId(user.organization_id || '');
    setOrgSearchQuery(user.organizations?.name || '');
    setOrgSearchResults([]);
    setShowApproveModal(true);
  };

  const handleEdit = (user: UserProfile) => {
    setSelectedUser(user);
    setApprovalRole(user.role);
    setApprovalRegionCode(user.region_code || '');
    setApprovalOrgId(user.organization_id || '');
    setOrgSearchQuery(user.organizations?.name || '');
    setOrgSearchResults([]);
    setShowEditModal(true);
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
    <div className="min-h-screen bg-gray-950 p-4">
      <div className="max-w-[1800px] mx-auto space-y-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">사용자 관리</h1>
            <p className="text-sm text-gray-400">신규 가입 승인 및 사용자 정보 관리</p>
          </div>
          <div className="text-sm text-gray-500">
            총 {data?.pagination.total || 0}명
          </div>
        </div>

        {/* 필터 및 검색 */}
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="pt-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => { setFilter('pending'); setPage(1); }}
                  variant={filter === 'pending' ? 'default' : 'outline'}
                  className={filter === 'pending' ? 'bg-yellow-600 hover:bg-yellow-700' : 'border-gray-700 text-gray-300 hover:bg-gray-800'}
                >
                  승인 대기
                </Button>
                <Button
                  size="sm"
                  onClick={() => { setFilter('approved'); setPage(1); }}
                  variant={filter === 'approved' ? 'default' : 'outline'}
                  className={filter === 'approved' ? 'bg-green-600 hover:bg-green-700' : 'border-gray-700 text-gray-300 hover:bg-gray-800'}
                >
                  승인 완료
                </Button>
                <Button
                  size="sm"
                  onClick={() => { setFilter('all'); setPage(1); }}
                  variant={filter === 'all' ? 'default' : 'outline'}
                  className={filter === 'all' ? 'bg-blue-600 hover:bg-blue-700' : 'border-gray-700 text-gray-300 hover:bg-gray-800'}
                >
                  전체
                </Button>
              </div>

              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="이름 또는 이메일로 검색..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                  className="pl-9 h-9 bg-gray-800 border-gray-700 text-white placeholder-gray-400 text-sm"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 로딩 */}
        {isLoading && (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="py-12">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                <p className="text-gray-400 mt-4 text-sm">사용자 목록을 불러오는 중...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 오류 */}
        {error && (
          <Alert className="border-red-500/20 bg-red-500/10">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <AlertDescription className="text-red-400">
              오류가 발생했습니다: {(error as Error).message}
            </AlertDescription>
          </Alert>
        )}

        {/* 사용자 목록 테이블 */}
        {!isLoading && !error && (
          <Card className="bg-gray-900 border-gray-800">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800 hover:bg-transparent">
                    <TableHead className="text-gray-400 text-xs">지역</TableHead>
                    <TableHead className="text-gray-400 text-xs">조직</TableHead>
                    <TableHead className="text-gray-400 text-xs">사용자</TableHead>
                    <TableHead className="text-gray-400 text-xs">이메일</TableHead>
                    <TableHead className="text-gray-400 text-xs">역할 및 권한</TableHead>
                    <TableHead className="text-gray-400 text-xs">가입일</TableHead>
                    <TableHead className="text-gray-400 text-xs">최근 로그인</TableHead>
                    <TableHead className="text-gray-400 text-xs text-center">로그인 횟수</TableHead>
                    <TableHead className="text-gray-400 text-xs text-right">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-32 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <User className="w-8 h-8 text-gray-600 mb-2" />
                          <p className="text-gray-400 text-sm">사용자가 없습니다.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    data?.users.map((user) => (
                      <TableRow key={user.id} className="border-gray-800 hover:bg-gray-800/30">
                        <TableCell className="text-gray-300 text-xs">
                          {user.region_code ? getRegionDisplay(user.region_code) : '-'}
                        </TableCell>
                        <TableCell className="text-gray-300 text-xs max-w-[200px] truncate">
                          {user.organizations?.name || '-'}
                        </TableCell>
                        <TableCell className="text-white text-xs font-medium">
                          {user.full_name || '-'}
                        </TableCell>
                        <TableCell className="text-gray-400 text-xs">
                          {user.email}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${getRoleBadgeClass(user.role)} text-xs`} variant="outline">
                            {getRoleLabel(user.role)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-400 text-xs whitespace-nowrap">
                          {new Date(user.created_at).toLocaleDateString('ko-KR')}
                        </TableCell>
                        <TableCell className="text-gray-400 text-xs whitespace-nowrap">
                          {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString('ko-KR') : '-'}
                        </TableCell>
                        <TableCell className="text-gray-400 text-xs text-center">
                          {user.login_count || 0}
                        </TableCell>
                        <TableCell className="text-right">
                          {user.role === 'pending_approval' ? (
                            <div className="flex gap-1 justify-end">
                              <Button
                                size="sm"
                                onClick={() => handleApprove(user)}
                                className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="w-3 h-3 mr-1" />
                                승인
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleReject(user)}
                                className="h-7 px-2 text-xs"
                              >
                                <XCircle className="w-3 h-3 mr-1" />
                                거부
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(user)}
                              className="h-7 px-2 text-xs border-gray-700 text-gray-300 hover:bg-gray-800"
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              수정
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}

        {/* 페이지네이션 */}
        {data && data.pagination.totalPages > 1 && (
          <div className="flex justify-center gap-1">
            {Array.from({ length: data.pagination.totalPages }, (_, i) => i + 1).map((pageNum) => (
              <Button
                key={pageNum}
                size="sm"
                onClick={() => setPage(pageNum)}
                variant={pageNum === page ? 'default' : 'outline'}
                className={`h-8 w-8 p-0 text-xs ${
                  pageNum === page
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'border-gray-700 text-gray-300 hover:bg-gray-800'
                }`}
              >
                {pageNum}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* 승인/수정 모달 */}
      <Dialog open={showApproveModal || showEditModal} onOpenChange={(open) => {
        setShowApproveModal(open);
        setShowEditModal(open);
      }}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {showApproveModal ? '사용자 승인' : '사용자 정보 수정'}
            </DialogTitle>
            <DialogDescription className="text-gray-400 text-sm">
              역할과 소속 정보를 확인하고 {showApproveModal ? '승인' : '수정'}합니다
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="grid grid-cols-2 gap-4 py-2">
              {/* 좌측: 사용자 기본 정보 */}
              <div className="space-y-3">
                <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                  <div className="text-xs text-gray-400 mb-2">사용자 정보</div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-400" />
                      <div>
                        <div className="text-sm font-medium text-white">{selectedUser.full_name}</div>
                        <div className="text-xs text-gray-400">{selectedUser.email}</div>
                      </div>
                    </div>
                    {selectedUser.phone && (
                      <div className="text-xs text-gray-500">{selectedUser.phone}</div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-gray-300">역할 선택</Label>
                  {!isMasterAccount && (
                    <Alert className="border-yellow-900/50 bg-yellow-950/30 p-2">
                      <AlertCircle className="h-3 w-3 text-yellow-500" />
                      <AlertDescription className="text-yellow-200/80 text-xs">
                        권장: <span className="font-semibold">{getRoleLabel(suggestDefaultRole(selectedUser.email))}</span>
                      </AlertDescription>
                    </Alert>
                  )}
                  {isMasterAccount && (
                    <Alert className="border-blue-900/50 bg-blue-950/30 p-2">
                      <Shield className="h-3 w-3 text-blue-500" />
                      <AlertDescription className="text-blue-200/80 text-xs">
                        마스터 권한: 모든 역할 선택 가능
                      </AlertDescription>
                    </Alert>
                  )}
                  <Select value={approvalRole} onValueChange={(value) => setApprovalRole(value as UserRole)}>
                    <SelectTrigger className="h-9 text-sm bg-gray-800 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700 max-h-60">
                      {(isMasterAccount ? APPROVABLE_ROLES : getAllowedRolesForDomain(selectedUser.email)).map((role) => (
                        <SelectItem key={role} value={role} className="text-white text-sm">
                          {getRoleLabel(role)} - {getRoleDescription(role)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 우측: 지역 및 조직 */}
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs text-gray-300">지역 선택</Label>
                  <Select value={approvalRegionCode} onValueChange={setApprovalRegionCode}>
                    <SelectTrigger className="h-9 text-sm bg-gray-800 border-gray-700 text-white">
                      <SelectValue placeholder="지역 선택" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700 max-h-60">
                      {REGION_FULL_NAMES.map((region) => (
                        <SelectItem key={region.code} value={region.code} className="text-white text-sm">
                          {region.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-gray-300">소속 기관</Label>
                  <div className="relative">
                    <Input
                      value={orgSearchQuery}
                      onChange={(e) => {
                        setOrgSearchQuery(e.target.value);
                        searchOrganizations(e.target.value);
                      }}
                      placeholder="기관명 입력"
                      className="h-9 text-sm bg-gray-800 border-gray-700 text-white"
                    />
                    {orgSearchResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                        {orgSearchResults.map((org) => (
                          <button
                            key={org.id}
                            type="button"
                            onClick={() => handleSelectOrganization(org)}
                            className="w-full text-left px-3 py-2 text-xs text-white hover:bg-gray-700 flex items-center gap-2"
                          >
                            <Building2 className="w-3 h-3 text-gray-400" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{org.name}</div>
                              <div className="text-xs text-gray-400">{getRegionDisplay(org.region_code)}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowApproveModal(false);
                setShowEditModal(false);
              }}
              disabled={approveMutation.isPending}
              className="h-8 text-xs border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              취소
            </Button>
            <Button
              size="sm"
              onClick={confirmApprove}
              disabled={approveMutation.isPending}
              className="h-8 text-xs bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              {approveMutation.isPending ? '처리 중...' : (showApproveModal ? '승인' : '수정')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 거부 모달 */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">사용자 거부</DialogTitle>
            <DialogDescription className="text-gray-400 text-sm">
              가입 신청을 거부하고 사유를 입력합니다
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-3">
              <div className="p-3 bg-red-900/10 rounded-lg border border-red-900/30">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-red-400" />
                  <div>
                    <div className="text-sm font-medium text-white">{selectedUser.full_name}</div>
                    <div className="text-xs text-gray-400">{selectedUser.email}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-gray-300">거부 사유 (필수)</Label>
                <Textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="거부 사유를 입력해주세요..."
                  className="text-sm bg-gray-800 border-gray-700 text-white resize-none"
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowRejectModal(false)}
              disabled={rejectMutation.isPending}
              className="h-8 text-xs border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              취소
            </Button>
            <Button
              size="sm"
              onClick={confirmReject}
              disabled={rejectMutation.isPending || !rejectReason.trim()}
              variant="destructive"
              className="h-8 text-xs"
            >
              <XCircle className="w-3 h-3 mr-1" />
              {rejectMutation.isPending ? '처리 중...' : '거부'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
