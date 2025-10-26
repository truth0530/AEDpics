'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

interface AuditLog {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details: any;
  created_at: string;
}

interface HistoryResponse {
  history: AuditLog[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export default function ProfileHistoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [history, setHistory] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    if (status === 'authenticated') {
      fetchHistory();
    }
  }, [status, router]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/profile/history');
      if (!res.ok) {
        throw new Error('Failed to fetch profile history');
      }

      const data: HistoryResponse = await res.json();
      setHistory(data.history || []);
    } catch (err) {
      console.error('[ProfileHistory] Error:', err);
      setError('프로필 이력을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (action: string) => {
    if (action.includes('approved')) {
      return <Badge className="bg-green-500">승인됨</Badge>;
    } else if (action.includes('rejected')) {
      return <Badge variant="destructive">거부됨</Badge>;
    } else if (action.includes('updated')) {
      return <Badge variant="secondary">업데이트</Badge>;
    } else if (action.includes('created')) {
      return <Badge>생성됨</Badge>;
    }
    return <Badge variant="outline">{action}</Badge>;
  };

  if (status === 'loading' || loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
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
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">프로필 변경 이력</h1>
        <p className="text-muted-foreground mt-2">
          내 프로필과 관련된 모든 변경 사항을 확인할 수 있습니다.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>변경 이력</CardTitle>
          <CardDescription>
            총 {history.length}건의 이력이 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {history.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                변경 이력이 없습니다.
              </p>
            ) : (
              history.map((log) => (
                <div
                  key={log.id}
                  className="border rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">
                        {log.resource_type === 'user_profile' && '프로필 변경'}
                        {log.resource_type === 'organization_change_request' && '조직 변경 요청'}
                      </h3>
                      {getActionBadge(log.action)}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {new Date(log.created_at).toLocaleString('ko-KR')}
                    </span>
                  </div>

                  {log.details && Object.keys(log.details).length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      <pre className="bg-muted p-2 rounded text-xs overflow-auto">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
