/**
 * OTP (One-Time Password) Utilities
 *
 * 이메일 인증 코드 생성 및 검증
 * - 6자리 숫자 코드
 * - 10분 유효 기간
 * - 사용 후 자동 무효화
 */

import { prisma } from '@/lib/db/prisma';
import { generateOTP, sendOTPEmail } from '@/lib/email/mailer';

const OTP_EXPIRATION_MINUTES = 10;

/**
 * OTP 코드 생성 및 이메일 발송
 */
export async function createAndSendOTP(email: string): Promise<boolean> {
  try {
    // 기존 OTP 삭제 (같은 이메일)
    await prisma.emailVerificationCode.deleteMany({
      where: {
        email,
        used: false,
        expiresAt: { lt: new Date() }, // 만료된 것만
      },
    });

    // 새 OTP 생성
    const code = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000);

    // 데이터베이스에 저장
    await prisma.emailVerificationCode.create({
      data: {
        email,
        code,
        expiresAt,
        used: false,
      },
    });

    // 이메일 발송
    const sent = await sendOTPEmail(email, code, OTP_EXPIRATION_MINUTES);

    if (!sent) {
      console.error('[OTP] Failed to send email to:', email);
      return false;
    }

    console.log(`[OTP] Code generated and sent to ${email}`);
    return true;
  } catch (error) {
    console.error('[OTP] Failed to create and send OTP:', error);
    return false;
  }
}

/**
 * OTP 코드 검증
 */
export async function verifyOTP(email: string, code: string): Promise<boolean> {
  try {
    // 코드 조회
    const otpRecord = await prisma.emailVerificationCode.findFirst({
      where: {
        email,
        code,
        used: false,
        expiresAt: { gte: new Date() }, // 유효 기간 내
      },
    });

    if (!otpRecord) {
      console.log('[OTP] Invalid or expired code for:', email);
      return false;
    }

    // 코드 사용 처리
    await prisma.emailVerificationCode.update({
      where: { id: otpRecord.id },
      data: { used: true },
    });

    // 사용자 이메일 인증 완료
    await prisma.user.updateMany({
      where: { email },
      data: { emailVerified: true },
    });

    console.log(`[OTP] Email verified successfully: ${email}`);
    return true;
  } catch (error) {
    console.error('[OTP] Verification failed:', error);
    return false;
  }
}

/**
 * OTP 재발송
 */
export async function resendOTP(email: string): Promise<boolean> {
  // 기존 미사용 OTP 삭제
  await prisma.emailVerificationCode.deleteMany({
    where: {
      email,
      used: false,
    },
  });

  // 새 OTP 생성 및 발송
  return await createAndSendOTP(email);
}

/**
 * 만료된 OTP 정리 (Cron Job용)
 */
export async function cleanupExpiredOTPs(): Promise<number> {
  try {
    const result = await prisma.emailVerificationCode.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    console.log(`[OTP] Cleaned up ${result.count} expired codes`);
    return result.count;
  } catch (error) {
    console.error('[OTP] Cleanup failed:', error);
    return 0;
  }
}

/**
 * OTP 전송 가능 여부 확인 (Rate Limiting)
 */
export async function canSendOTP(email: string): Promise<{ can: boolean; retryAfter?: number }> {
  // 최근 1분 내 발송 횟수 확인
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

  const recentCount = await prisma.emailVerificationCode.count({
    where: {
      email,
      createdAt: { gte: oneMinuteAgo },
    },
  });

  if (recentCount >= 3) {
    return {
      can: false,
      retryAfter: 60, // 60초 후 재시도
    };
  }

  return { can: true };
}
