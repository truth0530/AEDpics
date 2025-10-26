import { NextRequest } from 'next/server';

// Global 타입 확장
declare global {
  var rateLimitCleanupInterval: NodeJS.Timeout | undefined;
  var rateLimitHandlersRegistered: boolean | undefined;
}

// 메모리 기반 Rate Limiting (프로덕션에서는 Redis 권장)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

// 주기적으로 오래된 엔트리 정리 (30초마다)
if (typeof global !== 'undefined' && !global.rateLimitCleanupInterval) {
  global.rateLimitCleanupInterval = setInterval(() => {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    for (const [key, value] of requestCounts.entries()) {
      if (value.resetTime < oneHourAgo) {
        requestCounts.delete(key);
      }
    }
  }, 30000);

  // 프로세스 종료 시 정리 (중복 등록 방지)
  if (typeof process !== 'undefined' && !global.rateLimitHandlersRegistered) {
    global.rateLimitHandlersRegistered = true;

    const cleanup = () => {
      if (global.rateLimitCleanupInterval) {
        clearInterval(global.rateLimitCleanupInterval);
        global.rateLimitCleanupInterval = undefined;
      }
    };

    // 정상 종료
    process.on('exit', cleanup);
    // SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      cleanup();
      process.exit(0);
    });
    // SIGTERM
    process.on('SIGTERM', () => {
      cleanup();
      process.exit(0);
    });
  }
}

export interface RateLimitOptions {
  windowMs?: number; // 시간 윈도우 (밀리초)
  maxRequests?: number; // 최대 요청 수
  keyGenerator?: (req: NextRequest) => string; // 키 생성 함수
}

export function rateLimit(options: RateLimitOptions = {}) {
  const {
    windowMs = 60 * 1000, // 기본 1분
    maxRequests = 10, // 기본 10회
    keyGenerator = (req) => {
      // 기본: IP 주소 기반
      const forwarded = req.headers.get('x-forwarded-for');
      const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
      return ip;
    }
  } = options;

  return async function checkRateLimit(req: NextRequest): Promise<{ success: boolean; limit: number; remaining: number; reset: Date }> {
    const key = keyGenerator(req);
    const now = Date.now();

    // 현재 요청 정보 가져오기
    let requestInfo = requestCounts.get(key);

    // 시간 윈도우가 지났으면 리셋
    if (!requestInfo || now > requestInfo.resetTime) {
      requestInfo = {
        count: 0,
        resetTime: now + windowMs
      };
    }

    // 요청 수 증가
    requestInfo.count++;
    requestCounts.set(key, requestInfo);

    // 오래된 엔트리 정리 (메모리 누수 방지)
    if (requestCounts.size > 1000) {
      const oldestTime = now - windowMs * 2;
      for (const [k, v] of requestCounts.entries()) {
        if (v.resetTime < oldestTime) {
          requestCounts.delete(k);
        }
      }
    }

    const remaining = Math.max(0, maxRequests - requestInfo.count);
    const success = requestInfo.count <= maxRequests;

    return {
      success,
      limit: maxRequests,
      remaining,
      reset: new Date(requestInfo.resetTime)
    };
  };
}

// Request body를 안전하게 파싱하는 헬퍼 함수
async function getEmailFromRequest(req: NextRequest): Promise<string> {
  try {
    // Request를 복제하여 body를 읽기
    const clonedRequest = req.clone();
    const body = await clonedRequest.json();
    return body.email || '';
  } catch {
    return '';
  }
}

// API별 Rate Limit 설정 (함수로 변경하여 async 처리)
export const rateLimits = {
  // OTP 발송: 1분에 3회 (이메일 + IP 조합)
  sendOtp: async (req: NextRequest) => {
    const email = await getEmailFromRequest(req);
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';

    const limiter = rateLimit({
      windowMs: 60 * 1000,
      maxRequests: 3,
      keyGenerator: () => `otp:${ip}:${email}`
    });

    return limiter(req);
  },

  // OTP 검증: 1분에 5회 (이메일 + IP 조합)
  verifyOtp: async (req: NextRequest) => {
    const email = await getEmailFromRequest(req);
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';

    const limiter = rateLimit({
      windowMs: 60 * 1000,
      maxRequests: 5,
      keyGenerator: () => `verify:${ip}:${email}`
    });

    return limiter(req);
  },

  // 이메일 체크: 1분에 20회 (IP 기반)
  checkEmail: async (req: NextRequest) => {
    const limiter = rateLimit({
      windowMs: 60 * 1000,
      maxRequests: 20
    });

    return limiter(req);
  },

  // 로그인 시도: 5분에 5회 (이메일 + IP 조합)
  login: async (req: NextRequest) => {
    const email = await getEmailFromRequest(req);
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';

    const limiter = rateLimit({
      windowMs: 5 * 60 * 1000,
      maxRequests: 5,
      keyGenerator: () => `login:${ip}:${email}`
    });

    return limiter(req);
  }
};