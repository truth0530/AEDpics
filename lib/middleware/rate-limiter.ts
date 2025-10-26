/**
 * Rate Limiter Middleware
 *
 * Vercel KV (Redis)를 사용한 요청 제한
 * - IP 기반 rate limiting
 * - 사용자 ID 기반 rate limiting
 * - 엔드포인트별 다른 limit 설정
 */

import { kv } from '@vercel/kv';
import { NextRequest, NextResponse } from 'next/server';

export interface RateLimitConfig {
  /**
   * 시간 창 내 최대 요청 수
   */
  maxRequests: number;

  /**
   * 시간 창 (초 단위)
   * @example 60 = 1분, 3600 = 1시간
   */
  windowSeconds: number;

  /**
   * Rate limit 식별자 키
   * @example "api:aed-data", "api:auth"
   */
  key: string;
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp (seconds)
}

/**
 * Rate Limit 체크 및 응답 헤더 설정
 */
export async function checkRateLimit(
  identifier: string, // IP 주소 또는 사용자 ID
  config: RateLimitConfig
): Promise<RateLimitResult> {
  // Vercel KV가 설정되지 않은 경우 (로컬 개발 환경)
  if (!process.env.KV_REST_API_URL) {
    console.log('[Rate Limiter] KV not configured, allowing all requests');
    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests,
      reset: Math.floor(Date.now() / 1000) + config.windowSeconds,
    };
  }

  try {
    const key = `ratelimit:${config.key}:${identifier}`;
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - config.windowSeconds;

    // 현재 요청 카운트 조회
    const currentCount = await kv.get<number>(key);

    if (currentCount === null) {
      // 첫 요청
      await kv.set(key, 1, { ex: config.windowSeconds });

      return {
        success: true,
        limit: config.maxRequests,
        remaining: config.maxRequests - 1,
        reset: now + config.windowSeconds,
      };
    }

    if (currentCount >= config.maxRequests) {
      // Rate limit 초과
      const ttl = await kv.ttl(key);
      const reset = now + (ttl > 0 ? ttl : config.windowSeconds);

      return {
        success: false,
        limit: config.maxRequests,
        remaining: 0,
        reset,
      };
    }

    // 요청 카운트 증가
    await kv.incr(key);

    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - currentCount - 1,
      reset: now + config.windowSeconds,
    };
  } catch (error) {
    console.error('[Rate Limiter] Error checking rate limit:', error);

    // Redis 오류 시 요청 허용 (Fail open)
    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests,
      reset: Math.floor(Date.now() / 1000) + config.windowSeconds,
    };
  }
}

/**
 * Rate Limit 응답 헤더 추가
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  response.headers.set('X-RateLimit-Limit', result.limit.toString());
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
  response.headers.set('X-RateLimit-Reset', result.reset.toString());

  return response;
}

/**
 * Rate Limit 초과 응답 생성
 */
export function createRateLimitResponse(result: RateLimitResult): NextResponse {
  const resetDate = new Date(result.reset * 1000);
  const retryAfter = result.reset - Math.floor(Date.now() / 1000);

  const response = NextResponse.json(
    {
      error: 'Too Many Requests',
      message: `요청 횟수 제한을 초과했습니다. ${resetDate.toLocaleTimeString('ko-KR')}에 다시 시도해주세요.`,
      retryAfter,
    },
    { status: 429 }
  );

  response.headers.set('X-RateLimit-Limit', result.limit.toString());
  response.headers.set('X-RateLimit-Remaining', '0');
  response.headers.set('X-RateLimit-Reset', result.reset.toString());
  response.headers.set('Retry-After', retryAfter.toString());

  return response;
}

/**
 * 요청에서 식별자 추출 (IP 주소)
 */
export function getIdentifier(request: NextRequest): string {
  // Vercel에서는 x-forwarded-for 헤더 사용
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';

  return ip;
}

/**
 * 엔드포인트별 Rate Limit 설정
 */
export const RATE_LIMIT_CONFIGS = {
  // AED 데이터 조회 API: 분당 30회
  'aed-data': {
    maxRequests: 30,
    windowSeconds: 60,
    key: 'api:aed-data',
  },

  // 인증 API: 분당 10회
  auth: {
    maxRequests: 10,
    windowSeconds: 60,
    key: 'api:auth',
  },

  // 점검 API: 분당 20회
  inspection: {
    maxRequests: 20,
    windowSeconds: 60,
    key: 'api:inspection',
  },

  // 파일 업로드: 분당 5회
  upload: {
    maxRequests: 5,
    windowSeconds: 60,
    key: 'api:upload',
  },

  // 관리자 API: 분당 50회
  admin: {
    maxRequests: 50,
    windowSeconds: 60,
    key: 'api:admin',
  },
} as const;
