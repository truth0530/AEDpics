import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
      prisma.organization.count(),
      prisma.user_profiles.count(),
      prisma.aedData.count()
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
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0'
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;

    console.error('[Health Check] Error:', error);

    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime: `${responseTime}ms`,
      database: {
        status: 'disconnected',
        error: (error as Error).message
      },
      environment: process.env.NODE_ENV || 'development'
    }, { status: 503 });
  }
}
