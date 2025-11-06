#!/usr/bin/env npx tsx
/**
 * 이메일 수정사항 테스트
 *
 * 실행: npx tsx scripts/test-email-fix.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { selectSmartSender } from '@/lib/email/smart-sender-selector-simplified';
import { sendSimpleEmail } from '@/lib/email/ncp-email';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

async function testEmailFix() {
  console.log('='.repeat(60));
  console.log(`${colors.cyan}이메일 수정사항 테스트${colors.reset}`);
  console.log('='.repeat(60));
  console.log('');

  // 1. 스마트 선택기 테스트
  console.log(`${colors.blue}1. 스마트 발신자 선택기 테스트${colors.reset}`);
  console.log('-'.repeat(60));

  const testCases = [
    'ymy0810@nmc.or.kr',
    'youth991230@nmc.or.kr',
    'truth530@daum.net',
    'test@naver.com'
  ];

  for (const email of testCases) {
    const sender = await selectSmartSender(email);
    const isCorrect =
      (email.endsWith('@nmc.or.kr') && sender === 'noreply@nmc.or.kr') ||
      (email.endsWith('@daum.net') && sender === 'noreply@aed.pics') ||
      (email.endsWith('@naver.com') && sender === 'noreply@nmc.or.kr');

    console.log(`${email}: ${sender} ${isCorrect ? colors.green + '✅' : colors.red + '❌'}${colors.reset}`);
  }
  console.log('');

  // 2. 실제 발송 테스트 (선택적)
  const testEmail = process.argv[2];

  if (testEmail) {
    console.log(`${colors.blue}2. 실제 발송 테스트${colors.reset}`);
    console.log('-'.repeat(60));
    console.log(`대상: ${testEmail}`);

    try {
      const selectedSender = await selectSmartSender(testEmail);
      console.log(`선택된 발신자: ${colors.cyan}${selectedSender}${colors.reset}`);

      // 실제 이름 조회 시뮬레이션
      const recipientName = testEmail.split('@')[0];
      console.log(`수신자 이름: ${colors.cyan}${recipientName}${colors.reset} (이메일에서 추출)`);

      // 발송 테스트
      await sendSimpleEmail(
        {
          accessKey: process.env.NCP_ACCESS_KEY!,
          accessSecret: process.env.NCP_ACCESS_SECRET!,
          senderAddress: selectedSender,
          senderName: 'AED 픽스'
        },
        testEmail,
        recipientName,  // 실제 이름 사용
        '[테스트] 이메일 시스템 수정 확인',
        `
        <h2>이메일 시스템 수정 테스트</h2>
        <p>이 이메일이 정상적으로 수신되었다면 다음이 해결되었습니다:</p>
        <ul>
          <li>✅ nmc.or.kr 도메인 발송자 우선순위 수정</li>
          <li>✅ 수신자 이름 동적 설정</li>
          <li>✅ NCP 차단 문제 해결</li>
        </ul>
        <hr>
        <p style="color: #666; font-size: 12px;">
          발송자: ${selectedSender}<br>
          수신자: ${recipientName} (${testEmail})<br>
          시간: ${new Date().toLocaleString('ko-KR')}
        </p>
        `,
        { maxRetries: 1 }
      );

      console.log(`${colors.green}✅ 발송 성공!${colors.reset}`);
    } catch (error: any) {
      console.log(`${colors.red}❌ 발송 실패: ${error.message}${colors.reset}`);

      if (error.message.includes('SEND_BLOCK_ADDRESS')) {
        console.log(`${colors.yellow}⚠️ 아직 발송자가 차단되어 있습니다.${colors.reset}`);
        console.log('NCP Console에서 차단 해제 필요');
      }
    }
  } else {
    console.log('');
    console.log('실제 발송 테스트를 원하시면:');
    console.log(`${colors.gray}npx tsx scripts/test-email-fix.ts ymy0810@nmc.or.kr${colors.reset}`);
  }

  console.log('');
  console.log('='.repeat(60));
  console.log(`${colors.blue}3. 수정 사항 요약${colors.reset}`);
  console.log('='.repeat(60));
  console.log('');

  console.log('✅ 수정 완료:');
  console.log('1. smart-sender-selector-simplified.ts');
  console.log('   - nmc.or.kr 우선순위: noreply@nmc.or.kr');
  console.log('');
  console.log('2. notify-new-signup/route.ts');
  console.log('   - 수신자 이름 동적 설정');
  console.log('   - ministry_admin 제외');
  console.log('');

  console.log('📌 다음 단계:');
  console.log('1. 코드 배포');
  console.log('2. NCP Console에서 noreply@aed.pics 차단 해제 (한 번만)');
  console.log('3. 모니터링 - 더 이상 차단되지 않음');
  console.log('');
}

// 실행
testEmailFix().catch(console.error);