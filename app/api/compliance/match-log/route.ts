import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

/**
 * GET /api/compliance/match-log
 * 의무설치기관의 매칭/해제 이력 조회
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const targetKey = searchParams.get('target_key');
    const year = searchParams.get('year');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // 기본 where 조건
    const where: any = {};

    if (targetKey) {
      where.target_key = targetKey;
    }

    if (year) {
      where.target_list_year = parseInt(year);
    }

    // 전체 개수 조회
    const total = await prisma.target_list_match_logs.count({ where });

    // 로그 조회 (사용자 정보 포함)
    const logs = await prisma.target_list_match_logs.findMany({
      where,
      include: {
        user: {
          select: {
            full_name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      take: limit,
      skip: offset,
    });

    // 응답 포맷 정리
    const formattedLogs = logs.map((log) => ({
      id: log.id,
      action: log.action,
      target_list_year: log.target_list_year,
      target_key: log.target_key,
      management_numbers: log.management_numbers,
      user: {
        name: log.user.full_name,
        email: log.user.email,
        role: log.user.role,
      },
      reason: log.reason,
      created_at: log.created_at,
    }));

    return NextResponse.json({
      logs: formattedLogs,
      total,
      limit,
      offset,
    });

  } catch (error) {
    console.error('Failed to fetch match logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch match logs', details: String(error) },
      { status: 500 }
    );
  }
}
