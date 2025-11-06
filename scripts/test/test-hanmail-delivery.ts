#!/usr/bin/env npx tsx
/**
 * 한메일(Daum) 이메일 발송 테스트
 *
 * db9312@hanmail.net 발송 실패 문제 해결
 *
 * 실행: npx tsx scripts/test/test-hanmail-delivery.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { sendNCPEmail } from '@/lib/email/ncp-email';
import { sendEnhancedEmail } from '@/lib/email/enhanced-ncp-email';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

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

async function testHanmailDelivery() {
  console.log('='.repeat(60));
  console.log(`${colors.cyan}한메일 발송 테스트${colors.reset}`);
  console.log('='.repeat(60));
  console.log('');

  const testEmail = 'db9312@hanmail.net';

  console.log(`${colors.blue}1. 현재 발신자로 테스트${colors.reset}`);
  console.log('-'.repeat(60));
  console.log('');

  // 1. noreply@nmc.or.kr로 시도 (실패 예상)
  console.log('발신자: noreply@nmc.or.kr');
  console.log(`수신자: ${testEmail}`);
  console.log('');

  try {
    const result1 = await sendNCPEmail(
      {
        accessKey: process.env.NCP_ACCESS_KEY!,
        accessSecret: process.env.NCP_ACCESS_SECRET!,
        senderAddress: 'noreply@nmc.or.kr',
        senderName: 'AED 픽스'
      },
      {
        title: '[테스트] 한메일 발송 테스트 - nmc.or.kr',
        body: '<p>noreply@nmc.or.kr 발신자 테스트</p>',
        recipients: [{
          address: testEmail,
          name: '사용자',
          type: 'R'
        }],
        individual: true
      },
      {
        maxRetries: 1
      }
    );

    console.log(`${colors.green}✅ 발송 성공${colors.reset}`);
    console.log(`Message ID: ${result1.messageId}`);
  } catch (error: any) {
    console.log(`${colors.red}❌ 발송 실패 (예상됨)${colors.reset}`);
    console.log(`에러: ${error.message}`);

    if (error.message.includes('554 5.7.1')) {
      console.log(`${colors.yellow}→ 한메일 스팸 필터에 차단됨${colors.reset}`);
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log(`${colors.blue}2. 다른 발신자로 테스트${colors.reset}`);
  console.log('-'.repeat(60));
  console.log('');

  // 2. noreply@aed.pics로 시도
  console.log('발신자: noreply@aed.pics');
  console.log(`수신자: ${testEmail}`);
  console.log('');

  try {
    const result2 = await sendNCPEmail(
      {
        accessKey: process.env.NCP_ACCESS_KEY!,
        accessSecret: process.env.NCP_ACCESS_SECRET!,
        senderAddress: 'noreply@aed.pics',
        senderName: 'AED 픽스'
      },
      {
        title: '[테스트] 한메일 발송 테스트 - aed.pics',
        body: '<p>noreply@aed.pics 발신자 테스트</p>',
        recipients: [{
          address: testEmail,
          name: '사용자',
          type: 'R'
        }],
        individual: true
      },
      {
        maxRetries: 1
      }
    );

    console.log(`${colors.green}✅ 발송 성공!${colors.reset}`);
    console.log(`Message ID: ${result2.messageId}`);
    console.log('');
    console.log(`${colors.cyan}→ noreply@aed.pics는 한메일에 차단되지 않음!${colors.reset}`);
  } catch (error: any) {
    console.log(`${colors.red}❌ 발송 실패${colors.reset}`);
    console.log(`에러: ${error.message}`);
  }

  console.log('');
  console.log('='.repeat(60));
  console.log(`${colors.blue}3. 스마트 발신자 선택으로 테스트${colors.reset}`);
  console.log('-'.repeat(60));
  console.log('');

  // 3. 향상된 이메일 시스템 사용 (자동 발신자 선택)
  console.log('스마트 발신자 선택 시스템 사용');
  console.log(`수신자: ${testEmail}`);
  console.log('');

  try {
    const result3 = await sendEnhancedEmail(
      testEmail,
      '사용자',
      '[테스트] 스마트 발신자 선택',
      '<p>스마트 발신자 선택 시스템이 최적의 발신자를 선택했습니다.</p>',
      {
        maxSenderRetries: 2
      }
    );

    if (result3.success) {
      console.log(`${colors.green}✅ 발송 성공!${colors.reset}`);
      console.log(`사용된 발신자: ${result3.sender}`);
      console.log(`시도 횟수: ${result3.attempts}`);
    } else {
      console.log(`${colors.red}❌ 발송 실패${colors.reset}`);
      console.log(`에러: ${result3.error}`);
    }
  } catch (error: any) {
    console.log(`${colors.red}❌ 예외 발생${colors.reset}`);
    console.log(error);
  }

  console.log('');
  console.log('='.repeat(60));
  console.log(`${colors.blue}해결 방안${colors.reset}`);
  console.log('='.repeat(60));
  console.log('');

  console.log(`${colors.yellow}한메일/다음 메일 차단 해결책:${colors.reset}`);
  console.log('');
  console.log('1. 즉시 적용 가능:');
  console.log('   - app/api/auth/send-otp/route.ts에서 sendEnhancedEmail 사용');
  console.log('   - 한메일 도메인은 자동으로 noreply@aed.pics 사용');
  console.log('');
  console.log('2. 수동 설정:');
  console.log('   - hanmail.net, daum.net은 noreply@aed.pics 발신자 사용');
  console.log('   - 환경변수에서 직접 변경 가능');
  console.log('');
  console.log('3. 장기 해결:');
  console.log('   - SPF 레코드에 NCP IP 추가 요청');
  console.log('   - DKIM 설정으로 신뢰도 향상');
  console.log('');

  console.log(`${colors.cyan}현재 설정된 매핑:${colors.reset}`);
  console.log('hanmail.net → noreply@aed.pics (우선)');
  console.log('daum.net → noreply@aed.pics (우선)');
  console.log('naver.com → noreply@nmc.or.kr (우선)');
  console.log('nmc.or.kr → noreply@aed.pics (우선)');
}

// 실행
testHanmailDelivery().catch(console.error);