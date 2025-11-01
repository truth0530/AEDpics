/**
 * Redis 캐싱 유틸리티
 *
 * NCP 환경에서는 Vercel KV 대신 자체 Redis 또는 캐싱 없이 운영
 * - 하루 단위로 갱신되는 데이터 특성에 최적화
 * - TTL 24시간 설정
 * - Fallback 로직 포함
 */

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

// TODO: Vercel KV 제거 후 NCP Redis로 교체 필요
// import { kv } from '@vercel/kv';
const kv = {
  get: async <T>(_key: string): Promise<T | null> => null,
  set: async (_key: string, _data: any, _options?: any): Promise<void> => {},
  del: async (_key: string): Promise<void> => {},
};

export interface CacheConfig {
  key: string;
  ttl?: number; // seconds (기본값: 86400 = 24시간)
}

/**
 * Redis에서 데이터 조회
 */
export async function getCachedData<T>(key: string): Promise<T | null> {
  try {
    // Vercel KV가 설정되지 않은 경우 (로컬 개발 환경)
    if (!env.KV_REST_API_URL) {
      logger.info('Cache:get', 'KV not configured, skipping cache', { key });
      return null;
    }

    const data = await kv.get<T>(key);

    if (data) {
      logger.info('Cache:get', 'Cache HIT', { key });
      return data;
    } else {
      logger.info('Cache:get', 'Cache MISS', { key });
      return null;
    }
  } catch (error) {
    logger.error('Cache:get', 'Error reading from cache', error instanceof Error ? error : { error, key });
    return null; // Fallback to database
  }
}

/**
 * Redis에 데이터 저장
 */
export async function setCachedData<T>(
  key: string,
  data: T,
  ttl: number = 86400 // 기본값: 24시간
): Promise<void> {
  try {
    // Vercel KV가 설정되지 않은 경우 (로컬 개발 환경)
    if (!env.KV_REST_API_URL) {
      logger.info('Cache:set', 'KV not configured, skipping cache set', { key });
      return;
    }

    await kv.set(key, data, { ex: ttl });
    logger.info('Cache:set', 'Cached data', { key, ttl });
  } catch (error) {
    logger.error('Cache:set', 'Error writing to cache', error instanceof Error ? error : { error, key });
    // Fail silently - don't break the application if caching fails
  }
}

/**
 * Redis에서 데이터 삭제
 */
export async function deleteCachedData(key: string): Promise<void> {
  try {
    if (!env.KV_REST_API_URL) {
      return;
    }

    await kv.del(key);
    logger.info('Cache:delete', 'Deleted cache', { key });
  } catch (error) {
    logger.error('Cache:delete', 'Error deleting from cache', error instanceof Error ? error : { error, key });
  }
}

/**
 * 패턴에 맞는 모든 키 삭제 (예: "aed-data:*")
 */
export async function deletePatternCachedData(pattern: string): Promise<void> {
  try {
    if (!env.KV_REST_API_URL) {
      return;
    }

    // Vercel KV는 SCAN 명령을 지원하지 않으므로, 직접 키를 관리해야 함
    // 대신 특정 키만 삭제하는 방식 사용
    logger.warn('Cache:deletePattern', 'Pattern deletion not supported in Vercel KV', { pattern });
  } catch (error) {
    logger.error('Cache:deletePattern', 'Error deleting pattern from cache', error instanceof Error ? error : { error, pattern });
  }
}

/**
 * AED 데이터 캐시 키 생성
 */
export function getAEDDataCacheKey(snapshotDate: string): string {
  return `aed-data:${snapshotDate}`;
}

/**
 * 사용자별 스케줄 캐시 키 생성
 */
export function getUserScheduleCacheKey(userId: string): string {
  return `user-schedule:${userId}`;
}
