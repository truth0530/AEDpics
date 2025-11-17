/**
 * 통계 API 직접 호출 테스트
 * 대구광역시 필터로 호출했을 때 실제 반환값 확인
 */

const testMatchingStatusAPI = async () => {
  console.log('=== /api/compliance/matching-status 직접 호출 테스트 ===\n');

  // 1. 필터 없이 호출
  console.log('1. 필터 없이 호출:');
  const url1 = 'http://localhost:3000/api/compliance/matching-status?page=1&pageSize=50';
  console.log(`   URL: ${url1}`);

  try {
    const response1 = await fetch(url1, {
      headers: {
        'Cookie': 'next-auth.session-token=test' // 임시 인증 (실제로는 세션 필요)
      }
    });

    if (response1.status === 401) {
      console.log('   ❌ 인증 필요 - 브라우저에서 로그인 후 직접 테스트 필요\n');
    } else {
      const data1 = await response1.json();
      console.log(`   응답: ${JSON.stringify(data1.summary, null, 2)}\n`);
    }
  } catch (error) {
    console.log(`   ❌ 오류: ${error.message}\n`);
  }

  // 2. 대구광역시로 필터링
  console.log('2. sido=대구광역시로 필터링:');
  const url2 = 'http://localhost:3000/api/compliance/matching-status?sido=대구광역시&page=1&pageSize=50';
  console.log(`   URL: ${url2}`);

  try {
    const response2 = await fetch(url2);

    if (response2.status === 401) {
      console.log('   ❌ 인증 필요');
      console.log('\n브라우저에서 다음 URL들을 직접 확인하세요:');
      console.log('   1. 필터 없음: http://localhost:3000/api/compliance/matching-status?page=1&pageSize=50');
      console.log('   2. 대구광역시: http://localhost:3000/api/compliance/matching-status?sido=대구광역시&page=1&pageSize=50');
      console.log('   3. 대구광역시 군위군: http://localhost:3000/api/compliance/matching-status?sido=대구광역시&gugun=군위군&page=1&pageSize=50\n');
    } else {
      const data2 = await response2.json();
      console.log(`   응답: ${JSON.stringify(data2.summary, null, 2)}\n`);
    }
  } catch (error) {
    console.log(`   ❌ 오류: ${error.message}\n`);
  }

  // 3. 데이터베이스 직접 쿼리와 비교
  console.log('3. 데이터베이스와 API 비교:');
  console.log('   DB: 대구광역시 군위군에 2개 기관 확인됨');
  console.log('   API: 위 URL로 확인 필요');
  console.log('\n=== 검증 방법 ===');
  console.log('1. 브라우저에서 로그인');
  console.log('2. 개발자 도구 > Network 탭 열기');
  console.log('3. 통계 탭 방문하여 실제 API 호출 확인');
  console.log('4. Request URL과 Response 데이터 확인');
};

testMatchingStatusAPI();
