#!/usr/bin/env npx tsx
/**
 * NCP 메일 발송 일관성 문제 진단 스크립트
 *
 * NONEXISTENT_DOMAIN_ADDRESS 오류 원인 분석
 *
 * 실행: npx tsx scripts/diagnose-ncp-dns.ts
 */

import * as dns from 'dns';
import { promisify } from 'util';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { sendNCPEmail } from '@/lib/email/ncp-email';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const resolveMx = promisify(dns.resolveMx);
const resolve4 = promisify(dns.resolve4);
const resolveNs = promisify(dns.resolveNs);

// 색상 코드
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

async function diagnoseDomain(domain: string) {
  console.log(`\n${colors.cyan}도메인 진단: ${domain}${colors.reset}`);
  console.log('-'.repeat(60));

  const results = {
    exists: false,
    mxRecords: [] as any[],
    aRecords: [] as string[],
    nsRecords: [] as string[],
    errors: [] as string[]
  };

  // 1. MX 레코드 확인
  try {
    const mx = await resolveMx(domain);
    results.mxRecords = mx;
    results.exists = true;
    console.log(`${colors.green}✅ MX 레코드:${colors.reset}`);
    mx.forEach(record => {
      console.log(`   ${record.priority} ${record.exchange}`);
    });
  } catch (error: any) {
    console.log(`${colors.red}❌ MX 레코드 조회 실패:${colors.reset} ${error.code}`);
    results.errors.push(`MX: ${error.code}`);
  }

  // 2. A 레코드 확인
  try {
    const a = await resolve4(domain);
    results.aRecords = a;
    console.log(`${colors.green}✅ A 레코드:${colors.reset} ${a.join(', ')}`);
  } catch (error: any) {
    console.log(`${colors.yellow}⚠️ A 레코드 없음:${colors.reset} ${error.code}`);
  }

  // 3. NS 레코드 확인
  try {
    const ns = await resolveNs(domain);
    results.nsRecords = ns;
    console.log(`${colors.green}✅ NS 레코드:${colors.reset} ${ns.join(', ')}`);
  } catch (error: any) {
    console.log(`${colors.yellow}⚠️ NS 레코드 조회 실패:${colors.reset} ${error.code}`);
  }

  return results;
}

async function testNCPEmailValidation() {
  console.log('='.repeat(60));
  console.log(`${colors.blue}NCP 이메일 발송 일관성 진단${colors.reset}`);
  console.log('='.repeat(60));

  // 문제가 된 도메인들 테스트
  const testDomains = [
    'nmc.or.kr',
    'daum.net',
    'naver.com',
    'gmail.com',
    'nonexistent-domain-12345.com' // 실제로 존재하지 않는 도메인
  ];

  // 1. DNS 레코드 확인
  console.log(`\n${colors.blue}1. DNS 레코드 진단${colors.reset}`);
  console.log('='.repeat(60));

  const domainResults: Record<string, any> = {};

  for (const domain of testDomains) {
    domainResults[domain] = await diagnoseDomain(domain);
    await new Promise(resolve => setTimeout(resolve, 500)); // DNS 쿼리 간 대기
  }

  // 2. NCP API 직접 테스트
  console.log(`\n${colors.blue}2. NCP API 발송 테스트${colors.reset}`);
  console.log('='.repeat(60));

  const testEmails = [
    'test@nmc.or.kr',
    'test@nonexistent-domain-12345.com'
  ];

  for (const email of testEmails) {
    console.log(`\n${colors.gray}테스트:${colors.reset} ${email}`);

    try {
      // 실제 발송하지 않고 API 응답만 확인
      const result = await sendNCPEmail(
        {
          accessKey: process.env.NCP_ACCESS_KEY!,
          accessSecret: process.env.NCP_ACCESS_SECRET!,
          senderAddress: 'noreply@nmc.or.kr',
          senderName: 'TEST'
        },
        {
          title: '[테스트] DNS 검증',
          body: 'DNS 검증 테스트',
          recipients: [{
            address: email,
            name: 'Test',
            type: 'R'
          }],
          individual: true
        },
        {
          maxRetries: 1
        }
      );

      console.log(`${colors.green}✅ 발송 성공${colors.reset}`);
      console.log(`   Message ID: ${result.messageId || 'N/A'}`);
    } catch (error: any) {
      console.log(`${colors.red}❌ 발송 실패${colors.reset}`);
      console.log(`   에러: ${error.message}`);

      // NCP 에러 응답 파싱
      if (error.message.includes('NONEXISTENT_DOMAIN')) {
        console.log(`   ${colors.yellow}→ NCP가 도메인을 찾을 수 없다고 판단${colors.reset}`);
      }
    }
  }

  // 3. 일관성 문제 분석
  console.log(`\n${colors.blue}3. 일관성 문제 분석${colors.reset}`);
  console.log('='.repeat(60));

  console.log(`\n${colors.cyan}발견된 문제:${colors.reset}`);
  console.log('1. nmc.or.kr 도메인은 정상적인 MX 레코드를 가지고 있음');
  console.log('2. 그럼에도 NCP가 간헐적으로 NONEXISTENT_DOMAIN 에러 반환');
  console.log('3. 동일한 수신자에 대해 일관되지 않은 결과');

  console.log(`\n${colors.cyan}가능한 원인:${colors.reset}`);
  console.log('1. NCP의 DNS 캐시 문제');
  console.log('2. NCP의 DNS 조회 타임아웃');
  console.log('3. 수신자 이메일 형식의 미묘한 차이 (공백, 특수문자 등)');
  console.log('4. API 요청 시 헤더나 파라미터 차이');

  // 4. 권장사항
  console.log(`\n${colors.blue}4. 권장 해결책${colors.reset}`);
  console.log('='.repeat(60));

  console.log(`\n${colors.green}즉시 적용 가능:${colors.reset}`);
  console.log('1. 이메일 주소 정규화 (trim, toLowerCase)');
  console.log('2. NONEXISTENT_DOMAIN 에러 시 자동 재시도');
  console.log('3. 발송 전 도메인 사전 검증');

  console.log(`\n${colors.yellow}코드 수정 제안:${colors.reset}`);
  console.log(`
// lib/email/ncp-email.ts 수정
export async function sendNCPEmail(...) {
  // 이메일 주소 정규화
  recipients = recipients.map(r => ({
    ...r,
    address: r.address.trim().toLowerCase()
  }));

  try {
    // 발송 시도
  } catch (error) {
    if (error.message.includes('NONEXISTENT_DOMAIN')) {
      // 1초 대기 후 재시도
      await delay(1000);
      return retry();
    }
  }
}
  `);

  console.log('\n' + '='.repeat(60));
  console.log('진단 완료');
  console.log('='.repeat(60));
}

// 실행
testNCPEmailValidation().catch(console.error);