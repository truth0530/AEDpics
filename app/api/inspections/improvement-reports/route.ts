import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { LRUCache } from 'lru-cache';
import { UserRole } from '@/packages/types';

// 캐시 설정: 최대 100개 항목, 5분 TTL
const reportCache = new LRUCache<string, any>({
  max: 100,
  ttl: 1000 * 60 * 5, // 5분
});

// 인증 헬퍼 함수
async function requireAuthWithRole() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const profile = await prisma.user_profiles.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      role: true,
      region_code: true,
      email: true,
      full_name: true
    }
  });

  if (!profile) {
    throw new Error('User profile not found');
  }

  return {
    userId: profile.id,
    user: {
      id: profile.id,
      role: profile.role as UserRole,
      region_code: profile.region_code,
      email: profile.email,
      full_name: profile.full_name
    }
  };
}

/**
 * GET: 데이터 개선 리포트 조회
 * Query Parameters:
 * - view: 'inspection' | 'improvement' | 'all'
 * - startDate: YYYY-MM-DD
 * - endDate: YYYY-MM-DD
 * - sido: 시도 (선택)
 * - gugun: 시군구 (선택)
 * - fieldCategory: 'battery' | 'pad' | 'manager' | 'installation' | 'device' (선택)
 * - status: 'good' | 'problematic' (점검시점)
 * - improvementStatus: 'improved' | 'neglected' (개선현황)
 * - minDays: 최소 경과일
 * - limit: 결과 개수 제한 (기본 100)
 * - offset: 페이지네이션
 */
export async function GET(request: NextRequest) {
  try {
    const { userId, user } = await requireAuthWithRole();

    const searchParams = request.nextUrl.searchParams;
    const view = searchParams.get('view') || 'inspection';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const sido = searchParams.get('sido');
    const gugun = searchParams.get('gugun');
    const fieldCategory = searchParams.get('fieldCategory');
    const status = searchParams.get('status');
    const improvementStatus = searchParams.get('improvementStatus');
    const minDays = searchParams.get('minDays');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // 캐시 키 생성
    const cacheKey = `report:${user.role}:${user.region_code}:${view}:${startDate}:${endDate}:${sido}:${gugun}:${fieldCategory}:${status}:${improvementStatus}:${minDays}:${limit}:${offset}`;

    // 캐시 확인
    const cachedData = reportCache.get(cacheKey);
    if (cachedData) {
      logger.info('ImprovementReports:GET', '캐시 히트', { userId, cacheKey });
      return NextResponse.json(cachedData);
    }

    // 권한 확인: 지역 기반 필터링
    const regionFilter: any = {};
    if (user.role === 'local_admin' && user.region_code) {
      // 보건소 담당자: 본인 관할 지역만
      regionFilter.equipment_serial = {
        in: await prisma.aed_data.findMany({
          where: { gugun: user.region_code },
          select: { equipment_serial: true },
        }).then(rows => rows.map(r => r.equipment_serial)),
      };
    } else if (user.role === 'regional_admin' && user.region_code) {
      // 시도 관리자: 본인 시도만
      regionFilter.equipment_serial = {
        in: await prisma.aed_data.findMany({
          where: { sido: user.region_code },
          select: { equipment_serial: true },
        }).then(rows => rows.map(r => r.equipment_serial)),
      };
    }

    // 지역 필터 (사용자가 선택한 경우)
    if (sido || gugun) {
      const aedSerials = await prisma.aed_data.findMany({
        where: {
          ...(sido ? { sido } : {}),
          ...(gugun ? { gugun } : {}),
        },
        select: { equipment_serial: true },
      });
      regionFilter.equipment_serial = {
        in: aedSerials.map(r => r.equipment_serial),
      };
    }

    // 공통 where 조건
    const where: any = {
      ...regionFilter,
    };

    // 날짜 범위 (KST 기준)
    if (startDate || endDate) {
      where.inspection_time = {};
      const kstOffset = 9 * 60 * 60 * 1000; // 9시간을 밀리초로

      if (startDate) {
        try {
          // startDate의 KST 00:00:00을 UTC로 변환
          const [year, month, day] = startDate.split('-').map(Number);
          const startKST = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - kstOffset);
          where.inspection_time.gte = startKST;
        } catch (error) {
          logger.error('ImprovementReports:GET', 'startDate 파싱 실패', { startDate, error });
          // 파싱 실패 시 원본 사용 (fallback)
          where.inspection_time.gte = new Date(startDate);
        }
      }

      if (endDate) {
        try {
          // endDate의 KST 23:59:59을 UTC로 변환
          const [year, month, day] = endDate.split('-').map(Number);
          const endKST = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) - kstOffset);
          where.inspection_time.lte = endKST;
        } catch (error) {
          logger.error('ImprovementReports:GET', 'endDate 파싱 실패', { endDate, error });
          // 파싱 실패 시 원본 사용 (fallback)
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          where.inspection_time.lte = end;
        }
      }
    }

    // 필드 카테고리
    if (fieldCategory && fieldCategory !== 'all') {
      where.field_category = fieldCategory;
    }

    // 뷰에 따른 필터
    if (view === 'inspection') {
      // 점검시점 상태 조회
      if (status && status !== 'all') {
        where.status_at_inspection = status;
      }
    } else if (view === 'improvement') {
      // 개선 현황 조회 (문제였던 것만)
      where.status_at_inspection = 'problematic';
      if (improvementStatus && improvementStatus !== 'all') {
        where.improvement_status = improvementStatus;
      }
      if (minDays) {
        where.days_since_inspection = { gte: parseInt(minDays) };
      }
    } else if (view === 'all') {
      // 통합 조회
      if (status && status !== 'all') {
        where.status_at_inspection = status;
      }
      if (improvementStatus && improvementStatus !== 'all') {
        where.improvement_status = improvementStatus;
      }
    }

    // 데이터 조회
    const [records, totalCount] = await Promise.all([
      prisma.inspection_field_comparisons.findMany({
        where,
        include: {
          inspection: {
            select: {
              inspection_date: true,
              inspector_id: true,
              user_profiles: {
                select: {
                  full_name: true,
                  email: true,
                },
              },
            },
          },
          aed_device: {
            select: {
              installation_institution: true,
              sido: true,
              gugun: true,
            },
          },
        },
        orderBy: {
          inspection_time: 'desc',
        },
        take: limit,
        skip: offset,
      }),
      prisma.inspection_field_comparisons.count({ where }),
    ]);

    // 요약 통계
    const stats = await prisma.inspection_field_comparisons.groupBy({
      by: ['status_at_inspection'],
      where: {
        ...regionFilter,
        ...(startDate || endDate ? { inspection_time: where.inspection_time } : {}),
      },
      _count: true,
    });

    const improvementStats = await prisma.inspection_field_comparisons.groupBy({
      by: ['improvement_status'],
      where: {
        ...regionFilter,
        status_at_inspection: 'problematic',
        ...(startDate || endDate ? { inspection_time: where.inspection_time } : {}),
      },
      _count: true,
    });

    const totalInspections = stats.reduce((sum, s) => sum + s._count, 0);
    const goodCount = stats.find(s => s.status_at_inspection === 'good')?._count || 0;
    const problematicCount = stats.find(s => s.status_at_inspection === 'problematic')?._count || 0;
    const improvedCount = improvementStats.find(s => s.improvement_status === 'improved')?._count || 0;
    const neglectedCount = improvementStats.find(s => s.improvement_status === 'neglected')?._count || 0;
    const improvementRate = problematicCount > 0 ? (improvedCount / problematicCount) * 100 : 0;

    logger.info('ImprovementReports:GET', '리포트 조회', {
      userId,
      view,
      totalCount,
      limit,
      offset,
    });

    const responseData = {
      success: true,
      data: records,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
      stats: {
        totalInspections,
        goodCount,
        problematicCount,
        improvedCount,
        neglectedCount,
        improvementRate: improvementRate.toFixed(1),
      },
    };

    // 캐시에 저장
    reportCache.set(cacheKey, responseData);

    return NextResponse.json(responseData);

  } catch (error) {
    logger.error('ImprovementReports:GET', '리포트 조회 실패', error instanceof Error ? error : { error });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
