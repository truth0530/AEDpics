'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

interface Organization {
  id: string;
  name: string;
  type: string;
  region_code: string;
  _count: {
    user_profiles: number;
  };
}

interface OrganizationsResponse {
  organizations: Organization[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export default function AdminOrganizationsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const queryClient = useQueryClient();

  // 조직 목록 조회
  const { data, isLoading, error } = useQuery<OrganizationsResponse>({
    queryKey: ['admin-organizations', page, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(search && { search })
      });
      const res = await fetch(`/api/admin/organizations?${params}`);
      if (!res.ok) throw new Error('Failed to fetch organizations');
      return res.json();
    }
  });

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      central: '중앙',
      metropolitan_city: '특별시/광역시',
      province: '도',
      city: '시',
      district: '구/군',
      health_center: '보건소'
    };
    return labels[type] || type;
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">조직 관리</h1>
        <p className="text-gray-600">
          시스템에 등록된 조직을 조회하고 관리합니다.
        </p>
      </div>

      {/* 검색 */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <Input
              placeholder="조직명 검색..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch}>검색</Button>
            {search && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('');
                  setSearchInput('');
                  setPage(1);
                }}
              >
                초기화
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 통계 */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                총 조직 수
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.pagination.total}개</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                현재 페이지
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.pagination.page} / {data.pagination.totalPages}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                표시 중
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.organizations.length}개
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 조직 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>조직 목록</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="text-center py-8 text-gray-500">로딩 중...</div>
          )}

          {error && (
            <div className="text-center py-8 text-red-500">
              오류가 발생했습니다: {(error as Error).message}
            </div>
          )}

          {data && data.organizations.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              조직이 없습니다.
            </div>
          )}

          {data && data.organizations.length > 0 && (
            <div className="space-y-2">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">조직명</th>
                      <th className="text-left py-3 px-4">유형</th>
                      <th className="text-left py-3 px-4">지역</th>
                      <th className="text-right py-3 px-4">사용자 수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.organizations.map((org) => (
                      <tr key={org.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium">{org.name}</td>
                        <td className="py-3 px-4">
                          <Badge variant="outline">
                            {getTypeLabel(org.type)}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                            {org.region_code}
                          </code>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {org._count.user_profiles}명
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 페이지네이션 */}
              {data.pagination.totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    이전
                  </Button>
                  <div className="flex items-center px-4">
                    {page} / {data.pagination.totalPages}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= data.pagination.totalPages}
                  >
                    다음
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
