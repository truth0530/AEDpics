import { NextRequest, NextResponse } from 'next/server';
import { checkAllImprovements } from '@/lib/inspections/field-comparison';
import { logger } from '@/lib/logger';

/**
 * CRON API: 매일 자동으로 실행되어 개선 상태 확인
 *
 * Vercel CRON 설정:
 * vercel.json에 다음 추가:
 * {
 *   "crons": [{
 *     "path": "/api/cron/check-improvements",
 *     "schedule": "0 4 * * *"
 *   }]
 * }
 *
 * 보안:
 * - Vercel CRON_SECRET 환경변수로 인증
 * - 외부 호출 차단
 */
export async function GET(request: NextRequest) {
  try {
    // CRON_SECRET 인증
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('CRON:check-improvements', '인증 실패', {
        hasAuth: !!authHeader,
        hasSecret: !!cronSecret,
      });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    logger.info('CRON:check-improvements', 'CRON 작업 시작');

    const startTime = Date.now();

    // 전체 개선 상태 확인
    const result = await checkAllImprovements();

    const duration = Date.now() - startTime;

    logger.info('CRON:check-improvements', 'CRON 작업 완료', {
      ...result,
      durationMs: duration,
    });

    return NextResponse.json({
      success: true,
      ...result,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('CRON:check-improvements', 'CRON 작업 실패', error instanceof Error ? error : { error });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
