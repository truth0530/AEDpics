import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDivisions() {
  console.log('=== 티웨이항공과 군위군보건소의 sub_division 확인 ===\n');

  const targets = await prisma.target_list_2025.findMany({
    where: {
      OR: [
        { institution_name: { contains: '티웨이' } },
        { institution_name: { contains: '군위군' } }
      ],
      data_year: 2025
    },
    select: {
      target_key: true,
      institution_name: true,
      division: true,
      sub_division: true,
      sido: true,
      gugun: true
    }
  });

  targets.forEach(t => {
    console.log(`기관명: ${t.institution_name}`);
    console.log(`  target_key: ${t.target_key}`);
    console.log(`  sido: ${t.sido}, gugun: ${t.gugun}`);
    console.log(`  division: ${t.division || 'NULL'}`);
    console.log(`  sub_division: ${t.sub_division || 'NULL'}`);
    console.log('');
  });

  await prisma.$disconnect();
}

checkDivisions().catch(console.error);
