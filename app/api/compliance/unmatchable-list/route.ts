import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
// 중앙 관리: lib/constants/regions.ts (하드코딩 금지)
import { normalizeRegionName } from '@/lib/constants/regions';

/**
 * GET /api/compliance/unmatchable-list
 * 매칭 불가로 표시된 기관 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const year = 2025; // 2025년 고정
    // target_list_2025는 약칭("대구", "서울")으로 저장되어 있으므로
    // normalizeRegionName으로 정식명칭 → 약칭 변환
    const sidoParam = searchParams.get('sido');
    const sido = sidoParam ? normalizeRegionName(sidoParam) : undefined;
    const gugunParam = searchParams.get('gugun');
    const gugun = gugunParam ? normalizeRegionName(gugunParam) : undefined;

    // 매칭 불가로 표시된 기관 조회
    // 가장 최근의 mark_unmatchable 액션을 가진 기관들
    // cancel_unmatchable이 있으면 제외
    const unmatchableLogs = await prisma.$queryRaw<Array<{
      target_key: string;
      reason: string | null;
      user_id: string;
      created_at: Date;
      user_email: string | null;
      user_name: string | null;
    }>>`
      WITH latest_actions AS (
        SELECT
          target_key,
          action,
          reason,
          user_id,
          created_at,
          ROW_NUMBER() OVER (PARTITION BY target_key ORDER BY created_at DESC) as rn
        FROM aedpics.target_list_match_logs
        WHERE
          target_list_year = ${year}
          AND action IN ('mark_unmatchable', 'cancel_unmatchable')
      )
      SELECT
        la.target_key,
        la.reason,
        la.user_id,
        la.created_at,
        up.email as user_email,
        up.full_name as user_name
      FROM latest_actions la
      LEFT JOIN aedpics.user_profiles up ON la.user_id = up.id
      WHERE
        la.rn = 1
        AND la.action = 'mark_unmatchable'
      ORDER BY la.created_at DESC
    `;

    if (unmatchableLogs.length === 0) {
      return NextResponse.json({
        unmatchableInstitutions: [],
        total: 0
      });
    }

    // target_key로 기관 정보 조회
    const targetKeys = unmatchableLogs.map(log => log.target_key);

    const targetWhere: any = {
      target_key: { in: targetKeys },
      data_year: year
    };

    if (sido) targetWhere.sido = sido;
    if (gugun) targetWhere.gugun = gugun;

    const targets = await prisma.target_list_2025.findMany({
      where: targetWhere,
      select: {
        target_key: true,
        institution_name: true,
        sido: true,
        gugun: true,
        division: true,
        sub_division: true,
        unique_key: true,
        address: true
      }
    });

    // 로그와 기관 정보 결합
    const unmatchableInstitutions = unmatchableLogs
      .map(log => {
        const target = targets.find(t => t.target_key === log.target_key);
        if (!target) return null;

        return {
          targetInstitution: {
            target_key: target.target_key,
            institution_name: target.institution_name,
            sido: target.sido,
            gugun: target.gugun,
            division: target.division || '',
            sub_division: target.sub_division || '',
            unique_key: 'unique_key' in target ? target.unique_key : undefined,
            address: 'address' in target ? target.address : undefined
          },
          reason: log.reason || '',
          markedBy: log.user_name || log.user_email || '알 수 없음',
          markedAt: log.created_at,
          status: 'unmatchable' as const
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      unmatchableInstitutions,
      total: unmatchableInstitutions.length
    });

  } catch (error) {
    console.error('Failed to fetch unmatchable institutions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch unmatchable institutions', details: String(error) },
      { status: 500 }
    );
  }
}
