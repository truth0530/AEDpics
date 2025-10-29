import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth/auth-options';

import { prisma } from '@/lib/prisma';
// Haversine 공식으로 두 좌표 간 거리 계산 (km)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // 지구 반지름 (km)
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * 위치 기반 AED 데이터 조회 API
 * 지도 중심 좌표와 반경(미터)을 기준으로 AED 데이터를 조회합니다.
 */
export async function GET(request: NextRequest) {
  try {
    // 사용자 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const latitude = searchParams.get('latitude');
    const longitude = searchParams.get('longitude');
    const radius = searchParams.get('radius') || '3000'; // 기본 3km
    const limit = searchParams.get('limit') || '500';

    if (!latitude || !longitude) {
      return NextResponse.json(
        { success: false, error: 'latitude와 longitude가 필요합니다.' },
        { status: 400 }
      );
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const radiusKm = parseInt(radius) / 1000;

    // aed_data 테이블에서 직접 조회 (좌표가 있는 데이터만)
    const data = await prisma.aed_data.findMany({
      where: {
        AND: [
          { latitude: { not: null } },
          { longitude: { not: null } },
          { latitude: { not: 0 } },
          { longitude: { not: 0 } }
        ]
      },
      take: parseInt(limit)
    });

    // JavaScript로 거리 계산 (Haversine formula)
    const results = (data || [])
      .map((item) => {
        const itemLat = typeof item.latitude === 'object' ? item.latitude.toNumber() : item.latitude!;
        const itemLng = typeof item.longitude === 'object' ? item.longitude.toNumber() : item.longitude!;
        const distance = calculateDistance(lat, lng, itemLat, itemLng);
        return {
          ...item,
          distance_meters: Math.round(distance * 1000)
        };
      })
      .filter((item) => item.distance_meters <= parseInt(radius))
      .sort((a, b) => a.distance_meters - b.distance_meters)
      .slice(0, parseInt(limit));

    return NextResponse.json({
      success: true,
      data: results,
      count: results.length
    });
  } catch (error: any) {
    console.error('[API] Unexpected error in by-location:', error);
    return NextResponse.json(
      { success: false, error: error.message || '알 수 없는 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
