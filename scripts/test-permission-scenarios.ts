#!/usr/bin/env npx tsx

/**
 * 권한 테스트 시나리오 (직접 테스트)
 * parseQueryParams를 거치지 않고 직접 함수 테스트
 */

import { PrismaClient } from '@prisma/client';
import { resolveAccessScope } from '../lib/auth/access-control';
import { buildEquipmentFilter } from '../lib/auth/equipment-access';
import { UserRole } from '../packages/types';

const prisma = new PrismaClient();

interface TestScenario {
  name: string;
  user: {
    email: string;
    role: UserRole;
    organization?: any;
  };
  queryParams: Record<string, string>;
  criteria: 'address' | 'jurisdiction';
  expected: {
    description: string;
    minCount?: number;
    maxCount?: number;
  };
}

async function runScenario(scenario: TestScenario) {
  console.log(`\n📝 시나리오: ${scenario.name}`);
  console.log(`   사용자: ${scenario.user.email} (${scenario.user.role})`);
  console.log(`   쿼리: ${JSON.stringify(scenario.queryParams)}`);
  console.log(`   기준: ${scenario.criteria === 'address' ? '주소 기준' : '관할보건소 기준'}`);

  try {
    // 1. 쿼리 파싱 (API와 동일)
    const urlParams = new URLSearchParams(scenario.queryParams);
    const parsedQuery = parseQueryParams(urlParams);
    console.log(`   파싱결과: sido=${parsedQuery.sido || '없음'}, gugun=${parsedQuery.gugun || '없음'}`);

    // 2. 접근 범위 계산 (API와 동일)
    const accessScope = resolveAccessScope(scenario.user as any, parsedQuery.sido, parsedQuery.gugun);
    console.log(`   접근범위: 시도=${accessScope.allowedRegionCodes?.join(',') || '전국'}, 구군=${accessScope.allowedCityCodes?.join(',') || '전체'}`);

    // 3. 필터 생성 (API와 동일)
    const filter = buildEquipmentFilter(accessScope, scenario.criteria);
    console.log(`   필터: ${JSON.stringify(filter).substring(0, 100)}...`);

    // 4. 실제 데이터 조회
    const count = await prisma.aed_data.count({
      where: filter
    });

    // 5. 결과 검증
    const isValid = (!scenario.expected.minCount || count >= scenario.expected.minCount) &&
                    (!scenario.expected.maxCount || count <= scenario.expected.maxCount);

    console.log(`   결과: ${count}개 AED`);
    console.log(`   ${isValid ? '✅ 성공' : '❌ 실패'}: ${scenario.expected.description}`);

    if (!isValid) {
      console.log(`   예상: ${scenario.expected.minCount || 0} ~ ${scenario.expected.maxCount || '무제한'}, 실제: ${count}`);
    }

    return { scenario: scenario.name, success: isValid, count };

  } catch (error) {
    console.log(`   ❌ 에러: ${error}`);
    return { scenario: scenario.name, success: false, error };
  }
}

async function main() {
  console.log('=== 권한 테스트 시나리오 실행 ===\n');

  // 테스트용 조직 데이터 가져오기
  const daeguJungOrg = await prisma.organizations.findFirst({
    where: { name: { contains: '대구광역시 중구 보건소' } }
  });

  const jejuOrg = await prisma.organizations.findFirst({
    where: { name: { contains: '제주시 보건소' } }
  });

  const scenarios: TestScenario[] = [
    // 1. master_admin: 전국 접근
    {
      name: "Master Admin - 전국 접근",
      user: {
        email: "master@nmc.or.kr",
        role: 'master_admin' as UserRole
      },
      queryParams: {},
      criteria: 'address',
      expected: {
        description: "전국 모든 AED 접근 가능",
        minCount: 80000
      }
    },

    // 2. regional_admin: 시도 접근
    {
      name: "Regional Admin - 대구 전체",
      user: {
        email: "daegu@korea.kr",
        role: 'regional_admin' as UserRole,
        organization: { region_code: 'DAE' }
      },
      queryParams: { sido: '대구' },
      criteria: 'address',
      expected: {
        description: "대구 전체 AED 접근 가능",
        minCount: 1000,
        maxCount: 5000
      }
    },

    // 3. local_admin: 구군 제한 (주소 기준)
    {
      name: "Local Admin - 대구 중구 (주소 기준)",
      user: {
        email: "nemcdg@korea.kr",
        role: 'local_admin' as UserRole,
        organization: daeguJungOrg
      },
      queryParams: { sido: '대구', gugun: '중구' },
      criteria: 'address',
      expected: {
        description: "대구 중구에 설치된 AED만",
        minCount: 200,
        maxCount: 500
      }
    },

    // 4. local_admin: 구군 제한 (관할 기준)
    {
      name: "Local Admin - 대구 중구 (관할 기준)",
      user: {
        email: "nemcdg@korea.kr",
        role: 'local_admin' as UserRole,
        organization: daeguJungOrg
      },
      queryParams: {},
      criteria: 'jurisdiction',
      expected: {
        description: "대구중구보건소가 관리하는 AED",
        minCount: 200,
        maxCount: 500
      }
    },

    // 5. 플레이스홀더 필터링 테스트
    {
      name: "플레이스홀더 필터링 - '전체' 무시",
      user: {
        email: "jeju@korea.kr",
        role: 'regional_admin' as UserRole,
        organization: { region_code: 'JEJ' }
      },
      queryParams: { sido: '제주', gugun: '전체' }, // '전체'는 무시되어야 함
      criteria: 'address',
      expected: {
        description: "'전체'는 무시하고 제주 전체 AED 반환",
        minCount: 2000,
        maxCount: 4000
      }
    },

    // 6. 시도명 약어 처리 테스트
    {
      name: "시도명 약어 - 경남 = 경상남도",
      user: {
        email: "gimhae@korea.kr",
        role: 'local_admin' as UserRole,
        organization: {
          region_code: 'GYN',
          city_code: 'gimhae',
          name: '김해시 보건소'
        }
      },
      queryParams: { sido: '경남', gugun: '김해시' },
      criteria: 'address',
      expected: {
        description: "경남(약어)으로도 김해시 AED 조회 가능",
        minCount: 400,
        maxCount: 600
      }
    },

    // 7. 복합 행정구역 테스트
    {
      name: "복합 행정구역 - 수원시 영통구",
      user: {
        email: "yeongtong@korea.kr",
        role: 'local_admin' as UserRole,
        organization: {
          region_code: 'GYE',
          city_code: 'suwon_yeongtong',
          name: '경기도 수원시 영통구 보건소'
        }
      },
      queryParams: { sido: '경기', gugun: '영통구' },
      criteria: 'address',
      expected: {
        description: "수원시 영통구 AED만 조회",
        minCount: 50,
        maxCount: 300
      }
    },

    // 8. 빈 구군 코드 처리
    {
      name: "빈 구군 코드 - 시도 전체 차단",
      user: {
        email: "nogugun@korea.kr",
        role: 'local_admin' as UserRole,
        organization: {
          region_code: 'SEO',
          city_code: null,  // city_code가 없음
          name: '테스트 조직'
        }
      },
      queryParams: { sido: '서울' },
      criteria: 'address',
      expected: {
        description: "city_code 없으면 접근 차단",
        minCount: 0,
        maxCount: 0
      }
    }
  ];

  const results = [];
  for (const scenario of scenarios) {
    const result = await runScenario(scenario);
    results.push(result);
  }

  // 결과 요약
  console.log('\n\n=== 테스트 결과 요약 ===');
  const totalTests = results.length;
  const successTests = results.filter(r => r.success).length;
  const failedTests = results.filter(r => !r.success);

  console.log(`전체: ${totalTests}개`);
  console.log(`성공: ${successTests}개`);
  console.log(`실패: ${failedTests.length}개`);

  if (failedTests.length > 0) {
    console.log('\n실패한 테스트:');
    failedTests.forEach(test => {
      console.log(`  - ${test.scenario}: ${test.error || '예상 범위 벗어남'}`);
    });
  } else {
    console.log('\n✅ 모든 테스트 통과!');
  }

  await prisma.$disconnect();
}

main().catch(console.error);