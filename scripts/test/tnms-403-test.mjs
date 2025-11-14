#!/usr/bin/env node

/**
 * TNMS API 403 권한 테스트
 * 비관리자 사용자가 POST 엔드포인트 접근 시 403 반환 확인
 * Usage: node scripts/test/tnms-403-test.mjs
 */

import * as http from 'http';
import * as fs from 'fs';

const API_BASE = process.env.API_BASE || 'http://localhost:3000';
const TEST_RESULTS_FILE = '/tmp/tnms-403-test-results.json';

const results = [];

/**
 * 특정 쿠키를 포함한 요청 수행
 * (NextAuth 세션 시뮬레이션)
 */
async function makeRequestWithCookie(method, endpoint, body, authCookie) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, API_BASE);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookie || '',
      },
    };

    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode || 500,
          body: data,
          headers: res.headers
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

/**
 * 권한 제한 엔드포인트 테스트
 */
async function testForbidden(testName, method, endpoint, body) {
  try {
    console.log(`\n테스트: ${testName}`);
    console.log(`  ${method} ${endpoint}`);

    // 비관리자 세션 없이 요청 (401 Unauthorized 기대)
    const response = await makeRequestWithCookie(method, endpoint, body, null);

    // 인증 없으면 401 반환, 인증되었지만 비관리자면 403 반환
    const expectedStatus = 401;  // 먼저 인증 확인
    const actualStatus = response.status;
    const passed = actualStatus === expectedStatus;

    const result = {
      name: testName,
      endpoint,
      method,
      expectedStatus,
      actualStatus,
      passed,
      timestamp: new Date().toISOString(),
    };

    results.push(result);

    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`  상태: ${actualStatus} (기대값: ${expectedStatus}) ${status}`);

    if (!passed) {
      try {
        const json = JSON.parse(response.body);
        console.log(`  응답: ${JSON.stringify(json, null, 2)}`);
      } catch {
        console.log(`  응답: ${response.body.substring(0, 200)}`);
      }
    }

    return passed;
  } catch (error) {
    console.error(`  [에러] ${error.message}`);
    results.push({
      name: testName,
      endpoint,
      method,
      expectedStatus: 401,
      actualStatus: 0,
      passed: false,
      timestamp: new Date().toISOString(),
    });
    return false;
  }
}

/**
 * 관리자만 접근 가능한 엔드포인트 테스트
 */
async function testAdminOnly() {
  console.log('='.repeat(60));
  console.log('TNMS API 403 권한 테스트');
  console.log('='.repeat(60));
  console.log(`API Base: ${API_BASE}`);
  console.log(`테스트 시간: ${new Date().toISOString()}`);
  console.log('='.repeat(60));
  console.log('\n참고: 이 테스트는 인증 없는 상태에서 실행됩니다.');
  console.log('실제 403 테스트(비관리자 세션 with 403)는 로컬 dev 서버에서');
  console.log('실제 로그인으로 테스트해야 합니다.\n');

  let passCount = 0;
  let failCount = 0;

  // 401 상태 확인 (인증 필수)
  console.log('\n[Phase 1] 인증 없는 상태 - 401 Unauthorized 확인\n');

  // Test 1: POST /api/tnms/validate (관리자만)
  if (await testForbidden(
    'POST /api/tnms/validate - 인증 없음',
    'POST',
    '/api/tnms/validate',
    { log_id: '1', manual_review_status: 'approved' }
  )) {
    passCount++;
  } else {
    failCount++;
  }

  // Test 2: POST /api/tnms/metrics (관리자만)
  if (await testForbidden(
    'POST /api/tnms/metrics - 인증 없음',
    'POST',
    '/api/tnms/metrics',
    { metric_date: '2025-11-14' }
  )) {
    passCount++;
  } else {
    failCount++;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('테스트 요약');
  console.log('='.repeat(60));
  console.log(`총 테스트: ${results.length}`);
  console.log(`통과: ${passCount} ✅`);
  console.log(`실패: ${failCount} ❌`);
  console.log(`성공률: ${results.length > 0 ? ((passCount / results.length) * 100).toFixed(1) : 0}%`);
  console.log('='.repeat(60));

  // 추가 정보
  console.log('\n[중요] 실제 403 테스트 방법:\n');
  console.log('1. 개발 서버 시작:');
  console.log('   npm run dev\n');

  console.log('2. 다음 URL에서 비관리자 이메일로 로그인:');
  console.log('   http://localhost:3000/auth/signin\n');

  console.log('3. 로그인 후 POST 요청 테스트:');
  console.log('   curl -X POST http://localhost:3000/api/tnms/validate \\');
  console.log('     -H "Content-Type: application/json" \\');
  console.log('     -d \'{"log_id": "1", "manual_review_status": "approved"}\'\n');

  console.log('4. 예상 응답:');
  console.log('   HTTP 403 Forbidden');
  console.log('   {"error": "Forbidden", "message": "Only administrators can..."}\n');

  // Save results to file
  fs.writeFileSync(TEST_RESULTS_FILE, JSON.stringify(results, null, 2));
  console.log(`결과 저장: ${TEST_RESULTS_FILE}`);

  // Exit with appropriate code
  process.exit(failCount > 0 ? 1 : 0);
}

// Run tests if API is available
setTimeout(() => {
  makeRequestWithCookie('GET', '/api/health').then(
    () => {
      testAdminOnly();
    },
    () => {
      console.error('\n❌ 오류: API에 연결할 수 없습니다. ' + API_BASE);
      console.error('확인 사항:');
      console.error('  1. 개발 서버가 실행 중: npm run dev');
      console.error('  2. API_BASE 환경변수 확인\n');
      console.error('예시:');
      console.error('  API_BASE=http://localhost:3000 node scripts/test/tnms-403-test.mjs');
      process.exit(1);
    }
  );
}, 100);
