import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

console.log('Checking target_list_2025 table...\n');

try {
  const totalCount = await prisma.target_list_2025.count();
  console.log('Total records:', totalCount);

  if (totalCount === 0) {
    console.log('\nERROR: target_list_2025 table is EMPTY!');
    console.log('This is why compliance page shows no data.\n');
    await prisma.$disconnect();
    process.exit(0);
  }

  const sidoGroups = await prisma.$queryRaw`
    SELECT sido, COUNT(*)::int as count
    FROM aedpics.target_list_2025
    GROUP BY sido
    ORDER BY sido
    LIMIT 20
  `;
  console.log('\nSido distribution:');
  sidoGroups.forEach(g => {
    console.log('  ' + g.sido + ':', g.count);
  });

  const samples = await prisma.target_list_2025.findMany({
    take: 5,
    select: {
      target_key: true,
      institution_name: true,
      sido: true,
      gugun: true,
      division: true,
      sub_division: true,
      address: true
    }
  });
  console.log('\nSample data:');
  samples.forEach((s, idx) => {
    console.log('  ' + (idx + 1) + '. ' + s.institution_name);
    console.log('     ' + s.sido + ' ' + s.gugun + ' - ' + s.address);
  });

  const devicesCount = await prisma.target_list_devices.count({
    where: { target_list_year: 2025 }
  });
  console.log('\nMatched devices:', devicesCount);

} catch (error) {
  console.error('Error:', error.message);
} finally {
  await prisma.$disconnect();
}
