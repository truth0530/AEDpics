'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Force dynamic rendering to avoid prerender errors
export const dynamic = 'force-dynamic';

/**
 * 2025년 목표 매칭 페이지
 *
 * TODO: Supabase에서 Prisma + API 엔드포인트로 전환 필요
 */
export default function TargetMatching2025Page() {
  const router = useRouter();

  useEffect(() => {
    // 임시로 dashboard로 리다이렉트
    console.warn('[TargetMatching2025Page] This page is temporarily disabled - needs Prisma migration');
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
