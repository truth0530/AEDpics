import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

/**
 * GET /api/compliance/inspection-status
 * 의무기관별 점검 결과 연계 조회
 *
 * Query Parameters:
 * - year: 대상 연도 (2024 or 2025)
 * - sido?: 시도 필터 (optional)
 * - gugun?: 구군 필터 (optional)
 * - target_key?: 특정 기관 조회 (optional)
 *
 * Returns:
 * - 기관별 점검 완료 대수
 * - 양호/불량 통계
 * - 최근 점검일
 * - 점검률
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
    const targetKey = searchParams.get('target_key') || undefined;

    // 페이지네이션 파라미터
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '50'), 100);
    const offset = (page - 1) * pageSize;

    // 고정 테이블명
    const tableName = 'target_list_2025';

    // 기본 WHERE 조건
    const whereConditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (sido) {
      whereConditions.push(`t.sido = $${paramIndex}`);
      params.push(sido);
      paramIndex++;
    }

    if (gugun) {
      whereConditions.push(`t.gugun = $${paramIndex}`);
      params.push(gugun);
      paramIndex++;
    }

    if (targetKey) {
      whereConditions.push(`t.target_key = $${paramIndex}`);
      params.push(targetKey);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // 총 개수 조회
    const countQuery = `
      SELECT COUNT(DISTINCT t.target_key) as total
      FROM ${tableName} t
      ${whereClause}
    `;

    const countResult = await prisma.$queryRawUnsafe<[{ total: bigint }]>(countQuery, ...params);
    const totalCount = Number(countResult[0]?.total || 0);

    // 의무기관별 점검 결과 집계 (페이지네이션 적용)
    // target_list → target_list_devices → inspections 연계
    const query = `
      SELECT
        t.target_key,
        t.institution_name,
        t.sido,
        t.gugun,
        t.address,
        t.sub_division,
        COUNT(DISTINCT d.equipment_serial) as matched_equipment_count,
        COUNT(DISTINCT CASE WHEN i.id IS NOT NULL THEN i.equipment_serial END) as inspected_equipment_count,
        COUNT(DISTINCT CASE WHEN i.overall_status = '양호' THEN i.equipment_serial END) as good_status_count,
        COUNT(DISTINCT CASE WHEN i.overall_status = '불량' THEN i.equipment_serial END) as bad_status_count,
        COUNT(DISTINCT CASE WHEN i.overall_status NOT IN ('양호', '불량') AND i.overall_status IS NOT NULL THEN i.equipment_serial END) as other_status_count,
        MAX(i.inspection_date) as latest_inspection_date,
        COUNT(DISTINCT i.id) as total_inspection_records
      FROM ${tableName} t
      LEFT JOIN target_list_devices d
        ON d.target_institution_id = t.target_key
        AND d.target_list_year = $${paramIndex}
      LEFT JOIN inspections i
        ON i.equipment_serial = d.equipment_serial
      ${whereClause}
      GROUP BY t.target_key, t.institution_name, t.sido, t.gugun, t.address, t.sub_division
      ORDER BY inspected_equipment_count DESC, t.institution_name ASC
      LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}
    `;

    params.push(year, pageSize, offset);

    const results = await prisma.$queryRawUnsafe<any[]>(query, ...params);

    // ✅ 통계는 전체 데이터에서 집계 (페이지네이션 무관)
    // summary 통계용 별도 쿼리 (LIMIT/OFFSET 없이 전체 집계)
    const summaryQuery = `
      SELECT
        COUNT(DISTINCT t.target_key) as total_institutions,
        COUNT(DISTINCT d.equipment_serial) as total_matched_equipment,
        COUNT(DISTINCT CASE WHEN i.id IS NOT NULL THEN i.equipment_serial END) as total_inspected_equipment,
        COUNT(DISTINCT CASE WHEN i.overall_status = '양호' THEN i.equipment_serial END) as total_good_status,
        COUNT(DISTINCT CASE WHEN i.overall_status = '불량' THEN i.equipment_serial END) as total_bad_status,
        COUNT(DISTINCT CASE WHEN i.overall_status NOT IN ('양호', '불량') AND i.overall_status IS NOT NULL THEN i.equipment_serial END) as total_other_status
      FROM ${tableName} t
      LEFT JOIN target_list_devices d
        ON d.target_institution_id = t.target_key
        AND d.target_list_year = $${paramIndex}
      LEFT JOIN inspections i
        ON i.equipment_serial = d.equipment_serial
      ${whereClause}
    `;

    const summaryParams = [...params.slice(0, -2), year]; // year만 포함 (pageSize, offset 제외)
    const summaryResult = await prisma.$queryRawUnsafe<any[]>(summaryQuery, ...summaryParams);
    const summary = summaryResult[0];

    const totalInstitutions = parseInt(summary?.total_institutions || 0);
    const totalMatchedEquipment = parseInt(summary?.total_matched_equipment || 0);
    const totalInspectedEquipment = parseInt(summary?.total_inspected_equipment || 0);
    const totalGoodStatus = parseInt(summary?.total_good_status || 0);
    const totalBadStatus = parseInt(summary?.total_bad_status || 0);
    const totalOtherStatus = parseInt(summary?.total_other_status || 0);

    // 응답 데이터 정리
    const institutions = results.map(r => {
      const matchedCount = parseInt(r.matched_equipment_count || 0);
      const inspectedCount = parseInt(r.inspected_equipment_count || 0);
      const goodCount = parseInt(r.good_status_count || 0);
      const badCount = parseInt(r.bad_status_count || 0);
      const otherCount = parseInt(r.other_status_count || 0);

      return {
        target_key: r.target_key,
        institution_name: r.institution_name,
        sido: r.sido,
        gugun: r.gugun,
        address: r.address,
        sub_division: r.sub_division,
        matched_equipment_count: matchedCount,
        inspected_equipment_count: inspectedCount,
        uninspected_equipment_count: matchedCount - inspectedCount,
        inspection_rate: matchedCount > 0
          ? ((inspectedCount / matchedCount) * 100).toFixed(2) + '%'
          : '0%',
        good_status_count: goodCount,
        bad_status_count: badCount,
        other_status_count: otherCount,
        good_rate: inspectedCount > 0
          ? ((goodCount / inspectedCount) * 100).toFixed(2) + '%'
          : '0%',
        bad_rate: inspectedCount > 0
          ? ((badCount / inspectedCount) * 100).toFixed(2) + '%'
          : '0%',
        latest_inspection_date: r.latest_inspection_date,
        total_inspection_records: parseInt(r.total_inspection_records || 0)
      };
    });

    const totalPages = Math.ceil(totalCount / pageSize);

    return NextResponse.json({
      success: true,
      year,
      filters: {
        sido: sido || null,
        gugun: gugun || null,
        target_key: targetKey || null
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
        total_matched_equipment: totalMatchedEquipment,
        total_inspected_equipment: totalInspectedEquipment,
        total_uninspected_equipment: totalMatchedEquipment - totalInspectedEquipment,
        overall_inspection_rate: totalMatchedEquipment > 0
          ? ((totalInspectedEquipment / totalMatchedEquipment) * 100).toFixed(2) + '%'
          : '0%',
        total_good_status: totalGoodStatus,
        total_bad_status: totalBadStatus,
        total_other_status: totalOtherStatus,
        overall_good_rate: totalInspectedEquipment > 0
          ? ((totalGoodStatus / totalInspectedEquipment) * 100).toFixed(2) + '%'
          : '0%',
        overall_bad_rate: totalInspectedEquipment > 0
          ? ((totalBadStatus / totalInspectedEquipment) * 100).toFixed(2) + '%'
          : '0%'
      },
      institutions
    });

  } catch (error) {
    console.error('Failed to get inspection status:', error);
    return NextResponse.json(
      { error: 'Failed to get inspection status', details: String(error) },
      { status: 500 }
    );
  }
}
