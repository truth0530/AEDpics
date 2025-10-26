/**
 * OTP Rate Limiter - 서버 사이드 DB 기반
 *
 * 정책:
 * - 15분당 최대 3회 요청
 * - 윈도우 만료 시 자동 리셋
 * - IP 우회 불가능 (이메일 기반)
 */

// TODO: Supabase 서버 클라이언트 임시 비활성화
// import { createClient } from '@/lib/supabase/server';

// 임시: Supabase createClient stub
const createClient = async (): Promise<any> => {
  throw new Error('Supabase client not available. Please use Prisma instead.');
};

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
  const supabase = await createClient();

  try {
    // 현재 시간
    const now = new Date();
    const windowEnd = new Date(now.getTime() + WINDOW_MINUTES * 60 * 1000);

    // 기존 레코드 조회
    const { data: existing, error: fetchError } = await supabase
      .from('otp_rate_limits')
      .select('*')
      .eq('email', email)
      .gte('window_expires_at', now.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error('Rate limit fetch error:', fetchError);
      // DB 오류 시 안전하게 허용 (fallback)
      return {
        allowed: true,
        remaining: MAX_REQUESTS - 1,
        resetAt: windowEnd
      };
    }

    // 기존 윈도우가 없거나 만료됨 → 새 윈도우 생성
    if (!existing) {
      const { error: insertError } = await supabase
        .from('otp_rate_limits')
        .insert({
          email,
          request_count: 1,
          first_request_at: now.toISOString(),
          last_request_at: now.toISOString(),
          window_expires_at: windowEnd.toISOString()
        });

      if (insertError) {
        console.error('Rate limit insert error:', insertError);
        // 삽입 실패 시 안전하게 허용
        return {
          allowed: true,
          remaining: MAX_REQUESTS - 1,
          resetAt: windowEnd
        };
      }

      return {
        allowed: true,
        remaining: MAX_REQUESTS - 1,
        resetAt: windowEnd
      };
    }

    // 기존 윈도우가 있고 아직 유효함
    const currentCount = existing.request_count;
    const expiresAt = new Date(existing.window_expires_at);

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
    const { error: updateError } = await supabase
      .from('otp_rate_limits')
      .update({
        request_count: currentCount + 1,
        last_request_at: now.toISOString(),
        updated_at: now.toISOString()
      })
      .eq('id', existing.id);

    if (updateError) {
      console.error('Rate limit update error:', updateError);
      // 업데이트 실패 시 현재 카운트 기준으로 판단
      return {
        allowed: currentCount < MAX_REQUESTS,
        remaining: Math.max(0, MAX_REQUESTS - currentCount - 1),
        resetAt: expiresAt
      };
    }

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
  const supabase = await createClient();

  try {
    const now = new Date();

    const { data: existing } = await supabase
      .from('otp_rate_limits')
      .select('*')
      .eq('email', email)
      .gte('window_expires_at', now.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!existing) {
      return {
        allowed: true,
        remaining: MAX_REQUESTS,
        resetAt: new Date(Date.now() + WINDOW_MINUTES * 60 * 1000)
      };
    }

    const expiresAt = new Date(existing.window_expires_at);
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
