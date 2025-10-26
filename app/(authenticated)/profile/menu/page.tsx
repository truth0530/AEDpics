'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Force dynamic rendering to avoid prerender errors
export const dynamic = 'force-dynamic';

/**
 * 프로필 메뉴 페이지
 *
 * TODO: Supabase에서 Prisma + API 엔드포인트로 전환 필요
 * - GET /api/profile - 사용자 프로필 조회
 * - GET /api/admin/pending-approvals/count - 승인 대기 수 조회
 */
export default function ProfileMenuPage() {
  const router = useRouter();

  useEffect(() => {
    // 임시로 profile 페이지로 리다이렉트
    console.warn('[ProfileMenuPage] This page is temporarily disabled - needs Prisma migration');
    router.push('/profile');
  }, [router]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center text-white">
        <h1 className="text-2xl font-bold mb-4">페이지 이동 중...</h1>
        <p className="text-gray-400">
          이 페이지는 현재 업데이트 중입니다.
          <br />
          프로필 페이지로 이동합니다.
        </p>
      </div>
    </div>
  );
}
