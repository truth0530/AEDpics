#!/usr/bin/env node
/**
 * Phase 1 이메일 테스트 자동화 스크립트
 *
 * 목적:
 * - 관리자 계정으로 로그인
 * - 승인/거부 API 호출
 * - 이메일 발송 결과 검증
 *
 * 사용법:
 * npx tsx scripts/qa/phase1-email-tests.ts --config scripts/qa/phase1-email-tests.config.json
 */

import * as fs from 'fs';
import * as path from 'path';

interface TestScenario {
  label: string;
  type: 'approve' | 'reject';
  request: Record<string, any>;
  expectedStatus?: number;
}

interface Config {
  baseUrl: string;
  admin: {
    email: string;
    password: string;
  };
  scenarios: TestScenario[];
}

interface TestResult {
  scenario: string;
  status: 'PASS' | 'FAIL';
  httpStatus?: number;
  message: string;
  timestamp: string;
}

let sessionCookie: string | null = null;
const results: TestResult[] = [];

async function loadConfig(configPath: string): Promise<Config> {
  if (!fs.existsSync(configPath)) {
    console.error(`설정 파일을 찾을 수 없습니다: ${configPath}`);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  return config;
}

async function login(baseUrl: string, email: string, password: string): Promise<boolean> {
  try {
    console.log('\n인증 중...');
    console.log(`- 이메일: ${email}`);

    const formData = new URLSearchParams();
    formData.append('email', email);
    formData.append('password', password);
    formData.append('callbackUrl', `${baseUrl}/admin/users`);

    const response = await fetch(`${baseUrl}/api/auth/signin/credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
      redirect: 'follow',
    });

    console.log(`- 응답 상태: ${response.status}`);

    // 쿠키 헤더들 추출
    const cookieHeaders = response.headers.getSetCookie?.() || [];

    // 세션 토큰 찾기
    let foundSessionToken = false;
    for (const cookieHeader of cookieHeaders) {
      if (cookieHeader.includes('next-auth.session-token')) {
        const sessionMatch = cookieHeader.match(/next-auth\.session-token=([^;]+)/);
        if (sessionMatch) {
          sessionCookie = `next-auth.session-token=${sessionMatch[1]}`;
          foundSessionToken = true;
          console.log('✅ 인증 성공 (세션 토큰 확보)');
          return true;
        }
      }
    }

    // 대체: 모든 쿠키를 수집하여 사용
    if (cookieHeaders.length > 0) {
      sessionCookie = cookieHeaders
        .map(c => c.split(';')[0])
        .join('; ');
      console.log('✅ 인증 성공 (NextAuth 쿠키 확보)');
      return true;
    }

    // 쿠키가 없으면 실패
    console.log('⚠️  인증 쿠키를 얻지 못했습니다');
    return false;
  } catch (error) {
    console.error(`❌ 인증 실패: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function executeApprovalTest(baseUrl: string, request: Record<string, any>): Promise<TestResult> {
  const timestamp = new Date().toISOString();

  try {
    const response = await fetch(`${baseUrl}/api/admin/users/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionCookie ? { 'Cookie': sessionCookie } : {}),
      },
      body: JSON.stringify(request),
    });

    const body = await response.text();

    if (response.status === 200) {
      return {
        scenario: `승인 - ${request.organizationName || '미지정'}`,
        status: 'PASS',
        httpStatus: response.status,
        message: '이메일 발송 대기 중',
        timestamp,
      };
    } else {
      return {
        scenario: `승인 - ${request.organizationName || '미지정'}`,
        status: 'FAIL',
        httpStatus: response.status,
        message: `HTTP ${response.status}: ${body.substring(0, 100)}`,
        timestamp,
      };
    }
  } catch (error) {
    return {
      scenario: `승인 - ${request.organizationName || '미지정'}`,
      status: 'FAIL',
      message: `네트워크 오류: ${error instanceof Error ? error.message : String(error)}`,
      timestamp,
    };
  }
}

async function executeRejectionTest(baseUrl: string, request: Record<string, any>): Promise<TestResult> {
  const timestamp = new Date().toISOString();

  try {
    const response = await fetch(`${baseUrl}/api/admin/users/approve`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionCookie ? { 'Cookie': sessionCookie } : {}),
      },
      body: JSON.stringify(request),
    });

    const body = await response.text();

    if (response.status === 200) {
      return {
        scenario: `거부`,
        status: 'PASS',
        httpStatus: response.status,
        message: '거부 이메일 발송 대기 중',
        timestamp,
      };
    } else {
      return {
        scenario: `거부`,
        status: 'FAIL',
        httpStatus: response.status,
        message: `HTTP ${response.status}: ${body.substring(0, 100)}`,
        timestamp,
      };
    }
  } catch (error) {
    return {
      scenario: `거부`,
      status: 'FAIL',
      message: `네트워크 오류: ${error instanceof Error ? error.message : String(error)}`,
      timestamp,
    };
  }
}

async function main() {
  const configPath = process.argv.includes('--config')
    ? process.argv[process.argv.indexOf('--config') + 1]
    : 'scripts/qa/phase1-email-tests.config.json';

  console.log('='.repeat(60));
  console.log('Phase 1 이메일 테스트 자동화');
  console.log('='.repeat(60));
  console.log(`설정 파일: ${configPath}`);

  const config = await loadConfig(configPath);

  console.log(`Base URL: ${config.baseUrl}`);
  console.log(`시나리오 수: ${config.scenarios.length}`);

  // 1. 로그인
  const loginSuccess = await login(config.baseUrl, config.admin.email, config.admin.password);
  if (!loginSuccess) {
    console.error('\n인증 실패로 테스트를 중단합니다.');
    process.exit(1);
  }

  console.log('\n테스트 실행 중...\n');

  // 2. 시나리오 실행
  for (const scenario of config.scenarios) {
    process.stdout.write(`[ ${scenario.label} ] `);

    let result: TestResult;
    if (scenario.type === 'approve') {
      result = await executeApprovalTest(config.baseUrl, scenario.request);
    } else {
      result = await executeRejectionTest(config.baseUrl, scenario.request);
    }

    results.push(result);

    if (result.status === 'PASS') {
      console.log(`✅ PASS (HTTP ${result.httpStatus})`);
    } else {
      console.log(`❌ FAIL - ${result.message}`);
    }

    // 요청 사이에 짧은 지연
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // 3. 결과 요약
  console.log('\n' + '='.repeat(60));
  console.log('실행 결과 요약');
  console.log('='.repeat(60));

  const passCount = results.filter((r) => r.status === 'PASS').length;
  const failCount = results.filter((r) => r.status === 'FAIL').length;

  for (const result of results) {
    const icon = result.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} ${result.scenario}: ${result.message}`);
  }

  console.log('\n' + '-'.repeat(60));
  console.log(`전체: ${results.length}, 통과: ${passCount}, 실패: ${failCount}`);
  console.log('-'.repeat(60));

  // 4. 다음 단계 안내
  if (passCount === results.length) {
    console.log('\n✅ 모든 테스트 통과!');
    console.log('\n다음 단계:');
    console.log('1. 이메일 수신 확인 (5분 대기)');
    console.log('2. PM2 로그 확인: pm2 logs aedpics --err --lines 20');
    console.log('3. 발신자 주소 확인 (noreply@nmc.or.kr 또는 noreply@aed.pics)');
    console.log('4. Phase 2 NCP 콘솔 검증 진행');
    process.exit(0);
  } else {
    console.log('\n❌ 일부 테스트 실패');
    console.log('\n문제 해결:');
    console.log('1. 설정 파일의 userId, organizationId 확인');
    console.log('2. PM2 로그 확인: pm2 logs aedpics --err');
    console.log('3. NCP 환경변수 확인: cat .env.production | grep NCP');
    console.log('4. 실패한 요청의 응답 본문 확인');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('스크립트 실행 중 오류:', error);
  process.exit(1);
});
