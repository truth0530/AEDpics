import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSubdivisions() {
  try {
    console.log('Checking sub_division values in target_list_2025...\n');

    const result = await prisma.$queryRaw`
      SELECT DISTINCT sub_division
      FROM aedpics.target_list_2025
      WHERE sub_division IS NOT NULL
      ORDER BY sub_division
    `;

    console.log('Found sub_division values:');
    console.log('='.repeat(50));
    result.forEach((row, index) => {
      console.log(`${index + 1}. ${row.sub_division}`);
    });
    console.log('='.repeat(50));
    console.log(`\nTotal: ${result.length} distinct values`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSubdivisions();
