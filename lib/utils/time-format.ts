/**
 * 시간 포맷 변환 유틸리티
 * 점검 항목 - 24시간 사용 가능 여부에서 사용
 */

/**
 * 00002400 형식을 00:00~24:00로 변환
 * @param input - 8자리 시간 범위 문자열 (예: "00002400", "09001800")
 * @returns 포맷된 시간 범위 (예: "00:00~24:00", "09:00~18:00")
 */
export function formatTimeRange(input: string): string {
  if (input.length !== 8) {
    return input;
  }

  const start = input.substring(0, 4);
  const end = input.substring(4, 8);

  if (!validateTime(start) || !validateTime(end)) {
    return input;
  }

  return `${formatTime(start)}~${formatTime(end)}`;
}

/**
 * 0000을 00:00으로 변환
 * @param time - 4자리 시간 문자열 (예: "0000", "0900", "1800")
 * @returns 포맷된 시간 (예: "00:00", "09:00", "18:00")
 */
export function formatTime(time: string): string {
  if (time.length !== 4) {
    return time;
  }

  const hour = time.substring(0, 2);
  const minute = time.substring(2, 4);

  return `${hour}:${minute}`;
}

/**
 * 시간 유효성 검사 (0000-2400)
 * @param time - 4자리 시간 문자열
 * @returns 유효한 시간이면 true, 아니면 false
 */
export function validateTime(time: string): boolean {
  if (!/^\d{4}$/.test(time)) {
    return false;
  }

  const hour = parseInt(time.substring(0, 2), 10);
  const minute = parseInt(time.substring(2, 4), 10);

  // 시간: 0-24, 분: 0-59
  // 24:00만 허용, 24:01 이상은 불가
  if (hour < 0 || hour > 24) {
    return false;
  }

  if (hour === 24 && minute !== 0) {
    return false;
  }

  if (minute < 0 || minute > 59) {
    return false;
  }

  return true;
}

/**
 * 시간 범위 유효성 검사 (시작 < 종료)
 * @param start - 시작 시간 (4자리)
 * @param end - 종료 시간 (4자리)
 * @returns 유효한 시간 범위이면 true
 */
export function validateTimeRange(start: string, end: string): boolean {
  if (!validateTime(start) || !validateTime(end)) {
    return false;
  }

  const startNum = parseInt(start, 10);
  const endNum = parseInt(end, 10);

  return startNum < endNum;
}

/**
 * 시간 입력 문자열 정규화
 * 사용자가 입력한 값을 4자리 형식으로 변환
 * @param input - 사용자 입력 (예: "9", "900", "0900")
 * @returns 4자리 시간 문자열 (예: "0900")
 */
export function normalizeTimeInput(input: string): string {
  // 숫자만 추출
  const digits = input.replace(/\D/g, '');

  // 4자리로 패딩
  return digits.padStart(4, '0').substring(0, 4);
}

/**
 * 시간 범위 입력 파싱
 * @param input - 8자리 시간 범위 문자열 (예: "00002400")
 * @returns { start, end } 또는 null
 */
export function parseTimeRange(input: string): { start: string; end: string } | null {
  if (input.length !== 8) {
    return null;
  }

  const start = input.substring(0, 4);
  const end = input.substring(4, 8);

  if (!validateTime(start) || !validateTime(end)) {
    return null;
  }

  return { start, end };
}
