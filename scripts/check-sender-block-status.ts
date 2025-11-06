#!/usr/bin/env npx tsx
/**
 * 발송자 주소 차단 상태 확인
 *
 * NCP에서 noreply@aed.pics가 차단되었는지 확인
 *
 * 실행: npx tsx scripts/check-sender-block-status.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { sendNCPEmail } from '@/lib/email/ncp-email';

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

async function checkSenderStatus() {
  console.log('='.repeat(60));
  console.log(`${colors.cyan}발송자 주소 차단 상태 확인${colors.reset}`);
  console.log('='.repeat(60));
  console.log('');

  const senders = [
    'noreply@aed.pics',
    'noreply@nmc.or.kr'
  ];

  const testEmail = process.env.TEST_EMAIL || 'test@nmc.or.kr';

  for (const sender of senders) {
    console.log(`${colors.blue}테스트 발송자: ${sender}${colors.reset}`);
    console.log('-'.repeat(60));

    try {
      const result = await sendNCPEmail(
        {
          accessKey: process.env.NCP_ACCESS_KEY!,
          accessSecret: process.env.NCP_ACCESS_SECRET!,
          senderAddress: sender,
          senderName: 'AED 픽스'
        },
        {
          title: '[테스트] 발송자 차단 상태 확인',
          body: `<p>발송자 ${sender} 테스트</p>`,
          recipients: [{
            address: testEmail,
            name: '테스트',
            type: 'R'
          }],
          individual: true
        },
        {
          maxRetries: 1
        }
      );

      console.log(`${colors.green}✅ 발송 성공${colors.reset}`);
      console.log(`   Message ID: ${result.messageId}`);
      console.log(`   상태: 정상`);

    } catch (error: any) {
      console.log(`${colors.red}❌ 발송 실패${colors.reset}`);
      console.log(`   에러: ${error.message}`);

      if (error.message.includes('SEND_BLOCK_ADDRESS')) {
        console.log(`${colors.yellow}⚠️ 발송자 주소가 NCP에서 차단되어 있습니다!${colors.reset}`);
        console.log('');
        console.log('해결 방법:');
        console.log('1. NCP 콘솔 접속');
        console.log('2. Cloud Outbound Mailer > Send block list 메뉴');
        console.log(`3. ${sender} 검색`);
        console.log('4. 차단 해제');
      } else if (error.message.includes('UNAUTHORIZED_SENDER')) {
        console.log(`${colors.yellow}⚠️ 인증되지 않은 발송자입니다!${colors.reset}`);
        console.log('');
        console.log('해결 방법:');
        console.log('1. NCP 콘솔에서 발송자 인증 필요');
        console.log('2. SPF/DKIM 설정 확인');
      }
    }

    console.log('');
  }

  console.log('='.repeat(60));
  console.log(`${colors.red}⚠️  중요 오해 바로잡기${colors.reset}`);
  console.log('='.repeat(60));
  console.log('');

  console.log(`${colors.yellow}youth991230@nmc.or.kr 사건 분석:${colors.reset}`);
  console.log('━'.repeat(60));
  console.log('');
  console.log('📧 NCP Console 화면 해석:');
  console.log(`  ${colors.gray}수신자:${colors.reset} youth991230@nmc.or.kr ${colors.green}← 이메일 받을 사람 (피해자)${colors.reset}`);
  console.log(`  ${colors.gray}에러:${colors.reset} SEND_BLOCK_ADDRESS ${colors.red}← 발송자가 차단됨${colors.reset}`);
  console.log('');
  console.log('✅ 실제 상황:');
  console.log(`  1. 시도: ${colors.cyan}noreply@aed.pics${colors.reset} → youth991230@nmc.or.kr`);
  console.log(`  2. 문제: ${colors.red}noreply@aed.pics가 NCP에서 차단됨${colors.reset}`);
  console.log(`  3. 결과: youth991230님이 이메일을 ${colors.yellow}못 받음${colors.reset}`);
  console.log('');
  console.log(`${colors.green}✨ 핵심: youth991230@nmc.or.kr님은 아무 잘못이 없습니다!${colors.reset}`);
  console.log(`         이분은 이메일을 받지 못한 ${colors.cyan}피해자${colors.reset}입니다.`);
  console.log('');

  console.log('━'.repeat(60));
  console.log(`${colors.blue}NCP 에러 코드 해석 가이드${colors.reset}`);
  console.log('━'.repeat(60));
  console.log('');
  console.log('SEND_BLOCK_ADDRESS:');
  console.log(`  → 의미: ${colors.red}발송자 주소${colors.reset}가 차단됨`);
  console.log(`  → 차단된 주소: ${colors.red}noreply@aed.pics${colors.reset} (발송자)`);
  console.log(`  → 피해자: youth991230@nmc.or.kr (수신자)`);
  console.log('');
  console.log('RECIPIENT_BLOCK_ADDRESS:');
  console.log(`  → 의미: ${colors.yellow}수신자 주소${colors.reset}가 차단됨`);
  console.log(`  → 이 경우가 아님!`);
  console.log('');

  console.log('='.repeat(60));
  console.log(`${colors.cyan}🔧 즉시 해결 방법${colors.reset}`);
  console.log('='.repeat(60));
  console.log('');

  console.log('1단계: NCP Console 접속');
  console.log('  → https://console.ncloud.com');
  console.log('  → Cloud Outbound Mailer > Send block list');
  console.log('');

  console.log('2단계: 차단된 발송자 검색');
  console.log(`  → 검색어: ${colors.red}noreply@aed.pics${colors.reset}`);
  console.log('  → youth991230@nmc.or.kr 검색하지 마세요! (수신자임)');
  console.log('');

  console.log('3단계: 차단 해제');
  console.log('  → noreply@aed.pics 항목 찾기');
  console.log('  → "차단 해제" 버튼 클릭');
  console.log('  → 사유: "시스템 발송 계정"');
  console.log('');

  console.log(`${colors.green}📝 추가 문서${colors.reset}`);
  console.log('자세한 설명: docs/troubleshooting/NCP_CONSOLE_DISPLAY_CLARIFICATION.md');
  console.log('');
}

// 실행
checkSenderStatus().catch(console.error);