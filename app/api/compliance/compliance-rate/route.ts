import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

/**
 * GET /api/compliance/compliance-rate
 * 의무기관별 의무이행률 계산
 *
 * Query Parameters:
 * - year: 대상 연도 (2024 or 2025)
 * - sido?: 시도 필터 (optional)
 * - gugun?: 구군 필터 (optional)
 * - target_key?: 특정 기관 조회 (optional)
 *
 * Returns:
 * - 매칭률: 매칭된 장비 수 / 전체 장비 수
 * - 점검률: 점검 완료 장비 수 / 매칭된 장비 수
 * - 양호율: 양호 상태 장비 수 / 점검 완료 장비 수
 * - 종합 의무이행률: (매칭률 + 점검률 + 양호율) / 3
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

    // 의무기관별 종합 의무이행률 계산 (페이지네이션 적용)
    // 1. 해당 지역의 전체 AED 장비 수 (시도/구군 기준)
    // 2. 매칭된 장비 수
    // 3. 점검 완료 장비 수
    // 4. 양호 상태 장비 수
    const query = `
      WITH regional_equipment AS (
        SELECT
          t.target_key,
          COUNT(DISTINCT a.equipment_serial) as total_regional_equipment
        FROM ${tableName} t
        LEFT JOIN aed_data a
          ON a.sido = t.sido
          AND a.gugun = t.gugun
        ${whereClause}
        GROUP BY t.target_key
      )
      SELECT
        t.target_key,
        t.institution_name,
        t.sido,
        t.gugun,
        t.address,
        t.sub_division,
        re.total_regional_equipment,
        COUNT(DISTINCT d.equipment_serial) as matched_equipment_count,
        COUNT(DISTINCT CASE WHEN i.id IS NOT NULL THEN i.equipment_serial END) as inspected_equipment_count,
        COUNT(DISTINCT CASE WHEN i.overall_status = '양호' THEN i.equipment_serial END) as good_status_count,
        COUNT(DISTINCT CASE WHEN i.overall_status = '불량' THEN i.equipment_serial END) as bad_status_count,
        MAX(i.inspection_date) as latest_inspection_date
      FROM ${tableName} t
      LEFT JOIN regional_equipment re ON re.target_key = t.target_key
      LEFT JOIN target_list_devices d
        ON d.target_institution_id = t.target_key
        AND d.target_list_year = $${paramIndex}
      LEFT JOIN inspections i
        ON i.equipment_serial = d.equipment_serial
      ${whereClause}
      GROUP BY t.target_key, t.institution_name, t.sido, t.gugun, t.address, t.sub_division, re.total_regional_equipment
      ORDER BY t.institution_name ASC
      LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}
    `;

    params.push(year, pageSize, offset);

    const results = await prisma.$queryRawUnsafe<any[]>(query, ...params);

    // 응답 데이터 정리 및 의무이행률 계산
    const institutions = results.map(r => {
      const regionalEquipment = parseInt(r.total_regional_equipment || 0);
      const matchedCount = parseInt(r.matched_equipment_count || 0);
      const inspectedCount = parseInt(r.inspected_equipment_count || 0);
      const goodCount = parseInt(r.good_status_count || 0);
      const badCount = parseInt(r.bad_status_count || 0);

      // 매칭률: 매칭된 장비 / 지역 내 전체 장비
      const matchingRate = regionalEquipment > 0
        ? (matchedCount / regionalEquipment) * 100
        : 0;

      // 점검률: 점검 완료 장비 / 매칭된 장비
      const inspectionRate = matchedCount > 0
        ? (inspectedCount / matchedCount) * 100
        : 0;

      // 양호율: 양호 상태 / 점검 완료 장비
      const goodRate = inspectedCount > 0
        ? (goodCount / inspectedCount) * 100
        : 0;

      // 종합 의무이행률: (매칭률 + 점검률 + 양호율) / 3
      const overallComplianceRate = (matchingRate + inspectionRate + goodRate) / 3;

      return {
        target_key: r.target_key,
        institution_name: r.institution_name,
        sido: r.sido,
        gugun: r.gugun,
        address: r.address,
        sub_division: r.sub_division,
        total_regional_equipment: regionalEquipment,
        matched_equipment_count: matchedCount,
        inspected_equipment_count: inspectedCount,
        good_status_count: goodCount,
        bad_status_count: badCount,
        matching_rate: matchingRate.toFixed(2) + '%',
        inspection_rate: inspectionRate.toFixed(2) + '%',
        good_rate: goodRate.toFixed(2) + '%',
        overall_compliance_rate: overallComplianceRate.toFixed(2) + '%',
        latest_inspection_date: r.latest_inspection_date,
        compliance_grade: getComplianceGrade(overallComplianceRate)
      };
    });

    // 전체 통계 집계
    const totalRegionalEquipment = results.reduce((sum, r) => sum + parseInt(r.total_regional_equipment || 0), 0);
    const totalMatchedEquipment = results.reduce((sum, r) => sum + parseInt(r.matched_equipment_count || 0), 0);
    const totalInspectedEquipment = results.reduce((sum, r) => sum + parseInt(r.inspected_equipment_count || 0), 0);
    const totalGoodStatus = results.reduce((sum, r) => sum + parseInt(r.good_status_count || 0), 0);

    const overallMatchingRate = totalRegionalEquipment > 0
      ? (totalMatchedEquipment / totalRegionalEquipment) * 100
      : 0;
    const overallInspectionRate = totalMatchedEquipment > 0
      ? (totalInspectedEquipment / totalMatchedEquipment) * 100
      : 0;
    const overallGoodRate = totalInspectedEquipment > 0
      ? (totalGoodStatus / totalInspectedEquipment) * 100
      : 0;
    const overallComplianceRate = (overallMatchingRate + overallInspectionRate + overallGoodRate) / 3;
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
        total_institutions_on_page: institutions.length,
        total_institutions_all: totalCount,
        total_regional_equipment: totalRegionalEquipment,
        total_matched_equipment: totalMatchedEquipment,
        total_inspected_equipment: totalInspectedEquipment,
        total_good_status: totalGoodStatus,
        overall_matching_rate: overallMatchingRate.toFixed(2) + '%',
        overall_inspection_rate: overallInspectionRate.toFixed(2) + '%',
        overall_good_rate: overallGoodRate.toFixed(2) + '%',
        overall_compliance_rate: overallComplianceRate.toFixed(2) + '%',
        overall_compliance_grade: getComplianceGrade(overallComplianceRate)
      },
      institutions
    });

  } catch (error) {
    console.error('Failed to calculate compliance rate:', error);
    return NextResponse.json(
      { error: 'Failed to calculate compliance rate', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * 의무이행률 등급 계산
 */
function getComplianceGrade(rate: number): string {
  if (rate >= 90) return 'A (우수)';
  if (rate >= 80) return 'B (양호)';
  if (rate >= 70) return 'C (보통)';
  if (rate >= 60) return 'D (미흡)';
  return 'F (불량)';
}
