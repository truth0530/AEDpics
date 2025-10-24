/**
 * Email Verification Page
 *
 * Features:
 * - OTP code input
 * - Resend OTP
 * - Auto-redirect on success
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '인증에 실패했습니다.');
        setLoading(false);
        return;
      }

      setSuccess('이메일 인증이 완료되었습니다. 로그인 페이지로 이동합니다...');
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err) {
      console.error('[Verify Email] Error:', err);
      setError('서버 오류가 발생했습니다.');
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;

    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.retryAfter) {
          setError(`잠시 후 다시 시도해주세요. (${data.retryAfter}초 후)`);
        } else {
          setError(data.error || '재발송에 실패했습니다.');
        }
        return;
      }

      setSuccess('인증 코드가 재발송되었습니다.');
      setResendCooldown(60); // 60초 쿨다운
    } catch (err) {
      console.error('[Verify Email] Resend error:', err);
      setError('서버 오류가 발생했습니다.');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-center text-4xl font-bold text-blue-600">
            AED 점검 시스템
          </h1>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            이메일 인증
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {email}로 발송된 6자리 인증 코드를 입력해주세요.
          </p>
        </div>

        {/* Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              {success}
            </div>
          )}

          <div>
            <label htmlFor="code" className="sr-only">
              인증 코드
            </label>
            <input
              id="code"
              name="code"
              type="text"
              required
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="appearance-none rounded-lg relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="000000"
              autoComplete="off"
            />
            <p className="mt-2 text-xs text-gray-500 text-center">
              인증 코드는 10분간 유효합니다.
            </p>
          </div>

          {/* Submit button */}
          <div>
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? '인증 중...' : '인증하기'}
            </button>
          </div>

          {/* Resend button */}
          <div className="text-center">
            <button
              type="button"
              onClick={handleResend}
              disabled={resendCooldown > 0}
              className="text-sm font-medium text-blue-600 hover:text-blue-500 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              {resendCooldown > 0
                ? `인증 코드 재발송 (${resendCooldown}초 후)`
                : '인증 코드 재발송'}
            </button>
          </div>
        </form>

        {/* Back to login */}
        <div className="text-center">
          <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">
            로그인 페이지로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
