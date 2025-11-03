import { prisma } from '../lib/prisma';

async function checkCategories() {
  try {
    const categories = await prisma.$queryRaw<Array<{category_1: string | null, count: bigint}>>`
      SELECT category_1, COUNT(*) as count
      FROM aedpics.aed_data
      WHERE sido = '대구'
      GROUP BY category_1
      ORDER BY count DESC
      LIMIT 30
    `;

    console.log('\n=== 대구 지역 category_1 분포 ===\n');
    categories.forEach(cat => {
      console.log(`${cat.category_1 || 'NULL'}: ${cat.count.toString()}`);
    });

    console.log('\n=== 구비의무기관 관련 검색 ===\n');
    const mandatorySearch = await prisma.$queryRaw<Array<{category_1: string | null, count: bigint}>>`
      SELECT category_1, COUNT(*) as count
      FROM aedpics.aed_data
      WHERE sido = '대구'
        AND (
          category_1 LIKE '%공동주택%'
          OR category_1 LIKE '%공항%'
          OR category_1 LIKE '%항만%'
          OR category_1 LIKE '%역사%'
          OR category_1 LIKE '%학교%'
          OR category_1 LIKE '%점포%'
        )
      GROUP BY category_1
      ORDER BY count DESC
    `;

    if (mandatorySearch.length > 0) {
      console.log('구비의무기관 관련 카테고리 발견:');
      mandatorySearch.forEach(cat => {
        console.log(`${cat.category_1}: ${cat.count.toString()}`);
      });
    } else {
      console.log('구비의무기관 관련 카테고리를 찾을 수 없습니다.');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCategories();
