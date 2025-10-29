'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GlassCard, NeoButton } from '@/components/ui/modern-mobile';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 비밀번호 재설정 이메일 발송
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '비밀번호 재설정 요청에 실패했습니다.');
      }

      // 이메일 발송 성공 시 즉시 인증 코드 화면으로 이동
      router.push(`/auth/verify-reset?email=${encodeURIComponent(email)}`);
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
        </GlassCard>
      </div>
    </div>
  );
}