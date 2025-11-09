import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user_profiles.findMany({
    select: { id: true, email: true, full_name: true, role: true, is_active: true },
    take: 10
  });
  console.log(JSON.stringify(users, null, 2));
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e.message);
  process.exit(1);
});
