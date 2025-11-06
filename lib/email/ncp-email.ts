/**
 * NCP Cloud Outbound Mailer API
 *
 * 네이버 클라우드 플랫폼 이메일 발송 서비스
 * API: https://mail.apigw.ntruss.com/api/v1/mails
 */

import crypto from 'crypto';
import { logger } from '@/lib/logger';

export interface NCPEmailRecipient {
  address: string;
  name: string;
  type: 'R' | 'C' | 'B'; // R: To, C: CC, B: BCC
  parameters?: Record<string, string>;
}

export interface NCPEmailData {
  senderAddress: string;
  senderName?: string;
  title: string;
  body: string;
  recipients: NCPEmailRecipient[];
  individual?: boolean; // true: 개별 발송, false: 일괄 발송
  advertising?: boolean; // 광고성 이메일 여부
  attachFileIds?: string[]; // 첨부파일 ID 배열
}

export interface NCPEmailConfig {
  accessKey: string;
  accessSecret: string;
  senderAddress: string;
  senderName?: string;
}

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  exponentialBase?: number;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000,
  exponentialBase: 2
};

/**
 * 타임스탬프 생성 (밀리초)
 */
function getTimestamp(): string {
  return Date.now().toString();
}

/**
 * HMAC SHA256 서명 생성
 */
function makeSignature(
  accessKey: string,
  accessSecret: string,
  timestamp: string
): string {
  const method = 'POST';
  const uri = '/api/v1/mails';

  const message = `${method} ${uri}\n${timestamp}\n${accessKey}`;

  const hmac = crypto.createHmac('sha256', accessSecret);
  hmac.update(message);

  return hmac.digest('base64');
}

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
  return Math.min(exponentialDelay, 10000); // 최대 10초
}

/**
 * 이메일 주소 정규화
 * NCP 서비스 일관성 문제 해결을 위한 워크어라운드
 * - 공백 제거 (trim)
 * - 소문자 변환 (toLowerCase)
 */
function normalizeEmailAddress(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * NCP Cloud Outbound Mailer API 호출
 */
async function sendEmailRequest(
  config: NCPEmailConfig,
  emailData: Omit<NCPEmailData, 'senderAddress' | 'senderName'>
): Promise<any> {
  const endpoint = 'https://mail.apigw.ntruss.com/api/v1/mails';
  const timestamp = getTimestamp();
  const signature = makeSignature(config.accessKey, config.accessSecret, timestamp);

  // 수신자 이메일 주소 정규화
  const normalizedRecipients = emailData.recipients.map(recipient => ({
    ...recipient,
    address: normalizeEmailAddress(recipient.address)
  }));

  // 발신자 이메일도 정규화
  const normalizedSenderAddress = normalizeEmailAddress(config.senderAddress);

  const requestBody: NCPEmailData = {
    senderAddress: normalizedSenderAddress,
    ...(config.senderName && { senderName: config.senderName }),
    ...emailData,
    recipients: normalizedRecipients
  };

  logger.info('NCPEmail:Request', 'Sending email with normalized addresses', {
    sender: normalizedSenderAddress,
    recipients: normalizedRecipients.map(r => r.address),
    originalRecipients: emailData.recipients.map(r => r.address)
  });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'x-ncp-apigw-timestamp': timestamp,
      'x-ncp-iam-access-key': config.accessKey,
      'x-ncp-apigw-signature-v1': signature,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(`NCP Email API error: ${JSON.stringify(error)}`);
  }

  return response.json();
}

/**
 * 재시도 로직을 포함한 이메일 발송
 */
export async function sendNCPEmail(
  config: NCPEmailConfig,
  emailData: Omit<NCPEmailData, 'senderAddress' | 'senderName'>,
  retryOptions: RetryOptions = {}
): Promise<any> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...retryOptions };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < opts.maxRetries; attempt++) {
    try {
      const result = await sendEmailRequest(config, emailData);

      if (attempt > 0) {
        logger.info('NCPEmail:Retry', 'NCP Email sent successfully after retry', { attempt: attempt + 1 });
      }
      return result;

    } catch (error) {
      lastError = error as Error;
      const isLastAttempt = attempt === opts.maxRetries - 1;

      if (isLastAttempt) {
        logger.error('NCPEmail:Retry', 'NCP Email send failed after all retries', error instanceof Error ? error : {
          error,
          maxRetries: opts.maxRetries
        });
        break;
      }

      const delayMs = calculateDelay(attempt, opts);
      logger.warn('NCPEmail:Retry', 'NCP Email send attempt failed, retrying', {
        attempt: attempt + 1,
        retryDelay: `${delayMs}ms`
      });
      await delay(delayMs);
    }
  }

  throw lastError || new Error('NCP Email send failed after all retries');
}

/**
 * 수신자 도메인에 따라 최적의 발신자 이메일 선택
 *
 * DMARC 정책 준수:
 * - @nmc.or.kr 수신자 → noreply@nmc.or.kr (도메인 일치)
 * - 기타 도메인 → noreply@aed.pics (SPF/DKIM 설정됨)
 */
function selectSenderEmail(recipientEmail: string): string {
  const domain = recipientEmail.split('@')[1]?.toLowerCase();

  if (domain === 'nmc.or.kr') {
    return 'noreply@nmc.or.kr';
  }

  return 'noreply@aed.pics';
}

/**
 * 간단한 텍스트 이메일 발송 헬퍼
 */
export async function sendSimpleEmail(
  config: NCPEmailConfig,
  to: string,
  toName: string,
  subject: string,
  htmlBody: string,
  retryOptions?: RetryOptions
): Promise<any> {
  return sendNCPEmail(
    config,
    {
      title: subject,
      body: htmlBody,
      recipients: [
        {
          address: to,
          name: toName,
          type: 'R'
        }
      ],
      individual: true,
      advertising: false
    },
    retryOptions
  );
}

/**
 * 수신자 도메인에 따라 발신자를 자동 선택하는 이메일 발송 헬퍼
 *
 * DMARC 정책 준수를 위해 수신자 도메인에 따라 최적의 발신자를 선택합니다.
 */
export async function sendSmartEmail(
  baseConfig: NCPEmailConfig,
  to: string,
  toName: string,
  subject: string,
  htmlBody: string,
  retryOptions?: RetryOptions
): Promise<any> {
  const senderEmail = selectSenderEmail(to);

  const config: NCPEmailConfig = {
    ...baseConfig,
    senderAddress: senderEmail,
    senderName: 'AED 픽스'
  };

  return sendNCPEmail(
    config,
    {
      title: subject,
      body: htmlBody,
      recipients: [
        {
          address: to,
          name: toName,
          type: 'R'
        }
      ],
      individual: true,
      advertising: false
    },
    retryOptions
  );
}
