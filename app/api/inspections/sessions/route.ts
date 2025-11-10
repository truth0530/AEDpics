import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth/auth-options';

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
