import { prisma } from '@/lib/prisma';

async function checkJejuHealthCenters() {
  console.log('=== 제주도 보건소 계정 확인 ===\n');

  try {
    // 1. 제주도 모든 보건소 조직 확인
    const jejuOrganizations = await prisma.organizations.findMany({
      where: {
        region_code: 'JEJ',
        type: 'health_center'
      },
      orderBy: {
        name: 'asc'
      }
    });

    console.log(`제주도 보건소 조직: ${jejuOrganizations.length}개\n`);

    for (const org of jejuOrganizations) {
      console.log(`조직명: ${org.name}`);
      console.log(`  - ID: ${org.id}`);
      console.log(`  - region_code: ${org.region_code}`);
      console.log(`  - city_code: ${org.city_code || 'NULL ⚠️'}`);
      console.log(`  - 주소: ${org.address || 'N/A'}`);
      console.log('');
    }

    // 2. 언급된 두 계정 확인
    const targetEmails = ['kha115@korea.kr', 'bongbong6878@korea.kr'];

    console.log('=== 제주도 보건소 담당자 계정 상태 ===\n');

    for (const email of targetEmails) {
      const user = await prisma.user_profiles.findFirst({
        where: {
          email: email
        },
        include: {
          organizations: true
        }
      });

      if (!user) {
        console.log(`❌ ${email} 계정을 찾을 수 없습니다.\n`);
        continue;
      }

      console.log(`👤 ${user.full_name} (${user.email})`);
      console.log(`  역할: ${user.role}`);
      console.log(`  지역: ${user.region || 'N/A'}`);
      console.log(`  지역코드: ${user.region_code || 'N/A'}`);
      console.log(`  조직: ${user.organizations?.name || 'N/A'}`);
      console.log(`  조직 city_code: ${user.organizations?.city_code || 'NULL ⚠️'}`);

      // 권한 체크
      if (user.role === 'local_admin') {
        if (!user.organizations?.city_code) {
          console.log(`  ⚠️ 문제: city_code가 NULL - 제주도 전체 데이터가 보일 수 있음`);
        } else {
          console.log(`  ✅ 정상: city_code '${user.organizations.city_code}' 지역만 볼 수 있음`);
        }
      }
      console.log('');
    }

    // 3. 제주도 AED 데이터 분포 확인
    console.log('=== 제주도 AED 데이터 분포 ===\n');

    const jejuData = await prisma.aed_device_data.groupBy({
      by: ['sigugun'],
      where: {
        sido: '제주특별자치도'
      },
      _count: {
        id: true
      }
    });

    for (const data of jejuData) {
      console.log(`${data.sigugun || '(시군구 없음)'}: ${data._count.id}대`);
    }

    // 4. 관할보건소별 분포
    console.log('\n=== 관할보건소별 AED 분포 ===\n');

    const byHealthCenter = await prisma.aed_device_data.groupBy({
      by: ['jurisdiction_health_center'],
      where: {
        sido: '제주특별자치도'
      },
      _count: {
        id: true
      }
    });

    for (const data of byHealthCenter) {
      console.log(`${data.jurisdiction_health_center || '(관할보건소 없음)'}: ${data._count.id}대`);
    }

    // 5. city_code 매핑 제안
    console.log('\n=== city_code 매핑 제안 ===');
    console.log('제주도는 2개 시로 구성:');
    console.log('- 제주시: city_code = "jeju"');
    console.log('- 서귀포시: city_code = "seogwipo"');

    // 6. 수정이 필요한 조직 확인
    const needsFix = jejuOrganizations.filter(org => !org.city_code);

    if (needsFix.length > 0) {
      console.log('\n⚠️ city_code 설정이 필요한 보건소:');
      for (const org of needsFix) {
        let suggestedCode = 'unknown';
        if (org.name.includes('제주시')) {
          suggestedCode = 'jeju';
        } else if (org.name.includes('서귀포')) {
          suggestedCode = 'seogwipo';
        }

        console.log(`\n${org.name}:`);
        console.log(`  UPDATE organizations`);
        console.log(`  SET city_code = '${suggestedCode}'`);
        console.log(`  WHERE id = '${org.id}';`);
      }
    }

    // 7. 추가 보건소 확인 (제주도는 보건소가 6개 있을 수 있음)
    console.log('\n=== 제주도 보건소 체계 ===');
    console.log('제주특별자치도 보건소 구조:');
    console.log('- 제주시 보건소 (본소)');
    console.log('- 제주시 동부보건소');
    console.log('- 제주시 서부보건소');
    console.log('- 서귀포시 보건소 (본소)');
    console.log('- 서귀포시 동부보건소');
    console.log('- 서귀포시 서부보건소');
    console.log(`\n현재 DB에 ${jejuOrganizations.length}개 등록됨`);

    if (jejuOrganizations.length < 6) {
      console.log('⚠️ 일부 보건소가 누락되었을 수 있습니다.');
    }

  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkJejuHealthCenters().catch(console.error);