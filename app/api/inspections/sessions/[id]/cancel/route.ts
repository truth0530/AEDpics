import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth/auth-options';
import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api/error-handler';
import { logger } from '@/lib/logger';

import { prisma } from '@/lib/prisma';
/**
 * POST /api/inspections/sessions/[id]/cancel
 * 점검 세션 취소 (Soft Delete)
 */
// @ts-expect-error - apiHandler type issue with dynamic routes
export const POST = apiHandler(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id: sessionId } = await params;

  // 인증 확인
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 요청 본문 파싱
  const body = await request.json();
  const { reason } = body;

  // 세션 조회 (본인 세션인지 확인)
  const inspectionSession = await prisma.inspection_sessions.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      inspector_id: true,
      equipment_serial: true,
      status: true,
      notes: true
    }
  });

  if (!inspectionSession) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // 권한 확인: 본인만 취소 가능
  if (inspectionSession.inspector_id !== session.user.id) {
    return NextResponse.json({ error: 'Only the session owner can cancel it' }, { status: 403 });
  }

  // 이미 완료된 세션은 취소 불가
  if (inspectionSession.status === 'completed') {
    return NextResponse.json(
      { error: 'Cannot cancel a completed session. Use deletion API instead.' },
      { status: 400 }
    );
  }

  // Soft Delete: status를 'cancelled'로 변경
  try {
    await prisma.inspection_sessions.update({
      where: { id: sessionId },
      data: {
        status: 'cancelled',
        cancelled_at: new Date(),
        notes: reason ? `취소 사유: ${reason}` : inspectionSession.notes,
        updated_at: new Date()
      }
    });
  } catch (updateError) {
    logger.error('InspectionSessionCancel:POST', 'Update error',
      updateError instanceof Error ? updateError : { updateError }
    );
    return NextResponse.json({ error: 'Failed to cancel session' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: '점검 세션이 취소되었습니다.',
  });
});
