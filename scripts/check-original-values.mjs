import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkOriginalValues() {
  try {
    console.log('='.repeat(70));
    console.log('원본 명칭과 비교 확인');
    console.log('='.repeat(70));
    console.log('');

    // preprocess_target_list.py의 매핑과 DB 실제 값 비교
    const mappings = [
      { original: '119및 의료기관 구급차', converted: '119구급차' },
      { original: '500세대 이상 공동주택', converted: '공동주택' },
      { original: '20톤이상 선박', converted: '선박' },
      { original: '교도소 등', converted: '교도소등' },
      { original: '중앙행정기관청사', converted: '중앙행정기관' },
      { original: '여객자동차터미널', converted: '자동차터미널' },
      { original: '철도역사대합실', converted: '철도역' },
      { original: '항만대합실', converted: '항만' },
      { original: '여객항공기', converted: '항공기' },
      { original: '철도차량객차', converted: '철도차량' },
    ];

    console.log('전처리 스크립트의 변환 매핑과 DB 실제 값 비교:\n');

    for (const mapping of mappings) {
      const originalCount = await prisma.$queryRaw`
        SELECT COUNT(*) as count
        FROM aedpics.target_list_2025
        WHERE sub_division = ${mapping.original}
      `;

      const convertedCount = await prisma.$queryRaw`
        SELECT COUNT(*) as count
        FROM aedpics.target_list_2025
        WHERE sub_division = ${mapping.converted}
      `;

      console.log(`원본: "${mapping.original}" - ${originalCount[0].count}개`);
      console.log(`변환: "${mapping.converted}" - ${convertedCount[0].count}개`);

      if (originalCount[0].count > 0) {
        console.log(`  → 원본 명칭이 DB에 저장됨 (변환 불필요)`);
      } else if (convertedCount[0].count > 0) {
        console.log(`  ⚠️ 변환된 명칭이 DB에 저장됨 (복원 필요!)`);
      } else {
        console.log(`  ℹ️ 둘 다 없음`);
      }
      console.log('');
    }

    console.log('='.repeat(70));

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkOriginalValues();
