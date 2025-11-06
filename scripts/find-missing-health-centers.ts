import { prisma } from '@/lib/prisma';

async function findMissingHealthCenters() {
  console.log('=== 누락된 보건소 찾기 ===\n');

  try {
    // 1. 현재 DB의 보건소 목록
    const currentHealthCenters = await prisma.organizations.findMany({
      where: {
        type: 'health_center'
      },
      select: {
        name: true,
        region_code: true,
        city_code: true,
        address: true
      },
      orderBy: [
        { region_code: 'asc' },
        { name: 'asc' }
      ]
    });

    console.log(`현재 DB 보건소 수: ${currentHealthCenters.length}개\n`);

    // 2. 시도별로 그룹화
    const byRegion: Record<string, string[]> = {};
    for (const hc of currentHealthCenters) {
      const region = hc.region_code || 'UNKNOWN';
      if (!byRegion[region]) {
        byRegion[region] = [];
      }
      byRegion[region].push(hc.name);
    }

    // 3. 2024년 기준 공식 보건소 목록 (보건복지부)
    // 실제로는 공식 API나 문서에서 가져와야 하지만,
    // 일반적으로 누락되는 패턴 확인

    console.log('=== 시도별 보건소 현황 및 누락 가능성 ===\n');

    // 서울특별시 (25개)
    console.log('서울특별시 (SEO): ' + byRegion['SEO']?.length + '개');
    const seoulExpected = [
      '종로구', '중구', '용산구', '성동구', '광진구', '동대문구', '중랑구',
      '성북구', '강북구', '도봉구', '노원구', '은평구', '서대문구', '마포구',
      '양천구', '강서구', '구로구', '금천구', '영등포구', '동작구', '관악구',
      '서초구', '강남구', '송파구', '강동구'
    ];
    console.log('  25개 자치구 모두 있어야 함\n');

    // 경기도 (42개 현재 -> 실제로는 더 많을 수 있음)
    console.log('경기도 (GYG): ' + byRegion['GYG']?.length + '개');
    console.log('  ※ 분소 확인 필요: 수원(4), 고양(3), 용인(3), 성남(3), 안산(2), 안양(2) 등\n');

    // 제주도 특별 확인
    console.log('제주특별자치도 (JEJ): ' + byRegion['JEJ']?.length + '개');
    const jejuCenters = currentHealthCenters.filter(hc => hc.region_code === 'JEJ');
    for (const hc of jejuCenters) {
      console.log('  - ' + hc.name);
    }

    // 4. 일반적으로 누락되는 보건소 패턴
    console.log('\n=== 일반적으로 누락되는 보건소 패턴 ===\n');

    console.log('1. 대도시 보건소 분소');
    // 서울, 부산, 대구 등 대도시의 보건지소/분소

    console.log('2. 통합시 보건소');
    // 창원시(마산, 진해 통합), 청주시(청원 통합) 등
    const changwonCenters = currentHealthCenters.filter(hc =>
      hc.name.includes('창원') || hc.name.includes('마산') || hc.name.includes('진해')
    );
    console.log(`  창원시 관련: ${changwonCenters.length}개`);
    for (const hc of changwonCenters) {
      console.log(`    - ${hc.name}`);
    }

    const cheongjuCenters = currentHealthCenters.filter(hc =>
      hc.name.includes('청주') || hc.name.includes('청원')
    );
    console.log(`  청주시 관련: ${cheongjuCenters.length}개`);
    for (const hc of cheongjuCenters) {
      console.log(`    - ${hc.name}`);
    }

    console.log('\n3. 최근 행정구역 변경');
    console.log('  - 군위군: 경북 → 대구 편입 (2023년)');
    const gunwiCenters = currentHealthCenters.filter(hc =>
      hc.name.includes('군위')
    );
    console.log(`  군위군 관련: ${gunwiCenters.length}개`);
    for (const hc of gunwiCenters) {
      console.log(`    - ${hc.name} (${hc.region_code})`);
    }

    // 5. 특별히 확인이 필요한 지역
    console.log('\n=== 특별 확인 필요 지역 ===\n');

    // 세종시 - 1개만 있는게 맞는지 확인
    const sejongCenters = currentHealthCenters.filter(hc => hc.region_code === 'SEJ');
    console.log(`세종특별자치시: ${sejongCenters.length}개`);
    for (const hc of sejongCenters) {
      console.log(`  - ${hc.name}`);
    }

    // 인천 - 옹진군 포함 10개 확인
    const incheonCenters = currentHealthCenters.filter(hc => hc.region_code === 'INC');
    console.log(`\n인천광역시: ${incheonCenters.length}개`);
    const incheonExpected = ['중구', '동구', '미추홀구', '연수구', '남동구', '부평구', '계양구', '서구', '강화군', '옹진군'];
    console.log(`  예상: ${incheonExpected.join(', ')}`);

    // 6. 가능한 누락 보건소 추정
    console.log('\n=== 누락 가능성이 높은 보건소 ===\n');

    // 천안시 - 동남구, 서북구 확인
    const cheonanCenters = currentHealthCenters.filter(hc => hc.name.includes('천안'));
    console.log(`천안시: ${cheonanCenters.length}개`);
    for (const hc of cheonanCenters) {
      console.log(`  - ${hc.name}`);
    }

    // 전주시 - 완산구, 덕진구 확인
    const jeonjuCenters = currentHealthCenters.filter(hc => hc.name.includes('전주'));
    console.log(`\n전주시: ${jeonjuCenters.length}개`);
    for (const hc of jeonjuCenters) {
      console.log(`  - ${hc.name}`);
    }

    // 포항시 - 남구, 북구 확인
    const pohangCenters = currentHealthCenters.filter(hc => hc.name.includes('포항'));
    console.log(`\n포항시: ${pohangCenters.length}개`);
    for (const hc of pohangCenters) {
      console.log(`  - ${hc.name}`);
    }

    // 7. 고성군 중복 확인 (강원도, 경남)
    const goseongCenters = currentHealthCenters.filter(hc => hc.name.includes('고성'));
    console.log(`\n고성군: ${goseongCenters.length}개`);
    for (const hc of goseongCenters) {
      console.log(`  - ${hc.name} (${hc.region_code})`);
    }

    // 8. 보건소/보건지소/보건분소 구분
    const branches = currentHealthCenters.filter(hc =>
      hc.name.includes('분소') || hc.name.includes('지소') ||
      hc.name.includes('동부') || hc.name.includes('서부') ||
      hc.name.includes('남부') || hc.name.includes('북부')
    );
    console.log(`\n분소/지소 형태: ${branches.length}개`);
    for (const hc of branches) {
      console.log(`  - ${hc.name} (${hc.region_code})`);
    }

    console.log('\n=== 추정 결과 ===');
    console.log('누락 가능성이 높은 보건소:');
    console.log('1. 수원시 영통구/권선구/장안구/팔달구 중 일부 (분소)');
    console.log('2. 고양시 덕양구/일산동구/일산서구 중 일부 (분소)');
    console.log('3. 용인시 처인구/기흥구/수지구 중 일부 (분소)');
    console.log('4. 성남시 수정구/중원구/분당구 중 일부 (분소)');
    console.log('5. 안산시 상록구/단원구 중 일부 (분소)');
    console.log('6. 기타 통합시 보건소 분소');

  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findMissingHealthCenters().catch(console.error);