import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { resolveAccessScope, canAccessAEDData } from '@/lib/auth/access-control';
import { logger } from '@/lib/logger';

import { parseQueryParams, type ParsedFilters } from '@/lib/utils/query-parser';
import { maskSensitiveData } from '@/lib/data/masking';
import { logDataAccess, logAccessRejection } from '@/lib/audit/access-logger';
import { enforceFilterPolicy, type FilterEnforcementFailure } from '@/lib/aed/filter-policy';
import { reportSlowOperation } from '@/lib/monitoring/performance';
import { apiHandler } from '@/lib/api/error-handler';
import type { ExpiryFilter } from '@/lib/constants/aed-filters';
import { mapCityCodesToNames } from '@/lib/constants/cities';
import { REGION_LABEL_TO_CODE, REGION_LONG_LABELS, REGION_CODE_TO_LABEL } from '@/lib/constants/regions';
import type { UserProfile } from '@/packages/types';
import type { AEDDevice } from '@/packages/types/aed';
import type {
  DateFilterResult,
  OrganizationsWhereInput,
  AedDataWhereInput,
  RawQueryParams
} from '@/lib/types/api-filters';
import { mapUserProfile } from '@/lib/mappers/user-profile-mapper';

import { prisma } from '@/lib/prisma';
type DecodedCursor = { id: number; updated_at?: string };

// 날짜에 일수 추가 헬퍼 함수
function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

// Date 객체에 일수 추가 헬퍼 함수
function addDaysToDate(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// 날짜 필터를 Prisma where 조건으로 변환
function buildDateFilter(filterValue: string): DateFilterResult | undefined {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  switch (filterValue) {
    case 'expired':
      return { lt: today };
    case 'in30':
      return { gte: today, lte: addDaysToDate(today, 30) };
    case 'in60':
      return { gte: today, lte: addDaysToDate(today, 60) };
    case 'in90':
      return { gte: today, lte: addDaysToDate(today, 90) };
    case 'in180':
      return { gte: today, lte: addDaysToDate(today, 180) };
    case 'in365':
      return { gte: today, lte: addDaysToDate(today, 365) };
    default:
      return undefined;
  }
}

// 점검일 필터를 Prisma where 조건으로 변환
function buildInspectionDateFilter(filterValue: string): DateFilterResult | undefined {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  switch (filterValue) {
    case 'never':
      return { equals: null };
    case 'over365':
      return { lt: addDaysToDate(today, -365) };
    case 'over180':
      return { lt: addDaysToDate(today, -180) };
    case 'over90':
      return { lt: addDaysToDate(today, -90) };
    case 'over60':
      return { lt: addDaysToDate(today, -60) };
    case 'over30':
      return { lt: addDaysToDate(today, -30) };
    default:
      return undefined;
  }
}

// 날짜 필터를 Raw SQL 조건으로 변환 (jurisdiction 쿼리용)
function buildRawDateCondition(fieldName: string, filterValue: string, today: string): string | null {
  switch (filterValue) {
    case 'expired':
      return `${fieldName} < '${today}'`;
    case 'in30':
      return `${fieldName} BETWEEN '${today}' AND '${addDays(today, 30)}'`;
    case 'in60':
      return `${fieldName} BETWEEN '${today}' AND '${addDays(today, 60)}'`;
    case 'in90':
      return `${fieldName} BETWEEN '${today}' AND '${addDays(today, 90)}'`;
    case 'in180':
      return `${fieldName} BETWEEN '${today}' AND '${addDays(today, 180)}'`;
    case 'in365':
      return `${fieldName} BETWEEN '${today}' AND '${addDays(today, 365)}'`;
    default:
      return null;
  }
}

// 점검일 필터를 Raw SQL 조건으로 변환 (jurisdiction 쿼리용)
function buildRawInspectionDateCondition(fieldName: string, filterValue: string, today: string): string | null {
  switch (filterValue) {
    case 'never':
      return `${fieldName} IS NULL`;
    case 'over365':
      return `${fieldName} < '${addDays(today, -365)}'`;
    case 'over180':
      return `${fieldName} < '${addDays(today, -180)}'`;
    case 'over90':
      return `${fieldName} < '${addDays(today, -90)}'`;
    case 'over60':
      return `${fieldName} < '${addDays(today, -60)}'`;
    case 'over30':
      return `${fieldName} < '${addDays(today, -30)}'`;
    default:
      return null;
  }
}

function decodeCursor(cursor: string): DecodedCursor | null {
  try {
    const normalized = cursor.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '==='.slice((normalized.length + 3) % 4);
    const json = Buffer.from(padded, 'base64').toString('utf-8');
    const parsed = JSON.parse(json);

    // ✅ ID가 문자열인 경우도 처리
    const id = typeof parsed.id === 'number' ? parsed.id : parseInt(parsed.id, 10);

    if (parsed && !isNaN(id)) {
      if (parsed.updated_at && typeof parsed.updated_at === 'string') {
        return { id, updated_at: parsed.updated_at };
      }
      return { id };
    }
  } catch (error) {
    logger.warn('AEDDataAPI:decodeCursor', 'Failed to decode cursor', {
      error: error instanceof Error ? error.message : String(error),
      cursorPreview: cursor?.substring(0, 50)
    });
  }
  return null;
}

function encodeCursor(id: number, updated_at?: string | null): string {
  const payload: DecodedCursor = { id };
  if (updated_at) {
    payload.updated_at = updated_at;
  }

  const json = JSON.stringify(payload);
  return Buffer.from(json, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export const GET = async (request: NextRequest) => {
  try {
    logger.info('AEDDataAPI:GET', 'AED data API called', { url: request.url });

    // NextAuth 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

  // 사용자 프로필 및 organization 정보 한 번에 조회 (N+1 최적화)
  const prismaUserProfile = await prisma.user_profiles.findUnique({
    where: { id: session.user.id },
    include: {
      organizations: {
        select: {
          id: true,
          name: true,
          type: true,
          region_code: true,
          latitude: true,
          longitude: true,
          city_code: true,
          parent_id: true,
          address: true,
          contact: true,
          created_at: true,
          updated_at: true,
        }
      }
    }
  });

  if (!prismaUserProfile) {
    logger.error('AEDDataAPI:GET', 'Profile not found', { userId: session.user.id });
    return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
  }

  // Prisma 타입을 UserProfile로 변환 (타입 안전성 확보)
  const userProfile = mapUserProfile(prismaUserProfile);
  const organization = prismaUserProfile.organizations || null;

    // AED 데이터 접근 권한 확인
    if (!canAccessAEDData(userProfile)) {
      return NextResponse.json({
        error: 'AED data access not permitted for this role'
      }, { status: 403 });
    }

    // 접근 범위 계산 (에러 처리 포함)
    let accessScope;
    try {
      accessScope = resolveAccessScope(userProfile);
    } catch (error) {
      return NextResponse.json({
        error: `Access scope error: ${(error as Error).message}`
      }, { status: 403 });
    }

    // 개선된 쿼리 파라미터 파싱
    logger.info('AEDDataAPI:GET', 'Parsing search params', {
      searchParams: Object.fromEntries(request.nextUrl.searchParams)
    });
    const filters: ParsedFilters = parseQueryParams(request.nextUrl.searchParams);

    // ✅ includeSchedule 파라미터 체크 (일정추가 정보 포함 여부)
    const includeSchedule = request.nextUrl.searchParams.get('includeSchedule') === 'true';

    // inspection 모드 체크
    const viewMode = request.nextUrl.searchParams.get('viewMode');
    const isInspectionMode = viewMode === 'inspection';

    logger.info('AEDDataAPI:GET', 'Request parameters parsed', {
      filters,
      externalDisplay: filters.external_display,
      viewMode,
      isInspectionMode,
      userRole: userProfile.role,
      accessScope
    });

    // management_number 또는 equipment_serial로 조회하는 경우 지역 필터 불필요
    // local_admin/regional_admin의 경우 enforceFilterPolicy에서 자동으로 기본 지역 적용하므로 여기서는 체크하지 않음
    // if (!filters.management_number && !filters.equipment_serial && !filters.regionCodes && !accessScope.permissions.canViewAllRegions) {
    //   return NextResponse.json({
    //     error: '지역 필터를 지정해야 합니다. (관할 시도/시군구를 선택해주세요.)'
    //   }, { status: 400 });
    // }

    const enforcementResult = enforceFilterPolicy({
      userProfile,
      accessScope,
      requestedFilters: filters,
    });

    logger.info('AEDDataAPI:GET', 'Filter policy enforcement result', { enforcementResult });

    if (!enforcementResult.success) {
      // Explicitly narrow type to FilterEnforcementFailure
      const failure = enforcementResult as FilterEnforcementFailure;

      await logAccessRejection({
        userId: session.user.id,
        userRole: userProfile.role,
        requestedFilters: filters,
        reason: failure.reason,
        missingFilters: failure.missingFilters as string[] | undefined,
        unauthorizedRegions: failure.unauthorizedRegions,
        unauthorizedCities: failure.unauthorizedCities,
      });

      return NextResponse.json({
        error: failure.reason,
        missingFilters: failure.missingFilters,
        unauthorizedRegions: failure.unauthorizedRegions,
        unauthorizedCities: failure.unauthorizedCities,
      }, { status: failure.status });
    }

    // Type guard: enforcementResult is FilterEnforcementSuccess

    const {
      filters: enforcedFilters,
      metadata: enforcementMetadata,
    } = enforcementResult;

    const finalRegionCodes = enforcedFilters.regionCodes;
    const finalCityCodes = enforcedFilters.cityCodes;

    // 지역 코드를 DB에 저장된 한글 라벨로 변환 (짧은 형태 + 긴 형태 모두 포함)
    const { mapRegionCodesToDbLabels } = await import('@/lib/constants/regions');
    const regionFiltersForQuery = mapRegionCodesToDbLabels(finalRegionCodes);
    const cityFiltersForQuery = mapCityCodesToNames(finalCityCodes);

    // 커서 기반 페이지네이션 - 기본값을 30으로 설정 (클라이언트와 일치)
    const requestedLimit = filters.limit ?? 30;
    const maxLimit = Math.min(accessScope.permissions.maxResultLimit, 10000); // 최대값을 10000으로 증가
    const pageSize = Math.min(Math.max(1, requestedLimit), maxLimit);
    const queryLimit = pageSize + 1;

    const cursorParam = filters.cursor ?? request.nextUrl.searchParams.get('cursor');
    const decodedCursor = cursorParam ? decodeCursor(cursorParam) : null;
    const cursorId = decodedCursor?.id ?? null;

    // ✅ 커서 디버깅 로그
    logger.info('AEDDataAPI:GET', 'Cursor debug info', {
      cursorParam: cursorParam ? cursorParam.substring(0, 50) + '...' : 'none',
      decodedCursor,
      cursorId,
      cursorIdType: typeof cursorId
    });

    // 페이지 번호는 UI 표시용으로만 사용
    const page = filters.page || 1;

    // management_number 또는 equipment_serial로 직접 조회하는 경우
    if (filters.management_number || filters.equipment_serial) {
      try {
        const device = await prisma.aed_data.findFirst({
          where: filters.equipment_serial
            ? { equipment_serial: filters.equipment_serial }
            : { management_number: filters.management_number }
        });

        if (!device) {
          return NextResponse.json({
            data: [],
            pagination: { page: 1, limit: 1, hasMore: false, nextCursor: null, total: 0, currentPage: 1, totalPages: 0, from: 0, to: 0 },
            summary: { totalCount: 0, expiredCount: 0, expiringSoonCount: 0, hiddenCount: 0, withSensitiveDataCount: 0 },
            filters: { applied: {}, enforced: {}, available: {} }
          });
        }

        const { mapAedData } = await import('@/lib/utils/aed-data-mapper');
        const mappedDevice = mapAedData(device);

        return NextResponse.json({
          data: [mappedDevice],
          pagination: { page: 1, limit: 1, hasMore: false, nextCursor: null, total: 1, currentPage: 1, totalPages: 1, from: 1, to: 1 },
          summary: { totalCount: 1, expiredCount: 0, expiringSoonCount: 0, hiddenCount: 0, withSensitiveDataCount: 0 },
          filters: { applied: { management_number: filters.management_number, equipment_serial: filters.equipment_serial }, enforced: {}, available: {} }
        });
      } catch (deviceError) {
        logger.error('AEDDataAPI:GET', 'Single device query error', deviceError instanceof Error ? deviceError : { deviceError });
        return NextResponse.json({ error: `Query failed: ${deviceError instanceof Error ? deviceError.message : 'Unknown error'}` }, { status: 500 });
      }
    }

    // 직접 테이블 쿼리로 변경 (RPC 함수의 SQL 에러 회피)
    // ✅ Cursor 기반 페이지네이션: offset 제거, limit만 사용
    // (cursorId가 있을 때 .gt()로 필터링하므로 offset 불필요)

    logger.info('AEDDataAPI:GET', 'Direct query params', {
      regionCodes: regionFiltersForQuery,
      cityCodes: cityFiltersForQuery,
      category_1: filters.category_1
    });

    const queryStartedAt = Date.now();

    // inspection 모드일 때는 일정추가된 데이터만 조회
    let rawData;
    let queryError;

    if (isInspectionMode) {
      logger.info('AEDDataAPI:GET', 'Inspection mode: Using Prisma two-step query');

      try {
        // Build SQL WHERE clauses dynamically
        const sqlConditions: string[] = [];
        const sqlParams: RawQueryParams = [];
        let paramIndex = 1;

        // Assignment status filter (required for inspection mode)
        sqlConditions.push(`ia.status IN ('pending', 'in_progress', 'completed', 'unavailable')`);

        // 지역 필터
        if (regionFiltersForQuery && regionFiltersForQuery.length > 0) {
          sqlConditions.push(`a.sido = ANY($${paramIndex}::text[])`);
          sqlParams.push(regionFiltersForQuery);
          paramIndex++;
        }
        if (cityFiltersForQuery && cityFiltersForQuery.length > 0) {
          sqlConditions.push(`a.gugun = ANY($${paramIndex}::text[])`);
          sqlParams.push(cityFiltersForQuery);
          paramIndex++;
        }

        // 카테고리 필터
        if (filters.category_1 && filters.category_1.length > 0) {
          sqlConditions.push(`a.category_1 = ANY($${paramIndex}::text[])`);
          sqlParams.push(filters.category_1);
          paramIndex++;
        }
        if (filters.category_2 && filters.category_2.length > 0) {
          sqlConditions.push(`a.category_2 = ANY($${paramIndex}::text[])`);
          sqlParams.push(filters.category_2);
          paramIndex++;
        }
        if (filters.category_3 && filters.category_3.length > 0) {
          sqlConditions.push(`a.category_3 = ANY($${paramIndex}::text[])`);
          sqlParams.push(filters.category_3);
          paramIndex++;
        }

        // 외부표출 필터
        if (filters.external_display) {
          if (filters.external_display === 'blocked') {
            sqlConditions.push(`a.external_display = 'N'`);
            sqlConditions.push(`a.external_non_display_reason IS NOT NULL AND a.external_non_display_reason != '' AND a.external_non_display_reason != '구비의무기관(119구급차, 여객, 항공기, 객차(철도), 선박'`);
          } else {
            sqlConditions.push(`a.external_display = $${paramIndex}`);
            sqlParams.push(filters.external_display.toUpperCase());
            paramIndex++;
          }
        }

        // 상태 필터
        if (filters.status && filters.status.length > 0) {
          sqlConditions.push(`a.operation_status = ANY($${paramIndex}::text[])`);
          sqlParams.push(filters.status);
          paramIndex++;
        }

        // 배터리 만료일 필터
        if (filters.battery_expiry_date) {
          const dateFilter = buildDateFilter(filters.battery_expiry_date);
          if (dateFilter?.gte) {
            sqlConditions.push(`a.battery_expiry_date >= $${paramIndex}`);
            sqlParams.push(dateFilter.gte);
            paramIndex++;
          }
          if (dateFilter?.lte) {
            sqlConditions.push(`a.battery_expiry_date <= $${paramIndex}`);
            sqlParams.push(dateFilter.lte);
            paramIndex++;
          }
        }

        // 패드 만료일 필터
        if (filters.patch_expiry_date) {
          const dateFilter = buildDateFilter(filters.patch_expiry_date);
          if (dateFilter?.gte) {
            sqlConditions.push(`a.patch_expiry_date >= $${paramIndex}`);
            sqlParams.push(dateFilter.gte);
            paramIndex++;
          }
          if (dateFilter?.lte) {
            sqlConditions.push(`a.patch_expiry_date <= $${paramIndex}`);
            sqlParams.push(dateFilter.lte);
            paramIndex++;
          }
        }

        // 교체예정일 필터
        if (filters.replacement_date) {
          const dateFilter = buildDateFilter(filters.replacement_date);
          if (dateFilter?.gte) {
            sqlConditions.push(`a.replacement_date >= $${paramIndex}`);
            sqlParams.push(dateFilter.gte);
            paramIndex++;
          }
          if (dateFilter?.lte) {
            sqlConditions.push(`a.replacement_date <= $${paramIndex}`);
            sqlParams.push(dateFilter.lte);
            paramIndex++;
          }
        }

        // 점검일 필터
        if (filters.last_inspection_date) {
          const inspectionFilter = buildInspectionDateFilter(filters.last_inspection_date);
          if (inspectionFilter?.equals === null) {
            sqlConditions.push(`a.last_inspection_date IS NULL`);
          } else if (inspectionFilter) {
            if (inspectionFilter.gte) {
              sqlConditions.push(`a.last_inspection_date >= $${paramIndex}`);
              sqlParams.push(inspectionFilter.gte);
              paramIndex++;
            }
            if (inspectionFilter.lte) {
              sqlConditions.push(`a.last_inspection_date <= $${paramIndex}`);
              sqlParams.push(inspectionFilter.lte);
              paramIndex++;
            }
            if (inspectionFilter.lt) {
              sqlConditions.push(`a.last_inspection_date < $${paramIndex}`);
              sqlParams.push(inspectionFilter.lt);
              paramIndex++;
            }
          }
        }

        // 검색 필터 (OR 조건)
        if (filters.search) {
          sqlConditions.push(`(
            a.management_number ILIKE $${paramIndex} OR
            a.equipment_serial ILIKE $${paramIndex} OR
            a.installation_institution ILIKE $${paramIndex} OR
            a.installation_address ILIKE $${paramIndex}
          )`);
          sqlParams.push(`%${filters.search}%`);
          paramIndex++;
        }

        // Cursor 페이지네이션
        if (cursorId) {
          sqlConditions.push(`a.id > $${paramIndex}`);
          sqlParams.push(cursorId);
          paramIndex++;
        }

        // Build final SQL query with LEFT JOIN
        const whereClause = sqlConditions.length > 0 ? `WHERE ${sqlConditions.join(' AND ')}` : '';

        const query = `
          SELECT
            a.id, a.equipment_serial, a.management_number, a.model_name, a.manufacturer,
            a.manufacturing_country, a.manufacturing_date, a.serial_number, a.installation_date,
            a.first_installation_date, a.installation_institution, a.installation_address,
            a.installation_position, a.installation_method, a.jurisdiction_health_center,
            a.manager, a.institution_contact, a.establisher, a.purchase_institution,
            a.sido, a.gugun, a.longitude, a.latitude, a.operation_status, a.display_allowed,
            a.external_display, a.external_non_display_reason, a.government_support,
            a.battery_expiry_date, a.patch_available, a.patch_expiry_date, a.last_inspection_date,
            a.last_use_date, a.replacement_date, a.category_1, a.category_2, a.category_3,
            a.registration_date, a.remarks, a.created_at, a.updated_at, a.report_date,
            a.installation_location_address, a.saeum_deletion_status, a.data_status,
            a.first_seen_date, a.last_seen_date, a.consecutive_missing_days,
            a.deletion_suspected_date, a.sync_batch_id,
            ia.status as inspection_status,
            ia.scheduled_date,
            ia.assigned_to,
            ia.assigned_by
          FROM aedpics.aed_data a
          INNER JOIN aedpics.inspection_assignments ia ON a.equipment_serial = ia.equipment_serial
          ${whereClause}
          ORDER BY a.id ASC
          LIMIT ${queryLimit}
        `;

        logger.info('AEDDataAPI:GET', 'Inspection mode: Executing optimized JOIN query', {
          paramCount: sqlParams.length
        });

        // Execute optimized query
        rawData = await prisma.$queryRawUnsafe(query, ...sqlParams);
        queryError = null;

        logger.info('AEDDataAPI:GET', 'Inspection mode: Successfully fetched AED records', {
          count: rawData.length
        });
      } catch (error) {
        logger.error('AEDDataAPI:GET', 'Inspection mode: Query error', error instanceof Error ? error : { error });
        queryError = error;
        rawData = [];
      }
    } else {
      // 기존 로직: 직접 aed_data 테이블 쿼리

      // queryCriteria='jurisdiction' 지원
      if (filters.queryCriteria === 'jurisdiction') {
        try {
          logger.info('AEDDataAPI:GET', 'Using jurisdiction-based query with Prisma');

          // Step 1: 관할보건소 조회 (region/city code 기준)
          const whereOrgs: OrganizationsWhereInput = {
            type: 'health_center'
          };

          if (regionFiltersForQuery && regionFiltersForQuery.length > 0) {
            whereOrgs.region_code = { in: regionFiltersForQuery };
          }
          if (cityFiltersForQuery && cityFiltersForQuery.length > 0) {
            whereOrgs.city_code = { in: cityFiltersForQuery };
          }

          const healthCenters = await prisma.organizations.findMany({
            where: whereOrgs,
            select: { name: true }
          });

          if (healthCenters.length === 0) {
            rawData = [];
            queryError = null;
            logger.info('AEDDataAPI:GET', 'No health centers found for jurisdiction query');
          } else {
            // Step 2: 공백 정규화된 이름 목록 생성
            const normalizedNames = healthCenters.map(hc => hc.name.replace(/ /g, ''));

            // Step 3: AED 데이터 조회 (jurisdiction_health_center 매칭)
            // Prisma는 정규화된 문자열 비교를 직접 지원하지 않으므로 $queryRaw 사용
            const today = new Date().toISOString().split('T')[0];

            // WHERE 조건 빌드
            const whereClauses: string[] = [
              "REPLACE(jurisdiction_health_center, ' ', '') IN (" +
                normalizedNames.map((_, i) => `$${i + 1}`).join(',') + ")"
            ];
            let paramIndex = normalizedNames.length + 1;

            // 카테고리 필터
            if (filters.category_1 && filters.category_1.length > 0) {
              whereClauses.push(`category_1 = ANY($${paramIndex})`);
              paramIndex++;
            }
            if (filters.category_2 && filters.category_2.length > 0) {
              whereClauses.push(`category_2 = ANY($${paramIndex})`);
              paramIndex++;
            }
            if (filters.category_3 && filters.category_3.length > 0) {
              whereClauses.push(`category_3 = ANY($${paramIndex})`);
              paramIndex++;
            }

            // 상태 필터
            if (filters.status && filters.status.length > 0) {
              whereClauses.push(`operation_status = ANY($${paramIndex})`);
              paramIndex++;
            }

            // 배터리 만료일 필터
            if (filters.battery_expiry_date) {
              const condition = buildRawDateCondition('battery_expiry_date', filters.battery_expiry_date, today);
              if (condition) whereClauses.push(condition);
            }

            // 패드 만료일 필터
            if (filters.patch_expiry_date) {
              const condition = buildRawDateCondition('patch_expiry_date', filters.patch_expiry_date, today);
              if (condition) whereClauses.push(condition);
            }

            // 교체예정일 필터
            if (filters.replacement_date) {
              const condition = buildRawDateCondition('replacement_date', filters.replacement_date, today);
              if (condition) whereClauses.push(condition);
            }

            // 점검일 필터
            if (filters.last_inspection_date) {
              const condition = buildRawInspectionDateCondition('last_inspection_date', filters.last_inspection_date, today);
              if (condition) whereClauses.push(condition);
            }

            // 외부표출 필터
            if (filters.external_display) {
              if (filters.external_display === 'blocked') {
                whereClauses.push("external_display = 'N' AND external_non_display_reason IS NOT NULL AND external_non_display_reason NOT LIKE '%구비의무기관%'");
              } else {
                whereClauses.push(`external_display = '${filters.external_display.toUpperCase()}'`);
              }
            }

            // Cursor 페이지네이션
            if (cursorId) {
              whereClauses.push(`id > ${cursorId}`);
            }

            const whereClause = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

            const params: RawQueryParams = [...normalizedNames];
            if (filters.category_1 && filters.category_1.length > 0) params.push(filters.category_1);
            if (filters.category_2 && filters.category_2.length > 0) params.push(filters.category_2);
            if (filters.category_3 && filters.category_3.length > 0) params.push(filters.category_3);
            if (filters.status && filters.status.length > 0) params.push(filters.status);

            const sql = `
              SELECT
                id, equipment_serial, management_number, model_name, manufacturer,
                manufacturing_country, manufacturing_date, serial_number, installation_date,
                first_installation_date, installation_institution, installation_address,
                installation_position, installation_method, jurisdiction_health_center,
                manager, institution_contact, establisher, purchase_institution,
                sido, gugun, longitude, latitude, operation_status, display_allowed,
                external_display, external_non_display_reason, government_support,
                battery_expiry_date, patch_available, patch_expiry_date, last_inspection_date,
                last_use_date, replacement_date, category_1, category_2, category_3,
                registration_date, remarks, created_at, updated_at, report_date,
                installation_location_address, saeum_deletion_status, data_status,
                first_seen_date, last_seen_date, consecutive_missing_days,
                deletion_suspected_date, sync_batch_id
              FROM aed_data
              ${whereClause}
              ORDER BY id ASC
              LIMIT ${queryLimit}
            `;

            logger.info('AEDDataAPI:GET', 'Jurisdiction SQL query', { sql, params });

            rawData = await prisma.$queryRawUnsafe(sql, ...params);
            queryError = null;

            logger.info('AEDDataAPI:GET', 'Jurisdiction query completed', {
              deviceCount: rawData?.length || 0
            });
          }
        } catch (error) {
          logger.error('AEDDataAPI:GET', 'Jurisdiction query error', error instanceof Error ? error : { error });
          queryError = error;
          rawData = [];
        }
      } else {
        // 주소 기준 쿼리 (Prisma)
        try {
          const whereConditions: AedDataWhereInput = {};

          // 지역 필터
          if (regionFiltersForQuery && regionFiltersForQuery.length > 0) {
            whereConditions.sido = { in: regionFiltersForQuery };
          }
          if (cityFiltersForQuery && cityFiltersForQuery.length > 0) {
            whereConditions.gugun = { in: cityFiltersForQuery };
          }

          // 카테고리 필터
          if (filters.category_1 && filters.category_1.length > 0) {
            whereConditions.category_1 = { in: filters.category_1 };
          }
          if (filters.category_2 && filters.category_2.length > 0) {
            whereConditions.category_2 = { in: filters.category_2 };
          }
          if (filters.category_3 && filters.category_3.length > 0) {
            whereConditions.category_3 = { in: filters.category_3 };
          }

          // 외부표출 필터
          if (filters.external_display) {
            logger.info('AEDDataAPI:GET', 'Applying external_display filter', {
              externalDisplay: filters.external_display
            });
            if (filters.external_display === 'blocked') {
              whereConditions.external_display = 'N';
              whereConditions.AND = [
                { external_non_display_reason: { not: null } },
                { external_non_display_reason: { not: '' } },
                { external_non_display_reason: { not: '구비의무기관(119구급차, 여객, 항공기, 객차(철도), 선박' } }
              ];
            } else {
              whereConditions.external_display = filters.external_display.toUpperCase();
            }
          }

          // 상태 필터
          if (filters.status && filters.status.length > 0) {
            whereConditions.operation_status = { in: filters.status };
          }

          // 검색 필터 (OR 조건)
          if (filters.search) {
            whereConditions.OR = [
              { management_number: { contains: filters.search, mode: 'insensitive' } },
              { equipment_serial: { contains: filters.search, mode: 'insensitive' } },
              { installation_institution: { contains: filters.search, mode: 'insensitive' } },
              { installation_address: { contains: filters.search, mode: 'insensitive' } }
            ];
          }

          // 배터리 만료일 필터
          if (filters.battery_expiry_date) {
            const dateFilter = buildDateFilter(filters.battery_expiry_date);
            if (dateFilter) {
              whereConditions.battery_expiry_date = dateFilter;
            }
          }

          // 패드 만료일 필터
          if (filters.patch_expiry_date) {
            const dateFilter = buildDateFilter(filters.patch_expiry_date);
            if (dateFilter) {
              whereConditions.patch_expiry_date = dateFilter;
            }
          }

          // 교체예정일 필터
          if (filters.replacement_date) {
            const dateFilter = buildDateFilter(filters.replacement_date);
            if (dateFilter) {
              whereConditions.replacement_date = dateFilter;
            }
          }

          // 점검일 필터
          if (filters.last_inspection_date) {
            const inspectionFilter = buildInspectionDateFilter(filters.last_inspection_date);
            if (inspectionFilter) {
              whereConditions.last_inspection_date = inspectionFilter;
            }
          }

          // Cursor 페이지네이션
          if (cursorId) {
            whereConditions.id = { gt: cursorId };
          }

          // 쿼리 실행
          rawData = await prisma.aed_data.findMany({
            where: whereConditions,
            orderBy: { id: 'asc' },
            take: queryLimit
          });
          queryError = null;
        } catch (error) {
          logger.error('AEDDataAPI:GET', 'Address query error', error instanceof Error ? error : { error });
          rawData = [];
          queryError = error;
        }
      }
    }

    const queryDurationMs = Date.now() - queryStartedAt;

    logger.info('AEDDataAPI:GET', 'Direct query result', {
      method: 'table_query',
      resultCount: rawData?.length || 0,
      error: queryError instanceof Error ? queryError.message : queryError,
      hasData: !!rawData,
      durationMs: queryDurationMs
    });

    reportSlowOperation({
      name: 'aed-data/query',
      durationMs: queryDurationMs,
      metadata: {
        userId: session.user.id,
        role: userProfile.role,
        filters: {
          ...filters,
          enforcedRegionCodes: finalRegionCodes,
          enforcedCityCodes: finalCityCodes,
        },
      },
    });

    if (queryError) {
      logger.error('AEDDataAPI:GET', 'AED data query error', queryError instanceof Error ? queryError : { queryError });
      return NextResponse.json({
        error: `Query failed: ${queryError instanceof Error ? queryError.message : 'Unknown error'}`
      }, { status: 500 });
    }

    // 매핑 함수 import
    const { mapAedData } = await import('@/lib/utils/aed-data-mapper');

    // 디버그: 첫 번째 raw 데이터 확인
    if (rawData && rawData.length > 0) {
      logger.info('AEDDataAPI:GET', 'Sample raw data (first item)', {
        last_inspection_date: rawData[0].last_inspection_date,
        lastInspectionDate: rawData[0].lastInspectionDate,
        installation_institution: rawData[0].installation_institution
      });
    }

    // 보건소/응급의료센터 좌표 가져오기 (거리 계산용)
    const healthCenterCoords = organization?.latitude && organization?.longitude
      ? {
          lat: Number(organization.latitude),
          lng: Number(organization.longitude)
        }
      : null;

    const mappedData = (rawData || []).map(device => {
      const mapped = mapAedData(device);

      // 거리 계산 (보건소/응급의료센터 기준)
      const mappedWithDistance: ReturnType<typeof mapAedData> & { distance_km?: number } = {
        ...mapped
      };

      if (healthCenterCoords && device.latitude && device.longitude &&
          device.latitude !== 0 && device.longitude !== 0) {
        mappedWithDistance.distance_km = calculateDistance(
          healthCenterCoords.lat,
          healthCenterCoords.lng,
          device.latitude,
          device.longitude
        );
      }

      return mappedWithDistance;
    });

    // 디버그: 첫 번째 매핑된 데이터 확인
    if (mappedData && mappedData.length > 0) {
      logger.info('AEDDataAPI:GET', 'Sample mapped data (first item)', {
        last_inspection_date: mappedData[0].last_inspection_date,
        installation_institution: mappedData[0].installation_institution
      });
    }

    // hasMore 확인 및 데이터 정리
    // queryLimit = pageSize + 1로 요청했으므로 초과분 확인
    const hasMore = mappedData.length > pageSize;
    const trimmedData = hasMore ? mappedData.slice(0, pageSize) : mappedData;

    const filteredData = trimmedData;

    // ⚠️ 배터리/패드/교체일 필터는 DB에서 처리됨 (메모리 필터링 제거)
    // ✅ last_inspection_date 필터도 DB에서 처리됨 (RPC 함수 업데이트 완료 - 2025-10-18)

    // external_display 필터는 이제 DB 쿼리에서 처리되므로 여기서는 제거
    // (메모리 필터링 불필요)

    // 분류와 검색 필터는 이제 RPC에서 처리됨
    // 클라이언트 측 필터링 제거

    const maskedData = maskSensitiveData(filteredData, accessScope);

    // 다음 커서 생성
    let nextCursor: string | null = null;
    if (hasMore && trimmedData.length > 0) {
      const lastItem = trimmedData[trimmedData.length - 1];
      if (lastItem.id) {
        // id를 기준으로 커서 생성 (updated_at은 선택적)
        nextCursor = encodeCursor(lastItem.id, lastItem.updated_at);
      }
    }

    // 전체 통계 계산 (Prisma - 상세 버전)
    const summaryStartedAt = Date.now();

    // Date 객체로 직접 사용 (Prisma DateTime 필드와 호환)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in30Days = addDaysToDate(today, 30);

    // 통계용 base where 조건 (메인 쿼리와 동일한 필터 사용)
    const summaryWhere: AedDataWhereInput = {};

    let summary: {
      totalCount: number;
      expiredCount: number;
      expiringSoonCount: number;
      hiddenCount: number;
      withSensitiveDataCount: number;
    };

    // 지역 필터 (jurisdiction vs address 모드)
    if (filters.queryCriteria === 'jurisdiction') {
      // jurisdiction 모드: organizations 기준
      // TODO: 복잡한 로직이므로 현재는 filteredData 기반 사용
      summary = {
        totalCount: filteredData.length,
        expiredCount: filteredData.filter(d =>
          (d.battery_expiry_date && d.battery_expiry_date < today) ||
          (d.patch_expiry_date && d.patch_expiry_date < today)
        ).length,
        expiringSoonCount: filteredData.filter(d =>
          (d.battery_expiry_date && d.battery_expiry_date >= today && d.battery_expiry_date <= in30Days) ||
          (d.patch_expiry_date && d.patch_expiry_date >= today && d.patch_expiry_date <= in30Days)
        ).length,
        hiddenCount: 0,  // is_public_visible 필드가 없으면 0
        withSensitiveDataCount: filteredData.filter(d => d.institution_contact).length
      };

      // jurisdiction 모드는 여기서 summary 계산 완료
    } else {
      // 주소 기준 쿼리
      if (regionFiltersForQuery && regionFiltersForQuery.length > 0) {
        summaryWhere.sido = { in: regionFiltersForQuery };
      }
      if (cityFiltersForQuery && cityFiltersForQuery.length > 0) {
        summaryWhere.gugun = { in: cityFiltersForQuery };
      }

      // 카테고리 필터
      if (filters.category_1 && filters.category_1.length > 0) {
        summaryWhere.category_1 = { in: filters.category_1 };
      }
      if (filters.category_2 && filters.category_2.length > 0) {
        summaryWhere.category_2 = { in: filters.category_2 };
      }
      if (filters.category_3 && filters.category_3.length > 0) {
        summaryWhere.category_3 = { in: filters.category_3 };
      }

      // 상태 필터
      if (filters.status && filters.status.length > 0) {
        summaryWhere.operation_status = { in: filters.status };
      }

      // 외부표출 필터
      if (filters.external_display) {
        if (filters.external_display === 'blocked') {
          summaryWhere.external_display = 'N';
          summaryWhere.external_non_display_reason = {
            not: { in: [null, '', '구비의무기관(119구급차, 여객, 항공기, 객차(철도), 선박'] }
          };
        } else {
          summaryWhere.external_display = filters.external_display.toUpperCase();
        }
      }

      // 병렬 count 쿼리 실행
      const [
        totalCount,
        expiredCount,
        expiringSoonCount,
        withSensitiveDataCount
      ] = await Promise.all([
        // 전체 개수
        prisma.aed_data.count({ where: summaryWhere }),

        // 만료된 개수 (배터리 또는 패드)
        prisma.aed_data.count({
          where: {
            ...summaryWhere,
            OR: [
              {
                battery_expiry_date: { lt: today }
              },
              {
                patch_expiry_date: { lt: today }
              }
            ]
          }
        }),

        // 곧 만료될 개수 (30일 이내)
        prisma.aed_data.count({
          where: {
            ...summaryWhere,
            OR: [
              {
                battery_expiry_date: { gte: today, lte: in30Days }
              },
              {
                patch_expiry_date: { gte: today, lte: in30Days }
              }
            ]
          }
        }),

        // 민감 데이터 있는 개수
        prisma.aed_data.count({
          where: {
            ...summaryWhere,
            institution_contact: { not: null }
          }
        })
      ]);

      summary = {
        totalCount,
        expiredCount,
        expiringSoonCount,
        hiddenCount: 0,  // is_public_visible 필드 없음
        withSensitiveDataCount
      };
    }

    // Summary 계산 시간 로깅
    const summaryDurationMs = Date.now() - summaryStartedAt;
    reportSlowOperation({
      name: 'aed-data/summary',
      durationMs: summaryDurationMs,
      metadata: {
        userId: session.user.id,
        role: userProfile.role,
      },
    });

    const totalCount = summary.totalCount;
    const currentPage = page;
    const totalPages = pageSize > 0
      ? Math.max(1, Math.ceil(totalCount / pageSize))
      : 1;
    const pageItemCount = maskedData.length;
    const pageStart = (currentPage - 1) * pageSize;
    const from = totalCount === 0 || pageItemCount === 0 ? 0 : pageStart + 1;
    const to = totalCount === 0 || pageItemCount === 0 ? 0 : pageStart + pageItemCount;

    // includeSchedule이 true이면 일정추가된 장비 조회
    let scheduledEquipment: string[] | undefined = undefined;
    if (includeSchedule) {
      const assignments = await prisma.inspection_assignments.findMany({
        where: {
          assigned_to: session.user.id,
          status: { in: ['pending', 'in_progress'] }
        },
        select: {
          equipment_serial: true
        }
      });

      scheduledEquipment = assignments.map(a => a.equipment_serial);
      logger.info('AEDDataAPI:GET', 'includeSchedule: Found scheduled equipment', {
        count: scheduledEquipment.length
      });
    }

    // 접근 로깅 (민감 정보 제외)
    await logDataAccess({
      userId: session.user.id,
      userRole: userProfile.role,
      action: 'query',
      filterSummary: {
        battery_expiry_date: filters.battery_expiry_date,
        patch_expiry_date: filters.patch_expiry_date,
        replacement_date: filters.replacement_date,
        last_inspection_date: filters.last_inspection_date,
        external_display: filters.external_display,
        statusCount: filters.status?.length || 0,
        regionCount: finalRegionCodes?.length || 0,
        cityCount: finalCityCodes?.length || 0,
        category1Count: filters.category_1?.length || 0,
        category2Count: filters.category_2?.length || 0,
        category3Count: filters.category_3?.length || 0,
        search: filters.search,
        queryCriteria: filters.queryCriteria,
        enforcedDefaults: enforcementMetadata.appliedDefaults,
        durationMs: queryDurationMs,
        summaryDurationMs
      },
      resultCount: maskedData.length,
      timestamp: new Date()
    });

    return NextResponse.json({
      data: maskedData,
      pagination: {
        page,
        limit: pageSize,
        hasMore,
        nextCursor,
        total: totalCount,
        currentPage,
        totalPages,
        from,
        to,
      },
      summary,
      // ✅ includeSchedule이 true일 때만 scheduled 배열 포함
      ...(includeSchedule && { scheduled: scheduledEquipment }),
      filters: {
        applied: {
          battery_expiry_date: filters.battery_expiry_date,
          patch_expiry_date: filters.patch_expiry_date,
          replacement_date: filters.replacement_date,
          last_inspection_date: filters.last_inspection_date,
          status: filters.status,
          regions: finalRegionCodes,
          cities: finalCityCodes,
          category_1: filters.category_1,
          category_2: filters.category_2,
          category_3: filters.category_3,
          external_display: filters.external_display,
          search: filters.search,
          queryCriteria: filters.queryCriteria
        },
        enforced: {
          appliedDefaults: enforcementMetadata.appliedDefaults,
        },
        available: {
          canViewAllRegions: accessScope.permissions.canViewAllRegions,
          allowedRegions: accessScope.allowedRegionCodes,
          allowedCities: accessScope.allowedCityCodes,
          maxLimit: accessScope.permissions.maxResultLimit,
          canExportData: accessScope.permissions.canExportData,
          canViewSensitiveData: accessScope.permissions.canViewSensitiveData,
          requiredFilters: enforcementMetadata.requiredFilters,
          requireOneOf: enforcementMetadata.requireOneOf
        }
      }
    });
  } catch (error) {
    logger.error('AEDDataAPI:GET', 'Unexpected error in AED API', {
      error: error instanceof Error ? error : { error },
      stack: error instanceof Error ? error.stack : 'No stack trace',
      url: request.url
    });

    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
};

function matchesExpiryFilter(filter: ExpiryFilter, days: number | null | undefined) {
  if (filter === 'no_expiry') {
    return days === null || days === undefined;
  }

  if (filter === 'all_with_expiry') {
    return days !== null && days !== undefined;
  }

  if (days === null || days === undefined) {
    return false;
  }

  // 이미 만료됨 (음수)
  if (filter === 'expired') {
    return days < 0;
  }

  // 30일 이내 만료 예정
  if (filter === 'in30') {
    return days >= 0 && days <= 30;
  }

  // 60일 이내 만료 예정
  if (filter === 'in60') {
    return days >= 0 && days <= 60;
  }

  // 90일 이내 만료 예정
  if (filter === 'in90') {
    return days >= 0 && days <= 90;
  }

  // 180일 이내 만료 예정
  if (filter === 'in180') {
    return days >= 0 && days <= 180;
  }

  // 365일 이내 만료 예정
  if (filter === 'in365') {
    return days >= 0 && days <= 365;
  }

  return true;
}

function matchesInspectionFilter(filter: ExpiryFilter, daysSince: number | null | undefined) {
  // 점검미실시: 점검 이력 자체가 없는 경우 (null 또는 undefined)
  if (filter === 'never') {
    return daysSince === null || daysSince === undefined;
  }

  // 점검 이력이 없는데 다른 필터를 적용하면 제외
  if (daysSince === null || daysSince === undefined) {
    return false;
  }

  // 1개월 미점검: 최근 30일 이내 점검 없음 (30일 초과)
  if (filter === 'over30') {
    return daysSince > 30;
  }

  // 2개월 미점검: 최근 60일 이내 점검 없음 (60일 초과)
  if (filter === 'over60') {
    return daysSince > 60;
  }

  // 3개월 미점검: 최근 90일 이내 점검 없음 (90일 초과)
  if (filter === 'over90') {
    return daysSince > 90;
  }

  // 6개월 미점검: 최근 180일 이내 점검 없음 (180일 초과)
  if (filter === 'over180') {
    return daysSince > 180;
  }

  // 1년이상 미점검: 최근 365일 이내 점검 없음 (365일 초과)
  if (filter === 'over365') {
    return daysSince > 365;
  }

  // 기존 필터 호환성 유지
  if (filter === 'no_expiry') {
    return daysSince === null || daysSince === undefined;
  }

  if (filter === 'all_with_expiry') {
    return daysSince !== null && daysSince !== undefined;
  }

  if (filter === 'expired') {
    return daysSince > 90;
  }

  if (filter === 'in30') {
    return daysSince >= 0 && daysSince <= 30;
  }

  if (filter === 'in60') {
    return daysSince > 30 && daysSince <= 60;
  }

  if (filter === 'in90') {
    return daysSince > 60 && daysSince <= 90;
  }

  return true;
}

// Haversine 공식으로 두 좌표 간 거리 계산 (km)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // 지구 반지름 (km)
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}
