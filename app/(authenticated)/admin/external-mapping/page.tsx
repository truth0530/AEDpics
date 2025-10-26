'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Force dynamic rendering to avoid prerender errors
export const dynamic = 'force-dynamic';

/**
 * 외부 시스템 매칭 관리 페이지
 *
 * TODO: Supabase에서 Prisma + API 엔드포인트로 전환 필요
 * - GET /api/external-mapping - 매핑 목록 조회
 * - GET /api/external-mapping/stats - 매핑 통계 조회
 * - POST /api/external-mapping - 매핑 생성
 * - PATCH /api/external-mapping - 매핑 검증 상태 변경
 */
export default function ExternalMappingPage() {
  const router = useRouter();

  useEffect(() => {
    // 임시로 dashboard로 리다이렉트
    console.warn('[ExternalMappingPage] This page is temporarily disabled - needs Prisma migration');
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
