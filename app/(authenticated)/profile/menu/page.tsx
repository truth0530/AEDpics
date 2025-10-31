'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { signOut } from 'next-auth/react';
import { useAuth } from '@/lib/hooks/useAuth';
import {
  User,
  Lock,
  Bell,
  Users,
  LogOut,
  Building,
  ClipboardList,
  Mail
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
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">설정</h1>

      {/* 사용자 정보 섹션 */}
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">{user?.fullName || user?.email}</h2>
            <p className="text-gray-600 dark:text-gray-400">{user?.email}</p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              {user?.organization?.name || '소속 없음'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 내 정보 수정 */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/profile')}>
          <CardHeader className="flex flex-row items-center space-x-3">
            <User className="w-5 h-5 text-blue-500" />
            <CardTitle>내 정보 수정</CardTitle>
          </CardHeader>
          <CardContent className="text-gray-600 dark:text-gray-400">
            이름, 전화번호 등 개인정보를 수정합니다
          </CardContent>
        </Card>

        {/* 비밀번호 변경 */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/auth/update-profile')}>
          <CardHeader className="flex flex-row items-center space-x-3">
            <Lock className="w-5 h-5 text-green-500" />
            <CardTitle>비밀번호 변경</CardTitle>
          </CardHeader>
          <CardContent className="text-gray-600 dark:text-gray-400">
            로그인 비밀번호를 변경합니다
          </CardContent>
        </Card>

        {/* 알림 설정 */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/notifications/settings')}>
          <CardHeader className="flex flex-row items-center space-x-3">
            <Bell className="w-5 h-5 text-yellow-500" />
            <CardTitle>알림 설정</CardTitle>
          </CardHeader>
          <CardContent className="text-gray-600 dark:text-gray-400">
            이메일 및 시스템 알림 수신 설정을 관리합니다
          </CardContent>
        </Card>

        {/* 소속 변경 신청 */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/profile/change-organization')}>
          <CardHeader className="flex flex-row items-center space-x-3">
            <Building className="w-5 h-5 text-purple-500" />
            <CardTitle>소속 변경 신청</CardTitle>
          </CardHeader>
          <CardContent className="text-gray-600 dark:text-gray-400">
            소속 기관 변경을 신청합니다
          </CardContent>
        </Card>

        {/* 회원가입 관리 - 승인 권한이 있는 사용자만 표시 */}
        {canApproveUsers && (
          <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 border-orange-200 dark:border-orange-800"
                onClick={() => router.push('/admin/users')}>
            <CardHeader className="flex flex-row items-center space-x-3">
              <Users className="w-5 h-5 text-orange-500" />
              <CardTitle>회원가입 관리</CardTitle>
            </CardHeader>
            <CardContent className="text-gray-600 dark:text-gray-400">
              신규 가입 승인 및 사용자 관리
            </CardContent>
          </Card>
        )}

        {/* 점검 이력 - 점검 권한이 있는 사용자만 표시 */}
        {(user?.role === 'local_admin' || user?.role === 'temporary_inspector' || isAdmin) && (
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/profile/history')}>
            <CardHeader className="flex flex-row items-center space-x-3">
              <ClipboardList className="w-5 h-5 text-indigo-500" />
              <CardTitle>내 점검 이력</CardTitle>
            </CardHeader>
            <CardContent className="text-gray-600 dark:text-gray-400">
              내가 수행한 점검 이력을 확인합니다
            </CardContent>
          </Card>
        )}

        {/* 문의하기 */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => window.location.href = 'mailto:support@nmc.or.kr'}>
          <CardHeader className="flex flex-row items-center space-x-3">
            <Mail className="w-5 h-5 text-cyan-500" />
            <CardTitle>문의하기</CardTitle>
          </CardHeader>
          <CardContent className="text-gray-600 dark:text-gray-400">
            시스템 관련 문의 및 기술 지원
          </CardContent>
        </Card>
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
