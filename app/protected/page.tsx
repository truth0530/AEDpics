'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Force dynamic rendering to avoid prerender errors
export const dynamic = 'force-dynamic';

/**
 * Protected Page (임시 비활성화)
 *
 * TODO: Supabase에서 NextAuth로 전환 필요
 * - 이 페이지는 예제/튜토리얼 페이지로 보이며, 실제 프로덕션에서는 사용되지 않을 수 있음
 * - 필요시 NextAuth getServerSession으로 변경
 */
export default function ProtectedPage() {
  const router = useRouter();

  useEffect(() => {
    // 임시로 dashboard로 리다이렉트
    console.warn('[ProtectedPage] This page is temporarily disabled - needs migration from Supabase');
    router.push('/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center text-white">
        <h1 className="text-2xl font-bold mb-4">페이지 이동 중...</h1>
        <p className="text-gray-400">
          이 페이지는 현재 업데이트 중입니다.
          <br />
          대시보드로 이동합니다.
        </p>
      </div>
    </div>
  );
}
