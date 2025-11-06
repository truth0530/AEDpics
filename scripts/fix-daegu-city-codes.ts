import { prisma } from '@/lib/prisma';

// 대구광역시 구군 코드 매핑
const DAEGU_CITY_CODES = {
  '중구': 'jung',
  '동구': 'dong',
  '서구': 'seo',
  '남구': 'nam',
  '북구': 'buk',
  '수성구': 'suseong',
  '달서구': 'dalseo',
  '달성군': 'dalseong',
  '군위군': 'gunwi'
};

async function fixDaeguCityCodes() {
  console.log('=== 대구 지역 보건소 city_code 수정 시작 ===\n');

  try {
    // 대구 지역 health_center 조회
    const daeguHealthCenters = await prisma.organizations.findMany({
      where: {
        region_code: 'DAE',
        type: 'health_center'
      },
      select: {
        id: true,
        name: true,
        address: true,
        city_code: true
      }
    });

    console.log(`대구 지역 보건소 ${daeguHealthCenters.length}개 발견\n`);

    let updatedCount = 0;
    let skipCount = 0;

    for (const org of daeguHealthCenters) {
      console.log(`\n처리중: ${org.name}`);
      console.log(`  주소: ${org.address}`);
      console.log(`  현재 city_code: ${org.city_code || '없음'}`);

      // 주소나 이름에서 구군명 추출
      let detectedGu = null;

      for (const [guName, guCode] of Object.entries(DAEGU_CITY_CODES)) {
        if (org.name.includes(guName) || org.address?.includes(guName)) {
          detectedGu = { name: guName, code: guCode };
          break;
        }
      }

      if (!detectedGu) {
        console.log(`  ⚠️ 경고: 구군을 식별할 수 없습니다.`);
        skipCount++;
        continue;
      }

      if (org.city_code === detectedGu.code) {
        console.log(`  ✅ 이미 올바른 city_code가 설정되어 있습니다: ${detectedGu.code}`);
        skipCount++;
        continue;
      }

      // city_code 업데이트
      await prisma.organizations.update({
        where: { id: org.id },
        data: { city_code: detectedGu.code }
      });

      console.log(`  ✨ city_code 업데이트: ${org.city_code || '없음'} → ${detectedGu.code}`);
      updatedCount++;
    }

    console.log('\n' + '='.repeat(60));
    console.log(`처리 완료:`);
    console.log(`  - 업데이트된 조직: ${updatedCount}개`);
    console.log(`  - 건너뛴 조직: ${skipCount}개`);
    console.log(`  - 전체 처리: ${daeguHealthCenters.length}개`);

    // 업데이트 결과 확인
    if (updatedCount > 0) {
      console.log('\n=== 업데이트 확인 ===\n');
      const updatedOrgs = await prisma.organizations.findMany({
        where: {
          region_code: 'DAE',
          type: 'health_center',
          city_code: { not: null }
        },
        select: {
          name: true,
          city_code: true,
          address: true
        }
      });

      for (const org of updatedOrgs) {
        console.log(`${org.name}`);
        console.log(`  - city_code: ${org.city_code}`);
        console.log(`  - 주소: ${org.address}`);
      }
    }

    // 관련 사용자 정보 표시
    console.log('\n=== 영향받는 사용자 ===\n');
    const affectedUsers = await prisma.user_profiles.findMany({
      where: {
        organizations: {
          region_code: 'DAE',
          type: 'health_center'
        },
        role: 'local_admin'
      },
      include: {
        organizations: {
          select: {
            name: true,
            city_code: true
          }
        }
      },
      select: {
        full_name: true,
        email: true,
        organizations: true
      }
    });

    for (const user of affectedUsers) {
      console.log(`${user.full_name} (${user.email})`);
      console.log(`  - 조직: ${user.organizations?.name}`);
      console.log(`  - city_code: ${user.organizations?.city_code || '없음'}`);

      if (user.organizations?.city_code) {
        const guName = Object.entries(DAEGU_CITY_CODES).find(
          ([_, code]) => code === user.organizations?.city_code
        )?.[0];
        console.log(`  - ✅ 이제 ${guName} 데이터만 볼 수 있습니다.`);
      } else {
        console.log(`  - ⚠️ city_code가 없어서 대구 전체 데이터를 봅니다.`);
      }
    }

  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixDaeguCityCodes().catch(console.error);