import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth/auth-options';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

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

    // hours 파라미터 파싱 (기본값: 24시간)
    const hours = parseInt(request.nextUrl.searchParams.get('hours') || '24');

    // cutoff 날짜 계산
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hours);

    // 최근 완료된 점검 조회
    const inspections = await prisma.inspections.findMany({
      where: {
        inspection_date: {
          gte: cutoffDate
        },
        overall_status: {
          in: ['normal', 'needs_improvement', 'malfunction']
        }
      },
      select: {
        equipment_serial: true,
        inspection_date: true,
        overall_status: true
      },
      orderBy: {
        inspection_date: 'desc'
      }
    });

    return NextResponse.json({
      inspections,
      count: inspections.length,
      cutoffDate: cutoffDate.toISOString()
    });

  } catch (error) {
    logger.error('InspectionCompleted:GET', 'Completed inspections error',
      error instanceof Error ? error : { error }
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}