/**
 * Performance Monitoring Utilities
 * API 응답 시간 측정 및 로깅
 */

const DEBUG = process.env.NEXT_PUBLIC_DEBUG === 'true';
const SLOW_THRESHOLD_MS = 1000; // 1초 이상 걸리면 경고

export interface PerformanceMetrics {
  endpoint: string;
  method: string;
  duration: number;
  timestamp: Date;
  status?: number;
  queryCount?: number;
}

/**
 * API 핸들러를 성능 모니터링으로 래핑
 */
export function withPerformanceMonitoring<T>(
  handler: (req: Request) => Promise<Response>,
  endpoint: string
) {
  return async (req: Request): Promise<Response> => {
    const start = performance.now();
    const method = req.method;

    let response: Response;
    let status = 200;

    try {
      response = await handler(req);
      status = response.status;
      return response;
    } catch (error) {
      status = 500;
      throw error;
    } finally {
      const duration = performance.now() - start;

      // 성능 메트릭 기록
      const metrics: PerformanceMetrics = {
        endpoint,
        method,
        duration,
        timestamp: new Date(),
        status
      };

      // 느린 요청 경고
      if (duration > SLOW_THRESHOLD_MS) {
        console.warn(`[SLOW API] ${method} ${endpoint} took ${duration.toFixed(2)}ms (status: ${status})`);
      }

      // 디버그 모드에서 모든 요청 로깅
      if (DEBUG) {
        console.log(`[API Performance] ${method} ${endpoint}: ${duration.toFixed(2)}ms (status: ${status})`);
      }

      // Response header에 duration 추가 (프로덕션에서도 유용)
      if (response) {
        response.headers.set('X-Response-Time', `${duration.toFixed(2)}ms`);
        response.headers.set('X-Server-Timing', `total;dur=${duration.toFixed(2)}`);
      }
    }
  };
}

/**
 * Supabase 쿼리 성능 측정
 */
export class QueryPerformanceTracker {
  private queryCount = 0;
  private totalDuration = 0;
  private queries: Array<{ name: string; duration: number }> = [];

  /**
   * 쿼리 실행 시간 측정
   */
  async trackQuery<T>(
    name: string,
    queryFn: () => Promise<T>
  ): Promise<T> {
    const start = performance.now();
    this.queryCount++;

    try {
      const result = await queryFn();
      const duration = performance.now() - start;
      this.totalDuration += duration;
      this.queries.push({ name, duration });

      if (DEBUG) {
        console.log(`[Query] ${name}: ${duration.toFixed(2)}ms`);
      }

      if (duration > SLOW_THRESHOLD_MS) {
        console.warn(`[SLOW Query] ${name} took ${duration.toFixed(2)}ms`);
      }

      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.totalDuration += duration;
      console.error(`[Query Error] ${name} failed after ${duration.toFixed(2)}ms`, error);
      throw error;
    }
  }

  /**
   * 성능 통계 가져오기
   */
  getMetrics() {
    return {
      queryCount: this.queryCount,
      totalDuration: this.totalDuration,
      averageDuration: this.queryCount > 0 ? this.totalDuration / this.queryCount : 0,
      queries: this.queries
    };
  }

  /**
   * 성능 통계 로깅
   */
  logMetrics(endpoint: string) {
    const metrics = this.getMetrics();

    if (DEBUG || metrics.totalDuration > SLOW_THRESHOLD_MS) {
      console.log(`[Performance Summary] ${endpoint}:`, {
        queries: metrics.queryCount,
        total: `${metrics.totalDuration.toFixed(2)}ms`,
        average: `${metrics.averageDuration.toFixed(2)}ms`,
        breakdown: metrics.queries.map(q => `${q.name}: ${q.duration.toFixed(2)}ms`)
      });
    }
  }
}

/**
 * 간단한 타이머 헬퍼
 */
export function createTimer() {
  const start = performance.now();

  return {
    elapsed: () => performance.now() - start,
    log: (label: string) => {
      const elapsed = performance.now() - start;
      if (DEBUG) {
        console.log(`[Timer] ${label}: ${elapsed.toFixed(2)}ms`);
      }
      return elapsed;
    }
  };
}

/**
 * 성능 메트릭을 응답 헤더에 추가
 */
export function addPerformanceHeaders(
  response: Response,
  metrics: {
    total: number;
    queries?: number;
    queryTime?: number;
  }
): Response {
  const headers = new Headers(response.headers);

  headers.set('X-Response-Time', `${metrics.total.toFixed(2)}ms`);
  headers.set('X-Server-Timing', `total;dur=${metrics.total.toFixed(2)}`);

  if (metrics.queries !== undefined) {
    headers.set('X-Query-Count', metrics.queries.toString());
  }

  if (metrics.queryTime !== undefined) {
    headers.set('X-Query-Time', `${metrics.queryTime.toFixed(2)}ms`);
    headers.set(
      'X-Server-Timing',
      `total;dur=${metrics.total.toFixed(2)},db;dur=${metrics.queryTime.toFixed(2)}`
    );
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
