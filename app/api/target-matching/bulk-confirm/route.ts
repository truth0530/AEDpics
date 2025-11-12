import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth/auth-options';
import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { year = '2025' } = body || {};
    const yearSuffix = year === '2025' ? '_2025' : '_2024';

    // Get current user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all high confidence (>=90) unconfirmed mappings
    const highConfidenceMappings = await prisma.management_number_group_mapping.findMany({
      where: {
        [`auto_confidence${yearSuffix}`]: { gte: 90 },
        [`confirmed${yearSuffix}`]: false,
      },
      select: {
        management_number: true,
      },
    });

    let confirmedCount = 0;

    // Confirm each one using updateMany for better performance
    if (highConfidenceMappings.length > 0) {
      const managementNumbers = highConfidenceMappings.map(m => m.management_number).filter(Boolean) as string[];

      const result = await prisma.management_number_group_mapping.updateMany({
        where: {
          management_number: { in: managementNumbers },
          [`confirmed${yearSuffix}`]: false,
        },
        data: {
          [`confirmed${yearSuffix}`]: true,
          [`confirmed_by${yearSuffix}`]: session.user.id,
          [`confirmed_at${yearSuffix}`]: new Date(),
        },
      });

      confirmedCount = result.count;
    }

    return NextResponse.json({
      success: true,
      confirmed_count: confirmedCount,
      total_attempted: highConfidenceMappings.length,
    });
  } catch (error) {
    console.error('Failed to bulk confirm matchings:', error);
    return NextResponse.json(
      { error: 'Failed to bulk confirm matchings' },
      { status: 500 }
    );
  }
}
