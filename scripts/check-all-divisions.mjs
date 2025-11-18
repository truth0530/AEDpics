import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAllDivisions() {
  try {
    console.log('Checking division and sub_division values in target_list_2025...\n');

    // division 확인
    const divisions = await prisma.$queryRaw`
      SELECT DISTINCT division
      FROM aedpics.target_list_2025
      WHERE division IS NOT NULL
      ORDER BY division
    `;

    console.log('DIVISION values:');
    console.log('='.repeat(70));
    divisions.forEach((row, index) => {
      console.log(`${index + 1}. ${row.division}`);
    });
    console.log('='.repeat(70));
    console.log(`Total: ${divisions.length} distinct division values\n`);

    // sub_division 확인
    const subDivisions = await prisma.$queryRaw`
      SELECT DISTINCT sub_division
      FROM aedpics.target_list_2025
      WHERE sub_division IS NOT NULL
      ORDER BY sub_division
    `;

    console.log('SUB_DIVISION values:');
    console.log('='.repeat(70));
    subDivisions.forEach((row, index) => {
      console.log(`${index + 1}. ${row.sub_division}`);
    });
    console.log('='.repeat(70));
    console.log(`Total: ${subDivisions.length} distinct sub_division values\n`);

    // division별 sub_division 확인
    console.log('DIVISION -> SUB_DIVISION mapping:');
    console.log('='.repeat(70));

    const mapping = await prisma.$queryRaw`
      SELECT DISTINCT division, sub_division
      FROM aedpics.target_list_2025
      WHERE division IS NOT NULL AND sub_division IS NOT NULL
      ORDER BY division, sub_division
    `;

    let currentDivision = '';
    mapping.forEach((row) => {
      if (row.division !== currentDivision) {
        currentDivision = row.division;
        console.log(`\n${currentDivision}:`);
      }
      console.log(`  - ${row.sub_division}`);
    });
    console.log('='.repeat(70));

    // "대규모사업장" 또는 "300명이상 사업장" 검색
    console.log('\nSearching for specific values:');
    console.log('='.repeat(70));

    const search1 = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM aedpics.target_list_2025
      WHERE sub_division LIKE '%대규모%'
    `;
    console.log(`Records with "대규모" in sub_division: ${search1[0].count}`);

    const search2 = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM aedpics.target_list_2025
      WHERE sub_division LIKE '%300%'
    `;
    console.log(`Records with "300" in sub_division: ${search2[0].count}`);

    const search3 = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM aedpics.target_list_2025
      WHERE division LIKE '%대규모%'
    `;
    console.log(`Records with "대규모" in division: ${search3[0].count}`);

    const search4 = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM aedpics.target_list_2025
      WHERE division LIKE '%300%'
    `;
    console.log(`Records with "300" in division: ${search4[0].count}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllDivisions();
