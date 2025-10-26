'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const dynamic = 'force-dynamic';

interface OrganizationChangeRequest {
  id: string;
  status: string;
  reason: string;
  created_at: string;
  requested_organization: {
    id: string;
    name: string;
  };
  current_organization: {
    id: string;
    name: string;
  };
}

export default function ChangeOrganizationPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [requests, setRequests] = useState<OrganizationChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    if (status === 'authenticated') {
      fetchRequests();
    }
  }, [status, router]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/profile/organization-change');
      if (!res.ok) {
        throw new Error('Failed to fetch organization change requests');
      }

      const data = await res.json();
      setRequests(data.requests || []);
    } catch (err) {
      console.error('[ChangeOrganization] Error:', err);
      setError('조직 변경 요청을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    if (!confirm('정말로 이 요청을 취소하시겠습니까?')) {
      return;
    }

    try {
      const res = await fetch(`/api/profile/organization-change/${requestId}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        throw new Error('Failed to cancel request');
      }

      alert('요청이 취소되었습니다.');
      fetchRequests();
    } catch (err) {
      console.error('[CancelRequest] Error:', err);
      alert('요청 취소에 실패했습니다.');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge>대기중</Badge>;
      case 'approved':
        return <Badge className="bg-green-500">승인됨</Badge>;
      case 'rejected':
        return <Badge variant="destructive">거부됨</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-48" />
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

  const pendingRequest = requests.find(r => r.status === 'pending');

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">소속 조직 변경</h1>
        <p className="text-muted-foreground mt-2">
          소속 조직 변경을 요청하고 진행 상태를 확인할 수 있습니다.
        </p>
      </div>

      {pendingRequest && (
        <Alert>
          <AlertDescription>
            현재 <strong>{pendingRequest.requested_organization.name}</strong>로의 조직 변경 요청이 대기 중입니다.
            관리자 승인을 기다리고 있습니다.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>변경 요청 이력</CardTitle>
          <CardDescription>
            총 {requests.length}건의 요청이 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {requests.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  아직 조직 변경 요청 이력이 없습니다.
                </p>
                <Button onClick={() => router.push('/profile')}>
                  프로필로 돌아가기
                </Button>
              </div>
            ) : (
              requests.map((request) => (
                <div
                  key={request.id}
                  className="border rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">
                          {request.current_organization.name} → {request.requested_organization.name}
                        </h3>
                        {getStatusBadge(request.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        사유: {request.reason}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        요청일: {new Date(request.created_at).toLocaleString('ko-KR')}
                      </p>
                    </div>

                    {request.status === 'pending' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancelRequest(request.id)}
                      >
                        취소
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>새 변경 요청</CardTitle>
          <CardDescription>
            조직 변경이 필요하신 경우, 관리자에게 문의해 주세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              조직 변경 요청은 관리자 승인이 필요합니다.
              현재 대기 중인 요청이 있는 경우 새 요청을 제출할 수 없습니다.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
