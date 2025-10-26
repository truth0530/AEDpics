import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { PrismaClient } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { year = '2024' } = body;

    // 2025년은 아직 준비 중
    if (year === '2025') {
      return NextResponse.json(
        { error: '2025년 데이터는 준비 중입니다' },
        { status: 404 }
      );
    }

    // Get current user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all high confidence (>=90) unconfirmed mappings (2024년 데이터)
    const highConfidenceMappings = await prisma.management_number_group_mapping.findMany({
      where: {
        auto_confidence_2024: { gte: 90 },
        confirmed_2024: false,
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
          confirmed_2024: false,
        },
        data: {
          confirmed_2024: true,
          confirmed_by_2024: session.user.id,
          confirmed_at_2024: new Date(),
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
