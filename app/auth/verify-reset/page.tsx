'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GlassCard, NeoButton } from '@/components/ui/modern-mobile';

function VerifyResetContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'verify' | 'reset'>('verify');
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleVerifyCodeWithParams = (verifyCode: string, verifyEmail: string) => {
    handleVerifyCode(verifyCode, verifyEmail);
  };

  useEffect(() => {
    // URL에서 이메일과 토큰 가져오기
    const emailParam = searchParams.get('email');
    const tokenParam = searchParams.get('token');

    if (emailParam) {
      setEmail(decodeURIComponent(emailParam));
    }

    if (tokenParam) {
      setCode(tokenParam);
      // 토큰이 URL에 있으면 자동으로 검증 시도
      if (emailParam) {
        handleVerifyCodeWithParams(tokenParam, emailParam);
      }
    }
   
  }, [searchParams]);

  const handleVerifyCode = async (verifyCode?: string, verifyEmail?: string) => {
    const codeToVerify = verifyCode || code;
    const emailToVerify = verifyEmail || email;
    
    if (!emailToVerify) {
      setError('이메일을 입력해주세요');
      return;
    }
    
    if (!codeToVerify) {
      setError('인증 코드를 입력해주세요');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 인증 코드 확인
      const response = await fetch('/api/auth/verify-reset-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailToVerify,
          code: codeToVerify
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '인증 코드 확인에 실패했습니다');
      }

      // 인증 성공 - 비밀번호 재설정 단계로 이동
      setVerifiedEmail(emailToVerify);
      setStep('reset');
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다');
      return;
    }

    if (password.length < 8) {
      setError('비밀번호는 최소 8자 이상이어야 합니다');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 비밀번호 재설정 API 호출
      const response = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: verifiedEmail,
          code: code,
          password: password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '비밀번호 변경에 실패했습니다');
      }

      // 성공 - 로그인 페이지로 이동
      alert('비밀번호가 성공적으로 변경되었습니다');
      router.push('/auth/signin');
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'verify') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4">
        <div className="w-full max-w-md mx-auto pt-8">
          <button
            onClick={() => router.push('/auth/forgot-password')}
            className="text-gray-400 hover:text-white mb-6 flex items-center gap-2"
          >
            ← 뒤로가기
          </button>

          <GlassCard glow>
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-green-500/20 backdrop-blur-xl rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-12 h-12 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">
                인증 코드 확인
              </h1>
              <p className="text-gray-400 text-sm">
                이메일로 받은 6자리 인증 코드를 입력하세요
              </p>
            </div>

            <div className="bg-gray-800/30 backdrop-blur-xl rounded-xl p-4 mb-4 border border-gray-700/50 space-y-3">
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                <p className="text-xs text-green-400 font-semibold mb-1">
                  비밀번호 재설정 링크가 발송되었습니다
                </p>
                <p className="text-xs text-gray-400">
                  이메일에서 &quot;비밀번호 재설정하기&quot; 버튼을 클릭하세요
                </p>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <p className="text-xs text-yellow-400 font-semibold mb-1">
                  이메일이 도착하지 않았나요?
                </p>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li>• 스팸메일함 또는 프로모션 폴더 확인</li>
                  <li>• noreply@nmc.or.kr에서 발송된 메일 찾기</li>
                  <li>• 이메일 도착까지 최대 15분 소요 가능</li>
                </ul>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/30 text-red-400 p-3 rounded-xl mb-4 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); handleVerifyCode(); }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    이메일
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-3 bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-xl text-white focus:outline-none focus:border-green-500 transition-colors"
                    placeholder="example@korea.kr"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    인증 코드
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full px-3 py-3 bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-xl text-white text-center text-2xl font-mono tracking-widest focus:outline-none focus:border-green-500 transition-colors"
                    placeholder="000000"
                    maxLength={6}
                    pattern="[0-9]{6}"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    이메일로 발송된 6자리 숫자를 입력하세요
                  </p>
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
                  {loading ? '확인 중...' : '인증 코드 확인'}
                </NeoButton>
              </div>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => router.push('/auth/forgot-password')}
                className="text-green-400 hover:text-green-300 text-sm transition-colors"
              >
                인증 코드를 받지 못하셨나요?
              </button>
            </div>
          </GlassCard>
        </div>
      </div>
    );
  }

  // 비밀번호 재설정 단계
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4">
      <div className="w-full max-w-md mx-auto pt-8">
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
              {verifiedEmail}
            </p>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/30 text-red-400 p-3 rounded-xl mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleResetPassword}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  새 비밀번호
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-3 pr-12 bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-xl text-white focus:outline-none focus:border-green-500 transition-colors"
                    placeholder="최소 8자 이상"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
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

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  비밀번호 확인
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-3 pr-12 bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-xl text-white focus:outline-none focus:border-green-500 transition-colors"
                    placeholder="비밀번호를 다시 입력하세요"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                  >
                    {showConfirmPassword ? (
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
        </GlassCard>
      </div>
    </div>
  );
}

export default function VerifyResetPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <div className="text-white">로딩 중...</div>
      </div>
    }>
      <VerifyResetContent />
    </Suspense>
  );
}