import { prisma } from '@/lib/prisma';

async function validateCityCodeConsistency() {
  console.log('=== City Code 일관성 검증 (지역별 + 사용자별) ===\n');

  try {
    // 1. 모든 보건소 city_code 확인
    console.log('1. 모든 보건소 city_code 현황:');
    const allHealthCenters = await prisma.organizations.findMany({
      where: { type: 'health_center' },
      select: {
        name: true,
        city_code: true,
        region_code: true
      },
      orderBy: [{ region_code: 'asc' }, { name: 'asc' }]
    });

    // city_code 포맷 분석
    const cityCodes = new Map<string, { count: number; examples: string[] }>();
    const regionCityCodes = new Map<string, Set<string>>();

    for (const org of allHealthCenters) {
      if (org.city_code) {
        const isKorean = /[가-힣]/.test(org.city_code);
        const format = isKorean ? '한글' : '영문';
        const key = `${org.region_code}-${format}`;

        if (!cityCodes.has(key)) {
          cityCodes.set(key, { count: 0, examples: [] });
        }
        const entry = cityCodes.get(key)!;
        entry.count++;
        if (entry.examples.length < 2) {
          entry.examples.push(`${org.name}="${org.city_code}"`);
        }

        if (!regionCityCodes.has(org.region_code)) {
          regionCityCodes.set(org.region_code, new Set());
        }
        regionCityCodes.get(org.region_code)!.add(format);
      }
    }

    // 지역별 포맷 일관성 확인
    console.log('\n지역별 city_code 포맷 일관성:');
    let inconsistentRegions = 0;
    for (const [region, formats] of regionCityCodes) {
      const formatList = Array.from(formats);
      const isConsistent = formatList.length === 1;
      const status = isConsistent ? '✓' : '⚠️';
      console.log(`  ${status} ${region}: ${formatList.join(' + ')}`);
      if (!isConsistent) {
        inconsistentRegions++;
        // 상세 정보
        for (const org of allHealthCenters) {
          if (org.region_code === region && org.city_code) {
            const format = /[가-힣]/.test(org.city_code) ? '한글' : '영문';
            console.log(`     - ${org.name}: "${org.city_code}" (${format})`);
          }
        }
      }
    }

    console.log(`\n결과: ${inconsistentRegions}개 지역에서 혼합 포맷 사용`);

    // 2. 보건소별 city_code 분석
    console.log('\n\n2. 특정 지역 보건소 현황:');

    // 제주도
    console.log('\n제주도 (JEJ):');
    const jejuOrgs = allHealthCenters.filter(o => o.region_code === 'JEJ');
    for (const org of jejuOrgs) {
      console.log(`  - ${org.name}: "${org.city_code}"`);
    }

    // 충청북도
    console.log('\n충청북도 (CHB):');
    const chbOrgs = allHealthCenters.filter(o => o.region_code === 'CHB');
    for (const org of chbOrgs) {
      console.log(`  - ${org.name}: "${org.city_code}"`);
    }

    // 인천
    console.log('\n인천 (INC):');
    const incOrgs = allHealthCenters.filter(o => o.region_code === 'INC');
    for (const org of incOrgs) {
      console.log(`  - ${org.name}: "${org.city_code}"`);
    }

    // 3. 사용자 계정 일관성 확인
    console.log('\n\n3. 사용자 계정 city_code 일관성:');

    const localAdmins = await prisma.user_profiles.findMany({
      where: { role: 'local_admin' },
      include: {
        organizations: {
          select: {
            name: true,
            city_code: true,
            region_code: true
          }
        }
      }
    });

    console.log(`\n보건소 담당자(local_admin) ${localAdmins.length}명:`);
    for (const user of localAdmins) {
      const orgCityCode = user.organizations?.city_code;
      const isKorean = orgCityCode ? /[가-힣]/.test(orgCityCode) : false;
      const format = isKorean ? '한글' : '영문';

      console.log(`\n  이름: ${user.full_name}`);
      console.log(`  이메일: ${user.email}`);
      console.log(`  소속: ${user.organizations?.name}`);
      console.log(`  city_code: "${orgCityCode}" (${format})`);
      console.log(`  user.region_code: "${user.region_code}"`);

      // 문제 여부 확인
      if (orgCityCode && orgCityCode !== '구군' && orgCityCode !== user.organizations?.name) {
        const isMatch = /[가-힣]/.test(orgCityCode) === /[가-힣]/.test(user.organizations?.name || '');
        if (!isMatch) {
          console.log(`  ⚠️ 경고: city_code 포맷 불일치!`);
        }
      }
    }

    // 4. AED 데이터와의 매핑 확인
    console.log('\n\n4. AED 데이터와 city_code 매핑:');

    const distinctGuguns = await prisma.aed_data.findMany({
      select: { gugun: true, sido: true },
      distinct: ['gugun'],
      orderBy: { gugun: 'asc' },
      take: 100
    });

    const gugeonSet = new Set(distinctGuguns.map(a => a.gugun));
    console.log(`\nAED 데이터의 실제 gugun 값: ${gugeonSet.size}개`);

    // 제주도 gugun 확인
    const jejuGuguns = distinctGuguns.filter(a => a.sido?.includes('제주'));
    console.log(`\n제주도 AED gugun: ${jejuGuguns.map(g => `"${g.gugun}"`).join(', ')}`);

    // city_code와 gugun의 매핑 가능성 확인
    console.log('\n\n5. city_code → gugun 매핑 가능성:');

    const unmappedCodes = new Set<string>();
    for (const org of allHealthCenters) {
      if (org.city_code && /[가-힣]/.test(org.city_code)) {
        // 한글 city_code는 직접 비교 가능
        continue;
      }

      if (org.city_code && org.region_code === 'JEJ') {
        // 제주도 특정 확인
        const org_gugun = org.name.match(/제주시|서귀포시/)?.[0];
        const expected_gugun = org.city_code === 'jeju' ? '제주시' :
                               org.city_code === 'seogwipo' ? '서귀포시' : null;

        if (org_gugun && expected_gugun && org_gugun !== expected_gugun) {
          unmappedCodes.add(`${org.city_code} → 예상: "${expected_gugun}" 실제: "${org_gugun}"`);
        }
      }
    }

    if (unmappedCodes.size > 0) {
      console.log('매핑 오류:');
      for (const code of unmappedCodes) {
        console.log(`  ⚠️ ${code}`);
      }
    } else {
      console.log('✓ 모든 city_code가 올바르게 매핑됨');
    }

    // 6. 권장사항
    console.log('\n\n6. 권장사항:');
    console.log('  1. 모든 city_code를 일관된 포맷(영문)으로 통일');
    console.log('  2. RegionFilter와 API에서 city_code → gugun 매핑 적용');
    console.log('  3. 문제 지역별로 정확한 매핑 테이블 구성');

  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

validateCityCodeConsistency().catch(console.error);
