'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { getRegionCode } from '@/lib/constants/regions';
import { GlassCard, NeoButton } from '@/components/ui/modern-mobile';

function CompleteProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // React Hook은 컴포넌트 최상위 레벨에서 호출
  const { data: session, status } = useSession();

  useEffect(() => {
    const completeProfile = async () => {
      try {
        // 현재 로그인된 사용자 확인
        if (status === "loading") return;
        const user = session?.user;

        if (!user) {
          throw new Error('사용자 정보를 찾을 수 없습니다.');
        }

        // 이메일 인증 확인
        if (!user.email_confirmed_at) {
          router.push('/auth/verify-email');
          return;
        }

        // 이미 프로필이 있는지 확인
        const { data: existingProfile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (existingProfile) {
          // 이미 프로필이 있으면 적절한 페이지로 리다이렉트
          if (existingProfile.role === 'pending_approval') {
            router.push('/auth/pending-approval');
          } else if (!existingProfile.region || !existingProfile.region_code) {
            // 프로필은 있지만 지역 정보가 없으면 업데이트 페이지로
            router.push('/auth/update-profile');
          } else {
            // 모든 정보가 완전하면 대시보드로
            router.push('/dashboard');
          }
          return;
        }

        // sessionStorage에서 데이터 가져오기 (우선순위), 없으면 localStorage에서 마이그레이션
        let savedData = sessionStorage.getItem('pendingSignupData');
        if (!savedData) {
          savedData = localStorage.getItem('pendingSignupData');
          if (savedData) {
            // sessionStorage로 마이그레이션
            sessionStorage.setItem('pendingSignupData', savedData);
            localStorage.removeItem('pendingSignupData');
          }
        }

        if (savedData) {
          const signupData = JSON.parse(savedData);

          // 프로필 생성
          const regionCode = signupData.region ? getRegionCode(signupData.region) : null;

          const { error: profileError } = await supabase
            .from('user_profiles')
            .insert({
              id: user.id,
              email: user.email,
              full_name: signupData.fullName,
              phone: signupData.phone || null,
              role: 'pending_approval',
              region: signupData.region,
              region_code: regionCode,
              organization_name: signupData.organizationName,
              remarks: signupData.remarks || null,
              account_type: signupData.accountType || 'public'
            });

          if (profileError) {
            throw profileError;
          }

          // sessionStorage 정리
          sessionStorage.removeItem('pendingSignupData');
          sessionStorage.removeItem('pendingVerificationEmail');
          // 기존 localStorage도 정리 (후방 호환성)
          localStorage.removeItem('pendingSignupData');
          localStorage.removeItem('pendingVerificationEmail');
        } else {
          // 데이터가 없으면 회원가입 페이지로
          router.push('/auth/signup');
          return;
        }

        // 승인 대기 페이지로 이동
        router.push('/auth/pending-approval');

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '프로필 생성 중 오류가 발생했습니다.';
        setError(errorMessage);
        setLoading(false);
      }
    };

    completeProfile();
  }, [searchParams, supabase, router]);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4 flex items-center justify-center">
        <div className="w-full max-w-md mx-auto">
          <GlassCard>
            <div className="text-center py-8">
              <div className="text-green-400 mb-6">
                <svg className="w-20 h-20 mx-auto animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white mb-3">
                프로필 생성 중...
              </h2>
              <p className="text-gray-400 text-sm">
                잠시만 기다려주세요
              </p>
            </div>
          </GlassCard>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4 flex items-center justify-center">
        <div className="w-full max-w-md mx-auto">
          <GlassCard>
            <div className="text-center py-8">
              <div className="text-red-400 mb-6">
                <svg className="w-20 h-20 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white mb-3">
                오류가 발생했습니다
              </h2>
              <div className="bg-red-500/20 border border-red-500/30 text-red-400 p-3 rounded-xl mb-6 text-sm">
                {error}
              </div>
              <div className="space-y-3">
                <NeoButton
                  onClick={handleRetry}
                  fullWidth
                >
                  다시 시도
                </NeoButton>
                <NeoButton
                  variant="secondary"
                  fullWidth
                  onClick={() => router.push('/auth/signup')}
                >
                  회원가입으로 돌아가기
                </NeoButton>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    );
  }

  return null;
}

export default function CompleteProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4 flex items-center justify-center">
        <div className="w-full max-w-md mx-auto">
          <GlassCard>
            <div className="text-center py-8">
              <div className="text-green-400 mb-6">
                <svg className="w-20 h-20 mx-auto animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white mb-3">
                로딩 중...
              </h2>
              <p className="text-gray-400 text-sm">
                잠시만 기다려주세요
              </p>
            </div>
          </GlassCard>
        </div>
      </div>
    }>
      <CompleteProfileContent />
    </Suspense>
  );
}
