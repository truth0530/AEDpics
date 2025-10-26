import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

export const POST = async (request: NextRequest) => {
  try {
    // NextAuth 세션 확인
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '인증되지 않은 사용자입니다.' },
        { status: 401 }
      );
    }

    // 헤더에서 추가 정보 가져오기
    const headers = request.headers;
    const userAgent = headers.get('user-agent') || 'Unknown';
    const ip = headers.get('x-forwarded-for') || headers.get('x-real-ip') || 'Unknown';

    // 1. 로그인 이력 기록
    await prisma.login_history.create({
      data: {
        id: randomUUID(),
        user_id: session.user.id,
        success: true,
        ip_address: ip,
        user_agent: userAgent
      }
    });

    // 2. user_profiles 업데이트 (last_login_at, login_count 증가)
    const updatedProfile = await prisma.user_profiles.update({
      where: { id: session.user.id },
      data: {
        last_login_at: new Date(),
        login_count: {
          increment: 1
        },
        updated_at: new Date()
      },
      select: {
        login_count: true,
        last_login_at: true
      }
    });

    return NextResponse.json({
      success: true,
      login_count: updatedProfile.login_count,
      last_login_at: updatedProfile.last_login_at
    });

  } catch (error) {
    console.error('Error tracking login:', error);
    return NextResponse.json(
      { error: '로그인 기록 실패' },
      { status: 500 }
    );
  }
};
