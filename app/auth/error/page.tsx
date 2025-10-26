'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { GlassCard, NeoButton } from '@/components/ui/modern-mobile';
import { Suspense } from 'react';

function ErrorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4">
      <div className="w-full max-w-md mx-auto pt-8">
        <GlassCard glow>
          <div className="text-center">
            <div className="w-20 h-20 bg-red-500/20 backdrop-blur-xl rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <h1 className="text-2xl font-bold text-white mb-2">
              인증 오류
            </h1>
            
            <p className="text-gray-400 text-sm mb-6">
              인증 과정에서 문제가 발생했습니다
            </p>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
                <p className="text-sm text-red-400 break-words">
                  {decodeURIComponent(error)}
                </p>
              </div>
            )}

            <div className="bg-gray-800/30 backdrop-blur-xl rounded-xl p-5 mb-6 border border-gray-700/50">
              <h2 className="text-base font-semibold text-white mb-3">
                해결 방법
              </h2>
              <ul className="text-left text-sm space-y-2 text-gray-300">
                <li className="flex items-start">
                  <span className="text-green-400 mr-2 mt-0.5">•</span>
                  <span>이메일 인증 링크가 만료되었을 수 있습니다</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-400 mr-2 mt-0.5">•</span>
                  <span>이미 사용된 인증 링크일 수 있습니다</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-400 mr-2 mt-0.5">•</span>
                  <span>다시 로그인하거나 회원가입을 시도해주세요</span>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <NeoButton
                onClick={() => router.push('/auth/signin')}
                fullWidth
                size="lg"
              >
                로그인 페이지로 이동
              </NeoButton>
              
              <NeoButton
                onClick={() => router.push('/auth/signup')}
                variant="secondary"
                fullWidth
                size="lg"
              >
                다시 회원가입
              </NeoButton>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-700/50">
              <p className="text-xs text-gray-500">
                계속 문제가 발생하면 관리자에게 문의하세요
                <br />
                <span className="text-green-400">truth0530@nmc.or.kr</span>
              </p>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

export default function ErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  );
}