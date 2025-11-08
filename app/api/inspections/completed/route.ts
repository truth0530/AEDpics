import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth/auth-options';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { resolveAccessScope } from '@/lib/auth/access-control';
import { buildEquipmentFilter } from '@/lib/auth/equipment-access';

/**
 * GET /api/inspections/completed
 * 최근 N시간 내 완료된 점검 목록 조회 (권한 기반 필터링)
 *
 * v5.1 구현 사항:
 * - resolveAccessScope()로 사용자 권한 범위 계산
 * - buildEquipmentFilter()로 equipment 필터 생성
 * - aed_data 조인을 통한 권한 기반 필터링
 */
export async function GET(request: NextRequest) {
  try {
    // === Step 1: 인증 확인 ===
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // === Step 2: 사용자 프로필 조회 ===
    const userProfile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id }
    });
    if (!userProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    // === Step 3: 권한 범위 계산 ===
    const accessScope = resolveAccessScope(userProfile as any);

    // === Step 4: Equipment 필터 생성 ===
    const searchParams = request.nextUrl.searchParams;
    const criteria = searchParams.get('criteria') || 'address';
    const equipmentFilter = buildEquipmentFilter(accessScope, criteria as 'address' | 'jurisdiction');

    // === Step 5: hours 파라미터 파싱 (기본값: 24시간) ===
    const hours = parseInt(searchParams.get('hours') || '24');

    // cutoff 날짜 계산
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hours);

    // === Step 6: 최근 완료된 점검 조회 (aed_data 조인 + 권한 필터) ===
    const inspections = await prisma.inspections.findMany({
      where: {
        inspection_date: {
          gte: cutoffDate
        },
        overall_status: {
          in: ['pass', 'normal', 'needs_improvement', 'malfunction', 'fail']
        },
        // aed_data FK를 통한 equipment 필터 적용
        aed_data: equipmentFilter
      },
      select: {
        equipment_serial: true,
        inspection_date: true,
        overall_status: true,
        aed_data: {
          select: {
            sido: true,
            gugun: true
          }
        }
      },
      orderBy: {
        inspection_date: 'desc'
      }
    });

    // === Step 7: 감사 로그 ===
    logger.info('InspectionCompleted:GET', 'Completed inspections retrieved', {
      userId: session.user.id,
      role: userProfile.role,
      recordCount: inspections.length,
      hoursWindow: hours,
      appliedFilter: Object.keys(equipmentFilter).length > 0 ? 'yes' : 'no'
    });

    return NextResponse.json({
      inspections: inspections.map(inspection => ({
        equipment_serial: inspection.equipment_serial,
        inspection_date: inspection.inspection_date,
        overall_status: inspection.overall_status,
        location: inspection.aed_data
          ? `${inspection.aed_data.sido} ${inspection.aed_data.gugun}`
          : 'Unknown'
      })),
      count: inspections.length,
      cutoffDate: cutoffDate.toISOString(),
      appliedFilters: {
        sido: equipmentFilter.sido || 'all',
        gugun: equipmentFilter.gugun || 'all'
      }
    });

  } catch (error) {
    logger.error('InspectionCompleted:GET', 'Completed inspections error',
      error instanceof Error ? error : { error }
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}