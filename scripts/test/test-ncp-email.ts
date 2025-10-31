/**
 * NCP Cloud Outbound Mailer 테스트 스크립트
 *
 * 실행 방법:
 * npx tsx scripts/test/test-ncp-email.ts
 */

import { sendSimpleEmail } from '@/lib/email/ncp-email';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testEmailSending() {
  console.log('='.repeat(60));
  console.log('NCP Cloud Outbound Mailer 테스트');
  console.log('='.repeat(60));
  console.log('');

  // 1. 환경변수 확인
  console.log('1. 환경변수 확인:');
  console.log('-'.repeat(60));

  const accessKey = process.env.NCP_ACCESS_KEY;
  const accessSecret = process.env.NCP_ACCESS_SECRET;
  const senderEmail = process.env.NCP_SENDER_EMAIL;

  if (!accessKey) {
    console.error('❌ NCP_ACCESS_KEY가 설정되지 않았습니다.');
    console.log('   .env.local 파일에 다음을 추가하세요:');
    console.log('   NCP_ACCESS_KEY="your_access_key_here"');
    return;
  }

  if (!accessSecret) {
    console.error('❌ NCP_ACCESS_SECRET이 설정되지 않았습니다.');
    console.log('   .env.local 파일에 다음을 추가하세요:');
    console.log('   NCP_ACCESS_SECRET="your_access_secret_here"');
    return;
  }

  if (!senderEmail) {
    console.error('❌ NCP_SENDER_EMAIL이 설정되지 않았습니다.');
    console.log('   .env.local 파일에 다음을 추가하세요:');
    console.log('   NCP_SENDER_EMAIL="noreply@nmc.or.kr"');
    return;
  }

  console.log(`✅ NCP_ACCESS_KEY: ${accessKey.substring(0, 8)}...`);
  console.log(`✅ NCP_ACCESS_SECRET: ${accessSecret.substring(0, 8)}...`);
  console.log(`✅ NCP_SENDER_EMAIL: ${senderEmail}`);
  console.log('');

  // 2. 테스트 이메일 발송
  console.log('2. 테스트 이메일 발송:');
  console.log('-'.repeat(60));

  const testRecipient = process.argv[2] || senderEmail;

  console.log(`발신자: ${senderEmail}`);
  console.log(`수신자: ${testRecipient}`);
  console.log('');
  console.log('이메일 발송 중...');

  try {
    const result = await sendSimpleEmail(
      {
        accessKey,
        accessSecret,
        senderAddress: senderEmail,
        senderName: 'AED 픽스'
      },
      testRecipient,
      '테스트 수신자',
      '[테스트] NCP 이메일 발송 테스트',
      `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>NCP 이메일 발송 테스트</title>
        </head>
        <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px;">
            <h1 style="color: #22c55e;">✅ NCP 이메일 발송 테스트 성공!</h1>
            <p>이 이메일을 받으셨다면 NCP Cloud Outbound Mailer가 정상적으로 작동하고 있습니다.</p>

            <h2>테스트 정보</h2>
            <ul>
              <li><strong>발신자:</strong> ${senderEmail}</li>
              <li><strong>수신자:</strong> ${testRecipient}</li>
              <li><strong>시간:</strong> ${new Date().toLocaleString('ko-KR')}</li>
            </ul>

            <h2>다음 단계</h2>
            <p>OTP 이메일 발송이 실패하는 경우:</p>
            <ol>
              <li>NCP 콘솔에서 발신자 이메일(${senderEmail}) 인증 상태 확인</li>
              <li>API 키 권한 확인 (Cloud Outbound Mailer 사용 권한)</li>
              <li>발신 한도 초과 여부 확인</li>
              <li>스팸 필터 차단 여부 확인</li>
            </ol>

            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e5e5;">
            <p style="color: #666; font-size: 12px;">
              © 2025 AED 픽스 aed.pics · 테스트 이메일
            </p>
          </div>
        </body>
        </html>
      `,
      {
        maxRetries: 3,
        initialDelay: 1000,
        exponentialBase: 2
      }
    );

    console.log('');
    console.log('✅ 이메일 발송 성공!');
    console.log('');
    console.log('응답:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');
    console.log('='.repeat(60));
    console.log('✅ 모든 테스트 통과!');
    console.log('='.repeat(60));
    console.log('');
    console.log(`${testRecipient} 계정의 받은편지함을 확인하세요.`);

  } catch (error) {
    console.log('');
    console.error('❌ 이메일 발송 실패!');
    console.log('');
    console.error('오류 상세:');
    console.error(error);
    console.log('');
    console.log('='.repeat(60));
    console.log('❌ 테스트 실패');
    console.log('='.repeat(60));
    console.log('');
    console.log('문제 해결 방법:');
    console.log('');
    console.log('1. NCP 콘솔 접속: https://console.ncloud.com/');
    console.log('2. Services > Application Services > Cloud Outbound Mailer');
    console.log('3. 발신자 이메일 관리에서 다음 확인:');
    console.log(`   - ${senderEmail} 이 등록되어 있는지`);
    console.log(`   - 인증 상태가 "인증 완료"인지`);
    console.log(`   - 차단 상태가 아닌지`);
    console.log('');
    console.log('4. 마이페이지 > 인증키 관리에서:');
    console.log('   - Access Key가 활성화되어 있는지');
    console.log('   - Cloud Outbound Mailer 권한이 있는지');
    console.log('');
    console.log('5. 서비스 > Cloud Outbound Mailer > 통계에서:');
    console.log('   - 월 발송 한도 확인 (기본 1,000,000건)');
    console.log('   - 일일 발송 현황 확인');
    console.log('');

    process.exit(1);
  }
}

// 실행
testEmailSending();
