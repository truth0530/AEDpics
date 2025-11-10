import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth/auth-options';
import { logger } from '@/lib/logger';
import { validateSessionWithUserContext } from '@/lib/inspections/session-validation';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const equipmentSerial = searchParams.get('equipmentSerial');
    const statusParam = searchParams.get('status');

    // Case 1: 특정 장비의 세션 조회 (equipmentSerial 제공)
    if (equipmentSerial) {
      const where: any = {
        equipment_serial: equipmentSerial
      };

      if (statusParam) {
        where.status = statusParam;
      }

      const session_record = await prisma.inspection_sessions.findFirst({
        where,
        include: {
          user_profiles: {
            select: {
              id: true,
              full_name: true,
              email: true
            }
          }
        },
        orderBy: {
          started_at: 'desc'
        }
      });

      return NextResponse.json({
        success: true,
        data: session_record
      });
    }

    // Case 2: 모든 활성 세션 조회 (equipmentSerial 미제공)
    // statusParam이 'active'이면 완료되지 않은 세션만, 없으면 모든 세션 반환
    const where: any = {};
    if (statusParam === 'active') {
      where.status = {
        in: ['active', 'paused'] // 완료/취소/보류 제외
      };
    }

    const sessions = await prisma.inspection_sessions.findMany({
      where,
      include: {
        user_profiles: {
          select: {
            id: true,
            full_name: true,
            email: true
          }
        }
      },
      orderBy: {
        started_at: 'desc'
      }
    });

    return NextResponse.json({
      success: true,
      sessions: sessions
    });
  } catch (error) {
    console.error('[InspectionSessions:GET]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/inspections/sessions
 * 점검 세션 생성 또는 재개 (트랜잭션 기반 race condition 방지)
 *
 * 동작:
 * - 활성 세션 없음 → 새 세션 생성 (action: 'created')
 * - 자신의 활성 세션 있음 → 세션 재개 (action: 'resumed')
 * - 다른 사람의 활성 세션 있음 → 차단 (409 Conflict)
 *
 * Race Condition 방지:
 * - Application Level: 트랜잭션 기반 원자적 검증 및 생성/재개
 * - Database Level: Partial Unique Index (equipment_serial + status IN ('active', 'paused'))
 * - 이중 방어 구현으로 완전한 race condition 방지
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { equipment_serial } = body;

  if (!equipment_serial) {
    return NextResponse.json(
      { error: 'equipment_serial is required' },
      { status: 400 }
    );
  }

  try {
    // 사용자 컨텍스트 기반 세션 검증
    // 자신의 세션은 재개 가능, 다른 사람의 세션은 차단
    const validation = await validateSessionWithUserContext(equipment_serial, session.user.id);

    // action에 따른 처리
    if (validation.action === 'block') {
      // 다른 사람의 세션이 활성 상태 → 차단
      logger.warn('InspectionSessions:POST', 'Session creation blocked - other user session active', {
        equipmentSerial: equipment_serial,
        userId: session.user.id,
        existingUserId: validation.existingSession?.inspector_id
      });

      return NextResponse.json(
        {
          success: false,
          error: validation.reason,
          existingSession: validation.existingSession
        },
        { status: 409 } // Conflict: 다른 사용자의 활성 세션 존재
      );
    }

    // 트랜잭션 내에서 세션 생성 또는 재개
    const result = await prisma.$transaction(async (tx) => {
      if (validation.action === 'create') {
        // 활성 세션 없음 → 새 세션 생성
        const newSession = await tx.inspection_sessions.create({
          data: {
            equipment_serial,
            inspector_id: session.user.id,
            status: 'active',
            current_step: 0,
            started_at: new Date()
          },
          include: {
            user_profiles: {
              select: {
                id: true,
                full_name: true,
                email: true
              }
            }
          }
        });

        return {
          sessionData: newSession,
          action: 'created',
          message: '새로운 점검 세션이 생성되었습니다.'
        };
      } else if (validation.action === 'resume') {
        // 자신의 세션 → 재개 (status를 active로 변경)
        const resumedSession = await tx.inspection_sessions.update({
          where: { id: validation.existingSession.id },
          data: { status: 'active' },
          include: {
            user_profiles: {
              select: {
                id: true,
                full_name: true,
                email: true
              }
            }
          }
        });

        return {
          sessionData: resumedSession,
          action: 'resumed',
          message: '기존 점검 세션을 재개합니다.'
        };
      }
    });

    logger.info('InspectionSessions:POST', `Session ${result.action}`, {
      sessionId: result.sessionData.id,
      equipmentSerial: equipment_serial,
      userId: session.user.id,
      action: result.action,
      message: result.message
    });

    return NextResponse.json({
      success: true,
      session: result.sessionData,
      action: result.action,
      message: result.message
    });
  } catch (error: any) {
    // 다른 에러 처리
    logger.error('InspectionSessions:POST', 'Unexpected error', error instanceof Error ? error : { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
