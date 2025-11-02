'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { signOut } from 'next-auth/react';
import { useAuth } from '@/lib/hooks/useAuth';
import {
  User,
  Users,
  LogOut
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function ProfileMenuPage() {
  const router = useRouter();
  const { user } = useAuth();

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/auth/signin' });
  };

  // 관리자 권한 확인
  const isAdmin = user?.role === 'master' ||
                  user?.role === 'ministry_admin' ||
                  user?.role === 'emergency_center_admin' ||
                  user?.role === 'regional_emergency_center_admin';

  // 승인 권한은 역할 기반으로 판단
  const canApproveUsers = isAdmin;

  return (
    <div className="container mx-auto py-4 px-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-4">설정</h1>

      {/* 사용자 정보 섹션 - 간소화 */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold truncate">{user?.fullName || user?.email}</h2>
              <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.organization?.name || '소속 정보 없음'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3">
        {/* 프로필 설정 */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/profile')}>
          <CardHeader className="flex flex-row items-center space-x-3">
            <User className="w-5 h-5 text-blue-500" />
            <CardTitle>프로필 설정</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            내 정보, 비밀번호, 알림 설정, 소속 변경 등을 관리합니다
          </CardContent>
        </Card>

        {/* 사용자 승인 관리 - 관리자만 표시 */}
        {canApproveUsers && (
          <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 border-orange-500/30"
                onClick={() => router.push('/admin/users')}>
            <CardHeader className="flex flex-row items-center space-x-3">
              <Users className="w-5 h-5 text-orange-500" />
              <CardTitle>사용자 승인 관리</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              신규 가입 승인 및 사용자 권한 관리
            </CardContent>
          </Card>
        )}
      </div>

      {/* 로그아웃 버튼 */}
      <div className="mt-8">
        <Button
          onClick={handleLogout}
          variant="destructive"
          size="lg"
          className="w-full md:w-auto"
        >
          <LogOut className="w-4 h-4 mr-2" />
          로그아웃
        </Button>
      </div>
    </div>
  );
}
