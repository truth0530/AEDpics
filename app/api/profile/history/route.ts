import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GET /api/profile/history
 * 사용자 프로필 변경 이력 조회
 *
 * Query Parameters:
 * - page: 페이지 번호 (기본값: 1)
 * - limit: 페이지당 항목 수 (기본값: 20)
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Query Parameters 파싱
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // 3. 프로필 변경 이력 조회
    // audit_logs 테이블에서 resource_type='user_profile'이고 user_id가 본인인 것만 조회
    const [logs, total] = await Promise.all([
      prisma.audit_logs.findMany({
        where: {
          user_id: session.user.id,
          resource_type: 'user_profile'
        },
        orderBy: {
          created_at: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.audit_logs.count({
        where: {
          user_id: session.user.id,
          resource_type: 'user_profile'
        }
      })
    ]);

    return NextResponse.json({
      history: logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('[GET /api/profile/history] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
