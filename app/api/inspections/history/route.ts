import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth/auth-options';
import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api/error-handler';
import { logger } from '@/lib/logger';

import { prisma } from '@/lib/prisma';
/**
 * GET /api/inspections/history
 * 완료된 점검 이력 조회 (최근 24시간 또는 특정 장비)
 *
 * 쿼리 파라미터:
 *   - equipment_serial: 특정 장비의 점검 이력만 조회
 *   - hours: 조회 범위 (기본값: 24시간)
 *   - mode: 지역 필터링 기준 ('address'=물리적 위치, 'jurisdiction'=관할보건소 기본값: 'address')
 *
 * 권한별 조회 범위:
 *   - local_admin (보건소): 'address' 또는 'jurisdiction' 모드로 조회
 *   - regional_admin (응급의료지원센터): 전국 조회 가능
 *   - master: 전국 조회 가능
 *
 * 응답 필드:
 *   - inspection_date: AEDpics 시스템에서 실제 점검한 날짜
 *   - last_inspection_date_egen: e-gen 원본 시스템의 최근 점검일 (참고용)
 *   - data_source: 점검 데이터 출처 ('aedpics' 또는 'egen')
 */
// @ts-expect-error - apiHandler type issue with return type
export const GET = apiHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const equipmentSerial = searchParams.get('equipment_serial');
  const hoursAgo = parseInt(searchParams.get('hours') || '24');
  // 지역 필터링 기준: 'address' (물리적 위치) 또는 'jurisdiction' (관할보건소)
  const filterMode = searchParams.get('mode') || 'address';

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
    },
    // 완료된 점검만 표시 (pending 제외)
    overall_status: {
      in: ['pass', 'fail', 'normal', 'needs_improvement', 'malfunction']
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
      cityCode,
      filterMode
    });

    // AED 데이터와 조인하여 지역 필터링 - Prisma relation 필터링 사용
    const aedFilter: any = {};

    if (filterMode === 'jurisdiction') {
      // 관할보건소 기준 필터링: 해당 보건소가 관리하는 모든 AED (타 지역 포함 가능)
      if (userProfile.organizations.name) {
        aedFilter.jurisdiction_health_center = userProfile.organizations.name;
      }
      logger.info('InspectionHistory:GET', 'Using jurisdiction-based filtering', {
        healthCenter: userProfile.organizations.name
      });
    } else {
      // 주소 기준 필터링 (기본값): 물리적 위치가 해당 시도/시군구인 AED
      if (regionCode) {
        // 시도 코드 매핑 (예: DAE -> 대구광역시)
        // 검증 결과 (2025-11-07): 실제 데이터베이스의 region_code 값과 일치하도록 수정
        // 주의: KR (보건복지부/중앙)은 필터를 적용하지 않음 (전국 권한이므로 else if에서 이미 처리)
        const sidoMap: Record<string, string> = {
          'SEO': '서울특별시',      // 수정: SEL -> SEO (중앙응급의료센터 코드)
          'BUS': '부산광역시',
          'DAE': '대구광역시',
          'INC': '인천광역시',
          'GWA': '광주광역시',
          'DAJ': '대전광역시',
          'ULS': '울산광역시',
          'SEJ': '세종특별자치시',
          'GYE': '경기도',           // 수정: GYG -> GYE (경기도 정확한 코드)
          'GAN': '강원도',
          'CHB': '충청북도',
          'CHN': '충청남도',
          'JEB': '전라북도',
          'JEN': '전라남도',
          'GYB': '경상북도',
          'GYN': '경상남도',
          'JEJ': '제주특별자치도'
        };

        // KR (보건복지부)는 전국 권한이므로 필터를 적용하지 않음
        // CBN은 청주시 조직명이지만 실제 sido는 충청북도(CHB)이므로 맵에 포함하지 않음
        const sido = sidoMap[regionCode];
        if (sido && regionCode !== 'KR') {
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
      }
      logger.info('InspectionHistory:GET', 'Using address-based filtering', aedFilter);
    }

    // Prisma relation 필터링 적용
    // (note: FK가 NULL인 레코드도 필터링되는 문제 - 향후 개선 대상)
    if (Object.keys(aedFilter).length > 0) {
      where.aed_data = aedFilter;
    }

    // TODO: 2025-11-07 이후 FK 마이그레이션 완료 후 제거 가능
    // 현재: FK가 없는 레코드는 여기서 필터링됨 - 이는 의도된 동작
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
            installation_address: true,
            last_inspection_date: true,
            jurisdiction_health_center: true
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
    const formattedInspections = inspections.map((inspection: any) => {
      // 점검일자 데이터 소스 판단
      // - inspection_date: AEDpics 시스템에서 기록한 실제 점검일
      // - last_inspection_date_egen: e-gen 원본 시스템의 점검일 (참고용)
      // 데이터 소스 결정 로직:
      // 1. original_data에 e-gen 메타데이터가 있으면 'egen'으로 표시 (향후 e-gen 동기화 데이터용)
      // 2. 그 외는 'aedpics' (AEDpics 시스템에서 직접 생성)
      let dataSource = 'aedpics';  // 기본값

      // e-gen 동기화 데이터 판단 (향후 구현을 위한 인프라)
      // NOTE: original_data는 JSON 객체, 문자열, null 중 하나일 수 있음
      try {
        let originalData = inspection.original_data;

        // 문자열인 경우 JSON 파싱 (DB에 문자열로 저장된 JSON 데이터 처리)
        if (typeof originalData === 'string' && originalData.trim().length > 0) {
          originalData = JSON.parse(originalData);
        }

        // 파싱 후 객체인지 확인하고 e-gen 메타데이터 검사
        if (originalData && typeof originalData === 'object') {
          if (originalData.source === 'egen' ||
              originalData.from_egen === true ||
              originalData.e_gen_inspection_date !== undefined) {
            dataSource = 'egen';
          }
        }
      } catch (parseError) {
        // JSON 파싱 실패 시 로깅하되, 기본값 'aedpics' 유지
        logger.warn('InspectionHistory:GET', 'Failed to parse original_data', {
          inspectionId: inspection.id,
          error: parseError instanceof Error ? parseError.message : 'Unknown error'
        });
      }

      return {
        id: inspection.id,
        equipment_serial: inspection.equipment_serial,
        inspector_id: inspection.inspector_id,
        inspector_name: inspection.user_profiles?.full_name || '알 수 없음',
        inspector_email: inspection.user_profiles?.email,
        // 점검일자: AEDpics 시스템에서 기록한 날짜
        inspection_date: inspection.inspection_date,
        // e-gen 원본 시스템의 최근 점검일 (참고용)
        last_inspection_date_egen: inspection.aed_data?.last_inspection_date || null,
        // 데이터 소스 표시 (UI에서 사용자에게 표시)
        data_source: dataSource,
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
        aed_data: inspection.aed_data ? {
          installation_institution: inspection.aed_data.installation_institution,
          sido: inspection.aed_data.sido,
          gugun: inspection.aed_data.gugun,
          installation_address: inspection.aed_data.installation_address,
          jurisdiction_health_center: inspection.aed_data.jurisdiction_health_center
        } : null,
        created_at: inspection.created_at,
        updated_at: inspection.updated_at,
        completed_at: inspection.completed_at,
      };
    });

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
