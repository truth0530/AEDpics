'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default function ProfileMenuPage() {
  const router = useRouter();

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">프로필 메뉴</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="cursor-pointer hover:shadow-lg" onClick={() => router.push('/profile')}>
          <CardHeader>
            <CardTitle>프로필 보기</CardTitle>
          </CardHeader>
          <CardContent>내 프로필 정보를 확인합니다</CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-lg" onClick={() => router.push('/profile/history')}>
          <CardHeader>
            <CardTitle>변경 이력</CardTitle>
          </CardHeader>
          <CardContent>프로필 변경 이력을 확인합니다</CardContent>
        </Card>
      </div>
    </div>
  );
}
