/**
 * Redis 캐싱 유틸리티
 *
 * Vercel KV를 사용하여 AED 데이터를 캐싱합니다.
 * - 하루 단위로 갱신되는 데이터 특성에 최적화
 * - TTL 24시간 설정
 * - Fallback 로직 포함
 */

import { kv } from '@vercel/kv';

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
    if (!process.env.KV_REST_API_URL) {
      console.log('[Redis Cache] KV not configured, skipping cache');
      return null;
    }

    const data = await kv.get<T>(key);

    if (data) {
      console.log(`[Redis Cache] Cache HIT for key: ${key}`);
      return data;
    } else {
      console.log(`[Redis Cache] Cache MISS for key: ${key}`);
      return null;
    }
  } catch (error) {
    console.error('[Redis Cache] Error reading from cache:', error);
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
    if (!process.env.KV_REST_API_URL) {
      console.log('[Redis Cache] KV not configured, skipping cache set');
      return;
    }

    await kv.set(key, data, { ex: ttl });
    console.log(`[Redis Cache] Cached data for key: ${key} (TTL: ${ttl}s)`);
  } catch (error) {
    console.error('[Redis Cache] Error writing to cache:', error);
    // Fail silently - don't break the application if caching fails
  }
}

/**
 * Redis에서 데이터 삭제
 */
export async function deleteCachedData(key: string): Promise<void> {
  try {
    if (!process.env.KV_REST_API_URL) {
      return;
    }

    await kv.del(key);
    console.log(`[Redis Cache] Deleted cache for key: ${key}`);
  } catch (error) {
    console.error('[Redis Cache] Error deleting from cache:', error);
  }
}

/**
 * 패턴에 맞는 모든 키 삭제 (예: "aed-data:*")
 */
export async function deletePatternCachedData(pattern: string): Promise<void> {
  try {
    if (!process.env.KV_REST_API_URL) {
      return;
    }

    // Vercel KV는 SCAN 명령을 지원하지 않으므로, 직접 키를 관리해야 함
    // 대신 특정 키만 삭제하는 방식 사용
    console.warn('[Redis Cache] Pattern deletion not supported in Vercel KV');
  } catch (error) {
    console.error('[Redis Cache] Error deleting pattern from cache:', error);
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
