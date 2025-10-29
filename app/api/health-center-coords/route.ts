import { NextRequest, NextResponse } from 'next/server';
import { REGIONS } from '@/lib/constants/regions';

import { prisma } from '@/lib/prisma';
/**
 * 구군별 보건소 좌표 조회 API
 *
 * 우선순위:
 * 1. organizations 테이블에서 조회 (빠르고 정확)
 * 2. aed_data 테이블에서 계산 (fallback)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sido = searchParams.get('sido');
    const gugun = searchParams.get('gugun');

    if (!sido || !gugun) {
      return NextResponse.json(
        { error: 'sido and gugun parameters are required' },
        { status: 400 }
      );
    }

    // 1순위: organizations 테이블에서 조회
    const region = REGIONS.find(r => r.label === sido);
    if (region) {
      // 구군명으로 보건소 검색 (이름 매칭)
      const orgData = await prisma.organizations.findFirst({
        where: {
          type: 'health_center',
          region_code: region.code,
          name: { contains: gugun, mode: 'insensitive' },
          latitude: { not: null },
          longitude: { not: null },
        },
        select: {
          name: true,
          latitude: true,
          longitude: true,
          address: true,
        },
      });

      if (orgData) {
        console.log(`[health-center-coords] ⚡ Found from organizations: ${orgData.name}`);
        return NextResponse.json({
          sido,
          gugun,
          healthCenter: orgData.name,
          latitude: orgData.latitude,
          longitude: orgData.longitude,
          address: orgData.address,
          source: 'organizations',
          confidence: 'high'
        });
      }
    }

    // 2순위: aed_data 테이블에서 계산 (fallback)
    const data = await prisma.aed_data.findMany({
      where: {
        sido,
        gugun,
        jurisdiction_health_center: { not: null },
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        jurisdiction_health_center: true,
        latitude: true,
        longitude: true,
      },
      take: 100,
    });

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'No health center found for the given region' },
        { status: 404 }
      );
    }

    // 보건소별 출현 횟수와 좌표 집계
    const healthCenterMap = new Map<string, { count: number; coords: { lat: number; lng: number }[] }>();

    data.forEach(item => {
      const name = item.jurisdiction_health_center;
      const lat = item.latitude ? Number(item.latitude) : null;
      const lng = item.longitude ? Number(item.longitude) : null;

      if (!name || !lat || !lng) return;

      if (!healthCenterMap.has(name)) {
        healthCenterMap.set(name, { count: 0, coords: [] });
      }

      const entry = healthCenterMap.get(name)!;
      entry.count += 1;
      entry.coords.push({ lat, lng });
    });

    // 가장 많이 등장하는 보건소 찾기
    let maxCount = 0;
    let selectedCenter = '';
    let selectedCoords: { lat: number; lng: number }[] = [];

    healthCenterMap.forEach((value, key) => {
      if (value.count > maxCount) {
        maxCount = value.count;
        selectedCenter = key;
        selectedCoords = value.coords;
      }
    });

    // 해당 보건소 좌표들의 평균 계산 (정확도 향상)
    const avgLat = selectedCoords.reduce((sum, coord) => sum + coord.lat, 0) / selectedCoords.length;
    const avgLng = selectedCoords.reduce((sum, coord) => sum + coord.lng, 0) / selectedCoords.length;

    console.log(`[health-center-coords] 🔄 Fallback to aed_data: ${selectedCenter} for ${sido} ${gugun}`);

    return NextResponse.json({
      sido,
      gugun,
      healthCenter: selectedCenter,
      latitude: avgLat,
      longitude: avgLng,
      dataPoints: selectedCoords.length,
      source: 'aed_data',
      confidence: 'medium'
    });

  } catch (error) {
    console.error('[health-center-coords] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
