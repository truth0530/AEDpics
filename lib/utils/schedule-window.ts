/**
 * 일정 스케줄의 중복 감지 윈도우 범위 계산
 *
 * 비즈니스 로직:
 * - 예약된 시간 기준 ±N분 범위 내 기존 일정 검색
 * - 기본값: ±30분 (원활한 점검 스케줄링을 위해 충분한 범위)
 * - 필요시 ±20분 또는 ±45분으로 조정 가능
 *
 * 사용 사례:
 * - 같은 시간대에 중복 점검 일정이 생기는 것을 방지
 * - 점검자가 이동하는 데 소요되는 시간을 고려한 범위 설정
 */

export interface ScheduleWindow {
  start: Date;
  end: Date;
}

/**
 * 일정 스케줄의 중복 감지 윈도우 범위를 계산합니다.
 *
 * @param scheduledFor 예약된 시간 (ISO 문자열 또는 Date 객체)
 * @param windowMinutes 검색 범위 (분 단위, 기본값: 30)
 * @returns { start: Date, end: Date } 검색 범위 (start는 포함, end는 미포함)
 *
 * @example
 * // ±30분 윈도우 계산
 * const window = buildScheduleWindow('2025-11-10T14:00:00.000Z');
 * // { start: 2025-11-10T13:30:00Z, end: 2025-11-10T14:30:00Z }
 *
 * // 커스텀 윈도우 범위
 * const window = buildScheduleWindow('2025-11-10T14:00:00.000Z', 45);
 * // { start: 2025-11-10T13:15:00Z, end: 2025-11-10T14:45:00Z }
 */
export function buildScheduleWindow(
  scheduledFor: string | Date,
  windowMinutes: number = 30
): ScheduleWindow {
  // Input validation
  if (!scheduledFor) {
    throw new Error('scheduledFor parameter is required');
  }

  if (windowMinutes < 0) {
    throw new Error('windowMinutes must be a non-negative number');
  }

  // Convert to Date if string
  const scheduledDate = typeof scheduledFor === 'string'
    ? new Date(scheduledFor)
    : new Date(scheduledFor);

  // Validate date
  if (Number.isNaN(scheduledDate.getTime())) {
    throw new Error(`Invalid date format: ${scheduledFor}`);
  }

  // Calculate window boundaries
  const start = new Date(scheduledDate);
  start.setMinutes(start.getMinutes() - windowMinutes);

  const end = new Date(scheduledDate);
  end.setMinutes(end.getMinutes() + windowMinutes);

  return { start, end };
}

/**
 * 특정 시간이 주어진 일정의 윈도우 범위 내에 있는지 확인합니다.
 *
 * @param timeToCheck 확인할 시간
 * @param scheduledFor 예약된 기준 시간
 * @param windowMinutes 윈도우 범위 (분 단위, 기본값: 30)
 * @returns 윈도우 범위 내에 있으면 true
 *
 * @example
 * const isConflict = isTimeInWindow('2025-11-10T14:10:00Z', '2025-11-10T14:00:00Z');
 * // true (14:00의 ±30분 범위 내)
 */
export function isTimeInWindow(
  timeToCheck: string | Date,
  scheduledFor: string | Date,
  windowMinutes: number = 30
): boolean {
  const window = buildScheduleWindow(scheduledFor, windowMinutes);
  const checkTime = typeof timeToCheck === 'string'
    ? new Date(timeToCheck)
    : new Date(timeToCheck);

  if (Number.isNaN(checkTime.getTime())) {
    throw new Error(`Invalid date format: ${timeToCheck}`);
  }

  return checkTime >= window.start && checkTime < window.end;
}

/**
 * 일정 윈도우의 지속 시간(분)을 계산합니다.
 *
 * @param windowMinutes 윈도우 범위 (분 단위)
 * @returns 전체 윈도우 지속 시간 (분)
 *
 * @example
 * const duration = getWindowDuration(30);
 * // 60 (±30분 = 총 60분)
 */
export function getWindowDuration(windowMinutes: number = 30): number {
  return windowMinutes * 2;
}
