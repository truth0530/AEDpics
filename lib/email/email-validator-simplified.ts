/**
 * 이메일 검증 유틸리티 (간소화 버전)
 *
 * Prisma 테이블 생성 전까지 사용할 임시 버전
 * blocked_emails, email_bounces, email_send_logs 테이블 제외
 */

import * as dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);

/**
 * 일회용 이메일 서비스 도메인 목록
 */
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  '10minutemail.com',
  'guerrillamail.com',
  'mailinator.com',
  'temp-mail.org',
  'throwawaymail.com',
  'yopmail.com',
  // 더 많은 일회용 이메일 도메인 추가 가능
]);

/**
 * 이메일 유효성 종합 검사 (간소화 버전)
 */
export async function validateEmailBeforeSending(email: string): Promise<{
  valid: boolean;
  reason?: string;
  warnings?: string[];
}> {
  const warnings: string[] = [];

  // 1. 기본 형식 검증
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      valid: false,
      reason: 'Invalid email format'
    };
  }

  const domain = email.split('@')[1].toLowerCase();

  // 2. 일회용 이메일 확인
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    warnings.push('Disposable email address detected');
    // 일회용 이메일도 일단 허용 (경고만)
  }

  // 3. MX 레코드 확인
  try {
    const mxRecords = await resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) {
      return {
        valid: false,
        reason: `No MX records found for domain: ${domain}`
      };
    }
  } catch (error) {
    // DNS 조회 실패는 경고로 처리
    warnings.push(`DNS lookup failed for ${domain}`);
  }

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * 이메일 발송 로그 기록 (간소화 - 콘솔 로그만)
 */
export async function logEmailSend(
  email: string,
  subject: string,
  status: 'sent' | 'failed' | 'blocked' | 'bounced',
  metadata?: Record<string, any>
): Promise<void> {
  console.log('[EMAIL LOG]', {
    email,
    subject,
    status,
    metadata,
    timestamp: new Date().toISOString()
  });
}

/**
 * 이메일 정규화
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}