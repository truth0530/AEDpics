import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth/auth-options';
import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api/error-handler';
import { logger } from '@/lib/logger';
import { REGION_CODE_TO_DB_LABELS, mapCityCodeToGugun, normalizeJurisdictionName } from '@/lib/constants/regions';

import { prisma } from '@/lib/prisma';
/**
 * GET /api/inspections/history
 * 완료된 점검 이력 조회 (최근 24시간 또는 특정 장비)
 *
 * 쿼리 파라미터:
 *   - equipment_serial: 특정 장비의 점검 이력만 조회
 *   - hours: 조회 범위 (기본값: 24시간)
 *   - mode: 지역 필터링 기준 ('address'=물리적 위치, 'jurisdiction'=관할보건소 기본값: 'address')
 *   - status: 점검 상태 필터 ('all'=전체, 'in_progress'=점검중, 'completed'=점검완료, 기본값: 'completed')
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
  // 상태 필터: 'all' (전체), 'in_progress' (점검중), 'completed' (점검완료)
  const statusFilter = searchParams.get('status') || 'completed';

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

  // AED 필터 (aed_data relation 필터링용)
  const aedFilter: any = {};

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

    if (filterMode === 'jurisdiction') {
      // 관할보건소 기준 필터링: 해당 보건소가 관리하는 모든 AED (타 지역 포함 가능)
      if (userProfile.organizations.name) {
        const originalName = userProfile.organizations.name;
        const normalizedName = normalizeJurisdictionName(originalName);

        // 원본 이름과 정규화된 이름 모두 검색 (공백/구군명 중복 대응)
        // 예: "서귀포시 보건소" (원본) 또는 "서귀포시서귀포보건소" (정규화)
        // Prisma nested relation filter에서는 IN operator 사용
        const jurisdictionVariants = [originalName];
        if (normalizedName !== originalName) {
          jurisdictionVariants.push(normalizedName);
        }

        aedFilter.jurisdiction_health_center = { in: jurisdictionVariants };
      }
      logger.info('InspectionHistory:GET', 'Using jurisdiction-based filtering', {
        healthCenter: userProfile.organizations.name,
        normalizedName: userProfile.organizations.name ? normalizeJurisdictionName(userProfile.organizations.name) : null,
        aedFilter: JSON.stringify(aedFilter)
      });
    } else {
      // 주소 기준 필터링 (기본값): 물리적 위치가 해당 시도/시군구인 AED
      if (regionCode && regionCode !== 'KR') {
        // 중앙 관리 시스템에서 지역명 조회
        // REGION_CODE_TO_DB_LABELS는 각 지역코드에 대한 모든 유효한 데이터베이스 라벨을 포함
        // 예: 'DAE': ['대구광역시', '대구'] - 데이터베이스가 어떤 형식으로 저장했든 모두 매칭됨
        const validSidoLabels = REGION_CODE_TO_DB_LABELS[regionCode];
        if (validSidoLabels && validSidoLabels.length > 0) {
          // OR 필터를 사용하여 유효한 형식 중 하나와 일치하는 AED를 모두 조회
          aedFilter.sido = { in: validSidoLabels };
        }

        // 시군구 필터링 - city_code 기반으로 mapCityCodeToGugun 헬퍼 사용
        // (CLAUDE 가이드라인: 중앙 유틸 functions 사용)
        if (userProfile.organizations && userProfile.organizations.city_code) {
          const gugunName = mapCityCodeToGugun(userProfile.organizations.city_code);
          if (gugunName) {
            aedFilter.gugun = gugunName;
            logger.info('InspectionHistory:GET', 'Gugun name resolved via helper', {
              cityCode: userProfile.organizations.city_code,
              gugunName: gugunName
            });
          } else {
            logger.warn('InspectionHistory:GET', 'Failed to resolve gugun name from city_code', {
              cityCode: userProfile.organizations.city_code,
              organizationName: userProfile.organizations.name
            });
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
    logger.info('InspectionHistory:GET', 'Query conditions', { where, statusFilter });

    let inspections: any[] = [];
    let inProgressSessions: any[] = [];

    // 점검완료 조회 (completed 또는 all)
    if (statusFilter === 'completed' || statusFilter === 'all') {
      inspections = await prisma.inspections.findMany({
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
              jurisdiction_health_center: true,
              battery_expiry_date: true,
              patch_expiry_date: true,
              manufacturing_date: true,
              operation_status: true
            }
          }
        },
        orderBy: {
          inspection_date: 'desc'
        }
      });
    }

    // 점검중 조회 (in_progress 또는 all)
    if (statusFilter === 'in_progress' || statusFilter === 'all') {
      const sessionWhere: any = {
        status: 'active',
        started_at: {
          gte: cutoffDate
        }
      };

      if (equipmentSerial) {
        sessionWhere.equipment_serial = equipmentSerial;
      }

      // 권한별 필터링 (inspection_sessions에 적용)
      if (userProfile.role === 'local_admin' && userProfile.organizations) {
        // inspection_sessions는 aed_data와 relation이 있으므로 동일한 aedFilter 적용 가능
        if (Object.keys(aedFilter).length > 0) {
          sessionWhere.aed_data = aedFilter;
        }
      } else if (userProfile.role === 'temporary_inspector') {
        sessionWhere.inspector_id = session.user.id;
      }

      inProgressSessions = await prisma.inspection_sessions.findMany({
        where: sessionWhere,
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
              jurisdiction_health_center: true,
              battery_expiry_date: true,
              patch_expiry_date: true,
              manufacturing_date: true,
              operation_status: true
            }
          }
        },
        orderBy: {
          started_at: 'desc'
        }
      });
    }

    // 폴백 쿼리: 점검완료 조회 시 결과가 없고, local_admin이며 aedFilter가 있는 경우
    // (equipment_serial이 aed_data에 없는 데이터 품질 문제 대비)
    const shouldUseFallback = (statusFilter === 'completed' || statusFilter === 'all') &&
                             inspections.length === 0 &&
                             userProfile.role === 'local_admin' &&
                             Object.keys(aedFilter).length > 0;

    if (shouldUseFallback) {
      logger.warn('InspectionHistory:GET', 'Using NULL FK fallback query', {
        userEmail: userProfile.email,
        organization: userProfile.organizations?.name,
        filterMode: filterMode,
        reason: 'Primary query returned 0 results with aed_data relation filter'
      });

      // 폴백: aedFilter로 허용된 equipment_serial만 추출 (권한 유지)
      const allowedAeds = await prisma.aed_data.findMany({
        where: aedFilter,
        select: { equipment_serial: true }
      });

      const allowedEquipmentSerials = allowedAeds.map(aed => aed.equipment_serial);

      logger.info('InspectionHistory:GET', 'Extracted allowed equipment serials from aedFilter', {
        count: allowedEquipmentSerials.length,
        sample: allowedEquipmentSerials.slice(0, 5)
      });

      // 폴백 쿼리: aedFilter로 제한된 equipment_serial 범위 내에서만 조회 (권한 보호)
      const fallbackWhere: any = {
        inspection_date: where.inspection_date,
        overall_status: where.overall_status,
        equipment_serial: { in: allowedEquipmentSerials },  // ← 권한 필터 유지
        inspector_id: where.inspector_id  // 있는 경우만
      };

      // 명시적 equipment_serial 파라미터 재적용 (API 계약 준수)
      if (equipmentSerial) {
        fallbackWhere.equipment_serial = equipmentSerial;
      }

      const fallbackInspections = await prisma.inspections.findMany({
        where: fallbackWhere,
        select: {
          id: true,
          equipment_serial: true,
          inspection_date: true,
          aed_data_id: true
        }
      });

      if (fallbackInspections.length > 0) {
        logger.info('InspectionHistory:GET', `Fallback query found ${fallbackInspections.length} records (권한 범위 내)`, {
          equipment_serials: fallbackInspections.map(r => r.equipment_serial),
          aedFilterApplied: Object.keys(aedFilter).length > 0
        });

        // equipment_serial 기준으로 중복 제거 (안전장치)
        const uniqueSerials = new Set<string>();
        const filteredFallback = fallbackInspections.filter(record => {
          if (uniqueSerials.has(record.equipment_serial)) {
            return false;
          }
          uniqueSerials.add(record.equipment_serial);
          return true;
        });

        // 폴백 결과 포함하여 재조회 (full data with relations)
        inspections = await prisma.inspections.findMany({
          where: {
            id: { in: filteredFallback.map(r => r.id) }
          },
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
                jurisdiction_health_center: true,
                battery_expiry_date: true,
                patch_expiry_date: true,
                manufacturing_date: true,
                operation_status: true
              }
            }
          },
          orderBy: {
            inspection_date: 'desc'
          }
        });

        logger.info('InspectionHistory:GET', `Fallback query merged ${inspections.length} records (권한 검증 완료)`, {
          dedupedCount: filteredFallback.length,
          finalCount: inspections.length,
          accessControlMaintained: true
        });
      } else {
        logger.info('InspectionHistory:GET', 'Fallback query returned 0 records (권한 범위 내에서 NULL FK 데이터 없음)', {
          allowedEquipmentCount: allowedEquipmentSerials.length
        });
      }
    }

    logger.info('InspectionHistory:GET', `Found ${inspections.length} completed inspections and ${inProgressSessions.length} in-progress sessions`, {
      userEmail: userProfile.email,
      userRole: userProfile.role,
      organization: userProfile.organizations?.name,
      statusFilter,
      usedFallback: shouldUseFallback
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
          jurisdiction_health_center: inspection.aed_data.jurisdiction_health_center,
          battery_expiry_date: inspection.aed_data.battery_expiry_date,
          patch_expiry_date: inspection.aed_data.patch_expiry_date,
          manufacturing_date: inspection.aed_data.manufacturing_date,
          operation_status: inspection.aed_data.operation_status
        } : null,
        created_at: inspection.created_at,
        updated_at: inspection.updated_at,
        completed_at: inspection.completed_at,
      };
    });

    // 점검중 세션 데이터 포맷팅
    const formattedSessions = inProgressSessions.map((session: any) => {
      return {
        id: session.id,
        equipment_serial: session.equipment_serial,
        inspector_id: session.inspector_id,
        inspector_name: session.user_profiles?.full_name || '알 수 없음',
        inspector_email: session.user_profiles?.email,
        // 점검 시작일을 inspection_date로 매핑
        inspection_date: session.started_at,
        last_inspection_date_egen: session.aed_data?.last_inspection_date || null,
        data_source: 'aedpics',
        inspection_type: 'in_progress',
        // 점검중 상태는 아직 결과가 없으므로 기본값
        visual_status: 'pending',
        battery_status: 'pending',
        pad_status: 'pending',
        operation_status: 'pending',
        overall_status: 'in_progress',
        notes: null,
        issues_found: [],
        photos: [],
        inspection_latitude: null,
        inspection_longitude: null,
        step_data: session.step_data || {},
        original_data: {},
        aed_data: session.aed_data ? {
          installation_institution: session.aed_data.installation_institution,
          sido: session.aed_data.sido,
          gugun: session.aed_data.gugun,
          installation_address: session.aed_data.installation_address,
          jurisdiction_health_center: session.aed_data.jurisdiction_health_center,
          battery_expiry_date: session.aed_data.battery_expiry_date,
          patch_expiry_date: session.aed_data.patch_expiry_date,
          manufacturing_date: session.aed_data.manufacturing_date,
          operation_status: session.aed_data.operation_status
        } : null,
        created_at: session.created_at,
        updated_at: session.updated_at,
        completed_at: null,
        // 점검중 세션 고유 필드
        current_step: session.current_step,
        started_at: session.started_at,
      };
    });

    // 두 배열 병합 (점검중 + 점검완료)
    const allRecords = [...formattedSessions, ...formattedInspections];

    // inspection_date 기준 내림차순 정렬
    allRecords.sort((a, b) => {
      const dateA = new Date(a.inspection_date).getTime();
      const dateB = new Date(b.inspection_date).getTime();
      return dateB - dateA;
    });

    return NextResponse.json({
      success: true,
      count: allRecords.length,
      inspections: allRecords,
    });

  } catch (error) {
    logger.error('InspectionHistory:GET', 'Query error',
      error instanceof Error ? error : { error }
    );
    return NextResponse.json({ error: 'Failed to fetch inspection history' }, { status: 500 });
  }
});
