import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixSubdivisionNames() {
  try {
    console.log('='.repeat(70));
    console.log('sub_division 원본 명칭 복원 작업 시작');
    console.log('='.repeat(70));
    console.log('');

    // 현재 상태 확인
    console.log('1. 현재 상태 확인...');
    const beforeCount = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM aedpics.target_list_2025
      WHERE sub_division = '대규모사업장'
    `;
    console.log(`   "대규모사업장" 레코드: ${beforeCount[0].count}개`);

    // 업데이트 실행
    console.log('\n2. "대규모사업장" → "300명이상 사업장" 업데이트 중...');
    const updateResult = await prisma.$executeRaw`
      UPDATE aedpics.target_list_2025
      SET sub_division = '300명이상 사업장'
      WHERE sub_division = '대규모사업장'
    `;
    console.log(`   업데이트 완료: ${updateResult}개 레코드`);

    // 결과 확인
    console.log('\n3. 결과 확인...');
    const afterOld = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM aedpics.target_list_2025
      WHERE sub_division = '대규모사업장'
    `;
    console.log(`   "대규모사업장" 레코드: ${afterOld[0].count}개 (0이어야 정상)`);

    const afterNew = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM aedpics.target_list_2025
      WHERE sub_division = '300명이상 사업장'
    `;
    console.log(`   "300명이상 사업장" 레코드: ${afterNew[0].count}개`);

    // 전체 sub_division 목록 확인
    console.log('\n4. 업데이트 후 전체 sub_division 목록:');
    const allSubDivisions = await prisma.$queryRaw`
      SELECT DISTINCT sub_division
      FROM aedpics.target_list_2025
      WHERE sub_division IS NOT NULL
      ORDER BY sub_division
    `;
    console.log('='.repeat(70));
    allSubDivisions.forEach((row, index) => {
      console.log(`${index + 1}. ${row.sub_division}`);
    });
    console.log('='.repeat(70));
    console.log(`\n총 ${allSubDivisions.length}개의 고유한 sub_division 값`);

    console.log('\n작업 완료!');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixSubdivisionNames();
