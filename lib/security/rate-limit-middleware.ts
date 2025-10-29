import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, RATE_LIMIT_PRESETS } from './rate-limiter';

/**
 * Rate limit 미들웨어
 * API 라우트에서 사용
 */
export function withRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>,
  preset: keyof typeof RATE_LIMIT_PRESETS = 'API'
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const ip = getClientIp(request);
    const config = RATE_LIMIT_PRESETS[preset];

    // Rate limit 체크
    const { allowed, remaining, resetAt } = checkRateLimit(ip, config);

    // Rate limit 헤더 추가
    const headers = {
      'X-RateLimit-Limit': config.maxRequests.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': new Date(resetAt).toISOString(),
    };

    if (!allowed) {
      const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
          retryAfter,
        },
        {
          status: 429,
          headers: {
            ...headers,
            'Retry-After': retryAfter.toString(),
          },
        }
      );
    }

    // 요청 처리
    const response = await handler(request);

    // Rate limit 헤더 추가
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  };
}

/**
 * 한글 메시지로 rate limit 체크
 */
export async function checkRateLimitWithMessage(
  request: NextRequest,
  preset: keyof typeof RATE_LIMIT_PRESETS
): Promise<NextResponse | null> {
  const ip = getClientIp(request);
  const config = RATE_LIMIT_PRESETS[preset];

  const { allowed, remaining, resetAt } = checkRateLimit(ip, config);

  if (!allowed) {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
    const minutes = Math.ceil(retryAfter / 60);

    return NextResponse.json(
      {
        success: false,
        error: `요청 횟수가 초과되었습니다. ${minutes}분 후에 다시 시도해주세요.`,
        retryAfter,
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': new Date(resetAt).toISOString(),
          'Retry-After': retryAfter.toString(),
        },
      }
    );
  }

  return null; // allowed
}
