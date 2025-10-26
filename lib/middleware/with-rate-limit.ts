/**
 * Rate Limit Middleware Wrapper
 *
 * API Route에 Rate Limiting을 쉽게 적용할 수 있는 Higher-Order Function
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  checkRateLimit,
  createRateLimitResponse,
  addRateLimitHeaders,
  getIdentifier,
  type RateLimitConfig,
} from './rate-limiter';

type RouteHandler = (request: NextRequest) => Promise<NextResponse>;

/**
 * API Route에 Rate Limiting 적용
 *
 * @example
 * export const GET = withRateLimit(
 *   async (request: NextRequest) => {
 *     // Your handler logic
 *   },
 *   RATE_LIMIT_CONFIGS['aed-data']
 * );
 */
export function withRateLimit(
  handler: RouteHandler,
  config: RateLimitConfig
): RouteHandler {
  return async (request: NextRequest) => {
    // IP 기반 식별자 추출
    const identifier = getIdentifier(request);

    // Rate limit 체크
    const rateLimitResult = await checkRateLimit(identifier, config);

    // Rate limit 초과 시 429 응답
    if (!rateLimitResult.success) {
      console.warn(`[Rate Limit] Request blocked for ${identifier} (${config.key})`);
      return createRateLimitResponse(rateLimitResult);
    }

    // Handler 실행
    const response = await handler(request);

    // Rate limit 헤더 추가
    return addRateLimitHeaders(response, rateLimitResult);
  };
}
