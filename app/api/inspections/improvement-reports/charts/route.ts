import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { UserRole } from '@/packages/types';

/**
 * ISO 8601 주 번호 계산
 * 월요일이 주의 시작, 목요일이 포함된 주가 해당 연도에 속함
 */
function getISOWeek(date: Date): number {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7; // 월요일을 0으로 만듦
  target.setDate(target.getDate() - dayNr + 3); // 해당 주의 목요일로 이동
  const firstThursday = target.valueOf();
  target.setMonth(0, 1); // 연도의 1월 1일로 이동
  if (target.getDay() !== 4) {
    // 1월 1일이 목요일이 아니면 첫 목요일로 이동
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000); // 밀리초를 주로 변환
}

/**
 * ISO 주 번호가 속한 연도 계산
 */
function getISOYear(date: Date): number {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  return target.getFullYear();
}

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
 * GET: 차트 데이터 조회
 * Query Parameters:
 * - type: 'trend' | 'distribution'
 * - startDate: YYYY-MM-DD
 * - endDate: YYYY-MM-DD
 * - groupBy: 'week' | 'month' (trend용)
 */
export async function GET(request: NextRequest) {
  try {
    const { userId, user } = await requireAuthWithRole();

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'trend';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const groupBy = searchParams.get('groupBy') || 'week';

    // 권한에 따른 지역 필터
    let equipmentSerials: string[] | undefined;
    if (user.role === 'local_admin' && user.region_code) {
      const aedData = await prisma.aed_data.findMany({
        where: { gugun: user.region_code },
        select: { equipment_serial: true },
      });
      equipmentSerials = aedData.map(d => d.equipment_serial);
    } else if (user.role === 'regional_admin' && user.region_code) {
      const aedData = await prisma.aed_data.findMany({
        where: { sido: user.region_code },
        select: { equipment_serial: true },
      });
      equipmentSerials = aedData.map(d => d.equipment_serial);
    }

    if (type === 'trend') {
      // 개선율 추이 데이터
      const where: any = {
        ...(equipmentSerials ? { equipment_serial: { in: equipmentSerials } } : {}),
      };

      if (startDate || endDate) {
        where.inspection_time = {};
        if (startDate) where.inspection_time.gte = new Date(startDate);
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          where.inspection_time.lte = end;
        }
      }

      // 모든 데이터 조회
      const allRecords = await prisma.inspection_field_comparisons.findMany({
        where,
        select: {
          inspection_time: true,
          status_at_inspection: true,
          improvement_status: true,
        },
        orderBy: {
          inspection_time: 'asc',
        },
      });

      // 그룹화
      const grouped = new Map<string, { total: number; good: number; problematic: number; improved: number; neglected: number }>();

      allRecords.forEach(record => {
        const date = new Date(record.inspection_time);
        let key: string;

        if (groupBy === 'month') {
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        } else {
          // ISO 8601 week
          const isoYear = getISOYear(date);
          const weekNumber = getISOWeek(date);
          key = `${isoYear}-W${String(weekNumber).padStart(2, '0')}`;
        }

        if (!grouped.has(key)) {
          grouped.set(key, { total: 0, good: 0, problematic: 0, improved: 0, neglected: 0 });
        }

        const group = grouped.get(key)!;
        group.total++;

        if (record.status_at_inspection === 'good') {
          group.good++;
        } else if (record.status_at_inspection === 'problematic') {
          group.problematic++;
          if (record.improvement_status === 'improved') {
            group.improved++;
          } else if (record.improvement_status === 'neglected') {
            group.neglected++;
          }
        }
      });

      // 차트 데이터 변환
      const trendData = Array.from(grouped.entries())
        .map(([period, stats]) => ({
          period,
          totalInspections: stats.total,
          goodCount: stats.good,
          problematicCount: stats.problematic,
          improvedCount: stats.improved,
          neglectedCount: stats.neglected,
          improvementRate: stats.problematic > 0
            ? parseFloat(((stats.improved / stats.problematic) * 100).toFixed(1))
            : 0,
        }))
        .sort((a, b) => a.period.localeCompare(b.period));

      return NextResponse.json({
        success: true,
        type: 'trend',
        data: trendData,
      });

    } else if (type === 'distribution') {
      // 필드별 문제 분포도
      const where: any = {
        status_at_inspection: 'problematic',
        ...(equipmentSerials ? { equipment_serial: { in: equipmentSerials } } : {}),
      };

      if (startDate || endDate) {
        where.inspection_time = {};
        if (startDate) where.inspection_time.gte = new Date(startDate);
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          where.inspection_time.lte = end;
        }
      }

      const distribution = await prisma.inspection_field_comparisons.groupBy({
        by: ['field_category', 'improvement_status'],
        where,
        _count: true,
      });

      // 카테고리별 집계
      const categoryMap = new Map<string, { total: number; improved: number; neglected: number; pending: number }>();

      distribution.forEach(item => {
        if (!categoryMap.has(item.field_category)) {
          categoryMap.set(item.field_category, { total: 0, improved: 0, neglected: 0, pending: 0 });
        }

        const category = categoryMap.get(item.field_category)!;
        category.total += item._count;

        if (item.improvement_status === 'improved') {
          category.improved += item._count;
        } else if (item.improvement_status === 'neglected') {
          category.neglected += item._count;
        } else {
          category.pending += item._count;
        }
      });

      const CATEGORY_LABELS: Record<string, string> = {
        battery: '배터리',
        pad: '패드',
        manager: '관리자',
        installation: '설치정보',
        device: '장비정보',
      };

      const distributionData = Array.from(categoryMap.entries()).map(([category, stats]) => ({
        category: CATEGORY_LABELS[category] || category,
        total: stats.total,
        improved: stats.improved,
        neglected: stats.neglected,
        pending: stats.pending,
        improvementRate: stats.total > 0
          ? parseFloat(((stats.improved / stats.total) * 100).toFixed(1))
          : 0,
      }));

      return NextResponse.json({
        success: true,
        type: 'distribution',
        data: distributionData,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid type parameter' },
      { status: 400 }
    );

  } catch (error) {
    logger.error('ImprovementCharts:GET', '차트 데이터 조회 실패', error instanceof Error ? error : { error });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
