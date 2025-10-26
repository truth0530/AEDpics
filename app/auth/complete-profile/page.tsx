'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

// DEPRECATED: This page is part of legacy Supabase auth flow
// NextAuth handles profile completion automatically during signup
// This page now just redirects to the appropriate location

export default function CompleteProfilePage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.push('/auth/signin');
      return;
    }

    // Redirect based on user role
    if (session.user.role === 'pending_approval' || session.user.role === 'email_verified') {
      router.push('/auth/pending-approval');
    } else {
      router.push('/dashboard');
    }
  }, [session, status, router]);

  // Show loading state while redirecting
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4 flex items-center justify-center">
      <div className="text-center">
        <div className="text-green-400 mb-6">
          <svg className="w-20 h-20 mx-auto animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-white mb-3">
          리다이렉팅 중...
        </h2>
        <p className="text-gray-400 text-sm">
          잠시만 기다려주세요
        </p>
      </div>
    </div>
  );
}
