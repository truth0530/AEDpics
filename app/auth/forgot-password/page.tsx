'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GlassCard, NeoButton } from '@/components/ui/modern-mobile';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Custom API를 사용하여 비밀번호 재설정 이메일 발송
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '비밀번호 재설정 요청에 실패했습니다.');
      }
      
      setSuccess(true);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4">
      <div className="w-full max-w-md mx-auto pt-8">
        <button
          onClick={() => router.push('/auth/signin')}
          className="text-gray-400 hover:text-white mb-6 flex items-center gap-2"
        >
          ← 뒤로가기
        </button>

        <GlassCard glow>
          {success ? (
            <>
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-green-500/20 backdrop-blur-xl rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-12 h-12 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">
                  이메일을 확인하세요
                </h1>
                <p className="text-gray-400 text-sm">
                  비밀번호 재설정 링크를 발송했습니다
                </p>
              </div>
              
              <div className="bg-gray-800/30 backdrop-blur-xl rounded-xl p-5 mb-6 border border-gray-700/50">
                <p className="text-sm text-gray-300 leading-relaxed mb-3">
                  <strong className="text-green-400">{email}</strong>로 비밀번호 재설정 링크를 발송했습니다.
                </p>
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-3">
                  <p className="text-xs text-green-400 font-semibold mb-1">
                    ✓ 비밀번호 재설정 링크가 발송되었습니다
                  </p>
                  <p className="text-xs text-gray-400">
                    이메일에서 &quot;비밀번호 재설정하기&quot; 버튼을 클릭하세요
                  </p>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                  <p className="text-xs text-yellow-400">
                    ⚠️ 이메일이 도착하지 않았나요?
                  </p>
                  <ul className="text-xs text-gray-400 mt-1 space-y-1">
                    <li>• 스팸메일함 또는 프로모션 폴더 확인</li>
                    <li>• noreply@aed.pics에서 발송된 메일 찾기</li>
                    <li>• 이메일 도착까지 최대 15분 소요 가능</li>
                  </ul>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mt-3">
                  <p className="text-xs text-blue-400 font-semibold mb-1">
                    🔗 링크가 작동하지 않는 경우
                  </p>
                  <p className="text-xs text-gray-400">
                    이메일에 포함된 6자리 인증 코드를 사용하세요
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <NeoButton
                  onClick={() => router.push(`/auth/verify-reset?email=${encodeURIComponent(email)}`)}
                  variant="secondary"
                  fullWidth
                >
                  인증 코드로 재설정
                </NeoButton>
                <NeoButton
                  onClick={() => router.push('/auth/signin')}
                  variant="ghost"
                  fullWidth
                >
                  로그인으로 돌아가기
                </NeoButton>
              </div>
            </>
          ) : (
            <>
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-white mb-2">
                  비밀번호 재설정
                </h1>
                <p className="text-gray-400 text-sm">
                  가입하신 이메일 주소를 입력해주세요
                </p>
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500/30 text-red-400 p-3 rounded-xl mb-4 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      이메일
                    </label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                        </svg>
                      </div>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-3 py-3 bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-xl text-white focus:outline-none focus:border-green-500 transition-colors"
                        placeholder="example@korea.kr"
                        required
                      />
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
                    {loading ? '전송 중...' : '재설정 이메일 전송'}
                  </NeoButton>
                </div>
              </form>

              <div className="mt-6 text-center">
                <button
                  onClick={() => router.push('/auth/signin')}
                  className="text-green-400 hover:text-green-300 text-sm transition-colors"
                >
                  로그인 페이지로 돌아가기
                </button>
              </div>
            </>
          )}
        </GlassCard>
      </div>
    </div>
  );
}