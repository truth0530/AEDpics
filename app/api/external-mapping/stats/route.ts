// TODO: Supabase 서버 클라이언트 임시 비활성화
// // TODO: Supabase 서버 클라이언트 임시 비활성화
// import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/external-mapping/stats
 * 외부 시스템 매칭 통계 조회
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // external_mapping_stats 뷰 조회
    const { data, error } = await supabase
      .from('external_mapping_stats')
      .select('*')
      .single();

    if (error) {
      console.error('[GET /api/external-mapping/stats] Error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      stats: data
    });
  } catch (error) {
    console.error('[GET /api/external-mapping/stats] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
