/**
 * NCP Cloud Outbound Mailer API
 *
 * 네이버 클라우드 플랫폼 이메일 발송 서비스
 * API: https://mail.apigw.ntruss.com/api/v1/mails
 */

import crypto from 'crypto';

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
 * NCP Cloud Outbound Mailer API 호출
 */
async function sendEmailRequest(
  config: NCPEmailConfig,
  emailData: Omit<NCPEmailData, 'senderAddress' | 'senderName'>
): Promise<any> {
  const endpoint = 'https://mail.apigw.ntruss.com/api/v1/mails';
  const timestamp = getTimestamp();
  const signature = makeSignature(config.accessKey, config.accessSecret, timestamp);

  const requestBody: NCPEmailData = {
    senderAddress: config.senderAddress,
    ...(config.senderName && { senderName: config.senderName }),
    ...emailData
  };

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
        console.log(`NCP Email sent successfully on attempt ${attempt + 1}`);
      }
      return result;

    } catch (error) {
      lastError = error as Error;
      const isLastAttempt = attempt === opts.maxRetries - 1;

      if (isLastAttempt) {
        console.error(`NCP Email send failed after ${opts.maxRetries} attempts:`, error);
        break;
      }

      const delayMs = calculateDelay(attempt, opts);
      console.warn(`NCP Email send attempt ${attempt + 1} failed. Retrying in ${delayMs}ms...`);
      await delay(delayMs);
    }
  }

  throw lastError || new Error('NCP Email send failed after all retries');
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
