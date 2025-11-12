import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { normalizeGugunForDB } from '@/lib/constants/regions';

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
    const year = searchParams.get('year') || '2024';
    const sido = searchParams.get('sido');
    const gugunParam = searchParams.get('gugun');
    const gugun = gugunParam ? (normalizeGugunForDB(gugunParam) ?? gugunParam) : undefined;

    // 1. Build WHERE clause for target institutions
    const targetWhere: any = {
      data_year: parseInt(year),
    };

    if (sido && sido !== '전체' && sido !== '시도') {
      targetWhere.sido = sido;
    }
    if (gugun && gugun !== '전체' && gugun !== '구군') {
      targetWhere.gugun = gugun;
    }

    // 2. Count total target institutions (dynamic table selection)
    const totalCount = year === '2025'
      ? await prisma.target_list_2025.count({ where: targetWhere })
      : await prisma.target_list_2024.count({ where: targetWhere });

    // 3. Get all target keys for this region (dynamic table selection)
    const targetKeys = year === '2025'
      ? await prisma.target_list_2025.findMany({
          where: targetWhere,
          select: {
            target_key: true
          }
        })
      : await prisma.target_list_2024.findMany({
          where: targetWhere,
          select: {
            target_key: true
          }
        });

    const targetKeyList = targetKeys.map(t => t.target_key);

    // 4. Count confirmed mappings (installed)
    const installedCount = await prisma.management_number_group_mapping.count({
      where: {
        [`target_key_${year}`]: {
          in: targetKeyList
        },
        [`confirmed_${year}`]: true,
        management_number: {
          not: null
        }
      }
    });

    // 5. Count not installed (confirmed but no management_number)
    const confirmedNotInstalledCount = await prisma.management_number_group_mapping.count({
      where: {
        [`target_key_${year}`]: {
          in: targetKeyList
        },
        [`confirmed_${year}`]: true,
        management_number: null
      }
    });

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
