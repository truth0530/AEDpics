/**
 * 이메일 발송 재시도 헬퍼
 *
 * 정책:
 * - 최대 3회 재시도
 * - Exponential Backoff: 1초, 2초, 4초
 * - 각 재시도 사이 대기 시간 증가
 */

import { logger } from '@/lib/logger';

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number; // ms
  maxDelay?: number; // ms
  exponentialBase?: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000, // 1초
  maxDelay: 10000, // 10초
  exponentialBase: 2
};

/**
 * 지연 함수
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Exponential Backoff 계산
 */
function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
  const exponentialDelay = options.initialDelay * Math.pow(options.exponentialBase, attempt);
  return Math.min(exponentialDelay, options.maxDelay);
}

/**
 * 재시도 가능한 이메일 발송
 */
export async function sendEmailWithRetry<T>(
  emailFunction: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < opts.maxRetries; attempt++) {
    try {
      const result = await emailFunction();

      // 성공 시 즉시 반환
      if (attempt > 0) {
        logger.info('EmailRetry', 'Email sent successfully after retry', { attempt: attempt + 1 });
      }
      return result;

    } catch (error) {
      lastError = error as Error;
      const isLastAttempt = attempt === opts.maxRetries - 1;

      if (isLastAttempt) {
        logger.error('EmailRetry', 'Email send failed after all retries', error instanceof Error ? error : {
          error,
          maxRetries: opts.maxRetries
        });
        break;
      }

      // 재시도 전 대기
      const delayMs = calculateDelay(attempt, opts);
      logger.warn('EmailRetry', 'Email send attempt failed, retrying', {
        attempt: attempt + 1,
        retryDelay: `${delayMs}ms`
      });
      await delay(delayMs);
    }
  }

  // 모든 재시도 실패
  throw lastError || new Error('Email send failed after all retries');
}

/**
 * Resend API 호출 헬퍼 (재시도 포함)
 */
export async function sendResendEmail(
  apiKey: string,
  emailData: {
    from: string;
    to: string;
    subject: string;
    html: string;
  },
  retryOptions?: RetryOptions
): Promise<any> {
  return sendEmailWithRetry(async () => {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Resend API error: ${JSON.stringify(error)}`);
    }

    return response.json();
  }, retryOptions);
}
