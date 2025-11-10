import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth/auth-options';
import { validateInspectionSessionCreation } from '@/lib/inspections/session-validation';
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
 * 새로운 점검 세션 생성 (재발 방지: 중복 세션 체크)
 */
export async function POST(request: NextRequest) {
  try {
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

    // 재발 방지: 이미 활성 세션이 있는지 확인
    const validation = await validateInspectionSessionCreation(equipment_serial);

    if (!validation.allowed) {
      logger.warn('InspectionSessions:POST', 'Session creation blocked - duplicate session exists', {
        equipmentSerial: equipment_serial,
        reason: validation.reason,
        userId: session.user.id
      });

      return NextResponse.json(
        {
          success: false,
          error: validation.reason || '점검 세션을 생성할 수 없습니다.',
          existingSession: validation.existingSession
        },
        { status: 409 } // Conflict: 같은 장비에 이미 세션이 있음
      );
    }

    // 새 세션 생성
    const newSession = await prisma.inspection_sessions.create({
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

    logger.info('InspectionSessions:POST', 'Session created successfully', {
      sessionId: newSession.id,
      equipmentSerial: equipment_serial,
      userId: session.user.id
    });

    return NextResponse.json({
      success: true,
      session: newSession
    });
  } catch (error) {
    logger.error('InspectionSessions:POST', 'Session creation error', error instanceof Error ? error : { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
