import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/monitoring/duplicate-sessions
 * 중복 점검 세션 모니터링
 *
 * 목적:
 * - 운영팀이 중복 세션 현황을 파악하기 위한 API
 * - Cron job으로 정기적 호출 (예: 일 1회)
 * - Slack 알림 연동 가능
 * - 대시보드에 표시 가능
 *
 * 응답:
 * - total: 중복이 있는 총 장비 수
 * - duplicates: 장비별 중복 세션 정보 배열
 * - timestamp: 조회 시간
 *
 * 권한:
 * - 마스터 관리자만 접근 가능
 */
export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 마스터 관리자 확인
    const userProfile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id },
      select: { role: true, email: true }
    });

    if (!userProfile || userProfile.role !== 'master') {
      logger.warn('DuplicateSessionsMonitoring:GET', 'Non-master user attempted access', {
        userId: session.user.id,
        role: userProfile?.role
      });

      return NextResponse.json(
        { error: 'Forbidden: Only master administrators can access this endpoint' },
        { status: 403 }
      );
    }

    // 중복 세션 조회
    const duplicates = await prisma.$queryRaw`
      SELECT
        equipment_serial,
        COUNT(*) as session_count,
        STRING_AGG(id, ',') as session_ids,
        MIN(started_at) as earliest_start,
        MAX(started_at) as latest_start,
        STRING_AGG(DISTINCT status, ',') as statuses,
        STRING_AGG(DISTINCT user_profiles.full_name, ',') as inspectors
      FROM aedpics.inspection_sessions
      LEFT JOIN aedpics.user_profiles ON inspection_sessions.inspector_id = user_profiles.id
      WHERE status IN ('active', 'paused')
      GROUP BY equipment_serial
      HAVING COUNT(*) > 1
      ORDER BY session_count DESC, latest_start DESC
    `;

    const duplicateList = (duplicates as any[] || []).map(d => ({
      equipment_serial: d.equipment_serial,
      session_count: Number(d.session_count),
      session_ids: d.session_ids?.split(',') || [],
      earliest_start: d.earliest_start ? new Date(d.earliest_start).toISOString() : null,
      latest_start: d.latest_start ? new Date(d.latest_start).toISOString() : null,
      statuses: d.statuses?.split(',') || [],
      inspectors: d.inspectors?.split(',').filter(Boolean) || []
    }));

    // 감사 로그
    logger.info('DuplicateSessionsMonitoring:GET', 'Monitoring query executed', {
      userId: session.user.id,
      duplicateCount: duplicateList.length,
      totalSessions: duplicateList.reduce((sum, d) => sum + (d.session_count - 1), 0)
    });

    // 응답
    return NextResponse.json({
      success: true,
      data: {
        total: duplicateList.length,
        duplicates: duplicateList,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('DuplicateSessionsMonitoring:GET', 'Monitoring error', error instanceof Error ? error : { error });

    return NextResponse.json(
      { error: 'Failed to retrieve duplicate session information' },
      { status: 500 }
    );
  }
}
