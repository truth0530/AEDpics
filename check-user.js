import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user_profiles.findUnique({
    where: { email: 'nemcdg@korea.kr' },
    select: { id: true, email: true, full_name: true, role: true, is_active: true }
  });
  
  if (user) {
    console.log('사용자 찾음:', JSON.stringify(user, null, 2));
  } else {
    console.log('nemcdg@korea.kr 사용자 없음. 유사한 계정 검색:');
    const similar = await prisma.user_profiles.findMany({
      where: { email: { contains: 'nemcdg' } },
      select: { email: true, full_name: true, role: true }
    });
    console.log(JSON.stringify(similar, null, 2));
  }
  
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e.message);
  process.exit(1);
});
