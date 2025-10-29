import { PrismaClient } from '@prisma/client';

// PrismaClient 싱글톤 인스턴스
// 개발 환경에서 Hot Reload로 인한 중복 생성 방지
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
  // 연결 풀 최적화
  datasourceUrl: process.env.DATABASE_URL,
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});