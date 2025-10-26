'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

interface AedDevice {
  equipment_serial: string;
  place_name: string;
  address: string;
  building_name?: string;
  sido?: string;
  gugun?: string;
  battery_expiry_date?: string;
  patch_expiry_date?: string;
  days_until_battery_expiry?: number;
  days_until_patch_expiry?: number;
  assignment_id?: string;
  assignment_status?: string;
  scheduled_date?: string;
}

interface Stats {
  total: number;
  assigned: number;
  unassigned: number;
  urgent: number;
}

interface PriorityResponse {
  success: boolean;
  data: AedDevice[];
  stats: Stats;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function PriorityPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [devices, setDevices] = useState<AedDevice[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    if (status === 'authenticated') {
      fetchPriorityDevices();
    }
  }, [status, pagination.page, router]);

  const fetchPriorityDevices = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/aed-data/priority?page=${pagination.page}&limit=${pagination.limit}`);

      if (!res.ok) {
        throw new Error('Failed to fetch priority devices');
      }

      const data: PriorityResponse = await res.json();

      setDevices(data.data || []);
      setStats(data.stats);
      setPagination(data.pagination);
    } catch (err) {
      console.error('[PriorityPage] Error:', err);
      setError('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const getUrgencyBadge = (batteryDays?: number, patchDays?: number) => {
    const minDays = Math.min(batteryDays || 9999, patchDays || 9999);

    if (minDays < 7) {
      return <Badge variant="destructive">긴급 (7일 이내)</Badge>;
    } else if (minDays < 30) {
      return <Badge variant="secondary">주의 (30일 이내)</Badge>;
    } else {
      return <Badge variant="outline">정상</Badge>;
    }
  };

  const getAssignmentBadge = (device: AedDevice) => {
    if (!device.assignment_id) {
      return <Badge variant="outline">미할당</Badge>;
    }

    switch (device.assignment_status) {
      case 'pending':
        return <Badge>할당됨</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-500">진행중</Badge>;
      default:
        return <Badge variant="outline">{device.assignment_status}</Badge>;
    }
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  if (status === 'loading' || loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">오류 발생</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
            <Button onClick={fetchPriorityDevices} className="mt-4">
              다시 시도
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">우선순위 점검 대상</h1>
        <p className="text-muted-foreground mt-2">
          유효기간 기준 우선순위가 높은 AED 목록입니다.
        </p>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>전체 대상</CardDescription>
              <CardTitle className="text-3xl">{stats.total}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>긴급 (30일 이내)</CardDescription>
              <CardTitle className="text-3xl text-red-600">{stats.urgent}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>할당됨</CardDescription>
              <CardTitle className="text-3xl text-blue-600">{stats.assigned}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>미할당</CardDescription>
              <CardTitle className="text-3xl text-gray-600">{stats.unassigned}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>AED 목록</CardTitle>
          <CardDescription>
            총 {pagination.total}건 (페이지 {pagination.page} / {pagination.totalPages})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {devices.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                조회된 데이터가 없습니다.
              </p>
            ) : (
              devices.map((device) => (
                <div
                  key={device.equipment_serial}
                  className="border rounded-lg p-4 hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => router.push(`/inspection/${device.equipment_serial}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{device.place_name || '장소명 없음'}</h3>
                        {getUrgencyBadge(device.days_until_battery_expiry, device.days_until_patch_expiry)}
                        {getAssignmentBadge(device)}
                      </div>

                      <p className="text-sm text-muted-foreground">
                        시리얼: {device.equipment_serial}
                      </p>

                      <p className="text-sm text-muted-foreground">
                        {device.address} {device.building_name && `(${device.building_name})`}
                      </p>

                      <div className="flex gap-4 text-xs text-muted-foreground mt-2">
                        {device.battery_expiry_date && (
                          <span>
                            배터리: {new Date(device.battery_expiry_date).toLocaleDateString()}
                            ({device.days_until_battery_expiry}일 남음)
                          </span>
                        )}
                        {device.patch_expiry_date && (
                          <span>
                            패드: {new Date(device.patch_expiry_date).toLocaleDateString()}
                            ({device.days_until_patch_expiry}일 남음)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
              >
                이전
              </Button>

              <span className="text-sm text-muted-foreground px-4">
                {pagination.page} / {pagination.totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
              >
                다음
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
