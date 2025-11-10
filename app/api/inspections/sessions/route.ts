import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth/auth-options';
import { logger } from '@/lib/logger';

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
 * 새로운 점검 세션 생성 (트랜잭션 기반 race condition 방지)
 *
 * 개념 분리:
 * - '점검 시작': 세션이 없을 때만 새 세션 생성 (이 endpoint)
 * - '이어하기': 기존 세션에서 진행 (별도 endpoint)
 *
 * 동작:
 * - 활성 세션 없음 → 새 세션 생성 (성공)
 * - 활성 세션 있음 → 모두 차단 (409 Conflict) - 누구든지 새로 시작 불가
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
    // 트랜잭션 내에서 원자적(atomic) 검증 및 생성 수행
    // 이를 통해 race condition 완전 방지: 검증과 생성을 한 번에 처리
    const result = await prisma.$transaction(async (tx) => {
      // 트랜잭션 내에서 활성 세션 확인
      const existingSession = await tx.inspection_sessions.findFirst({
        where: {
          equipment_serial,
          status: { in: ['active', 'paused'] }
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

      // 활성 세션이 있으면 누구든지 차단 (점검 시작 불가)
      if (existingSession) {
        throw new Error(
          `SESSION_EXISTS|이미 진행 중인 점검 세션이 있습니다. (점검자: ${existingSession.user_profiles?.full_name || '알 수 없음'}, 시작: ${existingSession.started_at})|${existingSession.id}`
        );
      }

      // 활성 세션이 없으면 새 세션 생성
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

      return newSession;
    });

    logger.info('InspectionSessions:POST', 'New inspection session created', {
      sessionId: result.id,
      equipmentSerial: equipment_serial,
      userId: session.user.id
    });

    return NextResponse.json({
      success: true,
      session: result
    });
  } catch (error: any) {
    // 세션 이미 존재 에러 처리
    if (error.message?.startsWith('SESSION_EXISTS|')) {
      const [, errorMessage, existingSessionId] = error.message.split('|');

      logger.warn('InspectionSessions:POST', 'Session creation blocked - active session already exists', {
        equipmentSerial: equipment_serial,
        userId: session.user.id,
        existingSessionId: existingSessionId
      });

      // 차단된 경우 기존 세션 정보와 함께 응답
      const existingSession = await prisma.inspection_sessions.findUnique({
        where: { id: existingSessionId },
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

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          existingSession: existingSession
        },
        { status: 409 } // Conflict: 이미 활성 세션 존재
      );
    }

    // 다른 에러 처리
    logger.error('InspectionSessions:POST', 'Unexpected error', error instanceof Error ? error : { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
