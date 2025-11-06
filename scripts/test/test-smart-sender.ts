#!/usr/bin/env npx tsx
/**
 * 스마트 발신자 선택 테스트
 *
 * 실행:
 * npx tsx scripts/test/test-smart-sender.ts
 * npx tsx scripts/test/test-smart-sender.ts truth530@daum.net
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { selectSmartSender, getSenderStatistics } from '@/lib/email/smart-sender-selector-simplified';
import { sendEnhancedEmail } from '@/lib/email/enhanced-ncp-email';

// Load environment variables
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

async function testSmartSender() {
  console.log('='.repeat(60));
  console.log(`${colors.cyan}스마트 발신자 선택 시스템 테스트${colors.reset}`);
  console.log('='.repeat(60));
  console.log('');

  // 테스트할 이메일 목록
  const testEmails = [
    'test@naver.com',
    'test@daum.net',
    'test@gmail.com',
    'test@nmc.or.kr',
    'test@korea.kr',
    'test@unknown-domain.com'
  ];

  // 명령행 인자로 전달된 이메일 추가
  const customEmail = process.argv[2];
  if (customEmail) {
    testEmails.unshift(customEmail);
  }

  console.log(`${colors.blue}1. 도메인별 최적 발신자 선택${colors.reset}`);
  console.log('-'.repeat(60));
  console.log('');

  for (const email of testEmails) {
    const sender = await selectSmartSender(email);
    const domain = email.split('@')[1];

    console.log(`${colors.gray}수신자:${colors.reset} ${email}`);
    console.log(`${colors.gray}도메인:${colors.reset} ${domain}`);
    console.log(`${colors.green}선택된 발신자:${colors.reset} ${sender}`);
    console.log('');
  }

  console.log('='.repeat(60));
  console.log(`${colors.blue}2. 발신자별 통계 (최근 24시간)${colors.reset}`);
  console.log('-'.repeat(60));
  console.log('');

  const stats = await getSenderStatistics(24);

  if (Object.keys(stats).length === 0) {
    console.log(`${colors.gray}아직 발송 이력이 없습니다.${colors.reset}`);
  } else {
    for (const [sender, data] of Object.entries(stats)) {
      console.log(`${colors.cyan}${sender}${colors.reset}`);
      console.log(`  총 발송: ${data.total}건`);
      console.log(`  성공: ${data.sent || 0}건`);
      console.log(`  실패: ${data.failed || 0}건`);
      console.log(`  차단: ${data.blocked || 0}건`);

      const rate = parseFloat(data.successRate);
      const color = rate >= 80 ? colors.green : rate >= 50 ? colors.yellow : colors.red;
      console.log(`  성공률: ${color}${data.successRate}${colors.reset}`);
      console.log('');
    }
  }

  // 실제 발송 테스트
  if (customEmail) {
    console.log('='.repeat(60));
    console.log(`${colors.blue}3. 실제 이메일 발송 테스트${colors.reset}`);
    console.log('-'.repeat(60));
    console.log('');

    console.log(`수신자: ${customEmail}`);
    console.log('발송 중...');
    console.log('');

    try {
      const result = await sendEnhancedEmail(
        customEmail,
        '테스트 수신자',
        '[테스트] 스마트 발신자 선택 시스템',
        `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; }
            .header { color: #22c55e; font-size: 24px; margin-bottom: 20px; }
            .info { background: #f0f9ff; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .sender { color: #3b82f6; font-weight: bold; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">✅ 스마트 발신자 선택 시스템 테스트</div>

            <p>이 이메일은 스마트 발신자 선택 시스템을 통해 발송되었습니다.</p>

            <div class="info">
              <h3>발송 정보</h3>
              <ul>
                <li>수신자: ${customEmail}</li>
                <li>시간: ${new Date().toLocaleString('ko-KR')}</li>
                <li>시스템: 스마트 발신자 선택 v1.0</li>
              </ul>
            </div>

            <p>이 이메일이 정상적으로 수신되었다면, 해당 도메인에 최적화된 발신자가 선택되었음을 의미합니다.</p>

            <div class="footer">
              © 2025 AED 픽스 aed.pics · 테스트 이메일
            </div>
          </div>
        </body>
        </html>
        `,
        {
          maxSenderRetries: 2
        }
      );

      if (result.success) {
        console.log(`${colors.green}✅ 발송 성공!${colors.reset}`);
        console.log(`사용된 발신자: ${result.sender}`);
        console.log(`시도 횟수: ${result.attempts}`);
      } else {
        console.log(`${colors.red}❌ 발송 실패${colors.reset}`);
        console.log(`에러: ${result.error}`);
        console.log(`시도 횟수: ${result.attempts}`);
      }
    } catch (error) {
      console.log(`${colors.red}❌ 예외 발생${colors.reset}`);
      console.error(error);
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log(`${colors.blue}4. 도메인별 차단 패턴 (알려진 정보)${colors.reset}`);
  console.log('-'.repeat(60));
  console.log('');

  const knownPatterns = [
    {
      domain: 'naver.com',
      blocked: ['noreply@aed.pics'],
      working: ['noreply@nmc.or.kr'],
      status: '확인됨'
    },
    {
      domain: 'daum.net',
      blocked: ['noreply@nmc.or.kr'],
      working: ['noreply@aed.pics (추정)'],
      status: '554 5.7.1 스팸 차단'
    },
    {
      domain: 'nmc.or.kr',
      blocked: ['noreply@nmc.or.kr'],
      working: ['noreply@aed.pics'],
      status: '같은 도메인 문제'
    }
  ];

  for (const pattern of knownPatterns) {
    console.log(`${colors.cyan}${pattern.domain}${colors.reset}`);
    console.log(`  ${colors.red}차단됨:${colors.reset} ${pattern.blocked.join(', ')}`);
    console.log(`  ${colors.green}작동함:${colors.reset} ${pattern.working.join(', ')}`);
    console.log(`  ${colors.gray}상태: ${pattern.status}${colors.reset}`);
    console.log('');
  }

  console.log('='.repeat(60));
  console.log(`${colors.green}테스트 완료${colors.reset}`);
  console.log('='.repeat(60));

  // DB 연결 종료
  if (global.prisma) {
    await global.prisma.$disconnect();
  }
}

// 실행
testSmartSender().catch(console.error);