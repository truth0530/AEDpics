import { prisma } from '@/lib/prisma';

async function testPermissionSystem() {
  console.log('=== 권한 체계 테스트 ===\n');

  try {
    // 1. 중구가 있는 모든 시도 확인
    const jungGuHealthCenters = await prisma.organizations.findMany({
      where: {
        city_code: 'jung',
        type: 'health_center'
      },
      select: {
        id: true,
        name: true,
        region_code: true,
        city_code: true,
        address: true
      },
      orderBy: {
        region_code: 'asc'
      }
    });

    console.log('=== "중구" 보건소가 있는 시도 ===');
    console.log(`총 ${jungGuHealthCenters.length}개 시도에 중구 보건소 존재\n`);

    for (const hc of jungGuHealthCenters) {
      console.log(`${hc.name}`);
      console.log(`  region_code: ${hc.region_code}`);
      console.log(`  city_code: ${hc.city_code}`);
      console.log(`  조합키: ${hc.region_code}+${hc.city_code}`);
      console.log('');
    }

    // 2. 권한 시뮬레이션
    console.log('=== 권한 필터링 시뮬레이션 ===\n');

    // 서울 중구 보건소 사용자 시뮬레이션
    const seoulJungUser = {
      role: 'local_admin',
      organization: {
        region_code: 'SEO',
        city_code: 'jung'
      }
    };

    // 대구 중구 보건소 사용자 시뮬레이션
    const daeguJungUser = {
      role: 'local_admin',
      organization: {
        region_code: 'DAE',
        city_code: 'jung'
      }
    };

    console.log('케이스 1: 서울 중구 보건소 담당자');
    console.log(`  필터 조건: region_code='SEO' AND city_code='jung'`);

    const seoulJungData = await prisma.aed_device_data.count({
      where: {
        sido: '서울특별시',
        sigugun: { contains: '중구' }
      }
    });
    console.log(`  → 서울 중구 AED 데이터만 조회: ${seoulJungData}개\n`);

    console.log('케이스 2: 대구 중구 보건소 담당자');
    console.log(`  필터 조건: region_code='DAE' AND city_code='jung'`);

    const daeguJungData = await prisma.aed_device_data.count({
      where: {
        sido: '대구광역시',
        sigugun: { contains: '중구' }
      }
    });
    console.log(`  → 대구 중구 AED 데이터만 조회: ${daeguJungData}개\n`);

    // 3. 실제 access-control.ts 로직 검증
    console.log('=== access-control.ts 로직 검증 ===\n');
    console.log('현재 로직:');
    console.log('```typescript');
    console.log('if (userProfile.role === "local_admin") {');
    console.log('  const cityCode = userProfile.organization?.city_code;');
    console.log('  if (cityCode) {');
    console.log('    allowedCityCodes = [cityCode];');
    console.log('  }');
    console.log('}');
    console.log('```\n');

    console.log('⚠️ 문제점 발견!');
    console.log('현재 로직은 city_code만 체크하고 region_code는 체크하지 않음');
    console.log('');
    console.log('예시:');
    console.log('- 서울 중구 담당자가 city_code="jung"로 필터링');
    console.log('- 결과: 서울, 부산, 대구, 대전, 인천, 울산의 모든 중구 데이터 조회 가능!');
    console.log('');
    console.log('✅ 수정 필요:');
    console.log('```typescript');
    console.log('if (userProfile.role === "local_admin") {');
    console.log('  const cityCode = userProfile.organization?.city_code;');
    console.log('  const regionCode = userProfile.organization?.region_code;');
    console.log('  if (cityCode && regionCode) {');
    console.log('    // region_code와 city_code를 모두 사용해야 함');
    console.log('    allowedRegion = regionCode;');
    console.log('    allowedCityCodes = [cityCode];');
    console.log('  }');
    console.log('}');
    console.log('```');

    // 4. 영향 받는 보건소 수 계산
    console.log('\n=== 영향받는 보건소 현황 ===\n');

    const duplicateCityCodes = ['jung', 'seo', 'dong', 'nam', 'buk'];

    for (const code of duplicateCityCodes) {
      const affected = await prisma.organizations.count({
        where: {
          city_code: code,
          type: 'health_center'
        }
      });

      if (affected > 1) {
        console.log(`city_code="${code}": ${affected}개 보건소`);
        console.log(`  → 현재 로직으로는 ${affected}개 시도 데이터가 섞여 보임`);
      }
    }

    console.log('\n🚨 긴급 수정 필요!');
    console.log('access-control.ts의 권한 필터링 로직이 region_code를 고려하지 않음');

  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPermissionSystem().catch(console.error);