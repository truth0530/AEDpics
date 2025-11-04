import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { UserRole } from '@/packages/types';

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
 * GET: 지역/기간 비교 통계
 *
 * Query Parameters:
 * - compareType: 'region' | 'period'
 * - regions: comma-separated region codes (for region comparison)
 * - period1Start, period1End: first period dates
 * - period2Start, period2End: second period dates
 */
export async function GET(request: NextRequest) {
  try {
    const { userId, user } = await requireAuthWithRole();

    const searchParams = request.nextUrl.searchParams;
    const compareType = searchParams.get('compareType') || 'region';
    const regions = searchParams.get('regions')?.split(',') || [];
    const period1Start = searchParams.get('period1Start');
    const period1End = searchParams.get('period1End');
    const period2Start = searchParams.get('period2Start');
    const period2End = searchParams.get('period2End');
    const region = searchParams.get('region');

    // 권한에 따른 장비 시리얼 필터
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

    if (compareType === 'region') {
      // 지역 간 비교 - 최적화: 단일 쿼리 + 메모리 그룹화
      const where: any = {
        aed_device: {
          sido: { in: regions }
        },
        ...(equipmentSerials ? { equipment_serial: { in: equipmentSerials } } : {})
      };

      // 날짜 범위 (KST 기준)
      if (period1Start && period1End) {
        const kstOffset = 9 * 60 * 60 * 1000; // 9시간을 밀리초로
        try {
          const [startYear, startMonth, startDay] = period1Start.split('-').map(Number);
          const [endYear, endMonth, endDay] = period1End.split('-').map(Number);
          where.inspection_time = {
            gte: new Date(Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0, 0) - kstOffset),
            lte: new Date(Date.UTC(endYear, endMonth - 1, endDay, 23, 59, 59, 999) - kstOffset)
          };
        } catch (error) {
          logger.error('ImprovementCompare:region', '날짜 파싱 실패', { period1Start, period1End, error });
          where.inspection_time = {
            gte: new Date(period1Start),
            lte: new Date(period1End)
          };
        }
      }

      // 모든 데이터를 한 번에 조회
      const allRecords = await prisma.inspection_field_comparisons.findMany({
        where,
        select: {
          aed_device: {
            select: { sido: true }
          },
          status_at_inspection: true,
          improvement_status: true
        }
      });

      // 메모리에서 지역별 그룹화
      const regionStats = new Map<string, { total: number; problematic: number; improved: number; neglected: number }>();

      allRecords.forEach(record => {
        const region = record.aed_device.sido;
        if (!regionStats.has(region)) {
          regionStats.set(region, { total: 0, problematic: 0, improved: 0, neglected: 0 });
        }

        const stats = regionStats.get(region)!;
        stats.total++;

        if (record.status_at_inspection === 'problematic') {
          stats.problematic++;
          if (record.improvement_status === 'improved') {
            stats.improved++;
          } else if (record.improvement_status === 'neglected') {
            stats.neglected++;
          }
        }
      });

      // 결과 생성
      const comparisonData = regions.map(region => {
        const stats = regionStats.get(region) || { total: 0, problematic: 0, improved: 0, neglected: 0 };
        const improvementRate = stats.problematic > 0
          ? Math.round((stats.improved / stats.problematic) * 100 * 10) / 10
          : 0;

        return {
          label: region,
          totalCount: stats.total,
          problematicCount: stats.problematic,
          improvedCount: stats.improved,
          neglectedCount: stats.neglected,
          improvementRate
        };
      });

      return NextResponse.json({
        success: true,
        compareType: 'region',
        data: comparisonData
      });

    } else if (compareType === 'period') {
      // 기간 간 비교
      const comparisonData = [];

      // Period 1 (KST 기준)
      if (period1Start && period1End) {
        const kstOffset = 9 * 60 * 60 * 1000; // 9시간을 밀리초로
        let inspectionTimeRange: any;
        try {
          const [startYear, startMonth, startDay] = period1Start.split('-').map(Number);
          const [endYear, endMonth, endDay] = period1End.split('-').map(Number);
          inspectionTimeRange = {
            gte: new Date(Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0, 0) - kstOffset),
            lte: new Date(Date.UTC(endYear, endMonth - 1, endDay, 23, 59, 59, 999) - kstOffset)
          };
        } catch (error) {
          logger.error('ImprovementCompare:period1', '날짜 파싱 실패', { period1Start, period1End, error });
          inspectionTimeRange = {
            gte: new Date(period1Start),
            lte: new Date(period1End)
          };
        }

        const where1: any = {
          inspection_time: inspectionTimeRange,
          ...(equipmentSerials ? { equipment_serial: { in: equipmentSerials } } : {}),
          ...(region ? { aed_device: { sido: region } } : {})
        };

        const totalCount1 = await prisma.inspection_field_comparisons.count({ where: where1 });
        const problematicCount1 = await prisma.inspection_field_comparisons.count({
          where: { ...where1, status_at_inspection: 'problematic' }
        });
        const improvedCount1 = await prisma.inspection_field_comparisons.count({
          where: { ...where1, status_at_inspection: 'problematic', improvement_status: 'improved' }
        });
        const neglectedCount1 = await prisma.inspection_field_comparisons.count({
          where: { ...where1, status_at_inspection: 'problematic', improvement_status: 'neglected' }
        });

        const improvementRate1 = problematicCount1 > 0
          ? Math.round((improvedCount1 / problematicCount1) * 100 * 10) / 10
          : 0;

        comparisonData.push({
          label: `기간1 (${period1Start.slice(5)} ~ ${period1End.slice(5)})`,
          totalCount: totalCount1,
          problematicCount: problematicCount1,
          improvedCount: improvedCount1,
          neglectedCount: neglectedCount1,
          improvementRate: improvementRate1
        });
      }

      // Period 2 (KST 기준)
      if (period2Start && period2End) {
        const kstOffset = 9 * 60 * 60 * 1000; // 9시간을 밀리초로
        let inspectionTimeRange: any;
        try {
          const [startYear, startMonth, startDay] = period2Start.split('-').map(Number);
          const [endYear, endMonth, endDay] = period2End.split('-').map(Number);
          inspectionTimeRange = {
            gte: new Date(Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0, 0) - kstOffset),
            lte: new Date(Date.UTC(endYear, endMonth - 1, endDay, 23, 59, 59, 999) - kstOffset)
          };
        } catch (error) {
          logger.error('ImprovementCompare:period2', '날짜 파싱 실패', { period2Start, period2End, error });
          inspectionTimeRange = {
            gte: new Date(period2Start),
            lte: new Date(period2End)
          };
        }

        const where2: any = {
          inspection_time: inspectionTimeRange,
          ...(equipmentSerials ? { equipment_serial: { in: equipmentSerials } } : {}),
          ...(region ? { aed_device: { sido: region } } : {})
        };

        const totalCount2 = await prisma.inspection_field_comparisons.count({ where: where2 });
        const problematicCount2 = await prisma.inspection_field_comparisons.count({
          where: { ...where2, status_at_inspection: 'problematic' }
        });
        const improvedCount2 = await prisma.inspection_field_comparisons.count({
          where: { ...where2, status_at_inspection: 'problematic', improvement_status: 'improved' }
        });
        const neglectedCount2 = await prisma.inspection_field_comparisons.count({
          where: { ...where2, status_at_inspection: 'problematic', improvement_status: 'neglected' }
        });

        const improvementRate2 = problematicCount2 > 0
          ? Math.round((improvedCount2 / problematicCount2) * 100 * 10) / 10
          : 0;

        comparisonData.push({
          label: `기간2 (${period2Start.slice(5)} ~ ${period2End.slice(5)})`,
          totalCount: totalCount2,
          problematicCount: problematicCount2,
          improvedCount: improvedCount2,
          neglectedCount: neglectedCount2,
          improvementRate: improvementRate2
        });
      }

      return NextResponse.json({
        success: true,
        compareType: 'period',
        data: comparisonData
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid compareType'
    }, { status: 400 });

  } catch (error) {
    logger.error('ImprovementReportsCompare', '비교 통계 조회 실패', error instanceof Error ? error : { error });

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: '비교 통계 조회 실패' },
      { status: 500 }
    );
  }
}
