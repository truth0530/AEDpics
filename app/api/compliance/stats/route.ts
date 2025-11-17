import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { normalizeGugunForDB, normalizeSidoForDB } from '@/lib/constants/regions';

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
    const sido = sidoParam ? normalizeSidoForDB(sidoParam) : undefined;
    const gugunParam = searchParams.get('gugun');
    const gugun = gugunParam ? normalizeGugunForDB(gugunParam) : undefined;

    console.log('[compliance/stats] Request params:', {
      sidoParam,
      sido,
      gugunParam,
      gugun
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

    // 5. Count not installed (total - matched)
    const confirmedNotInstalledCount = 0;

    // 6. Calculate pending (not yet confirmed)
    const notInstalledCount = totalCount - installedCount;

    return NextResponse.json({
      success: true,
      stats: {
        total: totalCount,
        installed: installedCount,
        notInstalled: notInstalledCount,
        pending: totalCount - installedCount - confirmedNotInstalledCount
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
