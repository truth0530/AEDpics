/**
 * Rate Limiter Utility
 * IP 기반 간단한 인메모리 rate limiting
 * 프로덕션에서는 Redis 사용 권장
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // 10분마다 만료된 엔트리 정리
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 10 * 60 * 1000);
  }

  /**
   * Rate limit 체크
   * @param key - 제한 키 (IP 주소 또는 사용자 ID)
   * @param config - Rate limit 설정
   * @returns {allowed: boolean, remaining: number, resetAt: number}
   */
  check(key: string, config: RateLimitConfig): {
    allowed: boolean;
    remaining: number;
    resetAt: number;
  } {
    const now = Date.now();
    const entry = this.store.get(key);

    // 엔트리가 없거나 만료됨
    if (!entry || now >= entry.resetAt) {
      const resetAt = now + config.windowMs;
      this.store.set(key, { count: 1, resetAt });
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetAt,
      };
    }

    // 요청 횟수 증가
    entry.count++;
    this.store.set(key, entry);

    const allowed = entry.count <= config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - entry.count);

    return {
      allowed,
      remaining,
      resetAt: entry.resetAt,
    };
  }

  /**
   * 특정 키의 카운트 초기화
   */
  reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * 만료된 엔트리 정리
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetAt) {
        this.store.delete(key);
      }
    }
  }

  /**
   * 정리 작업 중지 (테스트용)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// 싱글톤 인스턴스
const rateLimiter = new RateLimiter();

/**
 * Rate limit 설정 프리셋
 */
export const RATE_LIMIT_PRESETS = {
  // 인증: 5분에 5회
  AUTH: { maxRequests: 5, windowMs: 5 * 60 * 1000 },

  // 회원가입: 10분에 5회
  SIGNUP: { maxRequests: 5, windowMs: 10 * 60 * 1000 },

  // 파일 업로드: 1분에 10회
  UPLOAD: { maxRequests: 10, windowMs: 60 * 1000 },

  // 일반 API: 1분에 60회
  API: { maxRequests: 60, windowMs: 60 * 1000 },

  // 비밀번호 재설정: 10분에 3회
  PASSWORD_RESET: { maxRequests: 3, windowMs: 10 * 60 * 1000 },

  // OTP 전송: 5분에 3회
  OTP: { maxRequests: 3, windowMs: 5 * 60 * 1000 },
} as const;

/**
 * IP 주소 추출 (프록시 고려)
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  return 'unknown';
}

/**
 * Rate limit 체크 (싱글톤 인스턴스 사용)
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  return rateLimiter.check(key, config);
}

/**
 * Rate limit 초기화
 */
export function resetRateLimit(key: string): void {
  rateLimiter.reset(key);
}

/**
 * Rate limiter 인스턴스 export (테스트용)
 */
export { rateLimiter };
