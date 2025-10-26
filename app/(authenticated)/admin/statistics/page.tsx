'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default function StatisticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const res = await fetch('/api/admin/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    }
  });

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">시스템 통계</h1>

      {isLoading && <div className="text-center py-8">로딩 중...</div>}

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader><CardTitle>사용자 통계</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>전체 사용자: {data.users?.total || 0}명</div>
                <div>승인 대기: {data.users?.pending || 0}명</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>조직 통계</CardTitle></CardHeader>
            <CardContent>
              <div>전체 조직: {data.organizations?.total || 0}개</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>AED 통계</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>전체 AED: {data.aedDevices?.total || 0}대</div>
                <div>최근 30일 점검: {data.inspections?.recent || 0}건</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
