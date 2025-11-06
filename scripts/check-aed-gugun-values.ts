import { prisma } from '@/lib/prisma';

async function checkAedGugunValues() {
  console.log('=== AED 데이터의 실제 gugun 값 확인 ===\n');

  try {
    // 1. 서귀포시 관련 AED 데이터 확인
    console.log('1. 서귀포시 AED 데이터:');
    const seogwipoAed = await prisma.aed_data.findMany({
      where: {
        gugun: {
          contains: '서귀포'
        }
      },
      select: {
        gugun: true,
        sido: true
      },
      distinct: ['gugun'],
      take: 5
    });

    console.log(`  찾은 gugun 값: ${seogwipoAed.length}개`);
    for (const aed of seogwipoAed) {
      console.log(`  - "${aed.gugun}" (sido: "${aed.sido}")`);
    }

    // 2. 제주시 관련 AED 데이터 확인
    console.log('\n2. 제주시 AED 데이터:');
    const jejuAed = await prisma.aed_data.findMany({
      where: {
        gugun: {
          contains: '제주시'
        }
      },
      select: {
        gugun: true,
        sido: true
      },
      distinct: ['gugun'],
      take: 5
    });

    console.log(`  찾은 gugun 값: ${jejuAed.length}개`);
    for (const aed of jejuAed) {
      console.log(`  - "${aed.gugun}" (sido: "${aed.sido}")`);
    }

    // 3. 제주특별자치도 모든 gugun 값
    console.log('\n3. 제주도 지역(sido)의 모든 gugun 값:');
    const jejuAll = await prisma.aed_data.findMany({
      where: {
        sido: {
          contains: '제주'
        }
      },
      select: {
        gugun: true,
        sido: true
      },
      distinct: ['gugun'],
      orderBy: {
        gugun: 'asc'
      }
    });

    console.log(`  총 ${jejuAll.length}개 gugun 값:`);
    for (const aed of jejuAll) {
      console.log(`  - sido: "${aed.sido}" → gugun: "${aed.gugun}"`);
    }

    // 4. 보건소 city_code와 비교
    console.log('\n4. 보건소 city_code 현황:');
    const seogwipoOrgs = await prisma.organizations.findMany({
      where: {
        name: {
          contains: '서귀포'
        },
        type: 'health_center'
      },
      select: {
        name: true,
        city_code: true,
        region_code: true
      }
    });

    console.log(`  서귀포시 보건소 (${seogwipoOrgs.length}개):`);
    for (const org of seogwipoOrgs) {
      console.log(`  - ${org.name}`);
      console.log(`    * city_code: "${org.city_code}"`);
      console.log(`    * region_code: "${org.region_code}"`);
    }

    const jejuOrgs = await prisma.organizations.findMany({
      where: {
        region_code: 'JEJ',
        name: {
          contains: '제주시'
        },
        type: 'health_center'
      },
      select: {
        name: true,
        city_code: true,
        region_code: true
      }
    });

    console.log(`\n  제주시 보건소 (${jejuOrgs.length}개):`);
    for (const org of jejuOrgs) {
      console.log(`  - ${org.name}`);
      console.log(`    * city_code: "${org.city_code}"`);
      console.log(`    * region_code: "${org.region_code}"`);
    }

    // 5. 고현아 사용자 정보 확인
    console.log('\n5. 고현아(서귀포 담당자) 정보:');
    const gohyeonah = await prisma.user_profiles.findFirst({
      where: {
        full_name: '고현아'
      },
      include: {
        organizations: true
      }
    });

    if (gohyeonah && gohyeonah.organizations) {
      console.log(`  - 이름: ${gohyeonah.full_name}`);
      console.log(`  - 이메일: ${gohyeonah.email}`);
      console.log(`  - 소속: ${gohyeonah.organizations.name}`);
      console.log(`  - 조직 city_code: "${gohyeonah.organizations.city_code}"`);
      console.log(`  - 조직 region_code: "${gohyeonah.organizations.region_code}"`);
    }

    // 6. 결론: 매핑이 필요한지 확인
    console.log('\n6. 매핑 필요성 확인:');
    const seogwipoGugun = jejuAll.find(a => a.gugun.includes('서귀포'));
    const jejuGugun = jejuAll.find(a => a.gugun.includes('제주시') && !a.gugun.includes('서귀포'));

    if (seogwipoGugun) {
      console.log(`  ✓ 서귀포 AED 데이터 실제 gugun: "${seogwipoGugun.gugun}"`);
      console.log(`    보건소 city_code: "seogwipo"`);
      console.log(`    → 매핑 필요: "seogwipo" → "${seogwipoGugun.gugun}"`);
    } else {
      console.log(`  ✗ 서귀포 AED 데이터를 찾을 수 없음`);
    }

    if (jejuGugun) {
      console.log(`\n  ✓ 제주시 AED 데이터 실제 gugun: "${jejuGugun.gugun}"`);
      console.log(`    보건소 city_code: "jeju"`);
      console.log(`    → 매핑 필요: "jeju" → "${jejuGugun.gugun}"`);
    } else {
      console.log(`\n  ✗ 제주시 AED 데이터를 찾을 수 없음`);
    }

  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAedGugunValues().catch(console.error);
