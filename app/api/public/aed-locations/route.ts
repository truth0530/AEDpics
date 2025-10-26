import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // 쿼리 파라미터
    const regionCode = searchParams.get('region');
    const cityCode = searchParams.get('city');
    const bounds = searchParams.get('bounds'); // "west,south,east,north"
    const limit = parseInt(searchParams.get('limit') || '1000');
    const category1 = searchParams.get('category1');
    const category2 = searchParams.get('category2');
    const category3 = searchParams.get('category3');
    const search = searchParams.get('search');

    // Prisma where 조건 구성
    const where: any = {
      latitude: { not: null },
      longitude: { not: null },
    };

    // 지역 필터링
    if (regionCode) {
      where.sido = regionCode;
    }

    if (cityCode) {
      where.gugun = cityCode;
    }

    // 카테고리 필터링
    if (category1) {
      where.category_1 = category1;
    }
    if (category2) {
      where.category_2 = category2;
    }
    if (category3) {
      where.category_3 = category3;
    }

    // 검색어 필터링 (OR 조건)
    if (search) {
      where.OR = [
        { installation_institution: { contains: search, mode: 'insensitive' } },
        { installation_address: { contains: search, mode: 'insensitive' } },
        { installation_position: { contains: search, mode: 'insensitive' } },
      ];
    }

    // 지도 영역 내 데이터만 가져오기 (성능 최적화)
    if (bounds) {
      const [west, south, east, north] = bounds.split(',').map(Number);
      if (!isNaN(west) && !isNaN(south) && !isNaN(east) && !isNaN(north)) {
        where.longitude = { gte: west, lte: east };
        where.latitude = { gte: south, lte: north };
      }
    }

    const data = await prisma.aed_data.findMany({
      where,
      select: {
        equipment_serial: true,
        installation_institution: true,
        installation_address: true,
        installation_location_address: true,
        installation_position: true,
        latitude: true,
        longitude: true,
        sido: true,
        gugun: true,
        model_name: true,
        installation_date: true,
        institution_contact: true,
        last_seen_date: true,
        patch_expiry_date: true,
        battery_expiry_date: true,
        category_1: true,
        category_2: true,
        category_3: true,
      },
      take: limit,
    });

    // 유효한 좌표만 필터링 (Decimal 타입 처리)
    const validLocations = data.filter(item => {
      if (!item.latitude || !item.longitude) return false;
      const lat = typeof item.latitude === 'string' ? parseFloat(item.latitude) : Number(item.latitude);
      const lng = typeof item.longitude === 'string' ? parseFloat(item.longitude) : Number(item.longitude);
      return !isNaN(lat) && !isNaN(lng) &&
             lat >= -90 && lat <= 90 &&
             lng >= -180 && lng <= 180;
    });

    return NextResponse.json({
      locations: validLocations,
      total: validLocations.length
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      }
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}