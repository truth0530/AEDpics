/**
 * Rate Limiting 관련 유틸리티 함수들
 */

/**
 * 재시도 대기 시간을 사용자 친화적인 문자열로 변환
 */
export function formatRetryTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}초`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (remainingSeconds === 0) {
    return `${minutes}분`;
  }

  return `${minutes}분 ${remainingSeconds}초`;
}


/**
 * 429 에러 응답에서 재시도 정보 추출
 */
export interface RetryInfo {
  retryAfter: number; // 초 단위
  message: string;
}

export function extractRetryInfo(response: Response, data: unknown): RetryInfo {
  // Retry-After 헤더 우선 확인
  const retryAfterHeader = response.headers.get('Retry-After');
  let retryAfter = 60; // 기본값 1분

  if (retryAfterHeader) {
    retryAfter = parseInt(retryAfterHeader);
  } else if (typeof data === 'object' && data !== null && 'retryAfterSeconds' in data) {
    const retryData = data as { retryAfterSeconds?: number };
    retryAfter = retryData.retryAfterSeconds || 60;
  }

  const message = `너무 많은 요청입니다. ${formatRetryTime(retryAfter)} 후에 다시 시도해주세요.`;

  return { retryAfter, message };
}