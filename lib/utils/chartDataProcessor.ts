/**
 * 시간대별 점검 현황 차트 데이터 처리 유틸리티
 *
 * 하루 평균 점검 건수를 계산하여 누적 데이터와 현재 기간 데이터를 공정하게 비교
 */

export interface HourlyRawData {
  hour: string;
  totalCount: number;  // 해당 시간대 총 점검 건수
  activeDays: number;  // 점검이 있었던 실제 날짜 수 (점검 없는 날은 제외)
}

export interface HourlyChartData {
  hour: string;
  count: number;  // 하루 평균 점검 건수
}

export interface TimeBasedInspectionApiResponse {
  currentPeriod: {
    data: HourlyRawData[];
    periodType: 'today' | 'week' | 'month' | 'year';
    startDate: string;
    endDate: string;
  };
  cumulative: {
    data: HourlyRawData[];
    totalDays: number;    // 전체 누적 기간 (예: 365일)
    activeDays: number;   // 실제 점검이 있었던 날짜 수
    startDate: string;
    endDate: string;
  };
}

/**
 * 하루 평균 점검 건수 계산
 * @param totalCount - 총 점검 건수
 * @param activeDays - 실제 점검이 있었던 날짜 수
 * @returns 하루 평균 점검 건수 (소수점 첫째자리까지)
 */
export function calculateDailyAverage(totalCount: number, activeDays: number): number {
  if (activeDays === 0) return 0;
  return Math.round((totalCount / activeDays) * 10) / 10;
}

/**
 * 원본 데이터를 하루 평균으로 정규화
 * @param rawData - 원본 시간대별 데이터
 * @returns 하루 평균으로 정규화된 차트 데이터
 */
export function normalizeToDaily(rawData: HourlyRawData[]): HourlyChartData[] {
  return rawData.map(item => ({
    hour: item.hour,
    count: calculateDailyAverage(item.totalCount, item.activeDays)
  }));
}

/**
 * 차트에 표시할 최대값 계산 (Y축 스케일)
 * @param datasets - 비교할 데이터셋들
 * @returns 모든 데이터셋에서 가장 큰 값 (여유를 위해 1.1배)
 */
export function calculateChartMaxValue(...datasets: HourlyChartData[][]): number {
  const allValues = datasets.flatMap(dataset => dataset.map(d => d.count));
  const max = Math.max(...allValues, 1); // 최소값 1 보장
  return Math.ceil(max * 1.1); // 10% 여유 + 올림
}

/**
 * 더미 데이터 생성 (개발/테스트용)
 * @param periodType - 기간 타입
 * @returns 더미 API 응답 데이터
 */
export function generateDummyData(periodType: 'today' | 'week' | 'month' | 'year'): TimeBasedInspectionApiResponse {
  const hours = ['08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'];

  // 현재 기간 데이터 (오늘의 실제 건수)
  const currentPeriodData: HourlyRawData[] = hours.map(hour => ({
    hour,
    totalCount: Math.floor(Math.random() * 5), // 0~4건
    activeDays: 1 // 오늘 하루
  }));

  // 누적 데이터 (120일간의 누적)
  const cumulativeData: HourlyRawData[] = hours.map(hour => {
    const activeDays = 120; // 120일간 점검 실시
    const dailyAvg = 2 + Math.random() * 4; // 하루 평균 2~6건
    return {
      hour,
      totalCount: Math.round(dailyAvg * activeDays),
      activeDays
    };
  });

  return {
    currentPeriod: {
      data: currentPeriodData,
      periodType,
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString()
    },
    cumulative: {
      data: cumulativeData,
      totalDays: 365,
      activeDays: 120,
      startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date().toISOString()
    }
  };
}

/**
 * API 응답을 차트 데이터로 변환
 * @param apiResponse - API 응답 데이터
 * @returns 차트에 바로 사용할 수 있는 정규화된 데이터
 */
export function processChartData(apiResponse: TimeBasedInspectionApiResponse) {
  const currentData = normalizeToDaily(apiResponse.currentPeriod.data);
  const cumulativeData = normalizeToDaily(apiResponse.cumulative.data);
  const maxCount = calculateChartMaxValue(currentData, cumulativeData);

  return {
    currentData,
    cumulativeData,
    maxCount,
    periodType: apiResponse.currentPeriod.periodType
  };
}
