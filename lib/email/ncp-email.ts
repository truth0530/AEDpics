/**
 * NCP Cloud Outbound Mailer API
 *
 * 네이버 클라우드 플랫폼 이메일 발송 서비스
 * API: https://mail.apigw.ntruss.com/api/v1/mails
 */

import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { selectSmartSender, recordSendingFailure, recordSendingSuccess } from '@/lib/email/smart-sender-selector-simplified';

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
 * [DEPRECATED - 2025-11-21] 고정식 발신자 선택 함수
 *
 * 2025-11-21부터 이 함수는 사용되지 않습니다.
 * 대신 smart-sender-selector-simplified.ts의 selectSmartSender를 사용합니다.
 *
 * 폐기 이유: Daum 반복 차단 문제의 자동 해결
 *
 * 과거 변경 이력:
 * - 2025-10-31 240972d: 초기 구현 (도메인별 선택)
 * - 2025-11-07 ebd58ba: noreply@aed.pics 비활성화 (잘못된 가정)
 * - 2025-11-13 c719845: 도메인 기반 선택 복구
 * - 2025-11-21 ebc0513: Daum을 위해 noreply@nmc.or.kr로 고정
 * - 2025-11-21 (현재): smart-sender 재활성화
 *
 * 문제점:
 * 고정식 접근은 반복적인 차단 문제 해결 불가:
 * 1. noreply@nmc.or.kr로 발송 시도
 * 2. NCP가 자동으로 Daum 차단 목록에 추가
 * 3. 수동으로 차단 목록에서 제거
 * 4. 시간이 지나면 다시 자동 추가 (무한 반복)
 *
 * 해결책:
 * smart-sender-selector-simplified.ts를 사용하여:
 * 1. 1차 시도: noreply@aed.pics
 * 2. 실패 시 2차: noreply@nmc.or.kr
 * 3. 실패 패턴을 메모리에 기록하여 다음 시도 최적화
 *
 * @deprecated 2025-11-21 smart-sender selector로 대체됨
 */
function selectSenderEmail(recipientEmail: string): string {
  // 2025-11-13 재활성화: 네이버 DMARC 차단 문제 해결
  // 과거 검증된 패턴 (사용자 증언 기반)
  // 2025-11-21 Daum 차단 대응: Daum/Hanmail은 noreply@nmc.or.kr 사용
  //
  // [DEPRECATED] 이 함수는 더 이상 사용되지 않습니다.
  // smart-sender-selector-simplified.ts의 selectSmartSender를 사용하세요.
  const domain = recipientEmail.split('@')[1]?.toLowerCase();

  // NMC 도메인: 같은 도메인 사용 (DMARC 정책)
  if (domain === 'nmc.or.kr') return 'noreply@nmc.or.kr';

  // Daum/Hanmail: noreply@aed.pics가 차단되므로 nmc.or.kr 사용
  if (domain === 'daum.net' || domain === 'hanmail.net') {
    return 'noreply@nmc.or.kr';
  }

  // 기타 도메인 (네이버, Gmail 등): 기존 패턴 유지
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
 * 2025-11-21 스마트 발신자 선택 시스템 활성화:
 * - smart-sender-selector-simplified.ts를 사용하여 도메인별 발신자 로테이션
 * - 이전의 고정식 접근(noreply@nmc.or.kr 고정) → 동적 로테이션으로 변경
 * - 이유: Daum 반복 차단 문제를 자동으로 대응하기 위함
 *
 * 작동 방식:
 * 1. 수신자 도메인에 따라 우선순위 발신자 리스트 확인
 * 2. 이전에 실패한 발신자는 스킵
 * 3. 첫 번째 성공한 발신자 사용
 * 4. 발송 성공/실패 메모리 캐시에 기록
 * 5. 1시간마다 캐시 초기화 (새로운 기회 제공)
 *
 * 이전 커밋들:
 * - 2025-10-31 240972d: 동적 발신자 선택 구현
 * - 2025-11-13 c719845: 도메인 기반 선택 복구
 * - 2025-11-21 ebc0513: 고정식으로 회귀 (Daum noreply@nmc.or.kr로 고정)
 * - 2025-11-21 (현재): smart-sender-selector 재활성화
 */
export async function sendSmartEmail(
  baseConfig: NCPEmailConfig,
  to: string,
  toName: string,
  subject: string,
  htmlBody: string,
  retryOptions?: RetryOptions
): Promise<any> {
  let senderEmail: string;

  try {
    // 스마트 발신자 선택 시스템 사용 (도메인별 우선순위 + 실패 캐시)
    senderEmail = await selectSmartSender(to);
    logger.info('SmartEmailSender', 'Selected sender using smart selector', {
      recipient: to,
      sender: senderEmail
    });
  } catch (error) {
    // 폴백: 스마트 선택 실패 시 기본값
    logger.error('SmartEmailSender', 'Smart selector failed, using fallback', {
      recipient: to,
      error: error instanceof Error ? error.message : error
    });
    senderEmail = 'noreply@nmc.or.kr';
  }

  const config: NCPEmailConfig = {
    ...baseConfig,
    senderAddress: senderEmail,
    senderName: 'AED 픽스'
  };

  try {
    const result = await sendNCPEmail(
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

    // 발송 성공 기록
    await recordSendingSuccess(to, senderEmail);

    logger.info('SmartEmailSender', 'Email sent successfully', {
      recipient: to,
      sender: senderEmail
    });

    return result;
  } catch (error) {
    // 발송 실패 기록 (다음 시도 시 다른 발신자 사용)
    const errorCode = error instanceof Error ? error.message.substring(0, 50) : 'UNKNOWN';
    await recordSendingFailure(to, senderEmail, errorCode);

    logger.error('SmartEmailSender', 'Email sending failed', {
      recipient: to,
      sender: senderEmail,
      error: error instanceof Error ? error.message : error
    });

    throw error;
  }
}
