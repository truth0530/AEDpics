import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

    // 사용자 프로필 조회 (organization 포함)
    const userProfile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id }
    });

    if (!userProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    // 조직 정보 조회 (별도 쿼리)
    let organization = null;
    if (userProfile.organization_id) {
      organization = await prisma.organizations.findUnique({
        where: { id: userProfile.organization_id },
        select: {
          id: true,
          name: true,
          type: true,
          region_code: true,
          city_code: true,
          latitude: true,
          longitude: true
        }
      });
    }

    return NextResponse.json({
      ...userProfile,
      organization
    });

  } catch (error) {
    console.error('User profile API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
