import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { normalizeGugunForDB } from '@/lib/constants/regions';
import { calculateInstitutionMatchConfidence } from '@/lib/utils/string-similarity';
import { getSqlAddressCoalesce } from '@/lib/utils/aed-address-helpers';

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
    const year = searchParams.get('year') || '2025';
    const search = searchParams.get('search') || '';
    const includeAllRegion = searchParams.get('include_all_region') === 'true';
    const includeMatched = searchParams.get('include_matched') === 'true';

    // year 값 검증 (SQL injection 방지)
    if (year !== '2024' && year !== '2025') {
      return NextResponse.json({ error: 'Invalid year parameter' }, { status: 400 });
    }

    // 동적 테이블명 (SQL 쿼리용)
    const targetTable = year === '2025' ? 'target_list_2025' : 'target_list_2024';
    const targetTableRaw = Prisma.raw(`aedpics.${targetTable}`);

    // target_key가 있으면 의무설치기관 정보 조회
    let targetInstitution: { sido: string | null; gugun: string | null } | null = null;
    let normalizedSido: string | null = null;
    let normalizedGugun: string | null = null;

    if (targetKey) {
      // 동적 테이블 선택 (2024 or 2025)
      targetInstitution = year === '2025'
        ? await prisma.target_list_2025.findUnique({
            where: { target_key: targetKey },
            select: { sido: true, gugun: true }
          })
        : await prisma.target_list_2024.findUnique({
            where: { target_key: targetKey },
            select: { sido: true, gugun: true }
          });

      if (!targetInstitution) {
        return NextResponse.json({ error: 'Target institution not found' }, { status: 404 });
      }

      // 2025-11-14: DB가 이제 정식 지역명을 사용하므로 정규화 제거
      // 예: aed_data.sido = "광주광역시" (이전: "광주")
      // normalizeRegionName()은 정식→축약명 변환이므로 사용 금지
      normalizedSido = targetInstitution.sido;
      normalizedGugun = targetInstitution.gugun ? (normalizeGugunForDB(targetInstitution.gugun) ?? targetInstitution.gugun) : null;
    }

    // 자동 추천: 의무설치기관 선택 여부에 따라 다른 쿼리 실행
    let autoSuggestionsQuery: Array<{
      management_number: string;
      institution_name: string;
      address: string;
      sido: string;
      equipment_count: number;
      equipment_serials: string[];
      equipment_details: Array<{ serial: string; location_detail: string }>;
      confidence: number;
      is_matched: boolean;
      matched_to: string | null;
      category_1: string | null;
      category_2: string | null;
    }> = [];

    if (targetInstitution) {
      // 선택된 의무설치기관 정보 조회 (동적 테이블 선택)
      const targetInfo = year === '2025'
        ? await prisma.target_list_2025.findUnique({
            where: { target_key: targetKey! },
            select: { institution_name: true }
          })
        : await prisma.target_list_2024.findUnique({
            where: { target_key: targetKey! },
            select: { institution_name: true }
          });
      const targetName = targetInfo?.institution_name || '';

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
              ad.equipment_serial,
              ad.category_1,
              ad.category_2,
              EXISTS(
                SELECT 1 FROM aedpics.target_list_devices tld
                WHERE tld.target_list_year = ${parseInt(year)}
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
                  AND tld.target_list_year = ${parseInt(year)}
                LIMIT 1
              ) as matched_to
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
              WHEN REPLACE(gd.installation_institution, ' ', '') = REPLACE(${targetName}, ' ', '') THEN 100
              WHEN REPLACE(gd.installation_institution, ' ', '') ILIKE '%' || REPLACE(${targetName}, ' ', '') || '%' THEN 90
              WHEN REPLACE(${targetName}, ' ', '') ILIKE '%' || REPLACE(gd.installation_institution, ' ', '') || '%' THEN 85
              ELSE 60
            END as confidence,
            gd.is_matched,
            gd.matched_to,
            gd.category_1,
            gd.category_2
          FROM grouped_data gd
          ORDER BY confidence DESC, equipment_count DESC
          LIMIT 20
        `;
      } else if (!includeAllRegion) {
        // 시도만 필터
        autoSuggestionsQuery = await prisma.$queryRaw`
          WITH grouped_data AS (
            SELECT DISTINCT ON (ad.management_number)
              ad.management_number,
              ad.installation_institution,
              COALESCE(ad.installation_location_address, ad.installation_address) as address,
              ad.sido,
              ad.equipment_serial,
              EXISTS(
                SELECT 1 FROM aedpics.target_list_devices tld
                WHERE tld.target_list_year = ${parseInt(year)}
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
                  AND tld.target_list_year = ${parseInt(year)}
                LIMIT 1
              ) as matched_to
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
              WHEN REPLACE(gd.installation_institution, ' ', '') = REPLACE(${targetName}, ' ', '') THEN 100
              WHEN REPLACE(gd.installation_institution, ' ', '') ILIKE '%' || REPLACE(${targetName}, ' ', '') || '%' THEN 90
              WHEN REPLACE(${targetName}, ' ', '') ILIKE '%' || REPLACE(gd.installation_institution, ' ', '') || '%' THEN 85
              ELSE 60
            END as confidence,
            gd.is_matched,
            gd.matched_to
          FROM grouped_data gd
          WHERE (
            REPLACE(gd.installation_institution, ' ', '') = REPLACE(${targetName}, ' ', '')
            OR REPLACE(gd.installation_institution, ' ', '') ILIKE '%' || REPLACE(${targetName}, ' ', '') || '%'
            OR REPLACE(${targetName}, ' ', '') ILIKE '%' || REPLACE(gd.installation_institution, ' ', '') || '%'
          )
          ORDER BY confidence DESC, equipment_count DESC
          LIMIT 20
        `;
      } else {
        // 지역 필터 없음
        autoSuggestionsQuery = await prisma.$queryRaw`
          WITH grouped_data AS (
            SELECT DISTINCT ON (ad.management_number)
              ad.management_number,
              ad.installation_institution,
              COALESCE(ad.installation_location_address, ad.installation_address) as address,
              ad.sido,
              ad.equipment_serial,
              EXISTS(
                SELECT 1 FROM aedpics.target_list_devices tld
                WHERE tld.target_list_year = ${parseInt(year)}
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
                  AND tld.target_list_year = ${parseInt(year)}
                LIMIT 1
              ) as matched_to
            FROM aedpics.aed_data ad
            WHERE ad.management_number IS NOT NULL
            ORDER BY ad.management_number, ad.updated_at DESC
          )
          SELECT
            gd.management_number,
            gd.installation_institution as institution_name,
            gd.address,
            gd.sido,
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
              WHEN REPLACE(gd.installation_institution, ' ', '') = REPLACE(${targetName}, ' ', '') THEN 100
              WHEN REPLACE(gd.installation_institution, ' ', '') ILIKE '%' || REPLACE(${targetName}, ' ', '') || '%' THEN 90
              WHEN REPLACE(${targetName}, ' ', '') ILIKE '%' || REPLACE(gd.installation_institution, ' ', '') || '%' THEN 85
              ELSE 60
            END as confidence,
            gd.is_matched,
            gd.matched_to
          FROM grouped_data gd
          WHERE (
            REPLACE(gd.installation_institution, ' ', '') = REPLACE(${targetName}, ' ', '')
            OR REPLACE(gd.installation_institution, ' ', '') ILIKE '%' || REPLACE(${targetName}, ' ', '') || '%'
            OR REPLACE(${targetName}, ' ', '') ILIKE '%' || REPLACE(gd.installation_institution, ' ', '') || '%'
          )
          ORDER BY confidence DESC, equipment_count DESC
          LIMIT 20
        `;
      }
    } else {
      // 의무설치기관 미선택 시: 전체 관리번호 리스트 (최신 업데이트 순)
      autoSuggestionsQuery = await prisma.$queryRaw`
        SELECT DISTINCT ON (ad.management_number)
          ad.management_number,
          ad.installation_institution as institution_name,
          COALESCE(ad.installation_location_address, ad.installation_address) as address,
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
            WHERE tld.target_list_year = ${parseInt(year)}
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
            JOIN aedpics.target_list_2024 t ON tld.target_institution_id = t.target_key
            WHERE ad2.management_number = ad.management_number
              AND tld.target_list_year = ${parseInt(year)}
            LIMIT 1
          ) as matched_to,
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
            COALESCE(ad.installation_location_address, ad.installation_address) as address,
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
              WHERE tld.target_list_year = ${parseInt(year)}
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
              JOIN aedpics.target_list_2024 t ON tld.target_institution_id = t.target_key
              WHERE ad2.management_number = ad.management_number
                AND tld.target_list_year = ${parseInt(year)}
              LIMIT 1
            ) as matched_to,
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
            COALESCE(ad.installation_location_address, ad.installation_address) as address,
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
              WHERE tld.target_list_year = ${parseInt(year)}
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
              JOIN aedpics.target_list_2024 t ON tld.target_institution_id = t.target_key
              WHERE ad2.management_number = ad.management_number
                AND tld.target_list_year = ${parseInt(year)}
              LIMIT 1
            ) as matched_to,
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
            COALESCE(ad.installation_location_address, ad.installation_address) as address,
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
              WHERE tld.target_list_year = ${parseInt(year)}
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
              JOIN aedpics.target_list_2024 t ON tld.target_institution_id = t.target_key
              WHERE ad2.management_number = ad.management_number
                AND tld.target_list_year = ${parseInt(year)}
              LIMIT 1
            ) as matched_to,
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
      const targetInfo = year === '2025'
        ? await prisma.target_list_2025.findUnique({
            where: { target_key: targetKey! },
            select: { institution_name: true, sido: true, gugun: true, division: true, sub_division: true }
          })
        : await prisma.target_list_2024.findUnique({
            where: { target_key: targetKey! },
            select: { institution_name: true, sido: true, gugun: true, division: true, sub_division: true }
          });

      const targetName = targetInfo?.institution_name || '';
      // 의무설치기관의 위치 정보 (address 필드 없으므로 sido + gugun + division으로 구성)
      const targetAddress = [targetInfo?.sido, targetInfo?.gugun, targetInfo?.division]
        .filter(Boolean)
        .join(' ');
      const targetSido = targetInfo?.sido || '';

      // 각 후보의 신뢰도를 퍼지 매칭으로 재계산 (주소 + 지역 정보 포함)
      improvedAutoSuggestions = autoSuggestionsQuery.map(item => {
        const fuzzyConfidence = calculateInstitutionMatchConfidence(
          item.institution_name,
          targetName,
          item.address,        // AED 설치 주소
          targetAddress,       // 의무설치기관 주소
          item.sido,           // AED 시도
          targetSido           // 의무설치기관 시도
        );

        // 퍼지 매칭이 더 나은 점수를 제공하면 사용
        if (fuzzyConfidence !== null && fuzzyConfidence > Number(item.confidence || 0)) {
          return {
            ...item,
            confidence: fuzzyConfidence
          };
        }

        return item;
      }).sort((a, b) => {
        // 재정렬: 신뢰도 높은 순, 같으면 장비 수 많은 순
        const confDiff = Number(b.confidence || 0) - Number(a.confidence || 0);
        return confDiff !== 0 ? confDiff : Number(b.equipment_count) - Number(a.equipment_count);
      });
    }

    // 매칭된 항목 필터링 (includeMatched가 false일 때)
    const filteredAutoSuggestions = includeMatched
      ? improvedAutoSuggestions
      : improvedAutoSuggestions.filter(item => !item.is_matched);

    const filteredSearchResults = includeMatched
      ? searchResults
      : searchResults.filter(item => !item.is_matched);

    return NextResponse.json({
      auto_suggestions: filteredAutoSuggestions.map(item => ({
        ...item,
        equipment_count: Number(item.equipment_count),
        confidence: item.confidence ? Number(item.confidence) : null,
      })),
      search_results: filteredSearchResults.map(item => ({
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
