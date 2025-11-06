import { prisma } from '@/lib/prisma';

async function fixJejuCityCodes() {
  console.log('=== 제주도 city_code 수정 ===\n');

  try {
    // 1. 현재 상태 확인
    console.log('현재 상태:');
    const jejuOrganizations = await prisma.organizations.findMany({
      where: {
        region_code: 'JEJ',
        type: 'health_center'
      },
      orderBy: {
        name: 'asc'
      }
    });

    console.log('모든 제주도 보건소가 city_code="jeju"로 설정되어 있어');
    console.log('제주시와 서귀포시가 구분되지 않는 상태입니다.\n');

    // 2. 서귀포시 보건소들 수정
    console.log('=== 서귀포시 보건소 city_code 수정 ===\n');

    const seogwipoHealthCenters = jejuOrganizations.filter(org =>
      org.name.includes('서귀포')
    );

    for (const org of seogwipoHealthCenters) {
      console.log(`수정 중: ${org.name}`);

      await prisma.organizations.update({
        where: {
          id: org.id
        },
        data: {
          city_code: 'seogwipo',  // jeju → seogwipo로 변경
          updated_at: new Date()
        }
      });

      console.log(`  ✅ city_code: jeju → seogwipo 변경 완료`);
    }

    console.log(`\n서귀포시 보건소 ${seogwipoHealthCenters.length}개 수정 완료`);

    // 3. 제주시 보건소들은 그대로 유지 (이미 jeju)
    console.log('\n=== 제주시 보건소 확인 ===\n');

    const jejuCityHealthCenters = jejuOrganizations.filter(org =>
      org.name.includes('제주시')
    );

    console.log(`제주시 보건소 ${jejuCityHealthCenters.length}개: city_code="jeju" 유지`);

    // 4. 최종 상태 확인
    console.log('\n=== 수정 후 최종 상태 ===\n');

    const finalState = await prisma.organizations.findMany({
      where: {
        region_code: 'JEJ',
        type: 'health_center'
      },
      select: {
        name: true,
        city_code: true
      },
      orderBy: {
        city_code: 'asc',
        name: 'asc'
      }
    });

    // city_code별로 그룹화
    const jejuCityOrgs = finalState.filter(org => org.city_code === 'jeju');
    const seogwipoOrgs = finalState.filter(org => org.city_code === 'seogwipo');

    console.log('제주시 (city_code="jeju"):');
    for (const org of jejuCityOrgs) {
      console.log(`  - ${org.name}`);
    }

    console.log('\n서귀포시 (city_code="seogwipo"):');
    for (const org of seogwipoOrgs) {
      console.log(`  - ${org.name}`);
    }

    // 5. 영향받는 사용자 확인
    console.log('\n=== 영향받는 사용자 ===\n');

    const affectedUsers = await prisma.user_profiles.findMany({
      where: {
        organizations: {
          region_code: 'JEJ',
          type: 'health_center'
        }
      },
      include: {
        organizations: true
      }
    });

    for (const user of affectedUsers) {
      const cityName = user.organizations?.city_code === 'seogwipo' ? '서귀포시' : '제주시';
      console.log(`${user.full_name} (${user.email})`);
      console.log(`  - 조직: ${user.organizations?.name}`);
      console.log(`  - 이제 ${cityName} 데이터만 조회 가능`);
      console.log('');
    }

    console.log('✨ 수정 완료!');
    console.log('이제 제주시와 서귀포시 보건소가 각자의 관할 지역 데이터만 볼 수 있습니다.');

  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixJejuCityCodes().catch(console.error);