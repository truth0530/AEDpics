import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth/auth-options';
import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api/error-handler';
import { logger } from '@/lib/logger';

import { prisma } from '@/lib/prisma';
/**
 * GET /api/inspections/history
 * 완료된 점검 이력 조회 (최근 24시간 또는 특정 장비)
 */
// @ts-expect-error - apiHandler type issue with return type
export const GET = apiHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const equipmentSerial = searchParams.get('equipment_serial');
  const hoursAgo = parseInt(searchParams.get('hours') || '24');

  // 인증 확인
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 사용자 정보 조회 (권한 확인)
  const userProfile = await prisma.user_profiles.findUnique({
    where: { id: session.user.id },
    include: {
      organizations: {
        select: {
          id: true,
          name: true,
          type: true,
          region_code: true,
          city_code: true
        }
      }
    }
  });

  if (!userProfile) {
    return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
  }

  // 시간 범위 계산
  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - hoursAgo);

  // Prisma 쿼리 조건
  const where: any = {
    inspection_date: {
      gte: cutoffDate
    }
  };

  if (equipmentSerial) {
    where.equipment_serial = equipmentSerial;
  }

  // 권한별 필터링
  if (userProfile.role === 'local_admin' && userProfile.organizations) {
    // 보건소 담당자: 해당 지역의 점검만 조회
    const regionCode = userProfile.organizations.region_code;
    const cityCode = userProfile.organizations.city_code;

    logger.info('InspectionHistory:GET', 'Local admin filtering', {
      email: userProfile.email,
      organization: userProfile.organizations.name,
      regionCode,
      cityCode
    });

    // AED 데이터와 조인하여 지역 필터링 - Prisma relation 필터링 사용
    const aedFilter: any = {};

    if (regionCode) {
      // 시도 코드 매핑 (예: DAE -> 대구광역시)
      const sidoMap: Record<string, string> = {
        'SEL': '서울특별시',
        'BUS': '부산광역시',
        'DAE': '대구광역시',
        'INC': '인천광역시',
        'GWA': '광주광역시',
        'DAJ': '대전광역시',
        'ULS': '울산광역시',
        'SEJ': '세종특별자치시',
        'GYE': '경기도',
        'GAN': '강원도',
        'CHB': '충청북도',
        'CHN': '충청남도',
        'JEB': '전라북도',
        'JEN': '전라남도',
        'GYB': '경상북도',
        'GYN': '경상남도',
        'JEJ': '제주특별자치도'
      };

      const sido = sidoMap[regionCode];
      if (sido) {
        aedFilter.sido = sido;
      }

      // 시군구 필터링
      if (cityCode && userProfile.organizations.name) {
        // 조직명에서 시군구 추출 (예: "대구광역시 중구 보건소" -> "중구")
        const nameParts = userProfile.organizations.name.split(' ');
        const gugunIndex = nameParts.findIndex(part => part.includes('구') || part.includes('군') || part.includes('시'));
        if (gugunIndex >= 0) {
          const gugun = nameParts[gugunIndex];
          aedFilter.gugun = gugun;
        }
      }

      logger.info('InspectionHistory:GET', 'AED filter constructed', aedFilter);

      // Prisma relation 필터링 적용
      if (Object.keys(aedFilter).length > 0) {
        where.aed_data = aedFilter;
      }
    }
  } else if (userProfile.role === 'master' ||
             userProfile.role === 'emergency_center_admin' ||
             userProfile.role === 'ministry_admin' ||
             userProfile.role === 'regional_admin' ||
             userProfile.role === 'regional_emergency_center_admin' ||
             userProfile.email?.endsWith('@nmc.or.kr')) {
    // 전국 권한: 모든 데이터 조회 가능
    // 추가 필터 없음
  } else if (userProfile.role === 'temporary_inspector') {
    // 점검자: 자신이 점검한 내역만 조회
    where.inspector_id = session.user.id;
  }

  try {
    logger.info('InspectionHistory:GET', 'Query conditions', { where });

    const inspections = await prisma.inspections.findMany({
      where,
      include: {
        user_profiles: {
          select: {
            full_name: true,
            email: true
          }
        },
        aed_data: {
          select: {
            installation_institution: true,
            sido: true,
            gugun: true,
            installation_address: true
          }
        }
      },
      orderBy: {
        inspection_date: 'desc'
      }
    });

    logger.info('InspectionHistory:GET', `Found ${inspections.length} inspections`, {
      userEmail: userProfile.email,
      userRole: userProfile.role,
      organization: userProfile.organizations?.name
    });

    // 응답 데이터 포맷팅
    const formattedInspections = inspections.map((inspection: any) => ({
      id: inspection.id,
      equipment_serial: inspection.equipment_serial,
      inspector_id: inspection.inspector_id,
      inspector_name: inspection.user_profiles?.full_name || '알 수 없음',
      inspector_email: inspection.user_profiles?.email,
      inspection_date: inspection.inspection_date,
      inspection_type: inspection.inspection_type,
      visual_status: inspection.visual_status,
      battery_status: inspection.battery_status,
      pad_status: inspection.pad_status,
      operation_status: inspection.operation_status,
      overall_status: inspection.overall_status,
      notes: inspection.notes,
      issues_found: inspection.issues_found,
      photos: inspection.photos,
      inspection_latitude: inspection.inspection_latitude,
      inspection_longitude: inspection.inspection_longitude,
      step_data: inspection.inspected_data || {},  // inspected_data를 step_data로 매핑
      original_data: inspection.original_data || {},  // 원본 데이터도 포함
      aed_data: inspection.aed_data || null,  // 위치 정보 추가
      created_at: inspection.created_at,
      updated_at: inspection.updated_at,
      completed_at: inspection.completed_at,
    }));

    return NextResponse.json({
      success: true,
      count: formattedInspections.length,
      inspections: formattedInspections,
    });

  } catch (error) {
    logger.error('InspectionHistory:GET', 'Query error',
      error instanceof Error ? error : { error }
    );
    return NextResponse.json({ error: 'Failed to fetch inspection history' }, { status: 500 });
  }
});
