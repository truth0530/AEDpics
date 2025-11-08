#!/usr/bin/env npx ts-node

/**
 * City Code 분석 스크립트
 * - organizations.city_code 실제 값 확인
 * - aed_data.gugun 실제 값 확인
 * - 매핑 누락 확인
 */

import { PrismaClient } from '@prisma/client';
import { CITY_CODE_TO_GUGUN_MAP, mapCityCodeToGugun } from '../lib/constants/regions';

const prisma = new PrismaClient();

async function analyzeCityCodes() {
  console.log('=== City Code 분석 시작 ===\n');

  try {
    // 1. organizations의 city_code 분석
    console.log('1. Organizations 테이블의 city_code 값들:');
    const orgCityCodes = await prisma.$queryRaw<
      Array<{ city_code: string | null; count: bigint }>
    >`
      SELECT city_code, COUNT(*) as count
      FROM organizations
      WHERE city_code IS NOT NULL
      GROUP BY city_code
      ORDER BY count DESC
    `;

    console.log(`\n총 ${orgCityCodes.length}개의 고유한 city_code 발견:\n`);

    const unmappedOrgCodes: string[] = [];
    const mappedOrgCodes: Array<{ code: string; gugun: string; count: bigint }> = [];

    for (const row of orgCityCodes) {
      if (!row.city_code) continue;

      const mapped = mapCityCodeToGugun(row.city_code);
      if (mapped) {
        mappedOrgCodes.push({
          code: row.city_code,
          gugun: mapped,
          count: row.count
        });
      } else {
        unmappedOrgCodes.push(row.city_code);
        console.log(`❌ 매핑 없음: "${row.city_code}" (${row.count}개 조직)`);
      }
    }

    console.log(`\n✅ 매핑된 city_code: ${mappedOrgCodes.length}개`);
    mappedOrgCodes.forEach(m => {
      console.log(`   ${m.code} → ${m.gugun} (${m.count}개)`);
    });

    console.log(`\n❌ 매핑되지 않은 city_code: ${unmappedOrgCodes.length}개`);
    console.log('   필요한 매핑 추가:');
    unmappedOrgCodes.forEach(code => {
      console.log(`   '${code}': '???',  // TODO: 실제 구군명 확인 필요`);
    });

    // 2. aed_data의 gugun 분석
    console.log('\n\n2. AED Data 테이블의 gugun 값들:');
    const aedGuguns = await prisma.$queryRaw<
      Array<{ sido: string | null; gugun: string | null; count: bigint }>
    >`
      SELECT sido, gugun, COUNT(*) as count
      FROM aed_data
      WHERE gugun IS NOT NULL
      GROUP BY sido, gugun
      ORDER BY sido, gugun
      LIMIT 50
    `;

    console.log(`\n샘플 시도/구군 조합 (상위 50개):\n`);
    let currentSido = '';
    for (const row of aedGuguns) {
      if (row.sido !== currentSido) {
        currentSido = row.sido || '';
        console.log(`\n[${currentSido}]`);
      }
      console.log(`   ${row.gugun}: ${row.count}개`);
    }

    // 3. 역 매핑 테이블 생성 (gugun → city_code)
    console.log('\n\n3. 역 매핑 테이블 (현재 매핑 기준):');
    const reverseMap: Record<string, string> = {};
    for (const [code, gugun] of Object.entries(CITY_CODE_TO_GUGUN_MAP)) {
      if (reverseMap[gugun]) {
        console.log(`⚠️ 중복 매핑 발견: ${gugun} → ${reverseMap[gugun]}, ${code}`);
      }
      reverseMap[gugun] = code;
    }
    console.log(`총 ${Object.keys(reverseMap).length}개의 구군이 매핑됨`);

    // 4. local_admin 역할 사용자들의 조직 분석
    console.log('\n\n4. local_admin 사용자들의 소속 조직 분석:');
    const localAdminOrgs = await prisma.$queryRaw<
      Array<{
        organization_name: string | null;
        city_code: string | null;
        region_code: string | null;
        count: bigint
      }>
    >`
      SELECT
        up.organization_name,
        o.city_code,
        up.region_code,
        COUNT(*) as count
      FROM user_profiles up
      LEFT JOIN organizations o ON up.organization_id = o.id
      WHERE up.role = 'local_admin'
      GROUP BY up.organization_name, o.city_code, up.region_code
      ORDER BY count DESC
    `;

    console.log(`\n총 ${localAdminOrgs.length}개의 local_admin 조직:\n`);

    let restrictedCount = 0;
    let unrestrictedCount = 0;

    for (const org of localAdminOrgs) {
      const mapped = org.city_code ? mapCityCodeToGugun(org.city_code) : null;
      if (mapped) {
        console.log(`✅ ${org.organization_name || 'Unknown'} (${org.region_code}/${org.city_code} → ${mapped}): ${org.count}명`);
        restrictedCount += Number(org.count);
      } else {
        console.log(`❌ ${org.organization_name || 'Unknown'} (${org.region_code}/${org.city_code || 'NULL'}): ${org.count}명 - 시도 전체 접근!`);
        unrestrictedCount += Number(org.count);
      }
    }

    console.log(`\n=== 요약 ===`);
    console.log(`구군 제한된 local_admin: ${restrictedCount}명`);
    console.log(`시도 전체 접근 local_admin: ${unrestrictedCount}명 (보안 위험!)`);
    console.log(`\n현재 CITY_CODE_TO_GUGUN_MAP 항목 수: ${Object.keys(CITY_CODE_TO_GUGUN_MAP).length}개`);
    console.log(`매핑이 필요한 city_code 수: ${unmappedOrgCodes.length}개`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeCityCodes().catch(console.error);