import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/monitoring/duplicate-schedules
 * 중복 점검 일정 모니터링
 *
 * 목적:
 * - 운영팀이 중복 일정 현황을 파악하기 위한 API
 * - ±30분 윈도우 범위 내의 일정들을 감지
 * - Cron job으로 정기적 호출 (예: 일 1회)
 * - Slack 알림 연동 가능
 *
 * 정의:
 * - 중복: 같은 장비(aed_data_id)에서 예약 시간(scheduled_for) 기준 ±30분 범위에 여러 일정
 * - 주의: 이는 경고일 뿐이며, transaction 기반 검증에 의해 중복 생성은 이미 방지됨
 *
 * 응답:
 * - total: 중복이 있는 시간대 수
 * - conflicts: 시간 범위가 겹치는 일정 그룹
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
      logger.warn('DuplicateSchedulesMonitoring:GET', 'Non-master user attempted access', {
        userId: session.user.id,
        role: userProfile?.role
      });

      return NextResponse.json(
        { error: 'Forbidden: Only master administrators can access this endpoint' },
        { status: 403 }
      );
    }

    // 활성 일정 조회 (취소되지 않은 것만)
    const schedules = await prisma.inspection_schedules.findMany({
      where: {
        status: { not: 'cancelled' }
      },
      select: {
        id: true,
        aed_data_id: true,
        equipment_serial: true,
        scheduled_for: true,
        priority: true,
        status: true,
        aed_data: {
          select: {
            sido: true,
            gugun: true,
            installation_address: true
          }
        },
        user_profiles: {
          select: {
            full_name: true,
            email: true
          }
        }
      },
      orderBy: {
        scheduled_for: 'asc'
      }
    });

    // 중복 감지: ±30분 윈도우 기반 충돌 찾기
    const conflicts: Array<any> = [];
    const WINDOW_MINUTES = 30;

    for (let i = 0; i < schedules.length; i++) {
      const current = schedules[i];
      const currentTime = new Date(current.scheduled_for);
      const windowStart = new Date(currentTime);
      windowStart.setMinutes(windowStart.getMinutes() - WINDOW_MINUTES);
      const windowEnd = new Date(currentTime);
      windowEnd.setMinutes(windowEnd.getMinutes() + WINDOW_MINUTES);

      // 같은 장비에서 윈도우 범위 내의 다른 일정 찾기
      const conflicting = schedules.filter((s, idx) => {
        if (idx === i) return false; // 자신 제외
        if (s.aed_data_id !== current.aed_data_id) return false; // 다른 장비 제외

        const sTime = new Date(s.scheduled_for);
        return sTime >= windowStart && sTime < windowEnd;
      });

      if (conflicting.length > 0) {
        // 이미 등록된 충돌 그룹이 있는지 확인
        const existingConflict = conflicts.find(
          c =>
            c.equipment_serial === current.equipment_serial &&
            c.schedule_ids.includes(current.id)
        );

        if (!existingConflict) {
          conflicts.push({
            equipment_serial: current.equipment_serial,
            aed_data_id: current.aed_data_id,
            location: current.aed_data
              ? `${current.aed_data.sido || ''} ${current.aed_data.gugun || ''}`
              : 'N/A',
            window: {
              start: windowStart.toISOString(),
              end: windowEnd.toISOString(),
              minutes: WINDOW_MINUTES * 2 // 전체 윈도우 범위
            },
            schedule_ids: [current.id, ...conflicting.map(c => c.id)],
            schedules: [
              {
                id: current.id,
                scheduled_for: current.scheduled_for,
                status: current.status,
                priority: current.priority,
                assigned_to: current.user_profiles?.full_name || 'Unassigned'
              },
              ...conflicting.map(c => ({
                id: c.id,
                scheduled_for: c.scheduled_for,
                status: c.status,
                priority: c.priority,
                assigned_to: c.user_profiles?.full_name || 'Unassigned'
              }))
            ]
          });
        }
      }
    }

    // 감사 로그
    logger.info('DuplicateSchedulesMonitoring:GET', 'Monitoring query executed', {
      userId: session.user.id,
      conflictCount: conflicts.length,
      totalSchedules: schedules.length
    });

    // 응답
    return NextResponse.json({
      success: true,
      data: {
        total: conflicts.length,
        conflicts: conflicts,
        summary: {
          total_schedules: schedules.length,
          conflicting_schedules: conflicts.reduce((sum, c) => sum + c.schedule_ids.length, 0),
          affected_equipment: new Set(conflicts.map(c => c.equipment_serial)).size
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('DuplicateSchedulesMonitoring:GET', 'Monitoring error', error instanceof Error ? error : { error });

    return NextResponse.json(
      { error: 'Failed to retrieve duplicate schedule information' },
      { status: 500 }
    );
  }
}
