// AED 데이터 보안 테스트 스크립트
// 브라우저 콘솔에서 실행

// ===========================================
// 1. 현재 사용자 정보 확인
// ===========================================
async function checkCurrentUser() {
  console.log('\n=== 현재 사용자 정보 ===');
  try {
    const response = await fetch('/api/auth/me', { credentials: 'include' });
    const user = await response.json();
    console.log('사용자 역할:', user.role);
    console.log('소속 조직:', user.organization);
    console.log('권한 범위:', {
      allowedRegionCodes: user.accessScope?.allowedRegionCodes,
      allowedCityCodes: user.accessScope?.allowedCityCodes
    });
    return user;
  } catch (error) {
    console.error('❌ 사용자 정보 조회 실패:', error);
    return null;
  }
}

// ===========================================
// 2. 역할별 테스트 함수
// ===========================================
async function testRole(role, testCases) {
  console.log(`\n=== Testing ${role} ===`);
  const results = [];

  for (const test of testCases) {
    try {
      const response = await fetch(`/api/aed-data?${test.params}`, {
        credentials: 'include'
      });

      const data = await response.json();
      const result = {
        description: test.description,
        expected: test.expected,
        actual: response.status,
        passed: response.status === test.expected,
        message: response.status === 200 ?
          `데이터 ${data.data?.length || 0}건` :
          data.error || data.message
      };

      console.log(
        result.passed ? '✅' : '❌',
        `[${result.actual}]`,
        result.description,
        '-',
        result.message
      );

      // 자동 적용된 필터 확인
      if (response.status === 200 && data.filters?.enforced?.appliedDefaults?.length > 0) {
        console.log('  📌 자동 적용된 필터:', data.filters.enforced.appliedDefaults);
      }

      results.push(result);
    } catch (error) {
      console.error('❌ 네트워크 오류:', test.description, error);
      results.push({
        description: test.description,
        passed: false,
        error: error.message
      });
    }
  }

  return results;
}

// ===========================================
// 3. Master 역할 테스트
// ===========================================
async function testMaster() {
  return await testRole('master', [
    {
      params: 'criteria=address',
      expected: 200,
      description: '필터 없음 - 전국 데이터'
    },
    {
      params: 'criteria=address&region=SEO',
      expected: 200,
      description: '단일 시도 (서울)'
    },
    {
      params: 'criteria=address&region=SEO&region=BUS',
      expected: 200,
      description: '다중 시도 (서울+부산)'
    },
    {
      params: 'criteria=address&region=SEO&city=강남구',
      expected: 200,
      description: '시도+시군구 (서울 강남구)'
    }
  ]);
}

// ===========================================
// 4. Regional Admin 테스트 (서울시청)
// ===========================================
async function testRegionalAdmin() {
  return await testRole('regional_admin', [
    {
      params: 'criteria=address',
      expected: 200,
      description: '필터 없음 → 소속 시도 자동 적용'
    },
    {
      params: 'criteria=address&region=SEO',
      expected: 200,
      description: '소속 시도 명시'
    },
    {
      params: 'criteria=address&region=BUS',
      expected: 403,
      description: '타 시도 요청 → 거부'
    },
    {
      params: 'criteria=address&city=강남구',
      expected: 200,
      description: '소속 시도 내 구'
    },
    {
      params: 'criteria=address&region=SEO&city=강남구&city=서초구',
      expected: 200,
      description: '소속 시도 내 다중 구'
    }
  ]);
}

// ===========================================
// 5. Local Admin 테스트 (서울 강남구 보건소)
// ===========================================
async function testLocalAdmin() {
  return await testRole('local_admin', [
    {
      params: 'criteria=address',
      expected: 200,
      description: '필터 없음 → 소속 시군구 자동 적용'
    },
    {
      params: 'criteria=address&region=SEO&city=강남구',
      expected: 200,
      description: '소속 지역 명시'
    },
    {
      params: 'criteria=address&city=서초구',
      expected: 403,
      description: '타 구 요청 → 거부'
    },
    {
      params: 'criteria=address&region=BUS',
      expected: 403,
      description: '타 시도 요청 → 거부'
    },
    {
      params: 'criteria=jurisdiction',
      expected: 200,
      description: '관할보건소 기준 → 성공'
    }
  ]);
}

// ===========================================
// 6. 필터 자동 적용 검증
// ===========================================
async function verifyFilterEnforcement() {
  console.log('\n=== 필터 자동 적용 검증 ===');

  const response = await fetch('/api/aed-data?criteria=address&limit=1', {
    credentials: 'include'
  });

  if (response.ok) {
    const data = await response.json();
    console.log('\n📋 필터 정보:');
    console.log('요청된 필터:', data.filters?.applied);
    console.log('강제 적용된 필터:', data.filters?.enforced);

    if (data.filters?.enforced?.appliedDefaults?.length > 0) {
      console.log('✅ 자동 적용 확인:', data.filters.enforced.appliedDefaults);
    }

    if (data.data?.length > 0) {
      const sample = data.data[0];
      console.log('\n📍 샘플 데이터 지역:');
      console.log('시도:', sample.sido);
      console.log('시군구:', sample.gugun);
    }
  }
}

// ===========================================
// 7. 403 에러 상세 확인
// ===========================================
async function test403Error() {
  console.log('\n=== 403 에러 검증 ===');

  const user = await checkCurrentUser();
  if (!user) return;

  // 역할에 따라 다른 테스트
  let testUrl = '';
  if (user.role === 'regional_admin') {
    testUrl = '/api/aed-data?criteria=address&region=BUS'; // 타 시도
  } else if (user.role === 'local_admin') {
    testUrl = '/api/aed-data?criteria=address&city=서초구'; // 타 구
  } else {
    console.log('이 테스트는 regional_admin 또는 local_admin 전용입니다');
    return;
  }

  const response = await fetch(testUrl, { credentials: 'include' });
  const data = await response.json();

  if (response.status === 403) {
    console.log('✅ 403 에러 정상 발생');
    console.log('에러 메시지:', data.error);
    console.log('거부된 지역:', data.unauthorizedRegions || data.unauthorizedCities);
  } else {
    console.log('❌ 예상과 다른 응답:', response.status);
    console.log('응답:', data);
  }
}

// ===========================================
// 8. 전체 테스트 실행
// ===========================================
async function runFullTest() {
  console.log('====================================');
  console.log('AED 데이터 보안 테스트 시작');
  console.log('====================================');

  // 현재 사용자 확인
  const user = await checkCurrentUser();
  if (!user) {
    console.error('로그인이 필요합니다');
    return;
  }

  // 역할별 테스트 실행
  let results = [];
  switch(user.role) {
    case 'master':
    case 'emergency_center_admin':
    case 'ministry_admin':
      results = await testMaster();
      break;
    case 'regional_admin':
      results = await testRegionalAdmin();
      break;
    case 'local_admin':
      results = await testLocalAdmin();
      break;
    default:
      console.log('테스트 대상이 아닌 역할:', user.role);
      return;
  }

  // 필터 자동 적용 검증
  await verifyFilterEnforcement();

  // 403 에러 테스트 (해당하는 경우)
  if (['regional_admin', 'local_admin'].includes(user.role)) {
    await test403Error();
  }

  // 결과 요약
  console.log('\n====================================');
  console.log('테스트 결과 요약');
  console.log('====================================');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`✅ 성공: ${passed}개`);
  console.log(`❌ 실패: ${failed}개`);

  if (failed > 0) {
    console.log('\n실패한 테스트:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`- ${r.description}`);
    });
  }

  return results;
}

// ===========================================
// 실행 방법
// ===========================================
console.log('📌 테스트 실행 방법:');
console.log('1. 전체 테스트: runFullTest()');
console.log('2. 현재 사용자 확인: checkCurrentUser()');
console.log('3. 필터 적용 확인: verifyFilterEnforcement()');
console.log('4. 403 에러 테스트: test403Error()');
console.log('\n시작하려면 runFullTest()를 실행하세요.');

// 자동 실행 (선택사항)
// runFullTest();