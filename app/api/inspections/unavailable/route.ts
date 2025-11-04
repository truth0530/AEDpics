import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/inspections/unavailable
 * 점검불가 상태의 장비 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // URL 파라미터에서 시간 범위 가져오기
    const { searchParams } = new URL(request.url);
    const hoursParam = searchParams.get('hours');
    const hours = hoursParam ? parseInt(hoursParam, 10) : 24;

    // 시간 범위 계산
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hours);

    // 점검불가 상태의 assignment 조회
    const unavailableAssignments = await prisma.inspection_assignments.findMany({
      where: {
        status: 'unavailable',
        updated_at: {
          gte: cutoffDate,
        },
      },
      select: {
        id: true,
        equipment_serial: true,
        assigned_by: true,
        notes: true,
        created_at: true,
        updated_at: true,
      },
      orderBy: {
        updated_at: 'desc',
      },
    });

    logger.info('Unavailable:GET', 'Unavailable assignments fetched', {
      count: unavailableAssignments.length,
      hours,
    });

    return NextResponse.json({
      success: true,
      unavailable: unavailableAssignments,
      count: unavailableAssignments.length,
    });
  } catch (error) {
    logger.error('Unavailable:GET', 'Error fetching unavailable assignments',
      error instanceof Error ? error : { error }
    );
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
