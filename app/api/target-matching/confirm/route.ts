import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth/auth-options';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { managementNumber, year = '2024' } = body;

    if (!managementNumber) {
      return NextResponse.json(
        { error: 'Management number is required' },
        { status: 400 }
      );
    }

    // 2025년은 아직 준비 중
    if (year === '2025') {
      return NextResponse.json(
        { error: '2025년 데이터는 준비 중입니다' },
        { status: 404 }
      );
    }

    // Get current user from NextAuth
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Update the mapping to confirmed
    const updatedMapping = await prisma.management_number_group_mapping.update({
      where: {
        management_number: managementNumber,
      },
      data: {
        confirmed_2024: true,
        confirmed_by_2024: session.user.id,
        confirmed_at_2024: new Date(),
        updated_at: new Date(),
      },
    });

    if (!updatedMapping) {
      return NextResponse.json(
        { error: 'Mapping not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedMapping
    });
  } catch (error) {
    console.error('Failed to confirm matching:', error);
    return NextResponse.json(
      { error: 'Failed to confirm matching' },
      { status: 500 }
    );
  }
}
