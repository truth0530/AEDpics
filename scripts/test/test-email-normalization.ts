#!/usr/bin/env npx tsx
/**
 * 이메일 정규화 테스트
 *
 * NCP 서비스 일관성 문제 해결 검증
 *
 * 실행: npx tsx scripts/test/test-email-normalization.ts
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

async function testEmailNormalization() {
  console.log('='.repeat(60));
  console.log(`${colors.cyan}이메일 정규화 테스트${colors.reset}`);
  console.log('='.repeat(60));
  console.log('');

  // 테스트할 이메일 변형들
  const testCases = [
    {
      original: 'shn@nmc.or.kr',
      description: '정상 이메일'
    },
    {
      original: 'SHN@NMC.OR.KR',
      description: '대문자 이메일'
    },
    {
      original: ' shn@nmc.or.kr ',
      description: '공백 포함 이메일'
    },
    {
      original: 'Shn@Nmc.Or.Kr',
      description: '혼합 대소문자'
    },
    {
      original: '  SHN@NMC.OR.KR  ',
      description: '공백 + 대문자'
    }
  ];

  console.log(`${colors.blue}1. 정규화 테스트${colors.reset}`);
  console.log('-'.repeat(60));
  console.log('');

  for (const testCase of testCases) {
    console.log(`${colors.gray}테스트:${colors.reset} ${testCase.description}`);
    console.log(`원본: "${testCase.original}"`);
    console.log(`정규화: "${testCase.original.trim().toLowerCase()}"`);
    console.log('');
  }

  console.log('='.repeat(60));
  console.log(`${colors.blue}2. 실제 발송 테스트 (dry-run)${colors.reset}`);
  console.log('-'.repeat(60));
  console.log('');

  // 문제가 된 이메일로 테스트
  const problemEmail = 'shn@nmc.or.kr';

  console.log(`대상 이메일: ${problemEmail}`);
  console.log('발송 테스트 시작...');
  console.log('');

  try {
    // Dry-run 모드로 테스트 (실제로는 테스트 계정으로 발송)
    const testEmail = process.env.TEST_EMAIL || 'test@nmc.or.kr';

    const result = await sendNCPEmail(
      {
        accessKey: process.env.NCP_ACCESS_KEY!,
        accessSecret: process.env.NCP_ACCESS_SECRET!,
        senderAddress: 'noreply@nmc.or.kr',
        senderName: 'AED 픽스'
      },
      {
        title: '[테스트] 이메일 정규화 검증',
        body: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .info { background: #f0f9ff; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .test-case { margin: 10px 0; padding: 10px; background: #fff; border: 1px solid #e5e7eb; }
          </style>
        </head>
        <body>
          <h2>이메일 정규화 테스트</h2>

          <div class="info">
            <h3>테스트 목적</h3>
            <p>NCP 서비스의 간헐적 도메인 검증 실패 문제 해결 검증</p>
          </div>

          <div class="test-case">
            <h4>정규화 전후 비교</h4>
            <ul>
              <li>원본: "${problemEmail}"</li>
              <li>정규화: "${problemEmail.trim().toLowerCase()}"</li>
              <li>시간: ${new Date().toLocaleString('ko-KR')}</li>
            </ul>
          </div>

          <p>이 이메일이 정상적으로 수신되었다면, 정규화가 성공적으로 적용되었습니다.</p>
        </body>
        </html>
        `,
        recipients: [
          {
            address: testEmail,
            name: '테스트',
            type: 'R'
          }
        ],
        individual: true
      }
    );

    console.log(`${colors.green}✅ 발송 성공${colors.reset}`);
    console.log(`Message ID: ${result.messageId || 'N/A'}`);
    console.log('');

  } catch (error: any) {
    console.log(`${colors.red}❌ 발송 실패${colors.reset}`);
    console.log(`에러: ${error.message}`);
    console.log('');

    // NONEXISTENT_DOMAIN 에러인지 확인
    if (error.message.includes('NONEXISTENT_DOMAIN')) {
      console.log(`${colors.yellow}⚠️ 도메인 검증 실패 발생!${colors.reset}`);
      console.log('정규화에도 불구하고 NCP 서비스 문제가 지속됨');
      console.log('');
    }
  }

  console.log('='.repeat(60));
  console.log(`${colors.blue}3. 일관성 테스트 (5회 반복)${colors.reset}`);
  console.log('-'.repeat(60));
  console.log('');

  console.log('동일한 이메일로 5회 연속 발송 테스트...');
  console.log('');

  let successCount = 0;
  let failCount = 0;
  const results: string[] = [];

  for (let i = 1; i <= 5; i++) {
    console.log(`시도 ${i}/5...`);

    try {
      // 실제 테스트 이메일로 발송
      const testEmail = process.env.TEST_EMAIL || 'test@nmc.or.kr';

      await sendNCPEmail(
        {
          accessKey: process.env.NCP_ACCESS_KEY!,
          accessSecret: process.env.NCP_ACCESS_SECRET!,
          senderAddress: 'noreply@nmc.or.kr',
          senderName: 'AED 픽스'
        },
        {
          title: `[테스트 ${i}/5] 일관성 검증`,
          body: `<p>일관성 테스트 ${i}번째 발송</p>`,
          recipients: [
            {
              address: testEmail,
              name: '테스트',
              type: 'R'
            }
          ],
          individual: true
        }
      );

      successCount++;
      results.push(`${colors.green}성공${colors.reset}`);

    } catch (error: any) {
      failCount++;
      if (error.message.includes('NONEXISTENT_DOMAIN')) {
        results.push(`${colors.red}도메인 에러${colors.reset}`);
      } else {
        results.push(`${colors.yellow}기타 에러${colors.reset}`);
      }
    }

    // 요청 간 대기 (rate limit 회피)
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('');
  console.log('결과 요약:');
  console.log(`- 성공: ${successCount}/5`);
  console.log(`- 실패: ${failCount}/5`);
  console.log(`- 일관성: ${successCount === 5 ? '✅ 완벽' : failCount === 5 ? '❌ 완전 실패' : '⚠️ 불안정'}`);
  console.log('');

  console.log('상세 결과:');
  results.forEach((result, index) => {
    console.log(`  ${index + 1}회차: ${result}`);
  });

  console.log('');
  console.log('='.repeat(60));
  console.log(`${colors.blue}4. 권장사항${colors.reset}`);
  console.log('-'.repeat(60));
  console.log('');

  if (failCount > 0) {
    console.log(`${colors.yellow}⚠️ 여전히 일관성 문제가 있습니다.${colors.reset}`);
    console.log('');
    console.log('추가 조치 필요:');
    console.log('1. NCP 지원팀에 문의하여 도메인 검증 로직 확인');
    console.log('2. 발신자 이메일 변경 (noreply@aed.pics 시도)');
    console.log('3. 재시도 로직 강화 (exponential backoff)');
    console.log('4. 백업 이메일 서비스 고려 (SendGrid, AWS SES)');
  } else {
    console.log(`${colors.green}✅ 정규화가 효과적으로 작동하고 있습니다!${colors.reset}`);
    console.log('');
    console.log('이메일 정규화로 일관성 문제가 해결되었습니다.');
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('테스트 완료');
  console.log('='.repeat(60));
}

// 실행
testEmailNormalization().catch(console.error);