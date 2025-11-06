import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth/auth-options';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/inspections/drafts
 * 임시저장된 점검 세션 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 사용자의 임시저장된 세션 조회 (paused 상태를 draft로 취급)
    const draftSessions = await prisma.inspection_sessions.findMany({
      where: {
        inspector_id: session.user.id,
        status: 'paused',  // paused 상태를 임시저장으로 취급
      },
      include: {
        aed_data: {
          select: {
            installation_institution: true,
            installation_address: true,
            model_name: true,
            manufacturer: true,
            gugun: true,
            sido: true,
          }
        }
      },
      orderBy: {
        updated_at: 'desc'
      }
    });

    // 응답 데이터 포맷팅
    const formattedSessions = draftSessions.map(session => ({
      id: session.id,
      equipment_serial: session.equipment_serial,
      current_step: session.current_step,
      status: session.status,
      step_data: session.step_data,  // session_data가 아니라 step_data
      created_at: session.created_at,
      updated_at: session.updated_at,
      aed_info: session.aed_data ? {
        institution: session.aed_data.installation_institution,
        address: session.aed_data.installation_address,
        model: session.aed_data.model_name,
        manufacturer: session.aed_data.manufacturer,
        location: `${session.aed_data.sido || ''} ${session.aed_data.gugun || ''}`
      } : null
    }));

    return NextResponse.json({
      success: true,
      drafts: formattedSessions,
      count: formattedSessions.length
    });

  } catch (error) {
    logger.error('InspectionDrafts:GET', 'Error fetching draft sessions',
      error instanceof Error ? error : { error }
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/inspections/drafts
 * 임시저장된 점검 세션 삭제
 */
export async function DELETE(request: NextRequest) {
  try {
    // 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // 세션 소유권 확인 및 삭제
    const deletedSession = await prisma.inspection_sessions.deleteMany({
      where: {
        id: sessionId,
        inspector_id: session.user.id,
        status: 'paused'  // paused 상태를 임시저장으로 취급
      }
    });

    if (deletedSession.count === 0) {
      return NextResponse.json(
        { error: 'Draft session not found or not authorized' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '임시저장된 점검이 삭제되었습니다.'
    });

  } catch (error) {
    logger.error('InspectionDrafts:DELETE', 'Error deleting draft session',
      error instanceof Error ? error : { error }
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}