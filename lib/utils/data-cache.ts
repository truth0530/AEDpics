// 데이터 캐싱 유틸리티

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class DataCache {
  private cache: Map<string, CacheItem<unknown>> = new Map();
  private defaultTTL = 5 * 60 * 1000; // 5분 기본 TTL

  /**
   * 캐시에 데이터 저장
   */
  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    });
  }

  /**
   * 캐시에서 데이터 가져오기
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key);

    if (!item) {
      return null;
    }

    // TTL 체크
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data as T;
  }

  /**
   * 캐시 무효화
   */
  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    // 패턴과 일치하는 키들 삭제
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 캐시 존재 여부 확인
   */
  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;

    // TTL 체크
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 캐시 키 생성 헬퍼
   */
  static createKey(prefix: string, params: Record<string, unknown>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join('_');
    return `${prefix}_${sortedParams}`;
  }
}

// 싱글톤 인스턴스
export const dataCache = new DataCache();

/**
 * 캐시된 데이터 페치 헬퍼
 */
export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // 캐시 확인
  const cached = dataCache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // 데이터 페치
  const data = await fetcher();

  // 캐시 저장
  dataCache.set(key, data, ttl);

  return data;
}

/**
 * 페이지네이션 헬퍼
 */
export interface PaginationParams {
  page: number;
  pageSize: number;
  total?: number;
}

export interface PaginatedData<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export function createPaginatedResponse<T>(
  data: T[],
  params: PaginationParams,
  total: number
): PaginatedData<T> {
  const totalPages = Math.ceil(total / params.pageSize);

  return {
    data,
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages,
      hasNext: params.page < totalPages,
      hasPrev: params.page > 1
    }
  };
}

/**
 * 쿼리 파라미터에서 페이지네이션 정보 추출
 */
export function getPaginationParams(
  searchParams: URLSearchParams,
  defaultPageSize = 20
): PaginationParams {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1,
    parseInt(searchParams.get('pageSize') || String(defaultPageSize), 10)
  ));

  return { page, pageSize };
}

/**
 * Supabase 쿼리에 페이지네이션 적용
 */
export function applyPagination<T extends { range: (from: number, to: number) => T }>(
  query: T,
  params: PaginationParams
): T {
  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;
  return query.range(from, to);
}