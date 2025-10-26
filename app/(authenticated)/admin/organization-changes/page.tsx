'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default function OrganizationChangesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['organization-changes'],
    queryFn: async () => {
      const res = await fetch('/api/admin/organization-changes');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    }
  });

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">소속 변경 요청</h1>
      {isLoading && <div className="text-center py-8">로딩 중...</div>}
      {data?.requests?.length === 0 && <div className="text-center py-8">요청이 없습니다.</div>}
      <div className="space-y-4">
        {data?.requests?.map((req: any) => (
          <Card key={req.id}>
            <CardContent className="pt-6">
              <div className="font-medium">{req.user?.full_name}</div>
              <Badge className="mt-2">{req.status}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
