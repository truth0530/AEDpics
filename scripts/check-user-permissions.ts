import { prisma } from '@/lib/prisma';

async function checkUserPermissions() {
  console.log('=== 사용자 권한 문제 확인 ===\n');

  try {
    // 1. 남동구보건소 조직 정보 확인
    console.log('1. 남동구보건소 조직 정보 확인:');
    const namdongOrg = await prisma.organizations.findFirst({
      where: {
        name: {
          contains: '남동구보건소'
        }
      }
    });

    if (namdongOrg) {
      console.log('  - 조직명:', namdongOrg.name);
      console.log('  - region_code:', namdongOrg.region_code);
      console.log('  - city_code:', namdongOrg.city_code);
      console.log('  - 주소:', namdongOrg.address);
    } else {
      console.log('  ❌ 남동구보건소를 찾을 수 없습니다.');
    }

    // 2. 남동구보건소 소속 사용자 확인
    console.log('\n2. 남동구보건소 소속 사용자 확인:');
    if (namdongOrg) {
      const users = await prisma.user_profiles.findMany({
        where: {
          organization_id: namdongOrg.id
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          region_code: true,
          organization_id: true
        }
      });

      if (users.length > 0) {
        for (const user of users) {
          console.log(`  - ${user.name} (${user.email})`);
          console.log(`    * role: ${user.role}`);
          console.log(`    * region_code: ${user.region_code}`);
          console.log(`    * organization_id: ${user.organization_id}`);
        }
      } else {
        console.log('  - 소속 사용자가 없습니다.');
      }
    }

    // 3. 서귀포시 보건소 조직 정보 확인
    console.log('\n3. 서귀포시 보건소 조직 정보 확인:');
    const seogwipoOrgs = await prisma.organizations.findMany({
      where: {
        name: {
          contains: '서귀포'
        }
      }
    });

    if (seogwipoOrgs.length > 0) {
      for (const org of seogwipoOrgs) {
        console.log(`  - ${org.name}`);
        console.log(`    * region_code: ${org.region_code}`);
        console.log(`    * city_code: ${org.city_code}`);
      }
    } else {
      console.log('  - 서귀포 관련 조직이 없습니다.');
    }

    // 4. 제주시 보건소 조직 정보 확인
    console.log('\n4. 제주시 보건소 조직 정보 확인:');
    const jejuOrgs = await prisma.organizations.findMany({
      where: {
        region_code: 'JEJ',
        name: {
          contains: '제주시'
        }
      }
    });

    if (jejuOrgs.length > 0) {
      for (const org of jejuOrgs) {
        console.log(`  - ${org.name}`);
        console.log(`    * region_code: ${org.region_code}`);
        console.log(`    * city_code: ${org.city_code}`);
      }
    } else {
      console.log('  - 제주시 관련 조직이 없습니다.');
    }

    // 5. 고현아 사용자 확인
    console.log('\n5. 고현아 사용자 정보 확인:');
    const gohyeonah = await prisma.user_profiles.findFirst({
      where: {
        full_name: '고현아'
      },
      include: {
        organizations: true
      }
    });

    if (gohyeonah) {
      console.log('  - 이름:', gohyeonah.full_name);
      console.log('  - 이메일:', gohyeonah.email);
      console.log('  - role:', gohyeonah.role);
      console.log('  - region_code:', gohyeonah.region_code);
      if (gohyeonah.organizations) {
        console.log('  - 소속 조직:', gohyeonah.organizations.name);
        console.log('  - 조직 region_code:', gohyeonah.organizations.region_code);
        console.log('  - 조직 city_code:', gohyeonah.organizations.city_code);
      }
    } else {
      console.log('  - 고현아 사용자를 찾을 수 없습니다.');
    }

    // 6. hak1212@korea.kr 사용자 확인
    console.log('\n6. hak1212@korea.kr 사용자 정보 확인:');
    const hak1212 = await prisma.user_profiles.findFirst({
      where: {
        email: 'hak1212@korea.kr'
      },
      include: {
        organizations: true
      }
    });

    if (hak1212) {
      console.log('  - 이름:', hak1212.full_name);
      console.log('  - 이메일:', hak1212.email);
      console.log('  - role:', hak1212.role);
      console.log('  - region_code:', hak1212.region_code);
      if (hak1212.organizations) {
        console.log('  - 소속 조직:', hak1212.organizations.name);
        console.log('  - 조직 region_code:', hak1212.organizations.region_code);
        console.log('  - 조직 city_code:', hak1212.organizations.city_code);
      }
    } else {
      console.log('  - hak1212@korea.kr 사용자를 찾을 수 없습니다.');
    }

    // 7. 인천 지역 조직들 확인
    console.log('\n7. 인천광역시 보건소 조직 확인:');
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

    if (incheonOrgs.length > 0) {
      for (const org of incheonOrgs) {
        console.log(`  - ${org.name}: city_code = "${org.city_code || 'null'}"`);
      }
    } else {
      console.log('  - 인천광역시 보건소가 없습니다.');
    }

  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 실행
checkUserPermissions().catch(console.error);