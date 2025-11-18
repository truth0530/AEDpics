import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/cleanup-sessions
 * 오래된 방치 세션 자동 정리 (Cron Job)
 * 
 * 동작:
 * - 마지막 접근(last_accessed_at)으로부터 30분이 지난 'active' 또는 'paused' 상태의 세션을 찾음
 * - 해당 세션들의 상태를 'cancelled'로 변경
 * - cancelled_at 타임스탬프 기록
 */
export async function GET() {
    try {
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

        // 1. 만료 대상 세션 조회 (로깅용)
        const staleSessions = await prisma.inspection_sessions.findMany({
            where: {
                status: { in: ['active', 'paused'] },
                last_accessed_at: { lt: thirtyMinutesAgo }
            },
            select: { id: true, inspector_id: true, equipment_serial: true }
        });

        if (staleSessions.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No stale sessions found',
                count: 0
            });
        }

        // 2. 세션 일괄 취소 처리
        const result = await prisma.inspection_sessions.updateMany({
            where: {
                status: { in: ['active', 'paused'] },
                last_accessed_at: { lt: thirtyMinutesAgo }
            },
            data: {
                status: 'cancelled',
                cancelled_at: new Date(),
                updated_at: new Date()
            }
        });

        // 3. 로그 기록
        logger.info('Cron:CleanupSessions', `Cleaned up ${result.count} stale sessions`, {
            count: result.count,
            sessionIds: staleSessions.map(s => s.id)
        });

        return NextResponse.json({
            success: true,
            message: `Successfully cancelled ${result.count} stale sessions`,
            count: result.count,
            details: staleSessions
        });

    } catch (error) {
        logger.error('Cron:CleanupSessions', 'Failed to cleanup sessions',
            error instanceof Error ? error : { error }
        );

        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
