import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { apiHandler } from '@/lib/api/error-handler';
import { logger } from '@/lib/logger';
import { parseQueryParams } from '@/lib/utils/query-parser';
import { resolveAccessScope } from '@/lib/auth/access-control';
import { enforceFilterPolicy } from '@/lib/aed/filter-policy';
import { mapCityCodeToGugun, getNormalizedRegionLabel } from '@/lib/constants/regions';
import { maskSensitiveData } from '@/lib/data/masking';
import { buildEquipmentFilter } from '@/lib/auth/equipment-access';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

/**
 * POST /api/inspections/export
 * 점검 이력 데이터 Excel 다운로드 (v5.3 - Equipment-Centric Pattern)
 *
 * v5.3 Changes (Equipment-Centric Architecture):
 * - buildEquipmentFilter 통합 (equipment-access.ts pattern)
 * - WHERE clause 구성 표준화 (aed_data FK 기반 필터링)
 * - 감사 로그 강화 (applied equipment filter 추적)
 *
 * v5.0 Implementation:
 * - Layer 1: can_export_data 플래그 검증
 * - Layer 2: Role-based 권한 검증
 * - Layer 3: maxResultLimit 강제
 * - City_code → gugun 매핑 with 검증
 * - enforceFilterPolicy 적용 (복잡한 필터 정책)
 * - 데이터 마스킹 (lib/data/masking.ts)
 * - SheetJS (xlsx) 사용
 */
export const POST = apiHandler(async (request: NextRequest) => {
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
      where: { id: session.user.id },
      include: { organizations: true }
    });

    if (!userProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    // === Step 3: 권한 검증 - Layer 1: can_export_data 플래그 ===
    if (!userProfile.can_export_data) {
      logger.warn('Export:Permission', 'Export permission denied (flag false)', {
        userId: session.user.id,
        role: userProfile.role
      });

      return NextResponse.json(
        { error: 'Export permission denied (insufficient flag)' },
        { status: 403 }
      );
    }

    // === Step 4: 권한 검증 - Layer 2: Role-based 검증 ===
    const exportableRoles = [
      'master',
      'emergency_center_admin',
      'regional_emergency_center_admin',
      'regional_admin',
      'local_admin'
    ];

    if (!exportableRoles.includes(userProfile.role)) {
      logger.warn('Export:Permission', 'Export permission denied (invalid role)', {
        userId: session.user.id,
        role: userProfile.role
      });

      return NextResponse.json(
        { error: 'Role cannot export data' },
        { status: 403 }
      );
    }

    // === Step 5: 권한 검증 - Layer 3: maxResultLimit 확인 ===
    const accessScope = resolveAccessScope(userProfile as any);

    if (accessScope.permissions.maxResultLimit <= 0) {
      logger.warn('Export:Permission', 'Export permission denied (no result limit)', {
        userId: session.user.id,
        role: userProfile.role,
        maxResultLimit: accessScope.permissions.maxResultLimit
      });

      return NextResponse.json(
        { error: 'Export not allowed for this role' },
        { status: 403 }
      );
    }

    // === Step 6: Filter 파싱 (Body 또는 Query String) + 유효성 검증 ===
    // POST body에서 필터 읽기 시도, 없으면 쿼리스트링 사용
    let requestedFilters: any;
    let filterSource: 'body' | 'query' = 'body';

    try {
      const body = await request.json();

      // 유효성 검증 1: 객체 여부 확인 (null, 배열, 문자열 등 제외)
      if (typeof body !== 'object' || body === null || Array.isArray(body)) {
        return NextResponse.json(
          { error: 'Invalid request body: must be a JSON object' },
          { status: 400 }
        );
      }

      // 유효성 검증 2: limit은 non-negative integer
      if (body.limit !== undefined) {
        if (typeof body.limit !== 'number' || !Number.isInteger(body.limit)) {
          return NextResponse.json(
            { error: 'Invalid limit: must be an integer' },
            { status: 400 }
          );
        }
        if (body.limit < 0) {
          return NextResponse.json(
            { error: 'Invalid limit: must be non-negative' },
            { status: 400 }
          );
        }
      }

      // 유효성 검증 3: regionCodes는 배열이며, 각 요소는 문자열
      if (body.regionCodes !== undefined) {
        if (!Array.isArray(body.regionCodes)) {
          return NextResponse.json(
            { error: 'Invalid regionCodes: must be an array' },
            { status: 400 }
          );
        }
        if (!body.regionCodes.every((code: any) => typeof code === 'string')) {
          return NextResponse.json(
            { error: 'Invalid regionCodes: all elements must be strings' },
            { status: 400 }
          );
        }
      }

      // 유효성 검증 4: cityCodes는 배열이며, 각 요소는 문자열
      if (body.cityCodes !== undefined) {
        if (!Array.isArray(body.cityCodes)) {
          return NextResponse.json(
            { error: 'Invalid cityCodes: must be an array' },
            { status: 400 }
          );
        }
        if (!body.cityCodes.every((code: any) => typeof code === 'string')) {
          return NextResponse.json(
            { error: 'Invalid cityCodes: all elements must be strings' },
            { status: 400 }
          );
        }
      }

      // 유효성 검증 5: mode는 'address' 또는 'jurisdiction'
      if (body.mode !== undefined) {
        if (typeof body.mode !== 'string' || !['address', 'jurisdiction'].includes(body.mode)) {
          return NextResponse.json(
            { error: 'Invalid mode: must be "address" or "jurisdiction"' },
            { status: 400 }
          );
        }
      }

      requestedFilters = body;
      filterSource = 'body';

      logger.debug('Export:Request', 'Filters from POST body', {
        source: 'body',
        regionCodes: requestedFilters.regionCodes,
        cityCodes: requestedFilters.cityCodes,
        limit: requestedFilters.limit
      });
    } catch (error) {
      // JSON body 파싱 실패 시 쿼리스트링 사용
      if (error instanceof SyntaxError) {
        // JSON 파싱 오류일 때만 fallback
        requestedFilters = parseQueryParams(request.nextUrl.searchParams);
        filterSource = 'query';

        logger.debug('Export:Request', 'Filters from query string (JSON parse failed)', {
          source: 'query',
          regionCodes: requestedFilters.regionCodes,
          cityCodes: requestedFilters.cityCodes,
          limit: requestedFilters.limit,
          parseError: error.message
        });
      } else {
        // 다른 종류의 오류는 re-throw
        throw error;
      }
    }

    // === Step 7: City_code 정규화 + 검증 ===
    // mapCityCodeToGugun은 매핑 성공 시 한글, 실패 시 null 반환
    // 매핑 실패한 값은 로그만 남기고 제외 (enforceFilterPolicy가 나머지 검증)
    const normalizedCityCodes = (requestedFilters.cityCodes || [])
      .map((code: string) => {
        const mapped = mapCityCodeToGugun(code);

        // 매핑 실패 감지: code는 있지만 mapped가 null
        if (mapped === null && code) {
          logger.warn('Export:CityCodeMapping', 'City code mapping failed - not in CITY_CODE_TO_GUGUN_MAP', {
            originalCode: code,
            source: filterSource,  // ← 'body' 또는 'query'로 출처 추적
            userId: session.user.id,
            note: 'City code removed from filter'
          });
          return null;
        }

        return mapped;
      })
      .filter(Boolean);

    // === Step 8: enforceFilterPolicy 호출 ===
    const filterResult = enforceFilterPolicy({
      userProfile: userProfile as any,
      accessScope,
      requestedFilters: {
        ...requestedFilters,
        cityCodes: normalizedCityCodes.length > 0 ? normalizedCityCodes : undefined
      }
    });

    if (!filterResult.success) {
      const failureResult = filterResult as any;

      logger.warn('Export:FilterPolicy', 'Filter policy enforcement failed', {
        userId: session.user.id,
        reason: failureResult.reason,
        missingFilters: failureResult.missingFilters,
        unauthorizedRegions: failureResult.unauthorizedRegions,
        unauthorizedCities: failureResult.unauthorizedCities
      });

      return NextResponse.json(
        {
          error: failureResult.reason,
          details: {
            missingFilters: failureResult.missingFilters,
            unauthorizedRegions: failureResult.unauthorizedRegions,
            unauthorizedCities: failureResult.unauthorizedCities
          }
        },
        { status: failureResult.status }
      );
    }

    // === Step 9: 데이터 조회 ===
    // maxResultLimit 강제 적용 (lib/auth/access-control.ts:321-409 참고)
    const finalLimit = Math.min(
      requestedFilters.limit || 1000,
      accessScope.permissions.maxResultLimit
    );

    // Build equipment filter from validated filters (v5.3: equipment-centric pattern)
    // buildEquipmentFilter converts validated region/city codes to Prisma WHERE clause
    const filterMode = requestedFilters.mode || 'address';
    const equipmentFilter = buildEquipmentFilter({
      regionCodes: filterResult.filters.regionCodes,
      cityCodes: filterResult.filters.cityCodes,
      userRole: userProfile.role
    }, filterMode);

    // 관할보건소 기반 필터링 (local_admin + jurisdiction mode)
    if (filterMode === 'jurisdiction' && userProfile.role === 'local_admin' && userProfile.organizations?.name) {
      equipmentFilter.jurisdiction_health_center = userProfile.organizations.name;
      logger.info('Export:JurisdictionFilter', 'Applied jurisdiction filter', {
        userId: session.user.id,
        healthCenter: userProfile.organizations.name,
        recordCount: undefined // will be set after query
      });
    }

    // Build WHERE clause for aed_data FK relationship
    const whereClause: any = {};
    if (Object.keys(equipmentFilter).length > 0) {
      whereClause.aed_data = equipmentFilter;
    }

    let inspections = await prisma.inspections.findMany({
      where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
      include: {
        aed_data: true,
        user_profiles: {
          select: {
            full_name: true,
            email: true
          }
        }
      },
      take: finalLimit,
      orderBy: {
        inspection_date: 'desc'
      }
    });

    // === Step 10: 데이터 마스킹 ===
    // lib/data/masking.ts:34-95 참고
    // canViewSensitiveData=false인 경우 마스킹 적용
    inspections = inspections.map(inspection => ({
      ...inspection,
      aed_data: inspection.aed_data
        ? maskSensitiveData([inspection.aed_data], accessScope)[0]
        : null
    }));

    // === Step 11: Excel 생성 (SheetJS - xlsx 사용) ===
    const excelData = inspections.map(inspection => ({
      '점검ID': inspection.id,
      '장비번호': inspection.equipment_serial,
      '설치기관': inspection.aed_data?.installation_institution || '-',
      '설치주소': inspection.aed_data?.installation_address || '-',
      '시도': inspection.aed_data?.sido || '-',
      '시군구': inspection.aed_data?.gugun || '-',
      '모델': inspection.aed_data?.model_name || '-',
      '제조사': inspection.aed_data?.manufacturer || '-',
      '점검일': inspection.inspection_date
        ? new Date(inspection.inspection_date).toISOString().split('T')[0]
        : '-',
      '점검자': inspection.user_profiles?.full_name || '-',
      '점검자이메일': inspection.user_profiles?.email || '-',
      '시각상태': inspection.visual_status || '-',
      '배터리상태': inspection.battery_status || '-',
      '패드상태': inspection.pad_status || '-',
      '작동상태': inspection.operation_status || '-',
      '종합상태': inspection.overall_status || '-',
      '발견사항': inspection.issues_found?.join(', ') || '-',
      '비고': inspection.notes || '-'
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inspections');

    const excelBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array'
    });

    // === Step 12: 감사 로그 기록 ===
    logger.info('Export:Success', 'Inspection data exported successfully', {
      userId: session.user.id,
      email: userProfile.email,
      role: userProfile.role,
      recordCount: inspections.length,
      appliedLimit: finalLimit,
      maxResultLimit: accessScope.permissions.maxResultLimit,
      filters: {
        regionCodes: filterResult.filters.regionCodes,
        cityCodes: filterResult.filters.cityCodes
      },
      timestamp: new Date().toISOString()
    });

    // === Step 13: 응답 전송 ===
    const fileName = `AED_inspection_export_${new Date().toISOString().split('T')[0]}_${Date.now()}.xlsx`;

    return new NextResponse(Buffer.from(excelBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Applied-Limit': finalLimit.toString(),
        'X-Role-Max-Limit': accessScope.permissions.maxResultLimit.toString(),
        'X-Record-Count': inspections.length.toString()
      }
    });
  } catch (error) {
    logger.error('Export:Error', 'Export endpoint error', error instanceof Error ? error : { error });

    return NextResponse.json(
      {
        error: 'Failed to export inspection data',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
});
