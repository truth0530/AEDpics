import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { getSidoVariantsForDB } from '@/lib/constants/regions';

/**
 * GET /api/compliance/matching-status
 * 의무기관별 매칭 현황 조회
 *
 * Query Parameters:
 * - year: 대상 연도 (2024 or 2025)
 * - sido?: 시도 필터 (optional)
 * - gugun?: 구군 필터 (optional)
 *
 * Returns:
 * - total_institutions: 총 의무기관 수
 * - matched_institutions: 매칭 완료 기관 수
 * - unmatched_institutions: 미매칭 기관 수
 * - total_matched_equipment: 총 매칭된 장비 수
 * - institutions: 기관별 상세 목록
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = 2025; // 2025년 고정
    const sido = searchParams.get('sido') || undefined;
    const gugun = searchParams.get('gugun') || undefined;

    // 페이지네이션 파라미터
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '50'), 100); // 최대 100개
    const offset = (page - 1) * pageSize;

    // 고정 테이블명
    const tableName = 'target_list_2025';

    // 기본 WHERE 조건
    const whereConditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // sido 필터: 약칭과 정식명 모두 검색
    const sidoVariants = getSidoVariantsForDB(sido);
    if (sidoVariants && sidoVariants.length > 0) {
      const placeholders = sidoVariants.map(() => `$${paramIndex++}`).join(', ');
      whereConditions.push(`t.sido IN (${placeholders})`);
      params.push(...sidoVariants);
    }

    if (gugun) {
      whereConditions.push(`t.gugun = $${paramIndex}`);
      params.push(gugun);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // 총 개수 조회 (페이지네이션용)
    const countQuery = `
      SELECT COUNT(DISTINCT t.target_key) as total
      FROM ${tableName} t
      ${whereClause}
    `;

    const countResult = await prisma.$queryRawUnsafe<[{ total: bigint }]>(countQuery, ...params);
    const totalCount = Number(countResult[0]?.total || 0);

    // 의무기관별 매칭 현황 조회 (페이지네이션 적용)
    const query = `
      SELECT
        t.target_key,
        t.institution_name,
        t.sido,
        t.gugun,
        t.address,
        t.sub_division,
        COUNT(DISTINCT d.equipment_serial) as matched_equipment_count,
        ARRAY_AGG(DISTINCT d.equipment_serial) FILTER (WHERE d.equipment_serial IS NOT NULL) as matched_serials
      FROM ${tableName} t
      LEFT JOIN target_list_devices d
        ON d.target_institution_id = t.target_key
        AND d.target_list_year = $${paramIndex}
      ${whereClause}
      GROUP BY t.target_key, t.institution_name, t.sido, t.gugun, t.address, t.sub_division
      ORDER BY matched_equipment_count DESC, t.institution_name ASC
      LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}
    `;

    params.push(year, pageSize, offset);

    const results = await prisma.$queryRawUnsafe<any[]>(query, ...params);

    // ✅ 통계는 전체 데이터에서 집계 (페이지네이션 무관)
    // summary 통계용 별도 쿼리 (LIMIT/OFFSET 없이 전체 집계)
    const summaryQuery = `
      SELECT
        COUNT(DISTINCT t.target_key) as total_institutions,
        COUNT(DISTINCT CASE WHEN d.equipment_serial IS NOT NULL THEN t.target_key END) as matched_institutions,
        COUNT(DISTINCT d.equipment_serial) as total_matched_equipment
      FROM ${tableName} t
      LEFT JOIN target_list_devices d
        ON d.target_institution_id = t.target_key
        AND d.target_list_year = $${paramIndex}
      ${whereClause}
    `;

    const summaryParams = [...params.slice(0, -2), year]; // year만 포함 (pageSize, offset 제외)
    const summaryResult = await prisma.$queryRawUnsafe<any[]>(summaryQuery, ...summaryParams);
    const summary = summaryResult[0];

    const totalInstitutions = parseInt(summary?.total_institutions || 0);
    const matchedInstitutions = parseInt(summary?.matched_institutions || 0);
    const unmatchedInstitutionsCount = totalInstitutions - matchedInstitutions; // 전체 - 매칭완료 = 미매칭
    const totalMatchedEquipment = parseInt(summary?.total_matched_equipment || 0);

    // 응답 데이터 정리
    const institutions = results.map(r => ({
      target_key: r.target_key,
      institution_name: r.institution_name,
      sido: r.sido,
      gugun: r.gugun,
      address: r.address,
      sub_division: r.sub_division,
      matched_equipment_count: parseInt(r.matched_equipment_count || 0),
      matched_serials: r.matched_serials || [],
      is_matched: parseInt(r.matched_equipment_count || 0) > 0
    }));

    const totalPages = Math.ceil(totalCount / pageSize);

    return NextResponse.json({
      success: true,
      year,
      filters: {
        sido: sido || null,
        gugun: gugun || null
      },
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      summary: {
        total_institutions_on_page: results.length,
        total_institutions_all: totalInstitutions,
        matched_institutions: matchedInstitutions,
        unmatched_institutions_count: unmatchedInstitutionsCount,
        total_matched_equipment: totalMatchedEquipment,
        matching_rate: totalInstitutions > 0
          ? ((matchedInstitutions / totalInstitutions) * 100).toFixed(2) + '%'
          : '0%'
      },
      institutions
    });

  } catch (error) {
    console.error('Failed to get matching status:', error);
    return NextResponse.json(
      { error: 'Failed to get matching status', details: String(error) },
      { status: 500 }
    );
  }
}
