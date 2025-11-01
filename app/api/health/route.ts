import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

import { prisma } from '@/lib/prisma';
/**
 * Health Check API
 *
 * GET /api/health
 *
 * 시스템 상태를 확인합니다:
 * - 애플리케이션 실행 상태
 * - 데이터베이스 연결 상태
 * - 업타임
 */
export async function GET() {
  const startTime = Date.now();

  try {
    // 데이터베이스 연결 확인
    await prisma.$queryRaw`SELECT 1`;

    // 기본 데이터 존재 여부 확인
    const [organizationCount, userCount, aedCount] = await Promise.all([
      prisma.organizations.count(),
      prisma.user_profiles.count(),
      prisma.aed_data.count()
    ]);

    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime: `${responseTime}ms`,
      database: {
        status: 'connected',
        organizations: organizationCount,
        users: userCount,
        aedDevices: aedCount
      },
      environment: env.NODE_ENV || 'development',
      version: '1.0.0'
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error('API:health', 'Health check failed', error instanceof Error ? error : { error });

    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime: `${responseTime}ms`,
      database: {
        status: 'disconnected',
        error: (error as Error).message
      },
      environment: env.NODE_ENV || 'development'
    }, { status: 503 });
  }
}
