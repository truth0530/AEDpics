import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { apiHandler } from '@/lib/api/error-handler';
import { logger } from '@/lib/logger';
import { parseQueryParams } from '@/lib/utils/query-parser';
import { resolveAccessScope } from '@/lib/auth/access-control';
import { enforceFilterPolicy } from '@/lib/aed/filter-policy';
import { mapCityCodeToGugun } from '@/lib/constants/regions';
import { maskSensitiveData } from '@/lib/data/masking';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

/**
 * POST /api/inspections/export
 * 점검 이력 데이터 Excel 다운로드
 *
 * v5.0 구현 사항:
 * - Layer 1: can_export_data 플래그 검증
 * - Layer 2: Role-based 권한 검증
 * - Layer 3: maxResultLimit 강제 (lib/auth/access-control.ts 참고)
 * - City_code → gugun 매핑 with 검증
 * - enforceFilterPolicy 적용
 * - 데이터 마스킹 (lib/data/masking.ts 참고)
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

    // === Step 6: Filter 파싱 (Body 또는 Query String) ===
    // POST body에서 필터 읽기 시도, 없으면 쿼리스트링 사용
    let requestedFilters;
    try {
      const body = await request.json();
      requestedFilters = body;

      logger.debug('Export:Request', 'Filters from POST body', {
        regionCodes: requestedFilters.regionCodes,
        cityCodes: requestedFilters.cityCodes,
        limit: requestedFilters.limit
      });
    } catch {
      // JSON body 파싱 실패 시 쿼리스트링 사용
      requestedFilters = parseQueryParams(request.nextUrl.searchParams);

      logger.debug('Export:Request', 'Filters from query string', {
        regionCodes: requestedFilters.regionCodes,
        cityCodes: requestedFilters.cityCodes,
        limit: requestedFilters.limit
      });
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

    // Build WHERE clause from filters
    const whereClause: any = {
      AND: []
    };

    // Region filter (sido)
    if (filterResult.filters.regionCodes && filterResult.filters.regionCodes.length > 0) {
      whereClause.AND.push({
        aed_data: {
          sido: {
            in: filterResult.filters.regionCodes
          }
        }
      });
    }

    // City filter (gugun)
    if (filterResult.filters.cityCodes && filterResult.filters.cityCodes.length > 0) {
      whereClause.AND.push({
        aed_data: {
          gugun: {
            in: filterResult.filters.cityCodes
          }
        }
      });
    }

    let inspections = await prisma.inspections.findMany({
      where: whereClause.AND.length > 0 ? whereClause : undefined,
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
