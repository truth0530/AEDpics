import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/compliance/tnms-stats
 * TNMS 매칭 통계 조회
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // tnms_matching_stats 뷰에서 통계 조회
    const stats = await prisma.$queryRaw<any[]>`
      SELECT * FROM aedpics.tnms_matching_stats
    `;

    if (stats.length === 0) {
      return NextResponse.json({
        total_targets: 0,
        matched_count: 0,
        unmatched_count: 0,
        avg_confidence: 0,
        high_confidence_count: 0,
        medium_confidence_count: 0,
        low_confidence_count: 0
      });
    }

    const stat = stats[0];

    return NextResponse.json({
      total_targets: Number(stat.total_targets),
      matched_count: Number(stat.matched_count),
      unmatched_count: Number(stat.unmatched_count),
      avg_confidence: parseFloat(stat.avg_confidence),
      high_confidence_count: Number(stat.high_confidence_count),
      medium_confidence_count: Number(stat.medium_confidence_count),
      low_confidence_count: Number(stat.low_confidence_count),
      auto_matched: Number(stat.auto_matched),
      manual_matched: Number(stat.manual_matched),
      verified_matched: Number(stat.verified_matched)
    });

  } catch (error) {
    console.error('[TNMS Stats] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}