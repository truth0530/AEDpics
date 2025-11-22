import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { normalizeGugunForDB } from '@/lib/constants/regions';
// TNMS 통합 버전으로 교체 (하드코딩 제거)
// import { calculateInstitutionMatchConfidence } from '@/lib/utils/string-similarity';
import { calculateInstitutionMatchConfidence } from '@/lib/utils/string-similarity-tnms';
import { getSqlAddressCoalesce } from '@/lib/utils/aed-address-helpers';

// IMPORTANT: 지역명 정규화 시 반드시 docs/REGION_MANAGEMENT_RULES.md 참조
// - 절대 임의로 정규화 규칙을 만들지 말 것
// - lib/constants/regions.ts의 함수만 사용할 것
// DEBUG: Added filtering debug logs on 2025-11-17
/**
 * GET /api/compliance/management-number-candidates
 * 특정 의무설치기관에 대한 관리번호 그룹 후보 조회
 * - 자동 추천 (신뢰도 기반)
 * - 검색 결과
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const targetKey = searchParams.get('target_key');
    const year = '2025'; // Only 2025 data is supported
    const search = searchParams.get('search') || '';
    const includeAllRegion = searchParams.get('include_all_region') === 'true';
    const includeMatched = searchParams.get('include_matched') === 'true';
    const category2Filter = searchParams.get('category_2'); // 카테고리 필터

    // 그루핑모드에서 전달된 추가 파라미터
    const targetName = searchParams.get('target_name');
    const targetSido = searchParams.get('target_sido');
    const targetGugun = searchParams.get('target_gugun');
    const targetAddress = searchParams.get('target_address');

    // 2025년 데이터만 사용
    const targetTableRaw = Prisma.raw('aedpics.target_list_2025');
    const yearInt = 2025;

    // target_key가 있으면 의무설치기관 정보 조회
    let targetInstitution: { sido: string | null; gugun: string | null } | null = null;
    let normalizedSido: string | null = null;
    let normalizedGugun: string | null = null;

    if (targetName && targetSido) {
      // 그루핑 모드: 전달된 정보로 가상의 targetInstitution 생성
      targetInstitution = {
        sido: targetSido,
        gugun: targetGugun
      };

      normalizedSido = targetSido;
      normalizedGugun = targetGugun ? (normalizeGugunForDB(targetGugun) ?? targetGugun) : null;

      console.log('[Grouping Mode API] Virtual target institution:', {
        name: targetName,
        sido: targetSido,
        gugun: targetGugun,
        address: targetAddress
      });
    } else if (targetKey) {
      // 일반 모드: 2025년 의무설치기관 조회
      targetInstitution = await prisma.target_list_2025.findUnique({
        where: { target_key: targetKey },
        select: { sido: true, gugun: true }
      });

      if (!targetInstitution) {
        return NextResponse.json({ error: 'Target institution not found' }, { status: 404 });
      }

      // 2025-11-17: aed_data.sido는 약칭으로 통일 완료 (DB 정합 작업)
      // target_list_2025.sido도 약칭으로 저장되어 있음
      // 예: aed_data.sido = "광주", target_list_2025.sido = "광주"
      // 따라서 정규화 없이 그대로 사용
      normalizedSido = targetInstitution.sido;
      normalizedGugun = targetInstitution.gugun ? (normalizeGugunForDB(targetInstitution.gugun) ?? targetInstitution.gugun) : null;
    }

    // 자동 추천: 의무설치기관 선택 여부에 따라 다른 쿼리 실행
    let autoSuggestionsQuery: Array<{
      management_number: string;
      institution_name: string;
      address: string;
      sido: string;
      gugun: string;
      equipment_count: number;
      equipment_serials: string[];
      equipment_details: Array<{ serial: string; location_detail: string }>;
      confidence: number;
      is_matched: boolean;
      matched_to: string | null;
      matched_institution_name: string | null;
      category_1: string | null;
      category_2: string | null;
    }> = [];

    // TNMS 사전 계산된 매칭 결과를 Map으로 변환 (모든 코드 경로에서 사용 가능하도록)
    const tnmsConfidenceMap = new Map<string, number>();

    if (targetInstitution) {
      // 기관명 결정: 그루핑 모드면 파라미터에서, 일반 모드면 DB에서
      let institutionName = '';

      if (targetName) {
        // 그루핑 모드: 파라미터로 전달된 이름 사용
        institutionName = targetName;
      } else if (targetKey) {
        // 일반 모드: DB에서 조회
        const targetInfo = await prisma.target_list_2025.findUnique({
          where: { target_key: targetKey },
          select: { institution_name: true }
        });
        institutionName = targetInfo?.institution_name || '';
      }

      // TNMS 사전 계산된 매칭 결과 확인 (targetKey가 있는 경우만)
      let tnmsMatching: Array<{
        matched_equipment_serial: string;
        confidence_score: number;
        match_type: string;
      }> = [];

      if (targetKey) {
        tnmsMatching = await prisma.$queryRaw<Array<{
          matched_equipment_serial: string;
          confidence_score: number;
          match_type: string;
        }>>`
          SELECT
            matched_equipment_serial,
            confidence_score,
            match_type
          FROM aedpics.tnms_matching_results
          WHERE target_key = ${targetKey}
        `;
      }

      // 사전 계산된 매칭 결과를 Map에 저장 (빠른 조회를 위해)
      tnmsMatching.forEach(match => {
        // matched_equipment_serial이 있으면 해당 장비의 신뢰도 저장
        if (match.matched_equipment_serial) {
          tnmsConfidenceMap.set(match.matched_equipment_serial, Number(match.confidence_score));
        }
      });

      console.log(`[TNMS] Found ${tnmsMatching.length} pre-calculated matches for ${targetKey}`);

      // 의무설치기관 선택 시: 실시간 유사도 계산
      if (!includeAllRegion && normalizedGugun) {
        // 시도 + 구군 필터
        autoSuggestionsQuery = await prisma.$queryRaw`
          WITH grouped_data AS (
            SELECT DISTINCT ON (ad.management_number)
              ad.management_number,
              ad.installation_institution,
              ${Prisma.raw(getSqlAddressCoalesce('ad', 'address'))},
              ad.sido,
              ad.gugun,
              ad.equipment_serial,
              ad.category_1,
              ad.category_2,
              EXISTS(
                SELECT 1 FROM aedpics.target_list_devices tld
                JOIN aedpics.aed_data ad2 ON tld.equipment_serial = ad2.equipment_serial
                WHERE tld.target_list_year = ${yearInt}
                  AND ad2.management_number = ad.management_number
              ) as is_matched,
              (
                SELECT t.target_key
                FROM aedpics.target_list_devices tld
                JOIN aedpics.aed_data ad2 ON tld.equipment_serial = ad2.equipment_serial
                JOIN ${targetTableRaw} t ON tld.target_institution_id = t.target_key
                WHERE ad2.management_number = ad.management_number
                  AND tld.target_list_year = ${yearInt}
                LIMIT 1
              ) as matched_to,
              (
                SELECT STRING_AGG(DISTINCT t.institution_name, ', ' ORDER BY t.institution_name)
                FROM aedpics.target_list_devices tld
                JOIN aedpics.aed_data ad2 ON tld.equipment_serial = ad2.equipment_serial
                JOIN ${targetTableRaw} t ON tld.target_institution_id = t.target_key
                WHERE ad2.management_number = ad.management_number
                  AND tld.target_list_year = ${yearInt}
              ) as matched_institution_name
            FROM aedpics.aed_data ad
            WHERE ad.management_number IS NOT NULL
              AND ad.sido = ${normalizedSido}
              AND ad.gugun = ${normalizedGugun}
            ORDER BY ad.management_number, ad.updated_at DESC
          )
          SELECT
            gd.management_number,
            gd.installation_institution as institution_name,
            gd.address,
            gd.sido,
            gd.gugun,
            (SELECT COUNT(*) FROM aedpics.aed_data ad WHERE ad.management_number = gd.management_number) as equipment_count,
            (SELECT array_agg(ad2.equipment_serial ORDER BY ad2.equipment_serial)
             FROM aedpics.aed_data ad2
             WHERE ad2.management_number = gd.management_number) as equipment_serials,
            (SELECT json_agg(
               json_build_object(
                 'serial', ad2.equipment_serial,
                 'location_detail', COALESCE(ad2.installation_position, '')
               ) ORDER BY ad2.equipment_serial
             )
             FROM aedpics.aed_data ad2
             WHERE ad2.management_number = gd.management_number) as equipment_details,
            CASE
              WHEN REPLACE(gd.installation_institution, ' ', '') = REPLACE(${institutionName}, ' ', '') THEN 100
              WHEN REPLACE(gd.installation_institution, ' ', '') ILIKE '%' || REPLACE(${institutionName}, ' ', '') || '%' THEN 90
              WHEN REPLACE(${institutionName}, ' ', '') ILIKE '%' || REPLACE(gd.installation_institution, ' ', '') || '%' THEN 85
              ELSE 0  -- TNMS가 계산하도록 0점 부여
            END as confidence,
            gd.is_matched,
            gd.matched_to,
            gd.matched_institution_name,
            gd.category_1,
            gd.category_2
          FROM grouped_data gd
          ORDER BY confidence DESC, equipment_count DESC
          LIMIT 100
        `;
      } else if (!includeAllRegion) {
        // 시도만 필터
        autoSuggestionsQuery = await prisma.$queryRaw`
          WITH grouped_data AS (
            SELECT DISTINCT ON (ad.management_number)
              ad.management_number,
              ad.installation_institution,
              ${Prisma.raw(getSqlAddressCoalesce('ad', 'address'))},
              ad.sido,
              ad.gugun,
              ad.equipment_serial,
              ad.category_1,
              ad.category_2,
              EXISTS(
                SELECT 1 FROM aedpics.target_list_devices tld
                JOIN aedpics.aed_data ad2 ON tld.equipment_serial = ad2.equipment_serial
                WHERE tld.target_list_year = ${yearInt}
                  AND ad2.management_number = ad.management_number
              ) as is_matched,
              (
                SELECT t.target_key
                FROM aedpics.target_list_devices tld
                JOIN aedpics.aed_data ad2 ON tld.equipment_serial = ad2.equipment_serial
                JOIN ${targetTableRaw} t ON tld.target_institution_id = t.target_key
                WHERE ad2.management_number = ad.management_number
                  AND tld.target_list_year = ${yearInt}
                LIMIT 1
              ) as matched_to,
              (
                SELECT STRING_AGG(DISTINCT t.institution_name, ', ' ORDER BY t.institution_name)
                FROM aedpics.target_list_devices tld
                JOIN aedpics.aed_data ad2 ON tld.equipment_serial = ad2.equipment_serial
                JOIN ${targetTableRaw} t ON tld.target_institution_id = t.target_key
                WHERE ad2.management_number = ad.management_number
                  AND tld.target_list_year = ${yearInt}
              ) as matched_institution_name
            FROM aedpics.aed_data ad
            WHERE ad.management_number IS NOT NULL
              AND ad.sido = ${normalizedSido}
            ORDER BY ad.management_number, ad.updated_at DESC
          )
          SELECT
            gd.management_number,
            gd.installation_institution as institution_name,
            gd.address,
            gd.sido,
            gd.gugun,
            (SELECT COUNT(*) FROM aedpics.aed_data ad WHERE ad.management_number = gd.management_number) as equipment_count,
            (SELECT array_agg(ad2.equipment_serial ORDER BY ad2.equipment_serial)
             FROM aedpics.aed_data ad2
             WHERE ad2.management_number = gd.management_number) as equipment_serials,
            (SELECT json_agg(
               json_build_object(
                 'serial', ad2.equipment_serial,
                 'location_detail', COALESCE(ad2.installation_position, '')
               ) ORDER BY ad2.equipment_serial
             )
             FROM aedpics.aed_data ad2
             WHERE ad2.management_number = gd.management_number) as equipment_details,
            CASE
              WHEN REPLACE(gd.installation_institution, ' ', '') = REPLACE(${institutionName}, ' ', '') THEN 100
              WHEN REPLACE(gd.installation_institution, ' ', '') ILIKE '%' || REPLACE(${institutionName}, ' ', '') || '%' THEN 90
              WHEN REPLACE(${institutionName}, ' ', '') ILIKE '%' || REPLACE(gd.installation_institution, ' ', '') || '%' THEN 85
              ELSE 0  -- TNMS가 계산하도록 0점 부여
            END as confidence,
            gd.is_matched,
            gd.matched_to,
            gd.matched_institution_name,
            gd.category_1,
            gd.category_2
          FROM grouped_data gd
          ORDER BY confidence DESC, equipment_count DESC
          LIMIT 100
        `;
      } else {
        // 지역 필터 없음
        autoSuggestionsQuery = await prisma.$queryRaw`
          WITH grouped_data AS (
            SELECT DISTINCT ON (ad.management_number)
              ad.management_number,
              ad.installation_institution,
              ${Prisma.raw(getSqlAddressCoalesce('ad', 'address'))},
              ad.sido,
              ad.gugun,
              ad.equipment_serial,
              EXISTS(
                SELECT 1 FROM aedpics.target_list_devices tld
                JOIN aedpics.aed_data ad2 ON tld.equipment_serial = ad2.equipment_serial
                WHERE tld.target_list_year = ${yearInt}
                  AND ad2.management_number = ad.management_number
              ) as is_matched,
              (
                SELECT t.target_key
                FROM aedpics.target_list_devices tld
                JOIN aedpics.aed_data ad2 ON tld.equipment_serial = ad2.equipment_serial
                JOIN ${targetTableRaw} t ON tld.target_institution_id = t.target_key
                WHERE ad2.management_number = ad.management_number
                  AND tld.target_list_year = ${yearInt}
                LIMIT 1
              ) as matched_to,
              (
                SELECT STRING_AGG(DISTINCT t.institution_name, ', ' ORDER BY t.institution_name)
                FROM aedpics.target_list_devices tld
                JOIN aedpics.aed_data ad2 ON tld.equipment_serial = ad2.equipment_serial
                JOIN ${targetTableRaw} t ON tld.target_institution_id = t.target_key
                WHERE ad2.management_number = ad.management_number
                  AND tld.target_list_year = ${yearInt}
              ) as matched_institution_name
            FROM aedpics.aed_data ad
            WHERE ad.management_number IS NOT NULL
            ORDER BY ad.management_number, ad.updated_at DESC
          )
          SELECT
            gd.management_number,
            gd.installation_institution as institution_name,
            gd.address,
            gd.sido,
            gd.gugun,
            (SELECT COUNT(*) FROM aedpics.aed_data ad WHERE ad.management_number = gd.management_number) as equipment_count,
            (SELECT array_agg(ad2.equipment_serial ORDER BY ad2.equipment_serial)
             FROM aedpics.aed_data ad2
             WHERE ad2.management_number = gd.management_number) as equipment_serials,
            (SELECT json_agg(
               json_build_object(
                 'serial', ad2.equipment_serial,
                 'location_detail', COALESCE(ad2.installation_position, '')
               ) ORDER BY ad2.equipment_serial
             )
             FROM aedpics.aed_data ad2
             WHERE ad2.management_number = gd.management_number) as equipment_details,
            CASE
              WHEN REPLACE(gd.installation_institution, ' ', '') = REPLACE(${institutionName}, ' ', '') THEN 100
              WHEN REPLACE(gd.installation_institution, ' ', '') ILIKE '%' || REPLACE(${institutionName}, ' ', '') || '%' THEN 90
              WHEN REPLACE(${institutionName}, ' ', '') ILIKE '%' || REPLACE(gd.installation_institution, ' ', '') || '%' THEN 85
              ELSE 0  -- TNMS가 계산하도록 0점 부여
            END as confidence,
            gd.is_matched,
            gd.matched_to
          FROM grouped_data gd
          ORDER BY confidence DESC, equipment_count DESC
          LIMIT 100
        `;
      }
    } else {
      // 의무설치기관 미선택 시: 전체 관리번호 리스트 (최신 업데이트 순)
      autoSuggestionsQuery = await prisma.$queryRaw`
        SELECT DISTINCT ON (ad.management_number)
          ad.management_number,
          ad.installation_institution as institution_name,
          ${Prisma.raw(getSqlAddressCoalesce('ad', 'address'))},
          ad.sido,
          ad.gugun,
          COUNT(*) OVER (PARTITION BY ad.management_number) as equipment_count,
          (SELECT array_agg(ad2.equipment_serial ORDER BY ad2.equipment_serial)
           FROM aedpics.aed_data ad2
           WHERE ad2.management_number = ad.management_number) as equipment_serials,
          (SELECT json_agg(
             json_build_object(
               'serial', ad2.equipment_serial,
               'location_detail', COALESCE(ad2.installation_position, '')
             ) ORDER BY ad2.equipment_serial
           )
           FROM aedpics.aed_data ad2
           WHERE ad2.management_number = ad.management_number) as equipment_details,
          0::numeric as confidence,
          EXISTS(
            SELECT 1 FROM aedpics.target_list_devices tld
            JOIN aedpics.aed_data ad2 ON tld.equipment_serial = ad2.equipment_serial
            WHERE tld.target_list_year = ${yearInt}
              AND ad2.management_number = ad.management_number
          ) as is_matched,
          (
            SELECT t.target_key
            FROM aedpics.target_list_devices tld
            JOIN aedpics.aed_data ad2 ON tld.equipment_serial = ad2.equipment_serial
            JOIN ${targetTableRaw} t ON tld.target_institution_id = t.target_key
            WHERE ad2.management_number = ad.management_number
              AND tld.target_list_year = ${yearInt}
            LIMIT 1
          ) as matched_to,
          (
            SELECT t.institution_name
            FROM aedpics.target_list_devices tld
            JOIN aedpics.aed_data ad2 ON tld.equipment_serial = ad2.equipment_serial
            JOIN ${targetTableRaw} t ON tld.target_institution_id = t.target_key
            WHERE ad2.management_number = ad.management_number
              AND tld.target_list_year = ${yearInt}
            LIMIT 1
          ) as matched_institution_name,
          ad.category_1,
          ad.category_2
        FROM aedpics.aed_data ad
        WHERE ad.management_number IS NOT NULL
        ORDER BY ad.management_number, ad.updated_at DESC NULLS LAST
        LIMIT 50
      `;
    }

    // 검색 결과: 사용자 검색어로 management_number 그룹 조회
    let searchResults: Array<{
      management_number: string;
      institution_name: string;
      address: string;
      equipment_count: number;
      equipment_serials: string[];
      equipment_details: Array<{ serial: string; location_detail: string }>;
      confidence: number | null;
      is_matched: boolean;
      matched_to: string | null;
      matched_institution_name: string | null;
      category_1: string | null;
      category_2: string | null;
    }> = [];

    if (search) {
      if (targetInstitution && !includeAllRegion && targetInstitution.gugun) {
        // 시도 + 구군 필터
        searchResults = await prisma.$queryRaw`
          SELECT DISTINCT ON (ad.management_number)
            ad.management_number,
            ad.installation_institution as institution_name,
            ${Prisma.raw(getSqlAddressCoalesce('ad', 'address'))},
            COUNT(*) OVER (PARTITION BY ad.management_number) as equipment_count,
            (SELECT array_agg(ad2.equipment_serial ORDER BY ad2.equipment_serial)
             FROM aedpics.aed_data ad2
             WHERE ad2.management_number = ad.management_number) as equipment_serials,
            (SELECT json_agg(
               json_build_object(
                 'serial', ad2.equipment_serial,
                 'location_detail', COALESCE(ad2.installation_position, '')
               ) ORDER BY ad2.equipment_serial
             )
             FROM aedpics.aed_data ad2
             WHERE ad2.management_number = ad.management_number) as equipment_details,
            NULL::numeric as confidence,
            EXISTS(
              SELECT 1 FROM aedpics.target_list_devices tld
              WHERE tld.target_list_year = ${yearInt}
                AND tld.target_institution_id = ${targetKey}
                AND ad.equipment_serial = ANY(
                  SELECT ad2.equipment_serial
                  FROM aedpics.aed_data ad2
                  WHERE ad2.management_number = ad.management_number
                )
            ) as is_matched,
            (
              SELECT t.target_key
              FROM aedpics.target_list_devices tld
              JOIN aedpics.aed_data ad2 ON tld.equipment_serial = ad2.equipment_serial
              JOIN ${targetTableRaw} t ON tld.target_institution_id = t.target_key
              WHERE ad2.management_number = ad.management_number
                AND tld.target_list_year = ${yearInt}
              LIMIT 1
            ) as matched_to,
            (
              SELECT t.institution_name
              FROM aedpics.target_list_devices tld
              JOIN aedpics.aed_data ad2 ON tld.equipment_serial = ad2.equipment_serial
              JOIN ${targetTableRaw} t ON tld.target_institution_id = t.target_key
              WHERE ad2.management_number = ad.management_number
                AND tld.target_list_year = ${yearInt}
              LIMIT 1
            ) as matched_institution_name,
            ad.category_1,
            ad.category_2
          FROM aedpics.aed_data ad
          WHERE ad.management_number IS NOT NULL
            AND (
              ad.installation_institution ILIKE ${'%' + search + '%'}
              OR ad.installation_location_address ILIKE ${'%' + search + '%'}
              OR ad.installation_address ILIKE ${'%' + search + '%'}
              OR ad.management_number ILIKE ${'%' + search + '%'}
            )
            AND ad.sido = ${normalizedSido}
            AND ad.gugun = ${normalizedGugun}
          ORDER BY ad.management_number
          LIMIT 50
        `;
      } else if (targetInstitution && !includeAllRegion && normalizedSido) {
        // 시도만 필터
        searchResults = await prisma.$queryRaw`
          SELECT DISTINCT ON (ad.management_number)
            ad.management_number,
            ad.installation_institution as institution_name,
            ${Prisma.raw(getSqlAddressCoalesce('ad', 'address'))},
            COUNT(*) OVER (PARTITION BY ad.management_number) as equipment_count,
            (SELECT array_agg(ad2.equipment_serial ORDER BY ad2.equipment_serial)
             FROM aedpics.aed_data ad2
             WHERE ad2.management_number = ad.management_number) as equipment_serials,
            (SELECT json_agg(
               json_build_object(
                 'serial', ad2.equipment_serial,
                 'location_detail', COALESCE(ad2.installation_position, '')
               ) ORDER BY ad2.equipment_serial
             )
             FROM aedpics.aed_data ad2
             WHERE ad2.management_number = ad.management_number) as equipment_details,
            NULL::numeric as confidence,
            EXISTS(
              SELECT 1 FROM aedpics.target_list_devices tld
              WHERE tld.target_list_year = ${yearInt}
                AND tld.target_institution_id = ${targetKey}
                AND ad.equipment_serial = ANY(
                  SELECT ad2.equipment_serial
                  FROM aedpics.aed_data ad2
                  WHERE ad2.management_number = ad.management_number
                )
            ) as is_matched,
            (
              SELECT t.target_key
              FROM aedpics.target_list_devices tld
              JOIN aedpics.aed_data ad2 ON tld.equipment_serial = ad2.equipment_serial
              JOIN ${targetTableRaw} t ON tld.target_institution_id = t.target_key
              WHERE ad2.management_number = ad.management_number
                AND tld.target_list_year = ${yearInt}
              LIMIT 1
            ) as matched_to,
            (
              SELECT t.institution_name
              FROM aedpics.target_list_devices tld
              JOIN aedpics.aed_data ad2 ON tld.equipment_serial = ad2.equipment_serial
              JOIN ${targetTableRaw} t ON tld.target_institution_id = t.target_key
              WHERE ad2.management_number = ad.management_number
                AND tld.target_list_year = ${yearInt}
              LIMIT 1
            ) as matched_institution_name,
            ad.category_1,
            ad.category_2
          FROM aedpics.aed_data ad
          WHERE ad.management_number IS NOT NULL
            AND (
              ad.installation_institution ILIKE ${'%' + search + '%'}
              OR ad.installation_location_address ILIKE ${'%' + search + '%'}
              OR ad.installation_address ILIKE ${'%' + search + '%'}
              OR ad.management_number ILIKE ${'%' + search + '%'}
            )
            AND ad.sido = ${normalizedSido}
          ORDER BY ad.management_number
          LIMIT 50
        `;
      } else {
        // 지역 필터 없음
        searchResults = await prisma.$queryRaw`
          SELECT DISTINCT ON (ad.management_number)
            ad.management_number,
            ad.installation_institution as institution_name,
            ${Prisma.raw(getSqlAddressCoalesce('ad', 'address'))},
            COUNT(*) OVER (PARTITION BY ad.management_number) as equipment_count,
            (SELECT array_agg(ad2.equipment_serial ORDER BY ad2.equipment_serial)
             FROM aedpics.aed_data ad2
             WHERE ad2.management_number = ad.management_number) as equipment_serials,
            (SELECT json_agg(
               json_build_object(
                 'serial', ad2.equipment_serial,
                 'location_detail', COALESCE(ad2.installation_position, '')
               ) ORDER BY ad2.equipment_serial
             )
             FROM aedpics.aed_data ad2
             WHERE ad2.management_number = ad.management_number) as equipment_details,
            NULL::numeric as confidence,
            EXISTS(
              SELECT 1 FROM aedpics.target_list_devices tld
              WHERE tld.target_list_year = ${yearInt}
                AND tld.target_institution_id = ${targetKey}
                AND ad.equipment_serial = ANY(
                  SELECT ad2.equipment_serial
                  FROM aedpics.aed_data ad2
                  WHERE ad2.management_number = ad.management_number
                )
            ) as is_matched,
            (
              SELECT t.target_key
              FROM aedpics.target_list_devices tld
              JOIN aedpics.aed_data ad2 ON tld.equipment_serial = ad2.equipment_serial
              JOIN ${targetTableRaw} t ON tld.target_institution_id = t.target_key
              WHERE ad2.management_number = ad.management_number
                AND tld.target_list_year = ${yearInt}
              LIMIT 1
            ) as matched_to,
            (
              SELECT t.institution_name
              FROM aedpics.target_list_devices tld
              JOIN aedpics.aed_data ad2 ON tld.equipment_serial = ad2.equipment_serial
              JOIN ${targetTableRaw} t ON tld.target_institution_id = t.target_key
              WHERE ad2.management_number = ad.management_number
                AND tld.target_list_year = ${yearInt}
              LIMIT 1
            ) as matched_institution_name,
            ad.category_1,
            ad.category_2
          FROM aedpics.aed_data ad
          WHERE ad.management_number IS NOT NULL
            AND (
              ad.installation_institution ILIKE ${'%' + search + '%'}
              OR ad.installation_location_address ILIKE ${'%' + search + '%'}
              OR ad.installation_address ILIKE ${'%' + search + '%'}
              OR ad.management_number ILIKE ${'%' + search + '%'}
            )
          ORDER BY ad.management_number
          LIMIT 50
        `;
      }
    }

    // TEMPORARY: 퍼지 매칭으로 신뢰도 재계산 (자동 추천 결과만)
    // TNMS 도입 시 이 로직은 제거되고 standard_code 기반 매칭으로 대체됨
    let improvedAutoSuggestions = autoSuggestionsQuery;
    if (targetInstitution && !search) {
      let targetNameForMatch = '';
      let targetAddressForMatch = '';
      let targetSidoForMatch = '';
      let targetGugunForMatch = '';

      if (targetKey) {
        // 일반 모드: DB에서 정보 조회
        const targetInfo = await prisma.target_list_2025.findUnique({
          where: { target_key: targetKey },
          select: { institution_name: true, sido: true, gugun: true, division: true, sub_division: true }
        });

        targetNameForMatch = targetInfo?.institution_name || '';
        targetAddressForMatch = [targetInfo?.sido, targetInfo?.gugun, targetInfo?.division]
          .filter(Boolean)
          .join(' ');
        targetSidoForMatch = targetInfo?.sido || '';
        targetGugunForMatch = targetInfo?.gugun || '';
      } else if (targetName) {
        // 그루핑 모드: 파라미터로 전달된 정보 사용
        targetNameForMatch = targetName;
        targetAddressForMatch = targetAddress || [targetSido, targetGugun].filter(Boolean).join(' ');
        targetSidoForMatch = targetSido || '';
        targetGugunForMatch = targetGugun || '';
      }

      // 각 후보의 신뢰도를 계산 - TNMS 사전 계산 결과 우선, 없으면 실시간 계산
      const enhancedCandidates = await Promise.all(autoSuggestionsQuery.map(async item => {
        // 1. TNMS 사전 계산된 매칭 결과 확인 (29,295개 데이터)
        // 관리번호 그룹의 첫 번째 장비연번으로 조회
        const firstSerial = item.equipment_serials?.[0];
        let tnmsPreCalculatedScore: number | null = null;

        if (firstSerial && tnmsConfidenceMap.has(firstSerial)) {
          tnmsPreCalculatedScore = tnmsConfidenceMap.get(firstSerial)!;
          console.log(`[TNMS] Using pre-calculated score for ${item.management_number}: ${tnmsPreCalculatedScore}%`);
        }

        // 사전 계산된 점수가 있으면 바로 사용
        if (tnmsPreCalculatedScore !== null) {
          return {
            ...item,
            confidence: tnmsPreCalculatedScore
          };
        }

        // 2. 사전 계산 결과가 없으면 실시간 TNMS 정규화 계산
        const matchResult = await calculateInstitutionMatchConfidence(
          targetNameForMatch,          // target이 먼저
          item.institution_name,
          targetAddressForMatch,       // 의무설치기관 주소
          item.address                 // AED 설치 주소
        );
        const fuzzyConfidence = matchResult.confidence;

        // TNMS 점수를 항상 사용 (0점인 경우 TNMS가 계산)
        // SQL에서 이미 높은 점수(90, 85, 100)를 받은 경우 유지
        if (fuzzyConfidence !== null) {
          const sqlConfidence = Number(item.confidence || 0);
          // SQL에서 0점을 받았거나, TNMS 점수가 더 나은 경우 TNMS 사용
          if (sqlConfidence === 0 || fuzzyConfidence > sqlConfidence) {
            return {
              ...item,
              confidence: fuzzyConfidence
            };
          }
        }

        return item;
      }));

      improvedAutoSuggestions = enhancedCandidates.sort((a, b) => {
        // 재정렬: 신뢰도 높은 순, 같으면 장비 수 많은 순
        const confDiff = Number(b.confidence || 0) - Number(a.confidence || 0);
        return confDiff !== 0 ? confDiff : Number(b.equipment_count) - Number(a.equipment_count);
      });
    }

    // 디버그: 필터링 전 데이터 확인
    console.log('[DEBUG] Auto suggestions before filtering:', {
      total: improvedAutoSuggestions.length,
      matched: improvedAutoSuggestions.filter(item => item.is_matched).length,
      unmatched: improvedAutoSuggestions.filter(item => !item.is_matched).length,
      includeMatched,
      sample: improvedAutoSuggestions.slice(0, 3).map(item => ({
        management_number: item.management_number,
        institution_name: item.institution_name,
        is_matched: item.is_matched,
        confidence: item.confidence
      }))
    });

    // 2025-11-19: includeMatched 파라미터 무시
    // 이유: 프론트엔드에서 showAlreadyMatched 상태로 UI 접기/펼치기를 제어하므로
    // API는 항상 모든 데이터를 반환하고, 프론트엔드가 표시 여부를 결정
    const filteredAutoSuggestions = improvedAutoSuggestions;
    const filteredSearchResults = searchResults;

    console.log('[DEBUG] After filtering (no filtering applied):', {
      auto_suggestions: filteredAutoSuggestions.length,
      search_results: filteredSearchResults.length,
      matched_items: filteredAutoSuggestions.filter(item => item.is_matched).length
    });

    // category_2 필터 적용 (구비의무기관 내에서)
    let finalAutoSuggestions = filteredAutoSuggestions;
    let finalSearchResults = filteredSearchResults;

    if (category2Filter) {
      finalAutoSuggestions = filteredAutoSuggestions.filter(item =>
        item.category_1 === '구비의무기관' && item.category_2 === category2Filter
      );
      finalSearchResults = filteredSearchResults.filter(item =>
        item.category_1 === '구비의무기관' && item.category_2 === category2Filter
      );
    }

    return NextResponse.json({
      auto_suggestions: finalAutoSuggestions.map(item => ({
        ...item,
        equipment_count: Number(item.equipment_count),
        confidence: item.confidence ? Number(item.confidence) : null,
      })),
      search_results: finalSearchResults.map(item => ({
        ...item,
        equipment_count: Number(item.equipment_count),
        confidence: item.confidence ? Number(item.confidence) : null,
      })),
    });

  } catch (error) {
    console.error('Failed to fetch management number candidates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch candidates', details: String(error) },
      { status: 500 }
    );
  }
}
