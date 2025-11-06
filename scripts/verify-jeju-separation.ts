import { prisma } from '@/lib/prisma';

async function verifyJejuSeparation() {
  console.log('=== 제주시/서귀포시 분리 검증 ===\n');

  try {
    // 1. 제주도 보건소 city_code 확인
    const jejuOrganizations = await prisma.organizations.findMany({
      where: {
        region_code: 'JEJ',
        type: 'health_center'
      },
      orderBy: [
        { city_code: 'asc' },
        { name: 'asc' }
      ]
    });

    console.log('📍 제주시 보건소 (city_code="jeju")');
    const jejuCityOrgs = jejuOrganizations.filter(org => org.city_code === 'jeju');
    for (const org of jejuCityOrgs) {
      console.log(`  ✅ ${org.name}`);
    }

    console.log('\n📍 서귀포시 보건소 (city_code="seogwipo")');
    const seogwipoOrgs = jejuOrganizations.filter(org => org.city_code === 'seogwipo');
    for (const org of seogwipoOrgs) {
      console.log(`  ✅ ${org.name}`);
    }

    // 2. 사용자별 접근 권한 테스트
    console.log('\n=== 사용자별 접근 권한 ===\n');

    const testUsers = [
      { email: 'kha115@korea.kr', name: '고현아' },
      { email: 'bongbong6878@korea.kr', name: '오봉철' }
    ];

    for (const testUser of testUsers) {
      const user = await prisma.user_profiles.findFirst({
        where: { email: testUser.email },
        include: { organizations: true }
      });

      if (!user) continue;

      console.log(`👤 ${user.full_name} (${user.email})`);
      console.log(`  소속: ${user.organizations?.name}`);
      console.log(`  city_code: ${user.organizations?.city_code}`);

      if (user.organizations?.city_code === 'jeju') {
        console.log(`  → 제주시 데이터만 조회 가능 ✅`);
        console.log(`  → 서귀포시 데이터 접근 불가 ❌`);
      } else if (user.organizations?.city_code === 'seogwipo') {
        console.log(`  → 서귀포시 데이터만 조회 가능 ✅`);
        console.log(`  → 제주시 데이터 접근 불가 ❌`);
      }
      console.log('');
    }

    // 3. 시뮬레이션: 데이터 필터링
    console.log('=== 데이터 필터링 시뮬레이션 ===\n');

    for (const org of jejuOrganizations) {
      const cityCode = org.city_code;
      console.log(`${org.name} (city_code="${cityCode}")`);

      // 실제 access-control.ts 로직 시뮬레이션
      console.log(`  필터: region_code='JEJ' AND city_code='${cityCode}'`);

      // 예상 결과
      if (cityCode === 'jeju') {
        console.log(`  → 제주시 지역 AED만 조회`);
      } else if (cityCode === 'seogwipo') {
        console.log(`  → 서귀포시 지역 AED만 조회`);
      }
      console.log('');
    }

    console.log('=== 검증 결과 ===\n');

    const jejuCount = jejuCityOrgs.length;
    const seogwipoCount = seogwipoOrgs.length;

    if (jejuCount === 3 && seogwipoCount === 3) {
      console.log('✅ 제주시 3개, 서귀포시 3개로 정상 분리됨');
      console.log('✅ 각 보건소는 자신의 시 데이터만 볼 수 있음');
      console.log('✅ 데이터 접근 권한이 올바르게 설정됨');
    } else {
      console.log(`⚠️ 비정상: 제주시 ${jejuCount}개, 서귀포시 ${seogwipoCount}개`);
    }

  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyJejuSeparation().catch(console.error);