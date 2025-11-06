import { prisma } from '@/lib/prisma';

async function fixCityCodes() {
  console.log('=== City Code 수정 작업 시작 ===\n');

  try {
    // 1. 인천 남동구 보건소 city_code 수정 (dong -> namdong)
    console.log('1. 인천 남동구 보건소 city_code 수정:');
    const namdongOrg = await prisma.organizations.findFirst({
      where: {
        name: '인천광역시 남동구 보건소'
      }
    });

    if (namdongOrg) {
      console.log(`  - 현재 city_code: ${namdongOrg.city_code}`);

      if (namdongOrg.city_code === 'dong' || namdongOrg.city_code === null) {
        await prisma.organizations.update({
          where: { id: namdongOrg.id },
          data: { city_code: 'namdong' }
        });
        console.log('  ✅ city_code를 "namdong"으로 수정했습니다.');
      }
    }

    // 2. 인천 동구 보건소 city_code 수정 (dong -> donggu)
    console.log('\n2. 인천 동구 보건소 city_code 수정:');
    const dongguOrg = await prisma.organizations.findFirst({
      where: {
        name: '인천광역시 동구 보건소'
      }
    });

    if (dongguOrg) {
      console.log(`  - 현재 city_code: ${dongguOrg.city_code}`);

      if (dongguOrg.city_code === 'dong') {
        await prisma.organizations.update({
          where: { id: dongguOrg.id },
          data: { city_code: 'donggu' }
        });
        console.log('  ✅ city_code를 "donggu"로 수정했습니다.');
      }
    }

    // 3. 서귀포시 보건소들 city_code 한글로 수정 (seogwipo -> 서귀포시)
    console.log('\n3. 서귀포시 보건소들 city_code 한글로 수정:');
    const seogwipoOrgs = await prisma.organizations.findMany({
      where: {
        name: {
          contains: '서귀포'
        }
      }
    });

    for (const org of seogwipoOrgs) {
      console.log(`  - ${org.name}: 현재 city_code = "${org.city_code}"`);

      if (org.city_code === 'seogwipo') {
        await prisma.organizations.update({
          where: { id: org.id },
          data: { city_code: '서귀포시' }
        });
        console.log(`    ✅ "서귀포시"로 수정했습니다.`);
      }
    }

    // 4. 제주시 보건소들 city_code 한글로 수정 (jeju -> 제주시)
    console.log('\n4. 제주시 보건소들 city_code 한글로 수정:');
    const jejuOrgs = await prisma.organizations.findMany({
      where: {
        region_code: 'JEJ',
        name: {
          contains: '제주시'
        }
      }
    });

    for (const org of jejuOrgs) {
      console.log(`  - ${org.name}: 현재 city_code = "${org.city_code}"`);

      if (org.city_code === 'jeju') {
        await prisma.organizations.update({
          where: { id: org.id },
          data: { city_code: '제주시' }
        });
        console.log(`    ✅ "제주시"로 수정했습니다.`);
      }
    }

    // 5. 최종 확인
    console.log('\n=== 수정 후 최종 확인 ===');

    console.log('\n인천광역시 보건소들:');
    const incheonOrgs = await prisma.organizations.findMany({
      where: {
        region_code: 'INC',
        type: 'health_center'
      },
      select: {
        name: true,
        city_code: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    for (const org of incheonOrgs) {
      console.log(`  - ${org.name}: city_code = "${org.city_code}"`);
    }

    console.log('\n제주특별자치도 보건소들:');
    const jejuAllOrgs = await prisma.organizations.findMany({
      where: {
        region_code: 'JEJ',
        type: 'health_center'
      },
      select: {
        name: true,
        city_code: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    for (const org of jejuAllOrgs) {
      console.log(`  - ${org.name}: city_code = "${org.city_code}"`);
    }

    // 6. 사용자 확인
    console.log('\n=== 영향받는 사용자 확인 ===');

    // 이인학 사용자
    const hak1212 = await prisma.user_profiles.findFirst({
      where: {
        email: 'hak1212@korea.kr'
      },
      include: {
        organizations: true
      }
    });

    if (hak1212 && hak1212.organizations) {
      console.log(`\n이인학 (hak1212@korea.kr):`);
      console.log(`  - 소속: ${hak1212.organizations.name}`);
      console.log(`  - city_code: ${hak1212.organizations.city_code}`);
    }

    // 고현아 사용자
    const gohyeonah = await prisma.user_profiles.findFirst({
      where: {
        full_name: '고현아'
      },
      include: {
        organizations: true
      }
    });

    if (gohyeonah && gohyeonah.organizations) {
      console.log(`\n고현아:`);
      console.log(`  - 소속: ${gohyeonah.organizations.name}`);
      console.log(`  - city_code: ${gohyeonah.organizations.city_code}`);
    }

  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 실행
fixCityCodes().catch(console.error);