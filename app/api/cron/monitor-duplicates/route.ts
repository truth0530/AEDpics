import { NextRequest, NextResponse } from 'next/server';
import { monitorDuplicateSessions } from '@/lib/cron/monitor-duplicates';
import { logger } from '@/lib/logger';

/**
 * POST /api/cron/monitor-duplicates
 * 중복 점검 세션 모니터링 Cron Job
 *
 * 목적:
 * - 정기적으로 중복 점검 세션을 감지 및 로깅
 * - 운영팀에 현황 보고
 * - Slack 알림 (Priority 4)
 *
 * 인증:
 * - API Key 기반 (X-Cron-Token 헤더)
 * - environment variable로 관리
 *
 * 호출 방법:
 * ```bash
 * # GitHub Actions Cron
 * curl -X POST https://aed.pics/api/cron/monitor-duplicates \
 *   -H "X-Cron-Token: ${{ secrets.MONITORING_CRON_TOKEN }}" \
 *   -H "Content-Type: application/json"
 *
 * # 또는 외부 서비스 (Zapier, Monitoring Tool, etc)
 * # 매일 정해진 시간에 자동 호출
 * ```
 *
 * 응답:
 * - 중복 세션 현황 JSON
 * - 로그에 상세 정보 기록
 */
export async function POST(request: NextRequest) {
  try {
    // API Key 인증
    const authToken = request.headers.get('x-cron-token');
    const expectedToken = process.env.MONITORING_CRON_TOKEN;

    if (!expectedToken) {
      logger.error('CronMonitorDuplicates:POST', 'MONITORING_CRON_TOKEN not configured', {});
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    if (!authToken || authToken !== expectedToken) {
      logger.warn('CronMonitorDuplicates:POST', 'Unauthorized cron request', {
        ip: request.headers.get('x-forwarded-for'),
        token_provided: !!authToken
      });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 중복 세션 모니터링 실행
    const result = await monitorDuplicateSessions();

    logger.info('CronMonitorDuplicates:POST', 'Monitoring completed successfully', {
      timestamp: result.timestamp.toISOString(),
      duplicate_equipment_count: result.equipment_with_duplicates,
      duplicate_sessions_count: result.duplicate_count
    });

    // 응답
    return NextResponse.json({
      success: true,
      timestamp: result.timestamp,
      summary: {
        equipment_with_duplicates: result.equipment_with_duplicates,
        total_duplicate_sessions: result.duplicate_count
      },
      message: result.equipment_with_duplicates === 0
        ? 'No duplicate sessions detected.'
        : `Detected ${result.equipment_with_duplicates} equipment with duplicate sessions (${result.duplicate_count} total sessions)`
    });
  } catch (error) {
    logger.error('CronMonitorDuplicates:POST', 'Cron job failed',
      error instanceof Error ? error : { error });

    return NextResponse.json(
      { error: 'Cron job execution failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/monitor-duplicates
 * 엔드포인트 상태 확인용
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    message: 'Duplicate session monitoring cron endpoint',
    method: 'POST',
    authentication: 'X-Cron-Token header required',
    example: 'curl -X POST https://aed.pics/api/cron/monitor-duplicates -H "X-Cron-Token: YOUR_TOKEN"'
  });
}
