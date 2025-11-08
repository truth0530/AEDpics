#!/usr/bin/env npx tsx

/**
 * City Code 매핑 검증 스크립트
 * - 모든 city_code가 매핑되는지 확인
 * - local_admin 권한이 제대로 제한되는지 확인
 */

import { PrismaClient } from '@prisma/client';
import {
  CITY_CODE_TO_GUGUN_MAP,
  mapCityCodeToGugun,
  extractRegionFromOrgName,
  normalizeJurisdictionName
} from '../lib/constants/regions';
import { resolveAccessScope } from '../lib/auth/access-control';

const prisma = new PrismaClient();

async function validateCityMapping() {
  console.log('=== City Code 매핑 검증 ===\n');

  try {
    // 1. Organizations의 모든 city_code 확인
    console.log('1. Organizations city_code 매핑 검증:\n');

    const allOrgs = await prisma.organizations.findMany({
      where: {
        city_code: { not: null }
      },
      select: {
        city_code: true,
        name: true,
        region_code: true
      }
    });

    let mappedCount = 0;
    let unmappedCount = 0;
    const unmapped: string[] = [];

    for (const org of allOrgs) {
      const mapped = mapCityCodeToGugun(org.city_code);
      if (mapped) {
        mappedCount++;
      } else {
        unmappedCount++;
        if (!unmapped.includes(org.city_code!)) {
          unmapped.push(org.city_code!);
        }
      }
    }

    console.log(`✅ 매핑 성공: ${mappedCount}개 조직`);
    console.log(`❌ 매핑 실패: ${unmappedCount}개 조직`);

    if (unmapped.length > 0) {
      console.log('\n매핑되지 않은 city_code:');
      unmapped.forEach(code => {
        const org = allOrgs.find(o => o.city_code === code);
        console.log(`  - ${code}: ${org?.name}`);
      });
    }

    // 2. local_admin 권한 검증
    console.log('\n\n2. local_admin 권한 범위 검증:\n');

    const localAdmins = await prisma.user_profiles.findMany({
      where: {
        role: 'local_admin',
        is_active: true
      },
      include: {
        organizations: true
      }
    });

    console.log(`총 ${localAdmins.length}명의 local_admin 분석:\n`);

    let restrictedCount = 0;
    let unrestrictedCount = 0;

    for (const admin of localAdmins) {
      const cityCode = admin.organizations?.city_code;
      const gugun = cityCode ? mapCityCodeToGugun(cityCode) : null;

      try {
        const accessScope = resolveAccessScope(admin as any);

        if (accessScope.allowedCityCodes && accessScope.allowedCityCodes.length > 0) {
          console.log(`✅ ${admin.email}:`);
          console.log(`   - 조직: ${admin.organizations?.name || admin.organization_name}`);
          console.log(`   - city_code: ${cityCode} → ${gugun}`);
          console.log(`   - 접근 구군: ${accessScope.allowedCityCodes.join(', ')}`);
          if (accessScope.jurisdictionCodes) {
            console.log(`   - 관할 보건소: ${accessScope.jurisdictionCodes.join(', ')}`);
          }
          restrictedCount++;
        } else if (accessScope.allowedCityCodes === null) {
          console.log(`⚠️ ${admin.email}:`);
          console.log(`   - 조직: ${admin.organizations?.name || admin.organization_name}`);
          console.log(`   - city_code: ${cityCode} (매핑 실패)`);
          console.log(`   - 시도 전체 접근 (보안 위험!)`);
          unrestrictedCount++;
        } else {
          console.log(`❌ ${admin.email}: 접근 불가 (빈 배열)`);
        }
      } catch (error) {
        console.log(`❌ ${admin.email}: 권한 계산 실패`);
        console.log(`   에러: ${error}`);
      }
    }

    console.log('\n=== 검증 결과 요약 ===');
    console.log(`구군 제한된 local_admin: ${restrictedCount}명`);
    console.log(`시도 전체 접근 local_admin: ${unrestrictedCount}명`);

    if (unrestrictedCount > 0) {
      console.log('\n⚠️ 경고: 시도 전체 접근 권한을 가진 local_admin이 있습니다!');
      console.log('city_code 매핑 추가가 필요합니다.');
    }

    // 3. 복합 행정구역 처리 테스트
    console.log('\n\n3. 복합 행정구역 처리 테스트:\n');

    const testCases = [
      '경기도 수원시 영통구 보건소',
      '충청남도 천안시 서북구 보건소',
      '경기도 성남시 분당구 보건소',
      '서울특별시 강남구 보건소',
      '대구광역시 수성구 보건소',
      '인천광역시 남동구 보건소',
      '제주시 보건소',
      '청주시 상당구 보건소'
    ];

    for (const testCase of testCases) {
      const result = extractRegionFromOrgName(testCase);
      console.log(`${testCase}:`);
      console.log(`  → 시도: ${result.sido || '❌'}, 구군: ${result.gugun || '❌'}`);
    }

    // 4. 관할보건소 정규화 테스트
    console.log('\n\n4. 관할보건소 정규화 테스트:\n');

    const jurisdictionTests = [
      '대구광역시 수성구 보건소',
      '대구광역시 수성구보건소',
      '대구광역시  수성구  보건소',
      '수성구 보건소'
    ];

    for (const test of jurisdictionTests) {
      const normalized = normalizeJurisdictionName(test);
      console.log(`"${test}" → "${normalized}"`);
    }

    // 5. 실제 AED 데이터 접근 테스트
    console.log('\n\n5. 실제 데이터 접근 테스트 (샘플):\n');

    for (const admin of localAdmins.slice(0, 3)) {
      try {
        const accessScope = resolveAccessScope(admin as any);

        // buildEquipmentFilter를 직접 호출하여 테스트
        const { buildEquipmentFilter } = await import('../lib/auth/equipment-access');

        // 주소 기준 필터
        const addressFilter = buildEquipmentFilter(accessScope, 'address');

        // 관할 기준 필터
        const jurisdictionFilter = buildEquipmentFilter(accessScope, 'jurisdiction');

        console.log(`\n${admin.email}의 필터:`);
        console.log('  주소 기준:', JSON.stringify(addressFilter, null, 2).substring(0, 200) + '...');
        console.log('  관할 기준:', JSON.stringify(jurisdictionFilter, null, 2).substring(0, 200) + '...');

        // 실제 접근 가능한 AED 수 확인
        const addressCount = await prisma.aed_data.count({
          where: addressFilter
        });

        const jurisdictionCount = await prisma.aed_data.count({
          where: jurisdictionFilter
        });

        console.log(`  접근 가능 AED: 주소 기준 ${addressCount}개, 관할 기준 ${jurisdictionCount}개`);

      } catch (error) {
        console.log(`  ❌ 테스트 실패: ${error}`);
      }
    }

    console.log('\n=== 검증 완료 ===');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

validateCityMapping().catch(console.error);