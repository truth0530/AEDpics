import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function restoreAllSubdivisions() {
  try {
    console.log('='.repeat(70));
    console.log('모든 sub_division 원본 명칭 복원 작업 시작');
    console.log('='.repeat(70));
    console.log('');

    const updates = [
      { from: '119구급차', to: '119및 의료기관 구급차' },
      { from: '공동주택', to: '500세대 이상 공동주택' },
      { from: '선박', to: '20톤이상 선박' },
    ];

    let totalUpdated = 0;

    for (const update of updates) {
      console.log(`처리 중: "${update.from}" → "${update.to}"`);

      // 현재 상태 확인
      const beforeCount = await prisma.$queryRaw`
        SELECT COUNT(*) as count
        FROM aedpics.target_list_2025
        WHERE sub_division = ${update.from}
      `;
      console.log(`  현재 "${update.from}" 레코드: ${beforeCount[0].count}개`);

      // 업데이트 실행
      const updateResult = await prisma.$executeRaw`
        UPDATE aedpics.target_list_2025
        SET sub_division = ${update.to}
        WHERE sub_division = ${update.from}
      `;
      console.log(`  업데이트 완료: ${updateResult}개 레코드`);
      totalUpdated += updateResult;

      // 결과 확인
      const afterCount = await prisma.$queryRaw`
        SELECT COUNT(*) as count
        FROM aedpics.target_list_2025
        WHERE sub_division = ${update.to}
      `;
      console.log(`  새로운 "${update.to}" 레코드: ${afterCount[0].count}개`);
      console.log('');
    }

    // 최종 전체 sub_division 목록 확인
    console.log('='.repeat(70));
    console.log('최종 전체 sub_division 목록:');
    console.log('='.repeat(70));
    const allSubDivisions = await prisma.$queryRaw`
      SELECT DISTINCT sub_division
      FROM aedpics.target_list_2025
      WHERE sub_division IS NOT NULL
      ORDER BY sub_division
    `;

    allSubDivisions.forEach((row, index) => {
      console.log(`${index + 1}. ${row.sub_division}`);
    });
    console.log('='.repeat(70));
    console.log(`\n총 ${allSubDivisions.length}개의 고유한 sub_division 값`);
    console.log(`총 ${totalUpdated}개 레코드 업데이트 완료`);
    console.log('='.repeat(70));

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

restoreAllSubdivisions();
