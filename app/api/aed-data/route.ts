/**
 * AED 데이터 조회 API
 *
 * GET /api/aed-data
 * - 커서 기반 페이지네이션
 * - Redis 캐싱 (24시간)
 * - 필터링: region, status, category, search
 * - 정렬: id, updated_at
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/db/prisma';
import { getCachedData, setCachedData, getAEDDataCacheKey } from '@/lib/cache/redis-cache';
import { checkRateLimit, createRateLimitResponse, getIdentifier, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rate-limiter';
import { createAuditLog } from '@/lib/db/prisma';

interface AEDQueryFilters {
  region?: string;
  status?: string[];
  category?: string;
  search?: string;
  cursor?: string;
  limit?: number;
}

type DecodedCursor = { id: number };

function decodeCursor(cursor: string): DecodedCursor | null {
  try {
    const normalized = cursor.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '==='.slice((normalized.length + 3) % 4);
    const json = Buffer.from(padded, 'base64').toString('utf-8');
    const parsed = JSON.parse(json);

    const id = typeof parsed.id === 'number' ? parsed.id : parseInt(parsed.id, 10);

    if (!isNaN(id)) {
      return { id };
    }
  } catch (error) {
    console.error('[decodeCursor] Failed to decode cursor:', error);
  }
  return null;
}

function encodeCursor(id: number): string {
  const payload = { id };
  const json = JSON.stringify(payload);
  return Buffer.from(json, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Rate limiting
    const identifier = getIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, RATE_LIMIT_CONFIGS['aed-data']);

    if (!rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult);
    }

    // JWT 인증
    const cookieToken = request.cookies.get('auth-token')?.value;
    const authHeader = request.headers.get('authorization');
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const token = cookieToken || headerToken;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // 사용자 프로필 조회
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: payload.userId },
      select: {
        role: true,
        organization: true,
      },
    });

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // 쿼리 파라미터 파싱
    const searchParams = request.nextUrl.searchParams;
    const filters: AEDQueryFilters = {
      region: searchParams.get('region') || undefined,
      status: searchParams.get('status')?.split(',') || undefined,
      category: searchParams.get('category') || undefined,
      search: searchParams.get('search') || undefined,
      cursor: searchParams.get('cursor') || undefined,
      limit: parseInt(searchParams.get('limit') || '30', 10),
    };

    console.log('[AED Data API] Filters:', filters);
    console.log('[AED Data API] User role:', userProfile.role);

    // 권한 확인 (간소화된 버전)
    const canViewAllRegions = ['admin', 'master'].includes(userProfile.role);
    if (!canViewAllRegions && !filters.region) {
      return NextResponse.json(
        { error: 'Region filter is required for your role' },
        { status: 403 }
      );
    }

    // 캐시 키 생성 (필터 기반)
    const cacheKey = getAEDDataCacheKey(
      JSON.stringify({ ...filters, role: userProfile.role })
    );

    // Redis 캐시 확인
    const cachedData = await getCachedData<any>(cacheKey);
    if (cachedData) {
      console.log('[AED Data API] Cache HIT');
      return NextResponse.json(cachedData);
    }

    console.log('[AED Data API] Cache MISS - Querying database');

    // 커서 디코딩
    const decodedCursor = filters.cursor ? decodeCursor(filters.cursor) : null;
    const cursorId = decodedCursor?.id || null;

    // Prisma 쿼리 구성
    const pageSize = Math.min(Math.max(1, filters.limit || 30), 100);
    const queryLimit = pageSize + 1; // hasMore 확인용

    const whereClause: any = {};

    // 지역 필터
    if (filters.region) {
      whereClause.region = filters.region;
    }

    // 상태 필터
    if (filters.status && filters.status.length > 0) {
      whereClause.status = { in: filters.status };
    }

    // 검색 필터 (location, deviceCode)
    if (filters.search) {
      whereClause.OR = [
        { deviceCode: { contains: filters.search, mode: 'insensitive' } },
        { location: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // 커서 페이지네이션
    if (cursorId) {
      whereClause.id = { gt: cursorId };
    }

    // 데이터 조회
    const devices = await prisma.aEDDevice.findMany({
      where: whereClause,
      orderBy: { id: 'asc' },
      take: queryLimit,
      select: {
        id: true,
        deviceCode: true,
        location: true,
        region: true,
        latitude: true,
        longitude: true,
        status: true,
        lastInspectionDate: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // hasMore 확인
    const hasMore = devices.length > pageSize;
    const trimmedData = hasMore ? devices.slice(0, pageSize) : devices;

    // 다음 커서 생성
    let nextCursor: string | null = null;
    if (hasMore && trimmedData.length > 0) {
      const lastItem = trimmedData[trimmedData.length - 1];
      nextCursor = encodeCursor(lastItem.id);
    }

    // 전체 카운트 조회 (간소화 - 실제로는 summary RPC 함수 사용)
    const totalCount = await prisma.aEDDevice.count({
      where: whereClause,
    });

    const responseData = {
      data: trimmedData,
      pagination: {
        limit: pageSize,
        hasMore,
        nextCursor,
        total: totalCount,
      },
      summary: {
        totalCount,
      },
      filters: {
        applied: filters,
      },
    };

    // Redis 캐싱 (24시간)
    await setCachedData(cacheKey, responseData, 86400);

    // 감사 로그 기록
    await createAuditLog({
      userId: payload.userId,
      action: 'QUERY',
      resource: 'AEDDevice',
      changes: { filters },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    const duration = Date.now() - startTime;
    console.log(`[AED Data API] Query completed in ${duration}ms`);

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('[AED Data API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
