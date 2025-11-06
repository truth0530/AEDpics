#!/usr/bin/env npx tsx
/**
 * NCP 이메일 차단 목록 조회 스크립트
 *
 * 실행 방법:
 * npx tsx scripts/check-email-block-list.ts
 * npx tsx scripts/check-email-block-list.ts truth530@daum.net
 *
 * 주의: NCP API에 Block List 조회 엔드포인트가 공식 문서에 없음
 * 현재는 콘솔에서 수동 확인 필요
 */

import { prisma } from '@/lib/prisma';
import * as dotenv from 'dotenv';
import * as path from 'path';
import crypto from 'crypto';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

/**
 * HMAC SHA256 서명 생성
 */
function makeSignature(
  accessKey: string,
  accessSecret: string,
  timestamp: string,
  method: string,
  uri: string
): string {
  const message = `${method} ${uri}\n${timestamp}\n${accessKey}`;
  const hmac = crypto.createHmac('sha256', accessSecret);
  hmac.update(message);
  return hmac.digest('base64');
}

/**
 * NCP API 호출을 통한 차단 목록 조회 (비공식)
 *
 * 참고: NCP Cloud Outbound Mailer API에는 공식적으로
 * Block List 조회 엔드포인트가 문서화되어 있지 않음
 *
 * 이 함수는 예상되는 엔드포인트로 시도하는 실험적 코드
 */
async function checkBlockListAPI() {
  const accessKey = process.env.NCP_ACCESS_KEY;
  const accessSecret = process.env.NCP_ACCESS_SECRET;

  if (!accessKey || !accessSecret) {
    console.error('NCP API 키가 설정되지 않았습니다.');
    return null;
  }

  const timestamp = Date.now().toString();
  const method = 'GET';
  const uri = '/api/v1/block-list';  // 추정 엔드포인트

  try {
    const signature = makeSignature(accessKey, accessSecret, timestamp, method, uri);

    const response = await fetch('https://mail.apigw.ntruss.com' + uri, {
      method,
      headers: {
        'x-ncp-apigw-timestamp': timestamp,
        'x-ncp-iam-access-key': accessKey,
        'x-ncp-apigw-signature-v1': signature,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.log(`API 응답: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.log('에러 내용:', errorText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('API 호출 실패:', error);
    return null;
  }
}

/**
 * 데이터베이스에서 바운스 이력 확인
 */
async function checkBounceHistory(email?: string) {
  console.log('\n=== 바운스 이력 확인 ===');

  // email_verification_codes 테이블에서 최근 실패 이력 확인
  const recentCodes = await prisma.email_verification_codes.findMany({
    where: email ? { email } : undefined,
    orderBy: { created_at: 'desc' },
    take: 20,
    select: {
      email: true,
      code: true,
      used: true,
      created_at: true,
      expires_at: true
    }
  });

  if (recentCodes.length === 0) {
    console.log('최근 이메일 발송 이력이 없습니다.');
    return;
  }

  console.log(`\n최근 ${recentCodes.length}개 발송 이력:`);

  // 이메일별로 그룹화
  const emailGroups = recentCodes.reduce((acc, record) => {
    if (!acc[record.email]) {
      acc[record.email] = [];
    }
    acc[record.email].push(record);
    return acc;
  }, {} as Record<string, typeof recentCodes>);

  for (const [emailAddr, records] of Object.entries(emailGroups)) {
    console.log(`\n📧 ${emailAddr}:`);

    const totalSent = records.length;
    const usedCount = records.filter(r => r.used).length;
    const expiredCount = records.filter(r => !r.used && new Date(r.expires_at) < new Date()).length;
    const pendingCount = records.filter(r => !r.used && new Date(r.expires_at) >= new Date()).length;

    console.log(`  - 총 발송: ${totalSent}회`);
    console.log(`  - 사용됨: ${usedCount}회`);
    console.log(`  - 만료됨: ${expiredCount}회 (미사용)`);
    console.log(`  - 대기중: ${pendingCount}회`);

    // 만료율이 높으면 문제일 가능성
    const unusedRate = ((expiredCount / totalSent) * 100).toFixed(1);
    if (expiredCount > 3) {
      console.log(`  ⚠️ 경고: 미사용 만료율 ${unusedRate}% (차단 가능성)`);
    }

    // 최근 발송 시간 확인
    const lastSent = records[0].created_at;
    console.log(`  - 마지막 발송: ${new Date(lastSent).toLocaleString('ko-KR')}`);
  }
}

/**
 * Rate Limiting 상태 확인
 */
async function checkRateLimitStatus(email: string) {
  console.log('\n=== Rate Limiting 상태 ===');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  const [dailyCount, hourlyCount, recentCount] = await Promise.all([
    // 오늘 발송 수
    prisma.email_verification_codes.count({
      where: {
        email,
        created_at: { gte: today }
      }
    }),

    // 지난 1시간 발송 수
    prisma.email_verification_codes.count({
      where: {
        email,
        created_at: { gte: oneHourAgo }
      }
    }),

    // 지난 5분 발송 수
    prisma.email_verification_codes.count({
      where: {
        email,
        created_at: { gte: fiveMinutesAgo }
      }
    })
  ]);

  console.log(`\n${email}의 발송 현황:`);
  console.log(`- 오늘: ${dailyCount}/10회 (일일 한도)`);
  console.log(`- 1시간: ${hourlyCount}/3회 (시간당 한도)`);
  console.log(`- 5분: ${recentCount}/1회 (쿨다운)`);

  if (dailyCount >= 10) {
    console.log('⛔ 일일 한도 초과 - 차단 가능성 높음');
  } else if (hourlyCount >= 3) {
    console.log('⚠️ 시간당 한도 도달 - 주의 필요');
  } else if (recentCount >= 1) {
    console.log('⏳ 쿨다운 기간 - 5분 대기 필요');
  } else {
    console.log('✅ 발송 가능 상태');
  }
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log('=' .repeat(60));
  console.log('NCP 이메일 차단 목록 체크');
  console.log('=' .repeat(60));

  const targetEmail = process.argv[2];

  // 1. API를 통한 차단 목록 조회 시도
  console.log('\n1. NCP API를 통한 차단 목록 조회 시도...');
  const blockList = await checkBlockListAPI();

  if (blockList) {
    console.log('차단 목록:', blockList);
  } else {
    console.log('❌ API를 통한 조회 실패 (API 미지원 가능성)');
    console.log('\n📌 NCP 콘솔에서 수동으로 확인하세요:');
    console.log('   1. https://console.ncloud.com/ 로그인');
    console.log('   2. Services > Application Services > Cloud Outbound Mailer');
    console.log('   3. 좌측 메뉴 > Send Block List');
    if (targetEmail) {
      console.log(`   4. 검색창에 "${targetEmail}" 입력`);
    }
  }

  // 2. 데이터베이스 바운스 이력 확인
  console.log('\n2. 데이터베이스 바운스 이력 확인...');
  await checkBounceHistory(targetEmail);

  // 3. 특정 이메일 Rate Limiting 상태 확인
  if (targetEmail) {
    console.log('\n3. Rate Limiting 상태 확인...');
    await checkRateLimitStatus(targetEmail);
  }

  // 4. 권장 사항
  console.log('\n' + '=' .repeat(60));
  console.log('📋 권장 조치사항:');
  console.log('=' .repeat(60));

  console.log('\n1. 즉시 확인:');
  console.log('   - NCP 콘솔에서 Send Block List 확인');
  console.log('   - 차단된 이메일 수동 해제');

  console.log('\n2. 예방 조치:');
  console.log('   - 가입 전 이메일 유효성 검증 강화');
  console.log('   - 바운스 처리 로직 구현');
  console.log('   - 발송 로그 데이터베이스 저장');

  console.log('\n3. 모니터링:');
  console.log('   - 일일 차단 목록 체크 자동화');
  console.log('   - 발송 성공률 모니터링');
  console.log('   - 이상 패턴 알림 설정');

  console.log('\n' + '=' .repeat(60));

  await prisma.$disconnect();
}

// 실행
main().catch(console.error);