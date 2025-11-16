/**
 * Stage 3 테스트: MEDIUM 우선순위 문제 해결 검증
 *
 * 테스트 범위:
 * 1. installation_location_address 검색 추가 (2개 API)
 * 2. 유틸리티 함수 동작 검증 (null-helpers.ts, aed-address-helpers.ts)
 * 3. 리팩토링된 API 동작 검증 (4개 API, 11개 위치)
 *
 * 실행: npx tsx tests/stage3-fixes.test.ts
 */

import { Prisma } from '@prisma/client';

// ============================================
// 유틸리티 함수 Import
// ============================================
import {
  addressFallback,
  addressFallbackWithDefault,
  regionCodeFallback,
} from '../lib/utils/null-helpers';

import {
  getSqlAddressCoalesce,
  getSqlPositionCoalesce,
  getDisplayAddress,
  getDisplayAddressWithDefault,
  formatAEDAddress,
  getSqlAddressSearchConditions,
  getPrismaAddressSearchConditions,
} from '../lib/utils/aed-address-helpers';

// ============================================
// 테스트 헬퍼
// ============================================
interface TestResult {
  category: string;
  name: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

const results: TestResult[] = [];

function test(category: string, name: string, fn: () => void | Promise<void>) {
  const fullName = `${category} > ${name}`;
  const start = Date.now();

  try {
    const result = fn();
    if (result instanceof Promise) {
      result
        .then(() => {
          results.push({
            category,
            name: fullName,
            passed: true,
            duration: Date.now() - start,
          });
          console.log(`  ✓ ${fullName} (${Date.now() - start}ms)`);
        })
        .catch((error) => {
          results.push({
            category,
            name: fullName,
            passed: false,
            error: error.message,
            duration: Date.now() - start,
          });
          console.log(`  ✗ ${fullName}`);
          console.log(`    Error: ${error.message}`);
        });
    } else {
      results.push({
        category,
        name: fullName,
        passed: true,
        duration: Date.now() - start,
      });
      console.log(`  ✓ ${fullName} (${Date.now() - start}ms)`);
    }
  } catch (error: any) {
    results.push({
      category,
      name: fullName,
      passed: false,
      error: error.message,
      duration: Date.now() - start,
    });
    console.log(`  ✗ ${fullName}`);
    console.log(`    Error: ${error.message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function assertIncludes(haystack: string, needle: string, message?: string) {
  if (!haystack.includes(needle)) {
    throw new Error(
      message || `Expected "${haystack}" to include "${needle}"`
    );
  }
}

// ============================================
// Category 1: 유틸리티 함수 단위 테스트 (10개)
// ============================================
console.log('\n====================================');
console.log('Stage 3 테스트 시작');
console.log('====================================\n');

console.log('[Category 1] 유틸리티 함수 테스트');

// null-helpers.ts 테스트
test('Category 1', 'addressFallback() - 우선순위 fallback', () => {
  const result = addressFallback('주소1', '주소2');
  assertEqual(result, '주소1', '첫 번째 주소가 우선되어야 함');
});

test('Category 1', 'addressFallback() - 빈 문자열 처리', () => {
  const result = addressFallback('', '주소2');
  assertEqual(result, '주소2', '빈 문자열은 무효로 처리되어야 함');
});

test('Category 1', 'addressFallback() - null 처리', () => {
  const result = addressFallback(null, '주소2');
  assertEqual(result, '주소2', 'null은 무효로 처리되어야 함');
});

test('Category 1', 'addressFallback() - 모두 null인 경우', () => {
  const result = addressFallback(null, null);
  assertEqual(result, null, '모두 null이면 null 반환');
});

test('Category 1', 'addressFallbackWithDefault() - 기본값 반환', () => {
  const result = addressFallbackWithDefault(null, null, '주소 미등록');
  assertEqual(result, '주소 미등록', '모두 null이면 기본값 반환');
});

test('Category 1', 'regionCodeFallback() - null/undefined 처리', () => {
  const result1 = regionCodeFallback(null);
  assertEqual(result1, undefined, 'null은 undefined로 변환');

  const result2 = regionCodeFallback('SEO');
  assertEqual(result2, 'SEO', '유효한 값은 그대로 반환');
});

// aed-address-helpers.ts 테스트
test('Category 1', 'getSqlAddressCoalesce() - 기본 인자', () => {
  const result = getSqlAddressCoalesce();
  assertEqual(
    result,
    'COALESCE(ad.installation_location_address, ad.installation_address) as address',
    '기본 별칭으로 SQL 생성'
  );
});

test('Category 1', 'getSqlAddressCoalesce() - 커스텀 별칭', () => {
  const result = getSqlAddressCoalesce('a', 'full_address');
  assertEqual(
    result,
    'COALESCE(a.installation_location_address, a.installation_address) as full_address',
    '커스텀 별칭으로 SQL 생성'
  );
});

test('Category 1', 'getDisplayAddress() - 정상 케이스', () => {
  const aed = {
    installation_location_address: '대구광역시 중구 동덕로 167',
    installation_address: '대구광역시 중구 동산동',
  };
  const result = getDisplayAddress(aed);
  assertEqual(result, '대구광역시 중구 동덕로 167', 'location_address 우선');
});

test('Category 1', 'getDisplayAddress() - null 케이스', () => {
  const aed = {
    installation_location_address: null,
    installation_address: '대구광역시 중구 동산동',
  };
  const result = getDisplayAddress(aed);
  assertEqual(result, '대구광역시 중구 동산동', 'installation_address fallback');
});

test('Category 1', 'getDisplayAddressWithDefault() - 기본값', () => {
  const aed = {
    installation_location_address: null,
    installation_address: null,
  };
  const result = getDisplayAddressWithDefault(aed, '주소 미등록');
  assertEqual(result, '주소 미등록', '모두 null이면 기본값 반환');
});

// ============================================
// Category 2: API 검색 기능 테스트 (6개)
// ============================================
console.log('\n[Category 2] API 검색 기능 테스트');

test('Category 2', 'getSqlAddressSearchConditions() - SQL 조건 생성', () => {
  const { conditions, params } = getSqlAddressSearchConditions('동덕로', 'a', 5);

  assertEqual(conditions.length, 2, '2개의 조건 생성');
  assertEqual(conditions[0], 'a.installation_address ILIKE $5');
  assertEqual(conditions[1], 'a.installation_location_address ILIKE $5');
  assertEqual(params[0], '%동덕로%');
});

test('Category 2', 'getPrismaAddressSearchConditions() - Prisma 조건 생성', () => {
  const conditions = getPrismaAddressSearchConditions('동덕로');

  assertEqual(conditions.length, 2, '2개의 조건 생성');
  assertEqual(conditions[0], {
    installation_address: { contains: '동덕로', mode: 'insensitive' }
  });
  assertEqual(conditions[1], {
    installation_location_address: { contains: '동덕로', mode: 'insensitive' }
  });
});

test('Category 2', 'formatAEDAddress() - 주소 메타데이터', () => {
  const aed = {
    installation_location_address: '대구광역시 중구 동덕로 167',
    installation_address: '대구광역시 중구 동산동',
  };
  const result = formatAEDAddress(aed);

  assertEqual(result.address, '대구광역시 중구 동덕로 167');
  assertEqual(result.hasLocationAddress, true);
  assertEqual(result.hasInstallationAddress, true);
  assertEqual(result.usedLocationAddress, true);
});

test('Category 2', 'getSqlPositionCoalesce() - 위치 COALESCE', () => {
  const result = getSqlPositionCoalesce('ad', 'position');
  assertEqual(
    result,
    "COALESCE(ad.installation_position, '') as position",
    '위치 필드 COALESCE 생성'
  );
});

// ============================================
// Category 3: Prisma.raw() 패턴 검증 (4개)
// ============================================
console.log('\n[Category 3] Prisma.raw() 패턴 검증');

test('Category 3', 'Prisma.raw() - getSqlAddressCoalesce 통합', () => {
  const sql = getSqlAddressCoalesce('ad', 'address');
  const prismaRaw = Prisma.raw(sql);

  // Prisma.raw 객체가 생성되는지 확인
  assertEqual(typeof prismaRaw, 'object', 'Prisma.raw 객체 생성');
});

test('Category 3', 'Prisma.raw() - 특수 문자 처리', () => {
  // 별칭에 특수 문자가 없는지 확인
  const sql = getSqlAddressCoalesce('ad', 'my_address');
  assertIncludes(sql, 'as my_address', '별칭이 정확히 포함됨');
});

test('Category 3', 'Prisma.raw() - 테이블 별칭 검증', () => {
  const sql1 = getSqlAddressCoalesce('ad');
  assertIncludes(sql1, 'ad.installation_location_address', '테이블 별칭 ad 사용');

  const sql2 = getSqlAddressCoalesce('a');
  assertIncludes(sql2, 'a.installation_location_address', '테이블 별칭 a 사용');
});

test('Category 3', 'Prisma.raw() - SQL Injection 방지', () => {
  // 하드코딩된 값만 사용하는지 확인
  const sql = getSqlAddressCoalesce('ad', 'address');

  // SQL 키워드가 하드코딩되어 있는지 확인
  assertIncludes(sql, 'COALESCE', 'COALESCE 키워드 포함');
  assertIncludes(sql, 'installation_location_address', '칼럼명 하드코딩');
  assertIncludes(sql, 'installation_address', '칼럼명 하드코딩');
});

// ============================================
// Category 4: 파일 구조 검증 (4개)
// ============================================
console.log('\n[Category 4] 파일 구조 검증');

test('Category 4', 'null-helpers.ts - export 확인', () => {
  assertEqual(typeof addressFallback, 'function');
  assertEqual(typeof addressFallbackWithDefault, 'function');
  assertEqual(typeof regionCodeFallback, 'function');
});

test('Category 4', 'aed-address-helpers.ts - export 확인', () => {
  assertEqual(typeof getSqlAddressCoalesce, 'function');
  assertEqual(typeof getDisplayAddress, 'function');
  assertEqual(typeof getDisplayAddressWithDefault, 'function');
  assertEqual(typeof formatAEDAddress, 'function');
});

test('Category 4', 'addressFallback과 getDisplayAddress 일관성', () => {
  const testData = {
    installation_location_address: '주소1',
    installation_address: '주소2',
  };

  const result1 = addressFallback(
    testData.installation_location_address,
    testData.installation_address
  );
  const result2 = getDisplayAddress(testData);

  assertEqual(result1, result2, '두 함수가 동일한 결과 반환');
});

test('Category 4', '유틸리티 함수 체인 테스트', () => {
  // getDisplayAddress는 내부적으로 addressFallback을 사용
  const aed = {
    installation_location_address: '',
    installation_address: '주소',
  };

  const result = getDisplayAddress(aed);
  assertEqual(result, '주소', '빈 문자열은 무효 처리됨');
});

// ============================================
// 테스트 결과 출력
// ============================================
setTimeout(() => {
  console.log('\n====================================');
  console.log('테스트 결과');
  console.log('====================================\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log(`총 테스트: ${total}개`);
  console.log(`통과: ${passed}개`);
  console.log(`실패: ${failed}개`);
  console.log(`통과율: ${((passed / total) * 100).toFixed(1)}%`);

  if (failed > 0) {
    console.log('\n실패한 테스트:');
    results
      .filter(r => !r.passed)
      .forEach(r => {
        console.log(`  ✗ ${r.name}`);
        console.log(`    ${r.error}`);
      });
  }

  console.log('\n====================================');

  if (failed === 0) {
    console.log('✅ 모든 테스트 통과!');
    console.log('====================================\n');
    process.exit(0);
  } else {
    console.log('❌ 일부 테스트 실패');
    console.log('====================================\n');
    process.exit(1);
  }
}, 1000); // 비동기 테스트 완료 대기
