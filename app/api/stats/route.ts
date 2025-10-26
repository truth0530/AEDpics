import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

// 폴백 데이터 (데이터베이스 연결 실패 시 사용)
const FALLBACK_STATS = {
  aed_count: 81443,
  health_center_count: 273,
  province_count: 17,
  monitoring: "24/7",
  last_updated: new Date().toISOString()
};

export async function GET() {
  try {
    // 병렬로 통계 데이터 조회
    const [aedCount, healthCenterCount, provinceCount] = await Promise.all([
      // AED 총 개수
      prisma.aed_data.count(),

      // 보건소 수
      prisma.organizations.count({
        where: { type: 'health_center' }
      }),

      // 시도 수
      prisma.organizations.count({
        where: { type: 'province' }
      })
    ]);

    // 통계 데이터 조합
    const stats = {
      aed_count: aedCount || FALLBACK_STATS.aed_count,
      health_center_count: healthCenterCount || FALLBACK_STATS.health_center_count,
      province_count: provinceCount || FALLBACK_STATS.province_count,
      monitoring: FALLBACK_STATS.monitoring,
      last_updated: new Date().toISOString()
    };

    // 캐시 헤더 설정 (5분간 캐시)
    return NextResponse.json(stats, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('통계 데이터 조회 실패:', error);
    
    // 에러 발생 시 폴백 데이터 반환
    return NextResponse.json(FALLBACK_STATS, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  }
}
