'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function InspectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, [status, session]);

  const checkAuth = async () => {
    // NextAuth 세션 로딩 중
    if (status === 'loading') {
      return;
    }

    // 세션이 없으면 로그인 페이지로
    if (status === 'unauthenticated' || !session) {
      router.push('/auth/signin?redirect=/inspection');
      return;
    }

    // 세션이 있고 사용자 정보가 있는 경우
    if (session?.user) {
      try {
        // NextAuth 세션에서 사용자 프로필 정보를 가져옴
        const response = await fetch('/api/auth/profile');
        if (!response.ok) {
          throw new Error('Failed to fetch profile');
        }

        const profile = await response.json();

        // 권한 확인 (점검 권한이 있는 역할만 허용)
        const allowedRoles = ['master', 'emergency_center_admin', 'regional_emergency_center_admin', 'regional_admin', 'local_admin'];
        if (!profile.role || !allowedRoles.includes(profile.role)) {
          router.push('/auth/signin?error=권한이 없습니다');
          return;
        }

        setUserRole(profile.role);
      } catch (error) {
        console.error('프로필 조회 실패:', error);
        router.push('/auth/signin');
      }
    }
  };

  // 로딩 중 표시
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
          <p className="text-gray-400 mt-4">인증 확인 중...</p>
        </div>
      </div>
    );
  }

  // 인증되지 않은 경우 (리다이렉트 전 잠시 표시)
  if (status === 'unauthenticated' || !session) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400">로그인이 필요합니다...</p>
        </div>
      </div>
    );
  }

  // 인증된 사용자에게만 컨텐츠 표시
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* 상단 보안 표시 */}
      <div className="bg-green-900/20 border-b border-green-500/30 px-4 py-2 flex-shrink-0">
        <div className="container mx-auto flex items-center justify-between text-sm">
          <span className="text-green-400 flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            보안 연결됨
          </span>
          <span className="text-gray-400">
            권한: {userRole === 'master' ? '마스터 관리자' :
                  userRole === 'emergency_center_admin' ? '중앙응급의료센터' :
                  userRole === 'regional_emergency_center_admin' ? '지역응급의료센터' :
                  userRole === 'regional_admin' ? '시도 관리자' : '보건소 담당자'}
          </span>
        </div>
      </div>

      {/* 실제 컨텐츠 */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}