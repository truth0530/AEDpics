import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/compliance/tnms-search
 * TNMS 매칭 결과 검색
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!query) {
      return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
    }

    // TNMS 매칭 결과에서 검색
    const results = await prisma.$queryRaw<any[]>`
      SELECT
        tmr.target_key,
        tmr.target_institution_name,
        tmr.target_sido,
        tmr.target_gugun,
        tmr.target_address,
        tmr.matched_equipment_serial,
        tmr.current_institution_name as matched_institution_name,
        tmr.current_address as matched_address,
        tmr.confidence_score,
        tmr.name_confidence,
        tmr.address_confidence,
        tmr.match_type,
        tmr.data_changed
      FROM aedpics.tnms_matching_current tmr
      WHERE
        tmr.target_institution_name ILIKE ${'%' + query + '%'}
        OR tmr.current_institution_name ILIKE ${'%' + query + '%'}
      ORDER BY
        CASE
          WHEN tmr.target_institution_name ILIKE ${query} THEN 1
          WHEN tmr.target_institution_name ILIKE ${query + '%'} THEN 2
          WHEN tmr.target_institution_name ILIKE ${'%' + query} THEN 3
          ELSE 4
        END,
        tmr.confidence_score DESC
      LIMIT ${limit}
    `;

    return NextResponse.json({
      query,
      count: results.length,
      results: results.map(r => ({
        target_key: r.target_key,
        target_institution_name: r.target_institution_name,
        target_sido: r.target_sido,
        target_gugun: r.target_gugun,
        target_address: r.target_address,
        matched_equipment_serial: r.matched_equipment_serial,
        matched_institution_name: r.matched_institution_name,
        matched_address: r.matched_address,
        confidence_score: parseFloat(r.confidence_score),
        name_confidence: parseFloat(r.name_confidence),
        address_confidence: parseFloat(r.address_confidence),
        match_type: r.match_type,
        data_changed: r.data_changed
      }))
    });

  } catch (error) {
    console.error('[TNMS Search] Error:', error);
    return NextResponse.json(
      { error: 'Search failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}