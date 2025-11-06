import { prisma } from '@/lib/prisma';

async function checkAllCityCodes() {
  try {
    console.log('=== 모든 보건소 city_code 현황 ===\n');

    const orgs = await prisma.organizations.findMany({
      where: { type: 'health_center' },
      select: { name: true, city_code: true, region_code: true },
      orderBy: [{ region_code: 'asc' }, { name: 'asc' }]
    });

    const grouped = new Map<string, typeof orgs>();
    for (const org of orgs) {
      const key = org.region_code;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(org);
    }

    for (const [region, items] of grouped) {
      console.log(`[${region}] (${items.length}개)`);
      for (const item of items) {
        console.log(`  - ${item.name}: "${item.city_code || 'null'}"`);
      }
      console.log();
    }

    // 포맷 통계
    const formats = new Map<string, number>();
    for (const org of orgs) {
      const code = org.city_code;
      if (code) {
        const isKorean = /[가-힣]/.test(code);
        const format = isKorean ? 'Korean (한글)' : 'English (영어)';
        formats.set(format, (formats.get(format) || 0) + 1);
      }
    }

    console.log('=== 포맷 통계 ===');
    console.log(`총 보건소: ${orgs.length}개`);
    for (const [format, count] of formats) {
      console.log(`  ${format}: ${count}개`);
    }

    // 혼합 사용 중인 지역 찾기
    console.log('\n=== 혼합 포맷 사용 지역 ===');
    let hasMixed = false;
    for (const [region, items] of grouped) {
      const formats = new Set<string>();
      for (const item of items) {
        if (item.city_code) {
          const isKorean = /[가-힣]/.test(item.city_code);
          formats.add(isKorean ? 'Korean' : 'English');
        }
      }
      if (formats.size > 1) {
        console.log(`  [${region}]: ${Array.from(formats).join(' + ')} 혼합`);
        hasMixed = true;
      }
    }
    if (!hasMixed) {
      console.log('  혼합 포맷 사용 지역 없음');
    }

  } finally {
    await prisma.$disconnect();
  }
}

checkAllCityCodes().catch(console.error);
