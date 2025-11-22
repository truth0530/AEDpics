import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/compliance/categories
 * 구비의무기관의 category_2 고유 값 조회
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // category_2 고유 값 조회 (category_1이 구비의무기관인 경우만)
    const category2Results = await prisma.$queryRaw<Array<{ category_2: string | null }>>`
      SELECT DISTINCT category_2
      FROM management_numbers
      WHERE category_1 = '구비의무기관'
        AND category_2 IS NOT NULL
        AND category_2 != ''
        AND category_2 != '구비의무기관'
      ORDER BY category_2
    `;

    const categories = category2Results
      .filter(r => r.category_2)
      .map(r => r.category_2 as string);

    return NextResponse.json({
      success: true,
      categories
    });

  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch categories',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
