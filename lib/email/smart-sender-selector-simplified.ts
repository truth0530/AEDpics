/**
 * 스마트 발신자 선택 시스템 (간소화 버전)
 *
 * 수신 도메인별 최적의 발신자 이메일 자동 선택
 * DB 테이블 생성 전까지 사용할 임시 버전
 */

import { logger } from '@/lib/logger';

/**
 * 수신 도메인별 발신자 매핑 (차단 이력 기반)
 *
 * 2025-11-07 기준 확인된 차단 패턴:
 * - naver.com: noreply@aed.pics ❌ → noreply@nmc.or.kr ✅
 * - daum.net: noreply@nmc.or.kr ❌
 * - nmc.or.kr: noreply@nmc.or.kr ❌ → noreply@aed.pics ✅
 */
const DOMAIN_SENDER_MAPPING: Record<string, string[]> = {
  // 네이버 계열
  'naver.com': ['noreply@nmc.or.kr', 'noreply@aed.pics'],

  // 다음/카카오 계열 (한메일 포함)
  'daum.net': ['noreply@aed.pics', 'noreply@nmc.or.kr'],
  'hanmail.net': ['noreply@aed.pics', 'noreply@nmc.or.kr'],  // hanmail은 다음 계열
  'kakao.com': ['noreply@aed.pics', 'noreply@nmc.or.kr'],

  // 구글 계열
  'gmail.com': ['noreply@aed.pics', 'noreply@nmc.or.kr'],
  'googlemail.com': ['noreply@aed.pics', 'noreply@nmc.or.kr'],

  // 정부/공공기관
  'korea.kr': ['noreply@nmc.or.kr', 'noreply@aed.pics'],
  'go.kr': ['noreply@nmc.or.kr', 'noreply@aed.pics'],

  // nmc.or.kr - 특별 처리 (같은 도메인 발송 문제)
  'nmc.or.kr': ['noreply@aed.pics', 'noreply@nmc.or.kr'],

  // 기타 도메인 기본값
  'default': ['noreply@aed.pics', 'noreply@nmc.or.kr']
};

/**
 * 발송 실패 기록을 메모리 캐시에 저장 (빠른 조회)
 */
const failureCache = new Map<string, Set<string>>();

/**
 * 발송 실패 기록 (메모리 캐시만)
 */
export async function recordSendingFailure(
  recipientEmail: string,
  senderEmail: string,
  errorCode?: string
) {
  const domain = recipientEmail.split('@')[1]?.toLowerCase();

  // 메모리 캐시 업데이트
  if (!failureCache.has(domain)) {
    failureCache.set(domain, new Set());
  }
  failureCache.get(domain)?.add(senderEmail);

  logger.warn('SmartSender:Failure', 'Email sending failure recorded', {
    recipient: recipientEmail,
    sender: senderEmail,
    errorCode
  });
}

/**
 * 발송 성공 기록 (메모리 캐시만)
 */
export async function recordSendingSuccess(
  recipientEmail: string,
  senderEmail: string
) {
  const domain = recipientEmail.split('@')[1]?.toLowerCase();

  // 성공한 발신자는 실패 캐시에서 제거
  failureCache.get(domain)?.delete(senderEmail);

  logger.info('SmartSender:Success', 'Email sending success recorded', {
    recipient: recipientEmail,
    sender: senderEmail
  });
}

/**
 * 스마트 발신자 선택
 *
 * 선택 우선순위:
 * 1. 실패 캐시에 없는 발신자
 * 2. 도메인별 우선순위 발신자
 * 3. 기본 발신자
 */
export async function selectSmartSender(recipientEmail: string): Promise<string> {
  const domain = recipientEmail.split('@')[1]?.toLowerCase();

  if (!domain) {
    logger.warn('SmartSender', 'Invalid email domain', { email: recipientEmail });
    return 'noreply@aed.pics';
  }

  // 도메인별 매핑 확인
  const candidates = DOMAIN_SENDER_MAPPING[domain] || DOMAIN_SENDER_MAPPING['default'];
  const failedSenders = failureCache.get(domain) || new Set();

  // 실패하지 않은 발신자 중 첫 번째 선택
  for (const sender of candidates) {
    if (!failedSenders.has(sender)) {
      logger.info('SmartSender', 'Selected sender for domain', {
        recipient: recipientEmail,
        sender,
        domain
      });
      return sender;
    }
  }

  // 모든 발신자가 실패한 경우, 첫 번째 후보 재시도
  logger.warn('SmartSender', 'All senders failed, retrying first candidate', {
    domain,
    failedSenders: Array.from(failedSenders)
  });

  return candidates[0];
}

/**
 * 발신자 로테이션 (라운드로빈)
 * 차단이 계속될 경우 순환하며 시도
 */
export function rotateSender(currentSender: string, domain: string): string {
  const candidates = DOMAIN_SENDER_MAPPING[domain] || DOMAIN_SENDER_MAPPING['default'];
  const currentIndex = candidates.indexOf(currentSender);

  if (currentIndex === -1 || currentIndex === candidates.length - 1) {
    return candidates[0];
  }

  return candidates[currentIndex + 1];
}

/**
 * 캐시 초기화 (주기적으로 실행)
 */
export function clearFailureCache() {
  const cacheSize = failureCache.size;
  failureCache.clear();

  logger.info('SmartSender:Cache', 'Failure cache cleared', {
    previousSize: cacheSize
  });
}

// 1시간마다 캐시 초기화
if (typeof setInterval !== 'undefined') {
  setInterval(clearFailureCache, 60 * 60 * 1000);
}

/**
 * 발송 통계 조회 (간소화 - 메모리 캐시 기반)
 */
export async function getSenderStatistics(hours: number = 24) {
  // DB 없이는 통계 제공 불가
  logger.info('SmartSender:Stats', 'Statistics not available without database', { hours });

  return {
    'noreply@aed.pics': {
      total: 0,
      sent: 0,
      failed: 0,
      blocked: 0,
      bounced: 0,
      successRate: '0%'
    },
    'noreply@nmc.or.kr': {
      total: 0,
      sent: 0,
      failed: 0,
      blocked: 0,
      bounced: 0,
      successRate: '0%'
    }
  };
}