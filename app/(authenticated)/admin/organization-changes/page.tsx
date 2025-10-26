'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Force dynamic rendering to avoid prerender errors
export const dynamic = 'force-dynamic';

/**
 * 소속 변경 요청 관리 페이지
 *
 * TODO: Supabase에서 Prisma + API 엔드포인트로 전환 필요
 * - GET /api/admin/organization-changes - 변경 요청 목록 조회
 * - POST /api/admin/organization-changes/[id]/approve - 요청 승인
 * - POST /api/admin/organization-changes/[id]/reject - 요청 거부
 */
export default function OrganizationChangesPage() {
  const router = useRouter();

  useEffect(() => {
    // 임시로 admin/users 페이지로 리다이렉트
    console.warn('[OrganizationChangesPage] This page is temporarily disabled - needs Prisma migration');
    router.push('/admin/users');
  }, [router]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center text-white">
        <h1 className="text-2xl font-bold mb-4">페이지 이동 중...</h1>
        <p className="text-gray-400">
          이 페이지는 현재 업데이트 중입니다.
          <br />
          사용자 관리 페이지로 이동합니다.
        </p>
      </div>
    </div>
  );
}
