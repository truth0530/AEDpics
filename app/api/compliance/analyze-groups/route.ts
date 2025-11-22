import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import {
  groupInstitutions,
  calculateGroupStats,
  type TargetInstitution,
  type InstitutionGroup
} from '@/lib/utils/institution-grouping';

/**
 * POST /api/compliance/analyze-groups
 * 의무기관 중복 분석 및 그룹핑
 */
export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { year = '2025', sido, gugun, threshold = 0.85 } = body;

    // 기관 리스트 조회
    let whereClause: any = {};

    // 연도별 테이블 선택
    if (year === '2025') {
      // 2025년 데이터는 target_list_2025 테이블 사용
      let whereConditions = '1=1';
      if (sido) whereConditions += ` AND sido = '${sido}'`;
      if (gugun) whereConditions += ` AND gugun = '${gugun}'`;

      const targets = await prisma.$queryRawUnsafe<any[]>(`
        WITH numbered_targets AS (
          SELECT
            institution_name,
            sido,
            gugun,
            division,
            sub_division,
            unique_key,
            address,
            ROW_NUMBER() OVER (ORDER BY institution_name, sido, gugun) as row_num
          FROM target_list_2025
          WHERE ${whereConditions}
        )
        SELECT
          CASE
            WHEN unique_key IS NOT NULL THEN CONCAT(institution_name, '_', sido, '_', gugun, '_', unique_key)
            ELSE CONCAT(institution_name, '_', sido, '_', gugun, '_row_', row_num::text)
          END as target_key,
          institution_name,
          sido,
          gugun,
          division,
          sub_division,
          unique_key,
          address,
          0::integer as equipment_count,
          0::integer as matched_count,
          0::integer as unmatched_count
        FROM numbered_targets
        ORDER BY institution_name, sido, gugun
        LIMIT 5000
      `);

      // 타입 변환
      const institutions: TargetInstitution[] = targets.map((t: any) => ({
        target_key: t.target_key,
        institution_name: t.institution_name,
        sido: t.sido || '',
        gugun: t.gugun || '',
        division: t.division || '',
        sub_division: t.sub_division || '',
        unique_key: t.unique_key,
        address: t.address,
        equipment_count: Number(t.equipment_count) || 0,
        matched_count: Number(t.matched_count) || 0,
        unmatched_count: Number(t.unmatched_count) || 0
      }));

      // 그룹핑 수행
      const { groups, ungrouped } = groupInstitutions(institutions, threshold);

      // 통계 계산
      const stats = calculateGroupStats(groups, ungrouped);

      // 캐시 헤더 설정 (5분)
      const headers = {
        'Cache-Control': 'private, max-age=300',
      };

      return NextResponse.json({
        success: true,
        groups,
        ungrouped: ungrouped.slice(0, 100), // 너무 많은 데이터 방지
        stats,
        metadata: {
          year,
          sido,
          gugun,
          threshold,
          processedAt: new Date().toISOString()
        }
      }, { headers });

    } else {
      // 2024년 이전 데이터는 target_list_2024 테이블 사용
      const whereClauseObj: Record<string, string> = {};
      if (sido) whereClauseObj.sido = sido;
      if (gugun) whereClauseObj.gugun = gugun;

      const targets = await prisma.target_list_2024.findMany({
        where: whereClauseObj,
        take: 5000, // 성능을 위해 제한
        orderBy: [
          { institution_name: 'asc' },
          { sido: 'asc' },
          { gugun: 'asc' }
        ]
      });

      // TargetInstitution 타입으로 변환
      const institutions: TargetInstitution[] = targets.map(t => ({
        target_key: t.target_key || `${t.institution_name}_${t.sido}_${t.gugun}_${t.no}`,
        institution_name: t.institution_name || '',
        sido: t.sido || '',
        gugun: t.gugun || '',
        division: t.division || '',
        sub_division: t.sub_division || '',
        equipment_count: 0, // target_list_2024에는 equipment_count 필드가 없음
        matched_count: 0, // TODO: 실제 매칭 수 계산
        unmatched_count: 0
      }));

      // 그룹핑 수행
      const { groups, ungrouped } = groupInstitutions(institutions, threshold);

      // 통계 계산
      const stats = calculateGroupStats(groups, ungrouped);

      return NextResponse.json({
        success: true,
        groups,
        ungrouped: ungrouped.slice(0, 100),
        stats,
        metadata: {
          year,
          sido,
          gugun,
          threshold,
          processedAt: new Date().toISOString()
        }
      });
    }

  } catch (error) {
    console.error('Error analyzing groups:', error);
    return NextResponse.json(
      {
        error: 'Failed to analyze groups',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/compliance/analyze-groups
 * 그룹핑 분석 상태 확인
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 여기서는 간단한 상태 정보만 반환
    return NextResponse.json({
      status: 'ready',
      supportedYears: ['2024', '2025'],
      defaultThreshold: 0.85,
      maxInstitutions: 5000
    });

  } catch (error) {
    console.error('Error getting group analysis status:', error);
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    );
  }
}