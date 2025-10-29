/**
 * Email Rate Limiter
 *
 * NCP Cloud Outbound Mailer 스팸 필터 차단 방지를 위한 이메일 발송 빈도 제한
 *
 * 차단 방지 전략:
 * 1. 수신자별 빈도 제한 (개별 이메일 과다 발송 방지)
 * 2. 도메인별 빈도 제한 (같은 도메인 연속 발송 방지)
 * 3. 쿨다운 메커니즘 (연속 발송 패턴 차단)
 *
 * 참고: lib/auth/otp-rate-limiter.ts는 OTP 요청 횟수만 제한
 *       이 파일은 실제 이메일 발송 빈도를 제한
 */

import { prisma } from '@/lib/prisma';

/**
 * Rate Limiting 설정
 */
export const EMAIL_RATE_LIMITS = {
  /** 수신자당 일일 최대 발송 횟수 */
  MAX_PER_RECIPIENT_PER_DAY: 10,

  /** 수신자당 시간당 최대 발송 횟수 */
  MAX_PER_RECIPIENT_PER_HOUR: 3,

  /** 같은 도메인으로 5분 내 최대 발송 횟수 (NCP 스팸 필터 회피) */
  MAX_SAME_DOMAIN_PER_5MIN: 2,

  /** 같은 수신자에게 연속 발송 시 최소 대기 시간 (분) */
  COOLDOWN_MINUTES: 5
} as const;

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  resetAt?: Date;
  retryAfterSeconds?: number;
  remaining?: number;
}

/**
 * 이메일 도메인 추출
 */
function extractDomain(email: string): string {
  const match = email.match(/@(.+)$/);
  return match ? match[1].toLowerCase() : '';
}

/**
 * 수신자별 일일 발송 횟수 체크
 */
async function checkDailyLimit(email: string): Promise<RateLimitResult> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const count = await prisma.email_verification_codes.count({
    where: {
      email,
      created_at: {
        gte: today
      }
    }
  });

  if (count >= EMAIL_RATE_LIMITS.MAX_PER_RECIPIENT_PER_DAY) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return {
      allowed: false,
      reason: `일일 이메일 발송 한도 초과 (${EMAIL_RATE_LIMITS.MAX_PER_RECIPIENT_PER_DAY}회). 내일 다시 시도해주세요.`,
      resetAt: tomorrow,
      retryAfterSeconds: Math.ceil((tomorrow.getTime() - Date.now()) / 1000),
      remaining: 0
    };
  }

  return {
    allowed: true,
    remaining: EMAIL_RATE_LIMITS.MAX_PER_RECIPIENT_PER_DAY - count
  };
}

/**
 * 수신자별 시간당 발송 횟수 체크
 */
async function checkHourlyLimit(email: string): Promise<RateLimitResult> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const count = await prisma.email_verification_codes.count({
    where: {
      email,
      created_at: {
        gte: oneHourAgo
      }
    }
  });

  if (count >= EMAIL_RATE_LIMITS.MAX_PER_RECIPIENT_PER_HOUR) {
    const nextHour = new Date(Date.now() + 60 * 60 * 1000);

    // 가장 오래된 이메일의 1시간 후 계산
    const oldestEmail = await prisma.email_verification_codes.findFirst({
      where: {
        email,
        created_at: {
          gte: oneHourAgo
        }
      },
      orderBy: {
        created_at: 'asc'
      }
    });

    const actualResetAt = oldestEmail
      ? new Date(oldestEmail.created_at.getTime() + 60 * 60 * 1000)
      : nextHour;

    return {
      allowed: false,
      reason: `시간당 이메일 발송 한도 초과 (${EMAIL_RATE_LIMITS.MAX_PER_RECIPIENT_PER_HOUR}회). ${Math.ceil((actualResetAt.getTime() - Date.now()) / 60000)}분 후 다시 시도해주세요.`,
      resetAt: actualResetAt,
      retryAfterSeconds: Math.ceil((actualResetAt.getTime() - Date.now()) / 1000),
      remaining: 0
    };
  }

  return {
    allowed: true,
    remaining: EMAIL_RATE_LIMITS.MAX_PER_RECIPIENT_PER_HOUR - count
  };
}

/**
 * 쿨다운 체크 (같은 수신자에게 연속 발송 방지)
 */
async function checkCooldown(email: string): Promise<RateLimitResult> {
  const cooldownTime = new Date(Date.now() - EMAIL_RATE_LIMITS.COOLDOWN_MINUTES * 60 * 1000);

  const recentCode = await prisma.email_verification_codes.findFirst({
    where: {
      email,
      created_at: {
        gte: cooldownTime
      }
    },
    orderBy: {
      created_at: 'desc'
    }
  });

  if (recentCode) {
    const resetAt = new Date(
      recentCode.created_at.getTime() + EMAIL_RATE_LIMITS.COOLDOWN_MINUTES * 60 * 1000
    );
    const waitSeconds = Math.ceil((resetAt.getTime() - Date.now()) / 1000);

    return {
      allowed: false,
      reason: `이메일 발송 후 ${EMAIL_RATE_LIMITS.COOLDOWN_MINUTES}분 대기 필요. ${Math.ceil(waitSeconds / 60)}분 후 다시 시도해주세요.`,
      resetAt,
      retryAfterSeconds: waitSeconds,
      remaining: 0
    };
  }

  return {
    allowed: true
  };
}

/**
 * 같은 도메인으로 5분 내 발송 횟수 체크 (NCP 스팸 필터 회피)
 */
async function checkDomainFrequency(email: string): Promise<RateLimitResult> {
  const domain = extractDomain(email);
  if (!domain) {
    return { allowed: true };
  }

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  // 같은 도메인으로 발송된 이메일 수 확인
  const domainPattern = `%@${domain}`;

  const count = await prisma.email_verification_codes.count({
    where: {
      email: {
        contains: domainPattern
      },
      created_at: {
        gte: fiveMinutesAgo
      }
    }
  });

  if (count >= EMAIL_RATE_LIMITS.MAX_SAME_DOMAIN_PER_5MIN) {
    const resetAt = new Date(Date.now() + 5 * 60 * 1000);

    // 가장 오래된 이메일의 5분 후 계산
    const oldestEmail = await prisma.email_verification_codes.findFirst({
      where: {
        email: {
          contains: domainPattern
        },
        created_at: {
          gte: fiveMinutesAgo
        }
      },
      orderBy: {
        created_at: 'asc'
      }
    });

    const actualResetAt = oldestEmail
      ? new Date(oldestEmail.created_at.getTime() + 5 * 60 * 1000)
      : resetAt;

    return {
      allowed: false,
      reason: `@${domain} 도메인으로 5분 내 발송 한도 초과 (${EMAIL_RATE_LIMITS.MAX_SAME_DOMAIN_PER_5MIN}회). NCP 스팸 필터 방지를 위해 ${Math.ceil((actualResetAt.getTime() - Date.now()) / 60000)}분 후 다시 시도해주세요.`,
      resetAt: actualResetAt,
      retryAfterSeconds: Math.ceil((actualResetAt.getTime() - Date.now()) / 1000),
      remaining: 0
    };
  }

  return {
    allowed: true,
    remaining: EMAIL_RATE_LIMITS.MAX_SAME_DOMAIN_PER_5MIN - count
  };
}

/**
 * 모든 Rate Limiting 규칙 체크
 *
 * 체크 순서:
 * 1. 도메인 빈도 (NCP 스팸 필터 회피)
 * 2. 수신자 일일 한도
 * 3. 수신자 시간당 한도
 * 4. 쿨다운
 *
 * @param email 수신자 이메일 주소
 * @returns Rate Limiting 결과
 */
export async function checkEmailRateLimit(email: string): Promise<RateLimitResult> {
  // 1. 도메인 빈도 체크 (NCP 스팸 필터 회피 - 중요!)
  const domainCheck = await checkDomainFrequency(email);
  if (!domainCheck.allowed) {
    return domainCheck;
  }

  // 2. 수신자별 일일 한도 체크
  const dailyCheck = await checkDailyLimit(email);
  if (!dailyCheck.allowed) {
    return dailyCheck;
  }

  // 3. 수신자별 시간당 한도 체크
  const hourlyCheck = await checkHourlyLimit(email);
  if (!hourlyCheck.allowed) {
    return hourlyCheck;
  }

  // 4. 쿨다운 체크
  const cooldownCheck = await checkCooldown(email);
  if (!cooldownCheck.allowed) {
    return cooldownCheck;
  }

  // 모든 체크 통과
  return {
    allowed: true,
    remaining: Math.min(
      dailyCheck.remaining || 0,
      hourlyCheck.remaining || 0,
      domainCheck.remaining || 0
    )
  };
}

/**
 * Rate Limiting 통계 조회
 */
export async function getEmailRateLimitStats(email: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const domain = extractDomain(email);

  const [dailyCount, hourlyCount, domainCount] = await Promise.all([
    // 일일 발송 수
    prisma.email_verification_codes.count({
      where: {
        email,
        created_at: { gte: today }
      }
    }),

    // 시간당 발송 수
    prisma.email_verification_codes.count({
      where: {
        email,
        created_at: { gte: oneHourAgo }
      }
    }),

    // 도메인별 5분 내 발송 수
    prisma.email_verification_codes.count({
      where: {
        email: { contains: `%@${domain}` },
        created_at: { gte: fiveMinutesAgo }
      }
    })
  ]);

  return {
    email,
    domain,
    daily: {
      count: dailyCount,
      limit: EMAIL_RATE_LIMITS.MAX_PER_RECIPIENT_PER_DAY,
      remaining: EMAIL_RATE_LIMITS.MAX_PER_RECIPIENT_PER_DAY - dailyCount
    },
    hourly: {
      count: hourlyCount,
      limit: EMAIL_RATE_LIMITS.MAX_PER_RECIPIENT_PER_HOUR,
      remaining: EMAIL_RATE_LIMITS.MAX_PER_RECIPIENT_PER_HOUR - hourlyCount
    },
    domainFiveMin: {
      count: domainCount,
      limit: EMAIL_RATE_LIMITS.MAX_SAME_DOMAIN_PER_5MIN,
      remaining: EMAIL_RATE_LIMITS.MAX_SAME_DOMAIN_PER_5MIN - domainCount
    }
  };
}
