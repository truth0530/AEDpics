'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Force dynamic rendering to avoid prerender errors
export const dynamic = 'force-dynamic';

/**
 * 조직 관리 페이지
 *
 * TODO: Supabase에서 Prisma + API 엔드포인트로 전환 필요
 * - GET /api/admin/organizations - 조직 목록 조회
 * - POST /api/admin/organizations - 조직 생성
 * - PATCH /api/admin/organizations/[id] - 조직 수정
 * - DELETE /api/admin/organizations/[id] - 조직 삭제
 */
export default function AdminOrganizationsPage() {
  const router = useRouter();

  useEffect(() => {
    // 임시로 dashboard로 리다이렉트
    console.warn('[AdminOrganizationsPage] This page is temporarily disabled - needs Prisma migration');
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
