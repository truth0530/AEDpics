/**
 * 향상된 NCP 이메일 발송 시스템
 *
 * 기능:
 * - 스마트 발신자 선택
 * - 자동 재시도 with 발신자 변경
 * - 실패 기록 및 학습
 */

import { sendNCPEmail, NCPEmailConfig } from './ncp-email';
import {
  selectSmartSender,
  rotateSender,
  recordSendingFailure,
  recordSendingSuccess
} from './smart-sender-selector-simplified';
import { validateEmailBeforeSending, logEmailSend } from './email-validator-simplified';
import { logger } from '@/lib/logger';

export interface EnhancedEmailOptions {
  maxSenderRetries?: number;  // 발신자 변경 재시도 횟수
  skipValidation?: boolean;   // 검증 스킵 (긴급 발송용)
  forceSender?: string;        // 특정 발신자 강제 사용
}

/**
 * 향상된 이메일 발송 함수
 *
 * 자동으로:
 * 1. 이메일 유효성 검증
 * 2. 최적 발신자 선택
 * 3. 실패 시 발신자 변경 재시도
 * 4. 성공/실패 기록
 */
export async function sendEnhancedEmail(
  recipientEmail: string,
  recipientName: string,
  subject: string,
  htmlBody: string,
  options: EnhancedEmailOptions = {}
): Promise<{ success: boolean; sender?: string; error?: string; attempts?: number }> {
  const {
    maxSenderRetries = 2,
    skipValidation = false,
    forceSender
  } = options;

  // 1. 이메일 유효성 검증
  if (!skipValidation) {
    const validation = await validateEmailBeforeSending(recipientEmail);
    if (!validation.valid) {
      logger.warn('EnhancedEmail:Validation', 'Email validation failed', {
        email: recipientEmail,
        reason: validation.reason
      });

      await logEmailSend(
        recipientEmail,
        subject,
        'blocked',
        {
          errorMessage: validation.reason
        }
      );

      return {
        success: false,
        error: validation.reason
      };
    }

    // 경고가 있으면 로깅
    if (validation.warnings?.length) {
      logger.info('EnhancedEmail:Validation', 'Email validation warnings', {
        email: recipientEmail,
        warnings: validation.warnings
      });
    }
  }

  // 2. 발신자 선택 및 재시도 로직
  let currentSender = forceSender || await selectSmartSender(recipientEmail);
  let lastError: Error | null = null;
  let attemptCount = 0;

  const recipientDomain = recipientEmail.split('@')[1];
  const triedSenders = new Set<string>();

  // 최대 발신자 수만큼 재시도
  for (let senderAttempt = 0; senderAttempt <= maxSenderRetries; senderAttempt++) {
    // 이미 시도한 발신자는 스킵
    if (triedSenders.has(currentSender)) {
      currentSender = rotateSender(currentSender, recipientDomain);
      continue;
    }

    triedSenders.add(currentSender);
    attemptCount++;

    logger.info('EnhancedEmail:Send', 'Attempting to send email', {
      recipient: recipientEmail,
      sender: currentSender,
      attempt: attemptCount
    });

    try {
      // NCP API 호출 (기본 3회 재시도 포함)
      const result = await sendNCPEmail(
        {
          accessKey: process.env.NCP_ACCESS_KEY!,
          accessSecret: process.env.NCP_ACCESS_SECRET!,
          senderAddress: currentSender,
          senderName: 'AED 픽스'
        },
        {
          title: subject,
          body: htmlBody,
          recipients: [
            {
              address: recipientEmail,
              name: recipientName,
              type: 'R'
            }
          ],
          individual: true,
          advertising: false
        },
        {
          maxRetries: 3,
          initialDelay: 1000,
          exponentialBase: 2
        }
      );

      // 성공!
      await recordSendingSuccess(recipientEmail, currentSender);
      await logEmailSend(
        recipientEmail,
        subject,
        'sent',
        {
          sender: currentSender,
          ncpMessageId: result.messageId
        }
      );

      logger.info('EnhancedEmail:Success', 'Email sent successfully', {
        recipient: recipientEmail,
        sender: currentSender,
        messageId: result.messageId,
        attempts: attemptCount
      });

      return {
        success: true,
        sender: currentSender,
        attempts: attemptCount
      };

    } catch (error) {
      lastError = error as Error;
      const errorMessage = lastError.message || 'Unknown error';

      logger.warn('EnhancedEmail:Failed', 'Email send failed with sender', {
        recipient: recipientEmail,
        sender: currentSender,
        error: errorMessage,
        attempt: attemptCount
      });

      // 실패 기록
      await recordSendingFailure(
        recipientEmail,
        currentSender,
        extractErrorCode(errorMessage)
      );

      // 554 5.7.1 같은 스팸 차단 에러면 발신자 변경
      if (isSpamBlockError(errorMessage)) {
        logger.info('EnhancedEmail:Rotate', 'Spam block detected, rotating sender', {
          blockedSender: currentSender,
          domain: recipientDomain
        });

        currentSender = rotateSender(currentSender, recipientDomain);

        // 잠시 대기 (스팸 필터 회피)
        await delay(2000);
      } else {
        // 다른 에러는 바로 실패
        break;
      }
    }
  }

  // 모든 시도 실패
  const finalError = lastError?.message || 'All send attempts failed';

  await logEmailSend(
    recipientEmail,
    subject,
    'failed',
    {
      errorMessage: finalError
    }
  );

  logger.error('EnhancedEmail:AllFailed', 'All email send attempts failed', {
    recipient: recipientEmail,
    triedSenders: Array.from(triedSenders),
    attempts: attemptCount,
    error: finalError
  });

  return {
    success: false,
    error: finalError,
    attempts: attemptCount
  };
}

/**
 * OTP 발송용 특화 함수
 */
export async function sendOTPEmail(
  recipientEmail: string,
  otpCode: string
): Promise<{ success: boolean; error?: string }> {
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>AED 픽스 - 이메일 인증</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #030712 0%, #111827 50%, #030712 100%);">
      <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #030712 0%, #111827 50%, #030712 100%); padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background: rgba(17, 24, 39, 0.8); backdrop-filter: blur(16px); border-radius: 16px; border: 1px solid rgba(34, 197, 94, 0.2); box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(34, 197, 94, 0.1); overflow: hidden;">
              <tr>
                <td style="padding: 40px 30px; text-align: center;">
                  <h1 style="margin: 0 0 20px; color: #ffffff; font-size: 28px; font-weight: 700;">AED 픽스</h1>
                  <div style="background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%); border: 2px solid rgba(34, 197, 94, 0.5); border-radius: 12px; padding: 30px 20px; margin-bottom: 24px;">
                    <p style="margin: 0 0 20px 0; color: #fbbf24; font-size: 14px; font-weight: 600;">
                      인증번호를 15분 내에 입력해주세요
                    </p>
                    <div style="font-size: 52px; font-weight: 800; color: #22c55e; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                      ${otpCode}
                    </div>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEnhancedEmail(
    recipientEmail,
    '사용자',
    `AED 점검 시스템 - 인증번호: ${otpCode}`,
    htmlBody,
    {
      maxSenderRetries: 2  // OTP는 빠른 전달이 중요하므로 2회만 재시도
    }
  );
}

/**
 * 에러 메시지에서 에러 코드 추출
 */
function extractErrorCode(errorMessage: string): string {
  // 554 5.7.1 같은 SMTP 응답 코드 추출
  const match = errorMessage.match(/(\d{3}\s+\d+\.\d+\.\d+)/);
  if (match) {
    return match[1];
  }

  // NCP 에러 코드 추출
  const ncpMatch = errorMessage.match(/\(([A-Z]\d+)\)/);
  if (ncpMatch) {
    return ncpMatch[1];
  }

  return 'UNKNOWN';
}

/**
 * 스팸 차단 에러 확인
 */
function isSpamBlockError(errorMessage: string): boolean {
  const spamIndicators = [
    '554 5.7.1',     // SMTP 스팸 차단
    'spam',
    'blocked',
    'rejected',
    'blacklist',
    'reputation',
    'policy'
  ];

  const lowerError = errorMessage.toLowerCase();
  return spamIndicators.some(indicator => lowerError.includes(indicator.toLowerCase()));
}

/**
 * 지연 함수
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}