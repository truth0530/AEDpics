/**
 * Redis 캐싱 유틸리티
 *
 * ioredis를 사용하여 AED 데이터를 캐싱합니다 (Naver Cloud Platform Redis)
 * - 하루 단위로 갱신되는 데이터 특성에 최적화
 * - TTL 24시간 설정
 * - Fallback 로직 포함
 */

import { getRedisClient } from '@/lib/cache/redis-client';
import type Redis from 'ioredis';

export interface CacheConfig {
  key: string;
  ttl?: number; // seconds (기본값: 86400 = 24시간)
}

/**
 * Redis에서 데이터 조회
 */
export async function getCachedData<T>(key: string): Promise<T | null> {
  try {
    const redis = getRedisClient();

    // Redis가 설정되지 않은 경우 (로컬 개발 환경)
    if (!redis) {
      console.log('[Redis Cache] Redis not configured, skipping cache');
      return null;
    }

    const dataStr = await redis.get(key);

    if (dataStr) {
      console.log(`[Redis Cache] Cache HIT for key: ${key}`);
      return JSON.parse(dataStr) as T;
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
    const redis = getRedisClient();

    // Redis가 설정되지 않은 경우 (로컬 개발 환경)
    if (!redis) {
      console.log('[Redis Cache] Redis not configured, skipping cache set');
      return;
    }

    const dataStr = JSON.stringify(data);
    await redis.setex(key, ttl, dataStr);
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
    const redis = getRedisClient();

    if (!redis) {
      return;
    }

    await redis.del(key);
    console.log(`[Redis Cache] Deleted cache for key: ${key}`);
  } catch (error) {
    console.error('[Redis Cache] Error deleting from cache:', error);
  }
}

/**
 * 패턴에 맞는 모든 키 삭제 (예: "aed-data:*")
 * ioredis는 SCAN 명령을 지원하므로 패턴 삭제 가능
 */
export async function deletePatternCachedData(pattern: string): Promise<void> {
  try {
    const redis = getRedisClient();

    if (!redis) {
      return;
    }

    // SCAN을 사용하여 패턴에 맞는 키 찾기
    const stream = redis.scanStream({
      match: pattern,
      count: 100,
    });

    const keys: string[] = [];

    stream.on('data', (resultKeys: string[]) => {
      keys.push(...resultKeys);
    });

    stream.on('end', async () => {
      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`[Redis Cache] Deleted ${keys.length} keys matching pattern: ${pattern}`);
      } else {
        console.log(`[Redis Cache] No keys found matching pattern: ${pattern}`);
      }
    });
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
