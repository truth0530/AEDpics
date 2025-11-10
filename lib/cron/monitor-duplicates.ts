import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * 중복 점검 세션 모니터링 및 알림
 * Cron job에서 정기적으로 호출됨
 *
 * 역할:
 * 1. 중복 점검 세션 감지
 * 2. 로깅 기록
 * 3. 필요시 외부 알림 (Slack 등) 전송
 *
 * 사용 흐름:
 * - GitHub Actions Cron: 매일 새벽 2시
 * - 또는 외부 서비스 (Zapier, etc)에서 API 호출
 */

export interface DuplicateSessionInfo {
  equipment_serial: string;
  session_count: number;
  session_ids: string[];
  earliest_start: Date;
  latest_start: Date;
  statuses: string[];
  inspectors: string[];
}

export interface MonitoringResult {
  success: boolean;
  timestamp: Date;
  duplicate_count: number;
  equipment_with_duplicates: number;
  duplicates: DuplicateSessionInfo[];
}

/**
 * 중복 점검 세션 조회
 */
export async function checkDuplicateSessions(): Promise<DuplicateSessionInfo[]> {
  try {
    const duplicates = await prisma.$queryRaw<any[]>`
      SELECT
        equipment_serial,
        COUNT(*) as session_count,
        STRING_AGG(id::text, ',') as session_ids,
        MIN(started_at) as earliest_start,
        MAX(started_at) as latest_start,
        STRING_AGG(DISTINCT status::text, ',') as statuses,
        STRING_AGG(DISTINCT user_profiles.full_name, ',') FILTER (WHERE user_profiles.full_name IS NOT NULL) as inspectors
      FROM aedpics.inspection_sessions
      LEFT JOIN aedpics.user_profiles ON inspection_sessions.inspector_id = user_profiles.id
      WHERE status IN ('active', 'paused')
      GROUP BY equipment_serial
      HAVING COUNT(*) > 1
      ORDER BY session_count DESC, latest_start DESC
    `;

    const duplicateList = (duplicates || []).map(d => ({
      equipment_serial: d.equipment_serial,
      session_count: Number(d.session_count),
      session_ids: d.session_ids?.split(',') || [],
      earliest_start: new Date(d.earliest_start),
      latest_start: new Date(d.latest_start),
      statuses: d.statuses?.split(',') || [],
      inspectors: d.inspectors?.split(',').filter(Boolean) || []
    }));

    return duplicateList;
  } catch (error) {
    logger.error('MonitorDuplicates:checkDuplicateSessions', 'Failed to check duplicates',
      error instanceof Error ? error : { error });
    throw error;
  }
}

/**
 * 중복 점검 세션 모니터링 메인 함수
 * 정기적으로 호출되며, 중복 세션을 감지하고 로깅합니다
 */
export async function monitorDuplicateSessions(): Promise<MonitoringResult> {
  const timestamp = new Date();

  try {
    const duplicates = await checkDuplicateSessions();

    const result: MonitoringResult = {
      success: true,
      timestamp,
      duplicate_count: duplicates.reduce((sum, d) => sum + d.session_count, 0),
      equipment_with_duplicates: duplicates.length,
      duplicates
    };

    // 로깅
    if (duplicates.length > 0) {
      logger.warn('MonitorDuplicates:monitorDuplicateSessions', 'Duplicate sessions detected!', {
        timestamp: timestamp.toISOString(),
        equipment_with_duplicates: duplicates.length,
        total_duplicate_sessions: result.duplicate_count,
        affected_equipment: duplicates.map(d => ({
          serial: d.equipment_serial,
          count: d.session_count,
          inspectors: d.inspectors.join(', ')
        }))
      });
    } else {
      logger.info('MonitorDuplicates:monitorDuplicateSessions', 'No duplicate sessions found', {
        timestamp: timestamp.toISOString()
      });
    }

    return result;
  } catch (error) {
    logger.error('MonitorDuplicates:monitorDuplicateSessions', 'Monitoring failed',
      error instanceof Error ? error : { error });

    throw error;
  }
}

/**
 * TODO (Priority 4): Slack 알림 통합
 *
 * 구현 예시:
 * ```typescript
 * import axios from 'axios';
 *
 * export async function sendSlackAlert(duplicates: DuplicateSessionInfo[]) {
 *   if (!process.env.SLACK_WEBHOOK_URL || duplicates.length === 0) return;
 *
 *   const message = {
 *     text: `⚠️ [AED 점검 시스템] ${duplicates.length}개 장비에서 중복 점검 세션 감지`,
 *     blocks: [
 *       {
 *         type: 'section',
 *         text: {
 *           type: 'mrkdwn',
 *           text: `*중복 점검 세션 감지*\n장비: ${duplicates.length}개, 총 세션: ${duplicates.reduce((sum, d) => sum + d.session_count, 0)}개`
 *         }
 *       },
 *       ...duplicates.map(d => ({
 *         type: 'section',
 *         text: {
 *           type: 'mrkdwn',
 *           text: `*${d.equipment_serial}*\n점검자: ${d.inspectors.join(', ')}\n세션 수: ${d.session_count}개`
 *         }
 *       }))
 *     ]
 *   };
 *
 *   await axios.post(process.env.SLACK_WEBHOOK_URL, message);
 * }
 * ```
 */
