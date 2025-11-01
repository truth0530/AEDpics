import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { logger } from '@/lib/logger';

import { prisma } from '@/lib/prisma';
export async function POST(request: NextRequest) {
  try {
    const { email, code, password } = await request.json();

    if (!email || !code || !password) {
      return NextResponse.json(
        { error: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: '비밀번호는 최소 8자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    // 토큰 재확인
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

    // 먼저 이메일로 사용자 찾기
    const userData = await prisma.user_profiles.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!userData) {
      logger.error('UpdatePassword:POST', 'User not found', { email });
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(password, 10);

    // 비밀번호 업데이트
    try {
      await prisma.user_profiles.update({
        where: { id: userData.id },
        data: {
          password_hash: hashedPassword,
          password_changed_at: new Date(),
          must_change_password: false,
        },
      });

      logger.info('UpdatePassword:POST', 'Password updated successfully', { userId: userData.id });
    } catch (updateError) {
      logger.error('UpdatePassword:POST', 'Password update error',
        updateError instanceof Error ? updateError : { updateError }
      );
      return NextResponse.json(
        { error: '비밀번호 변경에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 사용된 토큰 삭제
    try {
      await prisma.email_verification_codes.delete({
        where: { id: verificationCode.id },
      });
    } catch (deleteError) {
      logger.error('UpdatePassword:POST', 'Token delete error',
        deleteError instanceof Error ? deleteError : { deleteError }
      );
    }

    return NextResponse.json({
      success: true,
      message: '비밀번호가 성공적으로 변경되었습니다.'
    });
  } catch (error) {
    logger.error('UpdatePassword:POST', 'Password update error',
      error instanceof Error ? error : { error }
    );
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}