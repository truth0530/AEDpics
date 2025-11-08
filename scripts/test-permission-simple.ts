#!/usr/bin/env npx tsx

/**
 * 간단한 권한 테스트
 * buildEquipmentFilter 함수를 직접 테스트
 */

import { PrismaClient } from '@prisma/client';
import { buildEquipmentFilter } from '../lib/auth/equipment-access';

const prisma = new PrismaClient();

async function testScenario(name: string, accessScope: any, criteria: 'address' | 'jurisdiction') {
  console.log(`\n📝 ${name}`);
  console.log(`   기준: ${criteria === 'address' ? '주소' : '관할보건소'}`);

  const filter = buildEquipmentFilter(accessScope, criteria);
  console.log(`   필터: ${JSON.stringify(filter, null, 2)}`);

  const count = await prisma.aed_data.count({ where: filter });
  console.log(`   결과: ${count}개 AED`);

  return count;
}

async function main() {
  console.log('=== buildEquipmentFilter 직접 테스트 ===');

  // 1. 전국 접근 (master_admin 시뮬레이션)
  await testScenario(
    '전국 접근 (regionCodes=null)',
    {
      regionCodes: null,  // null = 전국
      cityCodes: null
    },
    'address'
  );

  // 2. 시도 접근 (regional_admin 시뮬레이션)
  await testScenario(
    '경남 전체 접근',
    {
      regionCodes: ['GYN'],  // 경상남도
      cityCodes: null  // null = 시도 내 전체
    },
    'address'
  );

  // 3. 구군 접근 (local_admin 시뮬레이션) - 주소 기준
  await testScenario(
    '김해시만 접근 (주소 기준)',
    {
      regionCodes: ['GYN'],
      cityCodes: ['김해시']
    },
    'address'
  );

  // 4. 구군 접근 (local_admin 시뮬레이션) - 관할 기준
  await testScenario(
    '김해시보건소 관할 (관할 기준)',
    {
      jurisdictionCodes: ['김해시보건소']
    },
    'jurisdiction'
  );

  // 5. 다중 시도 접근
  await testScenario(
    '대구+경북 접근',
    {
      regionCodes: ['DAE', 'GYB'],
      cityCodes: null
    },
    'address'
  );

  // 6. 다중 구군 접근
  await testScenario(
    '대구 중구+서구 접근',
    {
      regionCodes: ['DAE'],
      cityCodes: ['중구', '서구']
    },
    'address'
  );

  // 7. 빈 배열 = 접근 차단
  await testScenario(
    '빈 배열 = 접근 차단',
    {
      regionCodes: [],  // 빈 배열 = 접근 차단
      cityCodes: []
    },
    'address'
  );

  // 8. 제주 테스트 (시도명 변형 처리 확인)
  await testScenario(
    '제주 전체 (약어 처리 테스트)',
    {
      regionCodes: ['JEJ'],
      cityCodes: null
    },
    'address'
  );

  // 9. 제주시만 접근
  await testScenario(
    '제주시만 접근',
    {
      regionCodes: ['JEJ'],
      cityCodes: ['제주시']
    },
    'address'
  );

  // 10. 세종시 테스트
  await testScenario(
    '세종시',
    {
      regionCodes: ['SEJ'],
      cityCodes: ['세종시']  // 실제 AED 데이터는 구군='세종시'
    },
    'address'
  );

  console.log('\n=== 테스트 완료 ===');
  await prisma.$disconnect();
}

main().catch(console.error);