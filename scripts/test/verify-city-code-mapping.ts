/**
 * city_code → gugun 매핑 및 정규화 검증 스크립트
 *
 * 목적: 회원가입 시 다양한 조직명 형식이 올바르게 매핑되는지 확인
 */

import { mapCityCodeToGugun, normalizeGugunForDB } from '@/lib/constants/regions';

interface TestCase {
  cityCode: string;
  expectedGugun: string;
  expectedFullGugun: string;
  description: string;
}

const testCases: TestCase[] = [
  // 충청북도
  {
    cityCode: 'cheongju-sangdang',
    expectedGugun: '상당구',
    expectedFullGugun: '청주시 상당구',
    description: '청주시 상당구 보건소',
  },
  {
    cityCode: 'cheongju-seowon',
    expectedGugun: '서원구',
    expectedFullGugun: '청주시 서원구',
    description: '청주시 서원구 보건소',
  },
  {
    cityCode: 'cheongju-heungdeok',
    expectedGugun: '흥덕구',
    expectedFullGugun: '청주시 흥덕구',
    description: '청주시 흥덕구 보건소',
  },
  {
    cityCode: 'cheongju-cheongwon',
    expectedGugun: '청원구',
    expectedFullGugun: '청주시 청원구',
    description: '청주시 청원구 보건소',
  },

  // 경기도
  {
    cityCode: 'suwon-jangan',
    expectedGugun: '장안구',
    expectedFullGugun: '수원시 장안구',
    description: '수원시 장안구 보건소',
  },
  {
    cityCode: 'seongnam-bundang',
    expectedGugun: '분당구',
    expectedFullGugun: '성남시 분당구',
    description: '성남시 분당구 보건소',
  },
  {
    cityCode: 'anyang-manan',
    expectedGugun: '만안구',
    expectedFullGugun: '안양시 만안구',
    description: '안양시 만안구 보건소',
  },
  {
    cityCode: 'yongin-suji',
    expectedGugun: '수지구',
    expectedFullGugun: '용인시 수지구',
    description: '용인시 수지구 보건소',
  },

  // 충청남도
  {
    cityCode: 'cheonan-dongnam',
    expectedGugun: '동남구',
    expectedFullGugun: '천안시 동남구',
    description: '천안시 동남구 보건소',
  },
  {
    cityCode: 'cheonan-seobuk',
    expectedGugun: '서북구',
    expectedFullGugun: '천안시 서북구',
    description: '천안시 서북구 보건소',
  },

  // 전북특별자치도
  {
    cityCode: 'jeonju-wansan',
    expectedGugun: '완산구',
    expectedFullGugun: '전주시 완산구',
    description: '전주시 완산구 보건소',
  },
  {
    cityCode: 'jeonju-deokjin',
    expectedGugun: '덕진구',
    expectedFullGugun: '전주시 덕진구',
    description: '전주시 덕진구 보건소',
  },

  // 경상남도
  {
    cityCode: 'changwon-uichang',
    expectedGugun: '의창구',
    expectedFullGugun: '창원시 의창구',
    description: '창원시 의창구 보건소',
  },
  {
    cityCode: 'changwon-jinhae',
    expectedGugun: '진해구',
    expectedFullGugun: '창원시 진해구',
    description: '창원시 진해구 보건소',
  },
];

function runTests() {
  console.log('='.repeat(80));
  console.log('City Code → Gugun 매핑 검증 시작');
  console.log('='.repeat(80));

  let passCount = 0;
  let failCount = 0;

  for (const testCase of testCases) {
    const { cityCode, expectedGugun, expectedFullGugun, description } = testCase;

    // Step 1: city_code → gugun 매핑
    const mappedGugun = mapCityCodeToGugun(cityCode);
    const step1Pass = mappedGugun === expectedGugun;

    // Step 2: gugun → 전체 형식 정규화
    const normalizedGugun = normalizeGugunForDB(mappedGugun || undefined);
    const step2Pass = normalizedGugun === expectedFullGugun;

    const overallPass = step1Pass && step2Pass;

    if (overallPass) {
      passCount++;
      console.log(`✅ PASS: ${description}`);
      console.log(`   ${cityCode} → ${mappedGugun} → ${normalizedGugun}`);
    } else {
      failCount++;
      console.log(`❌ FAIL: ${description}`);
      console.log(`   ${cityCode}`);
      if (!step1Pass) {
        console.log(`   Step 1 실패: 예상 "${expectedGugun}", 실제 "${mappedGugun}"`);
      }
      if (!step2Pass) {
        console.log(`   Step 2 실패: 예상 "${expectedFullGugun}", 실제 "${normalizedGugun}"`);
      }
    }
    console.log();
  }

  console.log('='.repeat(80));
  console.log(`결과: ${passCount} 성공, ${failCount} 실패 (총 ${testCases.length}개 테스트)`);
  console.log('='.repeat(80));

  if (failCount > 0) {
    process.exit(1);
  }
}

// 실행
runTests();
