'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GlassCard, NeoButton } from '@/components/ui/modern-mobile';
import { Eye, EyeOff } from 'lucide-react';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');

  // 타이머 참조 (메모리 누수 방지)
  const navigationTimerRef = useRef<NodeJS.Timeout | null>(null);

  const token = searchParams.get('token');
  const emailParam = searchParams.get('email');

  useEffect(() => {
    // URL 파라미터 확인
    if (!token || !emailParam) {
      setError('유효하지 않은 재설정 링크입니다.');
      setTokenValid(false);
      return;
    }

    setEmail(decodeURIComponent(emailParam));
    verifyToken(token, emailParam);
  }, [token, emailParam]);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (navigationTimerRef.current) {
        clearTimeout(navigationTimerRef.current);
      }
    };
  }, []);

  const verifyToken = async (token: string, email: string) => {
    try {
      // 토큰 유효성 확인
      const response = await fetch('/api/auth/verify-reset-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: decodeURIComponent(email),
          code: token
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '유효하지 않거나 만료된 링크입니다.');
        setTokenValid(false);
      } else {
        setTokenValid(true);
      }
    } catch (error) {
      console.error('토큰 확인 오류:', error);
      setError('링크 확인 중 오류가 발생했습니다.');
      setTokenValid(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (password.length < 8) {
      setError('비밀번호는 최소 8자 이상이어야 합니다.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 비밀번호 업데이트 API 호출
      const response = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: decodeURIComponent(emailParam!),
          code: token,
          password: password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '비밀번호 변경에 실패했습니다.');
      }

      setSuccess(true);

      // 3초 후 로그인 페이지로 이동
      navigationTimerRef.current = setTimeout(() => {
        router.push('/auth/signin');
      }, 3000);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 토큰 확인 중
  if (tokenValid === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <div className="text-white">링크 확인 중...</div>
      </div>
    );
  }

  // 토큰이 유효하지 않은 경우
  if (tokenValid === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4">
        <div className="w-full max-w-md mx-auto pt-20">
          <GlassCard glow>
            <div className="text-center">
              <div className="w-20 h-20 bg-red-500/20 backdrop-blur-xl rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white mb-4">
                링크가 유효하지 않습니다
              </h1>
              <p className="text-gray-400 mb-2">{error}</p>
              <p className="text-gray-500 text-sm mb-6">
                링크가 만료되었거나 이미 사용되었을 수 있습니다.
              </p>
              <NeoButton
                fullWidth
                onClick={() => router.push('/auth/forgot-password')}
              >
                다시 시도하기
              </NeoButton>
            </div>
          </GlassCard>
        </div>
      </div>
    );
  }

  // 성공 메시지
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4">
        <div className="w-full max-w-md mx-auto pt-20">
          <GlassCard glow>
            <div className="text-center">
              <div className="w-20 h-20 bg-green-500/20 backdrop-blur-xl rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-12 h-12 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white mb-4">
                비밀번호가 변경되었습니다
              </h1>
              <p className="text-gray-400 mb-2">
                새로운 비밀번호로 로그인하실 수 있습니다.
              </p>
              <p className="text-gray-500 text-sm">
                잠시 후 로그인 페이지로 이동합니다...
              </p>
            </div>
          </GlassCard>
        </div>
      </div>
    );
  }

  // 비밀번호 재설정 폼
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4">
      <div className="w-full max-w-md mx-auto pt-8">
        <button
          onClick={() => router.push('/auth/signin')}
          className="text-gray-400 hover:text-white mb-6 flex items-center gap-2"
        >
          ← 로그인으로 돌아가기
        </button>

        <GlassCard glow>
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-green-500/20 backdrop-blur-xl rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              새 비밀번호 설정
            </h1>
            <p className="text-gray-400 text-sm">
              {email}
            </p>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/30 text-red-400 p-3 rounded-xl mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              {/* 새 비밀번호 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  새 비밀번호
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-xl text-white focus:outline-none focus:border-green-500 transition-colors"
                    placeholder="최소 8자 이상"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* 비밀번호 확인 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  비밀번호 확인
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full px-4 py-3 pr-12 bg-gray-800/50 backdrop-blur-xl border ${
                      confirmPassword && password !== confirmPassword
                        ? 'border-red-500'
                        : confirmPassword && password === confirmPassword
                        ? 'border-green-500'
                        : 'border-gray-700'
                    } rounded-xl text-white focus:outline-none focus:border-green-500 transition-colors`}
                    placeholder="비밀번호를 다시 입력하세요"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {/* 실시간 비밀번호 일치 여부 표시 */}
                {confirmPassword && (
                  <p className={`text-xs mt-2 ${
                    password === confirmPassword
                      ? 'text-green-400'
                      : 'text-red-400'
                  }`}>
                    {password === confirmPassword
                      ? '✓ 비밀번호가 일치합니다'
                      : '✗ 비밀번호가 일치하지 않습니다'}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6">
              <NeoButton
                type="submit"
                fullWidth
                size="lg"
                loading={loading}
                disabled={loading}
              >
                {loading ? '변경 중...' : '비밀번호 변경'}
              </NeoButton>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-700">
            <p className="text-center text-gray-500 text-xs">
              이 링크는 보안을 위해 1회만 사용 가능하며,
              <br />
              30분 후에 만료됩니다.
            </p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <div className="text-white">로딩 중...</div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}