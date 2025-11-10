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
    const status = searchParams.get('status');

    if (!equipmentSerial) {
      return NextResponse.json(
        { error: 'Equipment serial is required' },
        { status: 400 }
      );
    }

    // 조건 구성
    const where: any = {
      equipment_serial: equipmentSerial
    };

    if (status) {
      where.status = status;
    }

    // 가장 최근의 세션 조회
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
  } catch (error) {
    console.error('[InspectionSessions:GET]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
