import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth/auth-options';
import type { AedDataWhereInput } from '@/lib/types/api-filters';
import type { Prisma } from '@prisma/client';
import { mapCityCodeToGugun, normalizeGugunForDB, getRegionLabel } from '@/lib/constants/regions';

import { prisma } from '@/lib/prisma';
/**
 * GET /api/aed-data/priority
 * 우선순위 메뉴용 AED 목록 (할당 상태 포함)
 */
export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 사용자 프로필 조회
    const userProfile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id },
      include: {
        organizations: true
      }
    });

    if (!userProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // 쿼리 파라미터
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '100');
    const page = parseInt(searchParams.get('page') || '1');
    const skip = (page - 1) * limit;

    // AED 데이터 조회 (관할 지역 기반)
    const where: AedDataWhereInput = {};

    // 지역 필터링 (local_admin은 본인 관할만)
    if (userProfile.role === 'local_admin' && userProfile.organizations) {
      // 시도 필터: region_code → 약칭 변환 (aed_data.sido는 약칭으로 저장됨)
      // 예: 'DAE' → '대구', 'SEO' → '서울'
      if (userProfile.organizations.region_code) {
        where.sido = getRegionLabel(userProfile.organizations.region_code);
      }
      // 구군 필터: city_code → gugun → 정규화
      if (userProfile.organizations.city_code) {
        const gugun = mapCityCodeToGugun(userProfile.organizations.city_code);
        const normalizedGugun = normalizeGugunForDB(gugun || undefined);
        if (normalizedGugun) {
          where.gugun = normalizedGugun;
        }
      }
    } else if (userProfile.role === 'regional_admin' && userProfile.organizations) {
      // 시도청은 시도만 필터: region_code → 약칭 변환
      if (userProfile.organizations.region_code) {
        where.sido = getRegionLabel(userProfile.organizations.region_code);
      }
    }

    const [aedList, totalCount] = await Promise.all([
      prisma.aed_data.findMany({
        where,
        orderBy: [
          { battery_expiry_date: 'asc' },
          { patch_expiry_date: 'asc' }
        ],
        skip,
        take: limit
      }),
      prisma.aed_data.count({ where })
    ]);

    // Only query assignments for the current page's equipment serials
    const equipmentSerials = (aedList || []).map(aed => aed.equipment_serial).filter(Boolean);

    // Query assignments only for this page's equipment, scoped to assigned_to for inspectors
    const assignmentWhere: Prisma.inspection_assignmentsWhereInput = {
      equipment_serial: { in: equipmentSerials },
      status: { in: ['pending', 'in_progress'] }
    };

    // TODO: Add temporary_inspector role to schema, then uncomment this
    // For inspector role, only show their own assignments
    // if (userProfile.role === 'temporary_inspector') {
    //   assignmentWhere.assigned_to = session.user.id;
    // }

    const assignments = await prisma.inspection_assignments.findMany({
      where: assignmentWhere,
      select: {
        equipment_serial: true,
        scheduled_date: true,
        assignment_type: true,
        status: true,
        id: true
      }
    });

    // equipment_serial을 키로 하는 맵 생성
    const assignmentMap = new Map();
    (assignments || []).forEach(a => {
      assignmentMap.set(a.equipment_serial, {
        assignment_id: a.id,
        scheduled_date: a.scheduled_date,
        assignment_type: a.assignment_type,
        assignment_status: a.status
      });
    });

    // AED 데이터와 할당 정보 병합
    const enrichedData = (aedList || []).map(aed => {
      const assignment = assignmentMap.get(aed.equipment_serial);

      // 유효기간 계산
      const today = new Date();
      const batteryExpiry = aed.battery_expiry_date ? new Date(aed.battery_expiry_date) : null;
      const patchExpiry = aed.patch_expiry_date ? new Date(aed.patch_expiry_date) : null;

      const days_until_battery_expiry = batteryExpiry
        ? Math.ceil((batteryExpiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        : 9999;

      const days_until_patch_expiry = patchExpiry
        ? Math.ceil((patchExpiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        : 9999;

      return {
        ...aed,
        ...assignment, // assignment_id, scheduled_date, assignment_type, assignment_status
        days_until_battery_expiry,
        days_until_patch_expiry
      };
    });

    // 통계 계산
    const stats = {
      total: enrichedData.length,
      assigned: enrichedData.filter(a => a.assignment_id).length,
      unassigned: enrichedData.filter(a => !a.assignment_id).length,
      urgent: enrichedData.filter(
        a => a.days_until_battery_expiry < 30 || a.days_until_patch_expiry < 30
      ).length
    };

    return NextResponse.json({
      success: true,
      data: enrichedData,
      stats,
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit)
      }
    });

  } catch (error) {
    console.error('[API Error]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
