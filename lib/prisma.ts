import { PrismaClient } from '@prisma/client';

// PrismaClient 싱글톤 인스턴스
// 개발 환경에서 Hot Reload로 인한 중복 생성 방지
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Configure database URL with connection pooling and timeout settings
const getDatabaseUrl = () => {
  const url = process.env.DATABASE_URL;
  if (!url) return url;

  // Add connection pooling and timeout parameters
  const urlWithParams = new URL(url);
  urlWithParams.searchParams.set('connection_limit', '10');
  urlWithParams.searchParams.set('pool_timeout', '30');
  urlWithParams.searchParams.set('statement_timeout', '30000'); // 30 seconds
  urlWithParams.searchParams.set('connect_timeout', '10');

  return urlWithParams.toString();
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
  // 연결 풀 최적화
  datasourceUrl: getDatabaseUrl(),
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});