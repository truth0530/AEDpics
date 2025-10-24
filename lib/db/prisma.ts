/**
 * Prisma Client Singleton
 *
 * Naver Cloud Platform PostgreSQL 연결 관리
 * - Connection pooling
 * - Error handling
 * - Development vs Production 최적화
 */

import { PrismaClient } from '@prisma/client';

// Global Prisma instance for development (Hot Module Replacement 지원)
const globalForPrisma = global as unknown as { prisma: PrismaClient };

/**
 * Prisma Client 싱글톤
 *
 * Development: Hot reload 시 연결 재사용
 * Production: 단일 인스턴스 사용
 */
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
    errorFormat: 'pretty',
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Prisma Client 연결 종료 (Graceful Shutdown)
 */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
  console.log('[Prisma] Disconnected from database');
}

/**
 * 데이터베이스 연결 상태 확인
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('[Prisma] Database connection OK');
    return true;
  } catch (error) {
    console.error('[Prisma] Database connection failed:', error);
    return false;
  }
}

/**
 * 데이터베이스 트랜잭션 헬퍼
 *
 * @example
 * await withTransaction(async (tx) => {
 *   await tx.user.create({ data: { email: 'test@example.com' } });
 *   await tx.auditLog.create({ data: { action: 'CREATE', resource: 'User' } });
 * });
 */
export async function withTransaction<T>(
  callback: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  return await prisma.$transaction(async (tx) => {
    return await callback(tx as PrismaClient);
  });
}

/**
 * 감사 로그 생성 헬퍼
 *
 * 국정원 인증 요구사항: 모든 중요한 작업에 감사 로그 기록
 */
export async function createAuditLog(data: {
  userId?: number;
  action: string;
  resource: string;
  resourceId?: number;
  changes?: object;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId,
        changes: data.changes ? JSON.stringify(data.changes) : null,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  } catch (error) {
    console.error('[Audit Log] Failed to create audit log:', error);
    // Fail silently - don't break application flow
  }
}

/**
 * 성능 로그 생성 헬퍼
 */
export async function createPerformanceLog(data: {
  operation: string;
  duration: number;
  success: boolean;
  errorMessage?: string;
}): Promise<void> {
  try {
    await prisma.performanceLog.create({
      data: {
        operation: data.operation,
        duration: data.duration,
        success: data.success,
        errorMessage: data.errorMessage,
      },
    });
  } catch (error) {
    console.error('[Performance Log] Failed to create performance log:', error);
  }
}

/**
 * Connection Pool 상태 확인 (디버깅용)
 */
export function getConnectionPoolStats() {
  // Prisma는 내부적으로 connection pool 관리
  // 환경 변수로 설정 가능: DATABASE_URL?connection_limit=10
  return {
    provider: 'PostgreSQL',
    poolSize: process.env.DATABASE_POOL_SIZE || 'default (10)',
    timeout: process.env.DATABASE_TIMEOUT || 'default (5s)',
  };
}
