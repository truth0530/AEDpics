import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { normalizeRegionName } from '@/lib/constants/regions';

/**
 * Lightweight statistics-only endpoint for compliance matching
 *
 * This endpoint provides fast aggregated statistics without performing
 * expensive similarity matching calculations. Use this for dashboard
 * displays instead of the full /api/compliance/check endpoint.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const year = '2025'; // Only 2025 data is supported
    const sidoParam = searchParams.get('sido');
    // target_list_2025는 약칭("대구", "서울")으로 저장되어 있으므로
    // normalizeRegionName으로 정식명칭 → 약칭 변환
    const sido = sidoParam ? normalizeRegionName(sidoParam) : undefined;
    const gugunParam = searchParams.get('gugun');
    const gugun = gugunParam ? normalizeRegionName(gugunParam) : undefined;
    const search = searchParams.get('search');

    console.log('[compliance/stats] Request params:', {
      sidoParam,
      sido,
      gugunParam,
      gugun,
      search
    });

    // 1. Build WHERE clause for target institutions
    const targetWhere: any = {
      data_year: 2025,
    };

    if (sido && sido !== '전체' && sido !== '시도') {
      targetWhere.sido = sido;
    }
    if (gugun && gugun !== '전체' && gugun !== '구군') {
      targetWhere.gugun = gugun;
    }
    if (search) {
      targetWhere.OR = [
        { institution_name: { contains: search, mode: 'insensitive' } },
        { target_key: { contains: search, mode: 'insensitive' } },
        { unique_key: { contains: search, mode: 'insensitive' } }
      ];
    }

    // 2. Count total target institutions
    const totalCount = await prisma.target_list_2025.count({ where: targetWhere });

    // 3. Get all target keys for this region
    const targetKeys = await prisma.target_list_2025.findMany({
      where: targetWhere,
      select: {
        target_key: true
      }
    });

    const targetKeyList = targetKeys.map(t => t.target_key);

    // 4. Count matched institutions (distinct target_institution_id in target_list_devices)
    const matchedInstitutions = await prisma.target_list_devices.findMany({
      where: {
        target_institution_id: {
          in: targetKeyList
        },
        target_list_year: parseInt(year)
      },
      select: {
        target_institution_id: true
      },
      distinct: ['target_institution_id']
    });

    const installedCount = matchedInstitutions.length;

    // 5. Count unmatchable institutions (latest action is 'mark_unmatchable')
    let unmatchableCount = 0;
    if (targetKeyList.length > 0) {
      // Get all latest unmatchable actions for the year, then filter in JavaScript
      const allUnmatchableLogs = await prisma.$queryRaw<Array<{ target_key: string }>>`
        WITH latest_actions AS (
          SELECT
            target_key,
            action,
            ROW_NUMBER() OVER (PARTITION BY target_key ORDER BY created_at DESC) as rn
          FROM aedpics.target_list_match_logs
          WHERE
            target_list_year = ${parseInt(year)}
            AND action IN ('mark_unmatchable', 'cancel_unmatchable')
        )
        SELECT la.target_key
        FROM latest_actions la
        WHERE la.rn = 1
          AND la.action = 'mark_unmatchable'
      `;

      // Filter to only include target_keys in our region
      const targetKeySet = new Set(targetKeyList);
      const unmatchableLogs = allUnmatchableLogs.filter(log => targetKeySet.has(log.target_key));
      unmatchableCount = unmatchableLogs.length;
    }

    // 6. Count not installed (total - matched - unmatchable)
    const confirmedNotInstalledCount = 0;

    // 7. Calculate pending (not yet confirmed)
    const notInstalledCount = totalCount - installedCount - unmatchableCount;

    return NextResponse.json({
      success: true,
      stats: {
        total: totalCount,
        installed: installedCount,
        notInstalled: notInstalledCount,
        unmatchable: unmatchableCount,
        pending: totalCount - installedCount - confirmedNotInstalledCount - unmatchableCount
      },
      metadata: {
        year,
        sido: sido || 'all',
        gugun: gugun || 'all',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Compliance stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch compliance statistics' },
      { status: 500 }
    );
  }
}
