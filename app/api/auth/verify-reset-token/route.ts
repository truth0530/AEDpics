import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json(
        { error: '이메일과 인증 코드를 입력해주세요.' },
        { status: 400 }
      );
    }

    // 토큰 확인
    const verificationCode = await prisma.email_verification_codes.findFirst({
      where: {
        email,
        code,
        expires_at: { gte: new Date() },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    if (!verificationCode) {
      return NextResponse.json(
        { error: '유효하지 않거나 만료된 인증 코드입니다.' },
        { status: 400 }
      );
    }

    // 인증 성공 - 코드만 확인하고 성공 반환
    return NextResponse.json({
      success: true,
      message: '인증 코드가 확인되었습니다.',
      verified: true
    });
  } catch (error) {
    console.error('비밀번호 재설정 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}