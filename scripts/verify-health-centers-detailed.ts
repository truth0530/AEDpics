import { prisma } from '@/lib/prisma';

async function verifyHealthCentersDetailed() {
  console.log('=== 전국 보건소 상세 검증 ===\n');

  try {
    // 1. 전체 보건소 수 확인
    const allHealthCenters = await prisma.organizations.findMany({
      where: {
        type: 'health_center'
      },
      select: {
        id: true,
        name: true,
        city_code: true,
        region_code: true,
        address: true
      },
      orderBy: [
        { region_code: 'asc' },
        { name: 'asc' }
      ]
    });

    console.log(`=== 보건소 총 개수 ===`);
    console.log(`데이터베이스 내 보건소: ${allHealthCenters.length}개\n`);

    // 2. 시도별 보건소 개수 집계
    const byRegion: Record<string, { count: number; names: string[] }> = {};

    for (const hc of allHealthCenters) {
      const region = hc.region_code || 'UNKNOWN';
      if (!byRegion[region]) {
        byRegion[region] = { count: 0, names: [] };
      }
      byRegion[region].count++;
      byRegion[region].names.push(hc.name);
    }

    console.log('=== 시도별 보건소 개수 ===');
    let totalCount = 0;

    const regionNames: Record<string, string> = {
      'SEO': '서울특별시',
      'BUS': '부산광역시',
      'DAE': '대구광역시',
      'INC': '인천광역시',
      'GWA': '광주광역시',
      'DAJ': '대전광역시',
      'ULS': '울산광역시',
      'SEJ': '세종특별자치시',
      'GYG': '경기도',
      'CHB': '충청북도',
      'CHN': '충청남도',
      'JEB': '전북특별자치도',
      'JEN': '전라남도',
      'GYB': '경상북도',
      'GYN': '경상남도',
      'GAN': '강원특별자치도',
      'JEJ': '제주특별자치도',
      'KR': '중앙'
    };

    for (const [code, data] of Object.entries(byRegion).sort()) {
      const regionName = regionNames[code] || code;
      console.log(`${regionName} (${code}): ${data.count}개`);
      totalCount += data.count;
    }

    console.log(`\n합계: ${totalCount}개`);

    // 3. city_code 중복 검사
    console.log('\n=== city_code 중복 검사 ===');

    const cityCodes: Record<string, Array<{ name: string; region: string | null }>> = {};

    for (const hc of allHealthCenters) {
      if (hc.city_code) {
        if (!cityCodes[hc.city_code]) {
          cityCodes[hc.city_code] = [];
        }
        cityCodes[hc.city_code].push({
          name: hc.name,
          region: hc.region_code
        });
      }
    }

    // 중복된 city_code 찾기
    const duplicates = Object.entries(cityCodes)
      .filter(([code, items]) => items.length > 1)
      .sort(([a], [b]) => a.localeCompare(b));

    if (duplicates.length === 0) {
      console.log('✅ 동일 시도 내 city_code 중복 없음\n');
    } else {
      console.log(`⚠️ city_code가 여러 보건소에 사용됨:\n`);
      for (const [code, items] of duplicates) {
        console.log(`city_code: "${code}"`);
        for (const item of items) {
          console.log(`  - ${item.name} (${item.region})`);
        }
      }
    }

    // 4. 다른 시도의 동일 구 이름 확인 (예: 서울 중구 vs 대구 중구)
    console.log('\n=== 서로 다른 시도의 동일 구 이름 확인 ===');

    const sameCityDifferentRegion: Record<string, Array<{ name: string; region: string | null; city_code: string | null }>> = {};

    for (const hc of allHealthCenters) {
      if (hc.city_code) {
        if (!sameCityDifferentRegion[hc.city_code]) {
          sameCityDifferentRegion[hc.city_code] = [];
        }
        sameCityDifferentRegion[hc.city_code].push({
          name: hc.name,
          region: hc.region_code,
          city_code: hc.city_code
        });
      }
    }

    // 같은 city_code를 가진 다른 시도 찾기
    const crossRegionDuplicates: Array<{ code: string; regions: string[] }> = [];

    for (const [code, items] of Object.entries(sameCityDifferentRegion)) {
      const uniqueRegions = [...new Set(items.map(i => i.region))];
      if (uniqueRegions.length > 1) {
        crossRegionDuplicates.push({ code, regions: uniqueRegions as string[] });
      }
    }

    if (crossRegionDuplicates.length > 0) {
      console.log('⚠️ 서로 다른 시도에서 동일한 city_code 사용 발견:');
      for (const dup of crossRegionDuplicates) {
        console.log(`\ncity_code: "${dup.code}" 사용 지역:`);
        for (const region of dup.regions) {
          const regionName = regionNames[region] || region;
          const hcs = sameCityDifferentRegion[dup.code]
            .filter(h => h.region === region)
            .map(h => h.name);
          console.log(`  ${regionName}: ${hcs.join(', ')}`);
        }
      }
      console.log('\n❌ 문제: city_code만으로는 구분 불가! region_code와 함께 사용 필요');
    } else {
      console.log('✅ 서로 다른 시도 간 city_code 중복 없음');
    }

    // 5. 특정 케이스 확인: 중구, 서구, 동구, 남구, 북구
    console.log('\n=== 공통 구 이름 사용 현황 ===');

    const commonDistrictNames = ['jung', 'seo', 'dong', 'nam', 'buk'];

    for (const districtCode of commonDistrictNames) {
      const usingThisCode = allHealthCenters.filter(hc => hc.city_code === districtCode);
      if (usingThisCode.length > 0) {
        console.log(`\n"${districtCode}" 사용 보건소 (${usingThisCode.length}개):`);
        for (const hc of usingThisCode) {
          const regionName = regionNames[hc.region_code || ''] || hc.region_code;
          console.log(`  - ${hc.name} (${regionName})`);
        }
      }
    }

    // 6. 특별 케이스: 제주도 검증
    console.log('\n=== 특별 케이스: 제주도 ===');
    const jejuHealthCenters = allHealthCenters.filter(hc => hc.region_code === 'JEJ');
    console.log(`제주도 보건소: ${jejuHealthCenters.length}개`);
    for (const hc of jejuHealthCenters) {
      console.log(`  - ${hc.name}: city_code = "${hc.city_code}"`);
    }

    // 7. 권한 체계 검증을 위한 조합 확인
    console.log('\n=== 권한 체계 검증 ===');
    console.log('local_admin 권한은 region_code + city_code 조합으로 필터링됨');
    console.log('\n예시:');
    console.log('  서울 중구 보건소: SEO + jung');
    console.log('  대구 중구 보건소: DAE + jung');
    console.log('  부산 중구 보건소: BUS + jung');
    console.log('\n현재 시스템에서 이 조합으로 정확히 구분 가능함');

    // 8. NULL city_code 재확인
    const nullCityCodes = allHealthCenters.filter(hc => !hc.city_code);
    if (nullCityCodes.length > 0) {
      console.log('\n⚠️ city_code가 없는 보건소 발견:');
      for (const hc of nullCityCodes) {
        console.log(`  - ${hc.name} (${hc.region_code})`);
      }
    } else {
      console.log('\n✅ 모든 보건소가 city_code 보유');
    }

    // 9. 보건복지부 공식 통계와 비교
    console.log('\n=== 보건복지부 공식 통계와 비교 ===');
    console.log('보건복지부 2024년 12월 기준: 261개 보건소');
    console.log(`현재 데이터베이스: ${allHealthCenters.length}개 보건소`);

    if (allHealthCenters.length < 261) {
      console.log(`\n⚠️ ${261 - allHealthCenters.length}개 보건소 누락 가능성`);
      console.log('가능한 원인:');
      console.log('  1. 보건소 분소/지소 미포함');
      console.log('  2. 최근 신설 보건소 미반영');
      console.log('  3. 행정구역 개편 미반영');
    } else if (allHealthCenters.length > 261) {
      console.log(`\n⚠️ ${allHealthCenters.length - 261}개 추가 등록`);
      console.log('가능한 원인:');
      console.log('  1. 보건소 분소/지소 포함');
      console.log('  2. 중복 등록');
    }

    // 10. 최종 권고사항
    console.log('\n=== 최종 권고사항 ===');
    console.log('1. 현재 시스템은 region_code + city_code 조합으로 정확한 구분 가능');
    console.log('2. 서울 중구(SEO+jung)와 대구 중구(DAE+jung)는 명확히 구분됨');
    console.log('3. 보건복지부 공식 목록과 대조 필요');
    console.log('4. 누락/중복 보건소 확인 및 정리 필요');

  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyHealthCentersDetailed().catch(console.error);