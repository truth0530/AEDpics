import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== 테스트 가능 계정 확인 ===\n');

  const accounts = await prisma.userProfile.findMany({
    where: {
      approval_status: 'approved',
      role: {
        in: ['master_admin', 'local_admin', 'regional_admin']
      }
    },
    select: {
      email: true,
      role: true,
      region_code: true,
      city_code: true,
      jurisdiction_health_center: true
    },
    orderBy: [
      { role: 'asc' },
      { email: 'asc' }
    ],
    take: 10
  });

  console.log('테스트 가능한 계정:');
  console.log('==================\n');

  accounts.forEach((acc, idx) => {
    console.log(`${idx + 1}. ${acc.email}`);
    console.log(`   역할: ${acc.role}`);
    console.log(`   지역: ${acc.region_code || 'N/A'}`);
    console.log(`   시군구: ${acc.city_code || 'N/A'}`);
    console.log(`   관할보건소: ${acc.jurisdiction_health_center || 'N/A'}`);
    console.log('');
  });

  console.log(`\n총 ${accounts.length}개 계정 발견`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
