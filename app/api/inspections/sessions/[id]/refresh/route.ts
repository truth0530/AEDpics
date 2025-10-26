import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// POST /api/inspections/sessions/[id]/refresh
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;

  // 사용자 인증
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 세션 조회
  const inspectionSession = await prisma.inspection_sessions.findUnique({
    where: { id: sessionId },
    select: {
      equipment_serial: true,
      status: true,
      current_step: true,
      inspector_id: true,
      device_info: true
    }
  });

  if (!inspectionSession) {
    return NextResponse.json(
      { error: 'Session not found' },
      { status: 404 }
    );
  }

  // 권한 확인
  if (inspectionSession.inspector_id !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 점검 진행 중이면 갱신 불가
  if (inspectionSession.status === 'active' && inspectionSession.current_step > 0) {
    return NextResponse.json(
      {
        error: 'Cannot refresh during active inspection',
        message: '점검 진행 중에는 데이터를 갱신할 수 없습니다.'
      },
      { status: 400 }
    );
  }

  try {
    // 최신 데이터 조회
    const latestData = await prisma.aed_data.findUnique({
      where: { equipment_serial: inspectionSession.equipment_serial }
    });

    if (!latestData) {
      throw new Error('Failed to fetch latest data');
    }

    // 세션에 최신 데이터 업데이트
    await prisma.inspection_sessions.update({
      where: { id: sessionId },
      data: {
        device_info: latestData as any,
        updated_at: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      snapshot_updated_at: new Date().toISOString(),
      message: '갱신이 완료되었습니다.',
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Failed to refresh snapshot',
        message: err instanceof Error ? err.message : String(err)
      },
      { status: 500 }
    );
  }
}
