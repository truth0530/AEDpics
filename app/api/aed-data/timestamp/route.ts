import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
// 1분마다 재검증 (ISR - Incremental Static Regeneration)
export const revalidate = 60;

/**
 * GET /api/aed-data/timestamp
 *
 * aed_data 테이블의 최신 updated_at 타임스탬프를 조회합니다.
 *
 * 매일 교체되는 aed_data의 변경 사항을 감지하여
 * React Query 캐시 무효화에 사용됩니다.
 *
 * @returns {Object} 최신 타임스탬프 정보
 * @returns {string} latest_updated_at - 최신 updated_at 값 (ISO 8601 형식)
 * @returns {string} cache_key - 캐시 키로 사용 가능한 값 (latest_updated_at과 동일)
 */
export async function GET() {
  try {
    // aed_data 테이블에서 최신 updated_at 조회
    const latestRecord = await prisma.aed_data.findFirst({
      select: {
        updated_at: true
      },
      orderBy: {
        updated_at: 'desc'
      }
    });

    if (!latestRecord || !latestRecord.updated_at) {
      console.warn('[Timestamp API] No data found in aed_data table');
      return NextResponse.json(
        { error: 'No data found in aed_data table' },
        { status: 404 }
      );
    }

    const latestUpdatedAt = latestRecord.updated_at.toISOString();

    return NextResponse.json({
      latest_updated_at: latestUpdatedAt,
      cache_key: latestUpdatedAt, // 캐시 키로 사용 가능
      snapshot_date: latestUpdatedAt.split('T')[0], // YYYY-MM-DD
    }, {
      headers: {
        // CDN 캐싱 설정
        // public: CDN에서 캐시 가능
        // s-maxage=60: CDN에서 60초간 캐시
        // stale-while-revalidate=300: 5분간 stale 캐시 제공하면서 백그라운드에서 재검증
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (err) {
    console.error('[Timestamp API] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
