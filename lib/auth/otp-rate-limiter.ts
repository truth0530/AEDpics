/**
 * OTP Rate Limiter - Prisma 기반
 *
 * 정책:
 * - 15분당 최대 3회 요청
 * - 윈도우 만료 시 자동 리셋
 * - IP 우회 불가능 (이메일 기반)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MAX_REQUESTS = 3; // 15분당 최대 요청 수
const WINDOW_MINUTES = 15; // 윈도우 시간 (분)

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds?: number;
}

/**
 * OTP 요청 rate limit 확인 및 업데이트
 */
export async function checkOtpRateLimit(email: string): Promise<RateLimitResult> {
  try {
    // 현재 시간
    const now = new Date();
    const windowEnd = new Date(now.getTime() + WINDOW_MINUTES * 60 * 1000);

    // 기존 레코드 조회 (아직 유효한 윈도우만)
    const existing = await prisma.otp_rate_limits.findFirst({
      where: {
        email,
        window_expires_at: {
          gte: now
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    // 기존 윈도우가 없거나 만료됨 → 새 윈도우 생성
    if (!existing) {
      await prisma.otp_rate_limits.create({
        data: {
          id: crypto.randomUUID(),
          email,
          request_count: 1,
          first_request_at: now,
          last_request_at: now,
          window_expires_at: windowEnd
        }
      });

      return {
        allowed: true,
        remaining: MAX_REQUESTS - 1,
        resetAt: windowEnd
      };
    }

    // 기존 윈도우가 있고 아직 유효함
    const currentCount = existing.request_count;
    const expiresAt = existing.window_expires_at;

    // 제한 초과 확인
    if (currentCount >= MAX_REQUESTS) {
      const retryAfterMs = expiresAt.getTime() - now.getTime();
      const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

      return {
        allowed: false,
        remaining: 0,
        resetAt: expiresAt,
        retryAfterSeconds
      };
    }

    // 요청 카운트 증가
    await prisma.otp_rate_limits.update({
      where: {
        id: existing.id
      },
      data: {
        request_count: currentCount + 1,
        last_request_at: now,
        updated_at: now
      }
    });

    return {
      allowed: true,
      remaining: MAX_REQUESTS - currentCount - 1,
      resetAt: expiresAt
    };

  } catch (error) {
    console.error('Rate limit exception:', error);
    // 예외 발생 시 안전하게 허용 (서비스 차단 방지)
    return {
      allowed: true,
      remaining: MAX_REQUESTS - 1,
      resetAt: new Date(Date.now() + WINDOW_MINUTES * 60 * 1000)
    };
  }
}

/**
 * Rate limit 정보 조회 (요청 없이)
 */
export async function getOtpRateLimitStatus(email: string): Promise<RateLimitResult> {
  try {
    const now = new Date();

    const existing = await prisma.otp_rate_limits.findFirst({
      where: {
        email,
        window_expires_at: {
          gte: now
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    if (!existing) {
      return {
        allowed: true,
        remaining: MAX_REQUESTS,
        resetAt: new Date(Date.now() + WINDOW_MINUTES * 60 * 1000)
      };
    }

    const expiresAt = existing.window_expires_at;
    const currentCount = existing.request_count;

    if (currentCount >= MAX_REQUESTS) {
      const retryAfterMs = expiresAt.getTime() - now.getTime();
      const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

      return {
        allowed: false,
        remaining: 0,
        resetAt: expiresAt,
        retryAfterSeconds
      };
    }

    return {
      allowed: true,
      remaining: MAX_REQUESTS - currentCount,
      resetAt: expiresAt
    };

  } catch (error) {
    console.error('Get rate limit status error:', error);
    return {
      allowed: true,
      remaining: MAX_REQUESTS,
      resetAt: new Date(Date.now() + WINDOW_MINUTES * 60 * 1000)
    };
  }
}
