'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { GlassCard, NeoButton } from '@/components/ui/modern-mobile';
import { ROLE_ACCESS_MATRIX } from '@/lib/auth/role-matrix';
import { UserRole } from '@/packages/types';

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // 컴포넌트 마운트 시 저장된 이메일 불러오기 (보안: 비밀번호는 저장하지 않음)
  useState(() => {
    if (typeof window !== 'undefined') {
      const savedEmail = localStorage.getItem('savedEmail');
      const savedRememberMe = localStorage.getItem('rememberMe') === 'true';

      if (savedRememberMe && savedEmail) {
        setFormData(prev => ({ ...prev, email: savedEmail }));
        setRememberMe(true);
      }

      // 기존에 저장된 비밀번호가 있다면 제거 (보안 패치)
      localStorage.removeItem('savedPassword');
    }
    return undefined;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // 이메일만 저장 (보안: 비밀번호는 절대 저장하지 않음)
    if (rememberMe) {
      localStorage.setItem('savedEmail', formData.email);
      localStorage.setItem('rememberMe', 'true');
    } else {
      localStorage.removeItem('savedEmail');
      localStorage.removeItem('rememberMe');
    }
    // 기존 비밀번호 저장 제거 (보안 패치)
    localStorage.removeItem('savedPassword');

    try {
      // NextAuth 로그인
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        // NextAuth 에러 처리
        throw new Error(result.error);
      }

      if (result?.ok) {
        // 사용자 프로필 확인 (NextAuth 세션에서)
        const sessionResponse = await fetch('/api/auth/session');
        const session = await sessionResponse.json();

        if (!session?.user) {
          throw new Error('세션을 가져올 수 없습니다.');
        }

        // 프로필 상세 정보 가져오기
        const profileResponse = await fetch(`/api/user/profile/${session.user.id}`);
        const profile = await profileResponse.json();

        if (!profile) {
          // 프로필이 없으면 프로필 설정 페이지로
          setRedirecting(true);
          router.push('/auth/complete-profile');
          return;
        }

        // 승인 대기 중인 경우
        if (profile.role === 'pending_approval') {
          setRedirecting(true);
          router.push('/auth/pending-approval');
          return;
        }

        // 로그인 추적 (비동기로 실행, UI 블로킹 없음)
        void fetch('/api/auth/track-login', { method: 'POST' }).catch(error => {
          console.warn('Failed to track login:', error);
        });

        // 정상 로그인 - redirect 또는 redirectTo가 있으면 해당 경로로, 없으면 역할별 기본 랜딩 페이지로 이동
        setRedirecting(true);
        const redirectTo = searchParams.get('redirect') || searchParams.get('redirectTo');

        if (redirectTo) {
          router.push(redirectTo);
        } else {
          // 역할별 기본 랜딩 페이지 사용
          const userRole = profile.role as UserRole;
          const defaultLanding = ROLE_ACCESS_MATRIX[userRole]?.defaultLandingPage || '/dashboard';
          router.push(defaultLanding);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '로그인 중 알 수 없는 오류가 발생했습니다.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4">
      {/* 전체 화면 로딩 오버레이 */}
      {(loading || redirecting) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="loading-title"
          aria-describedby="loading-description"
        >
          <div className="flex flex-col items-center">
            <div className="relative" role="status" aria-label="로딩 중">
              <div className="w-20 h-20 border-4 border-green-500/20 rounded-full"></div>
              <div className="absolute top-0 left-0 w-20 h-20 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-10 h-10 text-green-500" viewBox="0 0 100 100" fill="currentColor" aria-hidden="true">
                  <path d="M50 85C50 85 20 60 20 40C20 30 25 25 32 25C38 25 44 28 50 35C56 28 62 25 68 25C75 25 80 30 80 40C80 60 50 85 50 85Z"/>
                </svg>
              </div>
            </div>
            <p id="loading-title" className="mt-4 text-white text-lg font-semibold">
              {redirecting ? '페이지 이동 중...' : '로그인 처리 중...'}
            </p>
            <p id="loading-description" className="mt-2 text-gray-400 text-sm">
              잠시만 기다려주세요
            </p>
          </div>
        </div>
      )}

      <div className="w-full max-w-md mx-auto pt-8">
        <button
          onClick={() => router.push('/')}
          className="text-gray-400 hover:text-white mb-6 flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 rounded-lg px-2 py-1 transition-colors"
          aria-label="홈페이지로 돌아가기"
        >
          ← 뒤로가기
        </button>

        <GlassCard glow>
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full animate-pulse opacity-50" />
                <div className="relative flex items-center justify-center w-full h-full bg-green-500 rounded-full">
                  <svg className="w-12 h-12" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M50 85C50 85 20 60 20 40C20 30 25 25 32 25C38 25 44 28 50 35C56 28 62 25 68 25C75 25 80 30 80 40C80 60 50 85 50 85Z" fill="white"/>
                    <path d="M55 35L45 50H55L40 65L60 45H50L55 35Z" fill="#10b981" strokeWidth="2" stroke="#10b981"/>
                  </svg>
                </div>
              </div>
            </div>

            <h1 className="text-2xl font-bold text-white mb-2" role="heading" aria-level={1}>
              AED 픽스
            </h1>
            <p className="text-gray-400 text-sm">
              중앙응급의료센터
            </p>
          </div>

          {error && (
            <div
              className="bg-red-500/20 border border-red-500/30 text-red-400 p-3 rounded-xl mb-4 text-sm"
              role="alert"
              aria-live="polite"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} role="form" aria-label="로그인 폼">
            <fieldset className="space-y-4">
              <legend className="sr-only">로그인 정보 입력</legend>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                  이메일
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                    </svg>
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-10 pr-3 py-3 bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-xl text-white focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors"
                    placeholder="example@korea.kr"
                    aria-describedby="email-hint"
                    autoComplete="email"
                    required
                  />
                  <div id="email-hint" className="sr-only">
                    기관 이메일 주소를 입력하세요
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                  비밀번호
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                    </svg>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-10 pr-12 py-3 bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-xl text-white focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors"
                    placeholder="비밀번호 입력"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 rounded p-1 transition-colors"
                    aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 bg-gray-800/50 border border-gray-700 rounded text-green-500 focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors cursor-pointer"
                  />
                  <span className="ml-2 text-sm text-gray-400 group-hover:text-gray-300 transition-colors">
                    아이디 저장
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => router.push('/auth/forgot-password')}
                  className="text-gray-400 hover:text-green-400 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 rounded px-2 py-1"
                  aria-label="비밀번호 재설정 페이지로 이동"
                >
                  비밀번호를 잊으셨나요?
                </button>
              </div>
            </fieldset>

            <div className="mt-6">
              <NeoButton
                type="submit"
                fullWidth
                size="lg"
                loading={loading || redirecting}
                disabled={loading || redirecting}
              >
                {loading || redirecting ? '로그인 중...' : '로그인'}
              </NeoButton>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-400">
              계정이 없으신가요?{' '}
              <button
                type="button"
                onClick={() => router.push('/auth/signup')}
                className="text-green-400 hover:text-green-300 font-semibold focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 rounded px-2 py-1 transition-colors"
                aria-label="회원가입 페이지로 이동"
              >
                회원가입
              </button>
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-700/50">
            <p className="text-xs text-gray-500 text-center" role="note">
              본 시스템은 중앙응급의료센터에서 운영합니다.
              <br />
              17개 시도, 보건소 담당자만 접근 가능합니다.
            </p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">로딩 중...</p>
        </div>
      </div>
    }>
      <SignInForm />
    </Suspense>
  );
}
