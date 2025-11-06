import { prisma } from '@/lib/prisma';

async function standardizeCityCodes() {
  console.log('=== 모든 city_code 영어 포맷으로 통일 ===\n');

  try {
    // 변환 규칙: 한글 -> 영어
    const conversionMap: Record<string, string> = {
      '서귀포시': 'seogwipo',
      '제주시': 'jeju'
    };

    console.log('변환 규칙:');
    for (const [korean, english] of Object.entries(conversionMap)) {
      console.log(`  "${korean}" → "${english}"`);
    }

    // 변환할 조직 찾기
    const orgsToUpdate = await prisma.organizations.findMany({
      where: {
        city_code: {
          in: Object.keys(conversionMap)
        }
      }
    });

    console.log(`\n변환 대상: ${orgsToUpdate.length}개\n`);

    if (orgsToUpdate.length === 0) {
      console.log('변환 대상이 없습니다.');
      return;
    }

    // 각 조직을 변환
    for (const org of orgsToUpdate) {
      const newCode = conversionMap[org.city_code || ''];
      if (newCode) {
        console.log(`변환: ${org.name}`);
        console.log(`  "${org.city_code}" → "${newCode}"`);

        await prisma.organizations.update({
          where: { id: org.id },
          data: { city_code: newCode }
        });
      }
    }

    console.log('\n=== 변환 완료 ===\n');

    // 최종 확인
    console.log('최종 상태 확인:');
    const finalOrgs = await prisma.organizations.findMany({
      where: { type: 'health_center', region_code: 'JEJ' },
      select: { name: true, city_code: true }
    });

    for (const org of finalOrgs) {
      console.log(`  - ${org.name}: "${org.city_code}"`);
    }

    // 포맷 통계
    console.log('\n=== 최종 포맷 통계 ===');
    const allOrgs = await prisma.organizations.findMany({
      where: { type: 'health_center' },
      select: { city_code: true }
    });

    const formats = new Map<string, number>();
    for (const org of allOrgs) {
      const code = org.city_code;
      if (code) {
        const isKorean = /[가-힣]/.test(code);
        const format = isKorean ? 'Korean (한글)' : 'English (영어)';
        formats.set(format, (formats.get(format) || 0) + 1);
      }
    }

    console.log(`총 보건소: ${allOrgs.length}개`);
    for (const [format, count] of formats) {
      console.log(`  ${format}: ${count}개`);
    }

  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

standardizeCityCodes().catch(console.error);
