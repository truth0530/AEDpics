/**
 * Session Timeout Middleware
 *
 * Features:
 * - 30분 무활동 시 자동 로그아웃
 * - Redis 기반 세션 타임스탬프 관리
 * - 활동 시 자동 갱신
 *
 * NIS Certification: Session Management
 */

import { getRedisClient } from '@/lib/cache/redis-client';

const SESSION_TIMEOUT = 30 * 60; // 30 minutes in seconds
const SESSION_KEY_PREFIX = 'session:activity:';

/**
 * Update session activity timestamp
 */
export async function updateSessionActivity(userId: number): Promise<void> {
  const redis = getRedisClient();

  if (!redis) {
    console.warn('[Session Timeout] Redis not available, session timeout disabled');
    return;
  }

  const key = `${SESSION_KEY_PREFIX}${userId}`;
  const timestamp = Date.now();

  try {
    await redis.setex(key, SESSION_TIMEOUT, timestamp.toString());
  } catch (error) {
    console.error('[Session Timeout] Failed to update session activity:', error);
  }
}

/**
 * Check if session is active
 */
export async function isSessionActive(userId: number): Promise<boolean> {
  const redis = getRedisClient();

  if (!redis) {
    // If Redis is not available, assume session is active
    return true;
  }

  const key = `${SESSION_KEY_PREFIX}${userId}`;

  try {
    const timestamp = await redis.get(key);

    if (!timestamp) {
      // No session activity recorded
      return false;
    }

    const lastActivity = parseInt(timestamp, 10);
    const now = Date.now();
    const diff = (now - lastActivity) / 1000; // Convert to seconds

    return diff < SESSION_TIMEOUT;
  } catch (error) {
    console.error('[Session Timeout] Failed to check session activity:', error);
    // On error, assume session is active to avoid false logouts
    return true;
  }
}

/**
 * Clear session activity (on logout)
 */
export async function clearSessionActivity(userId: number): Promise<void> {
  const redis = getRedisClient();

  if (!redis) {
    return;
  }

  const key = `${SESSION_KEY_PREFIX}${userId}`;

  try {
    await redis.del(key);
  } catch (error) {
    console.error('[Session Timeout] Failed to clear session activity:', error);
  }
}

/**
 * Get remaining session time in seconds
 */
export async function getRemainingSessionTime(userId: number): Promise<number> {
  const redis = getRedisClient();

  if (!redis) {
    return SESSION_TIMEOUT;
  }

  const key = `${SESSION_KEY_PREFIX}${userId}`;

  try {
    const ttl = await redis.ttl(key);

    if (ttl === -2) {
      // Key does not exist
      return 0;
    }

    if (ttl === -1) {
      // Key exists but has no expiration
      return SESSION_TIMEOUT;
    }

    return ttl;
  } catch (error) {
    console.error('[Session Timeout] Failed to get remaining session time:', error);
    return SESSION_TIMEOUT;
  }
}
