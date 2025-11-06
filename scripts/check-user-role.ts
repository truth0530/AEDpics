#!/usr/bin/env npx tsx
/**
 * 특정 사용자의 권한 확인
 *
 * 실행: npx tsx scripts/check-user-role.ts ymy0810@nmc.or.kr
 */

import { prisma } from '@/lib/prisma';

async function checkUserRole() {
  const email = process.argv[2] || 'ymy0810@nmc.or.kr';

  console.log('='.repeat(60));
  console.log(`사용자 권한 조회: ${email}`);
  console.log('='.repeat(60));
  console.log('');

  try {
    // 사용자 정보 조회
    const user = await prisma.user_profiles.findUnique({
      where: { email },
      select: {
        email: true,
        full_name: true,
        role: true,
        is_active: true,
        organization_name: true,
        region: true,
        region_code: true,
        created_at: true
      }
    });

    if (!user) {
      console.log('❌ 사용자를 찾을 수 없습니다.');
      return;
    }

    console.log('👤 사용자 정보:');
    console.log('-'.repeat(60));
    console.log(`이메일: ${user.email}`);
    console.log(`이름: ${user.full_name || '미설정'}`);
    console.log(`권한: ${user.role}`);
    console.log(`활성화: ${user.is_active ? '✅ 활성' : '❌ 비활성'}`);
    console.log(`소속: ${user.organization_name || '미설정'}`);
    console.log(`지역: ${user.region || '미설정'}`);
    console.log(`가입일: ${user.created_at?.toLocaleString('ko-KR')}`);
    console.log('');

    // 권한 분석
    console.log('🔍 권한 분석:');
    console.log('-'.repeat(60));

    switch (user.role) {
      case 'master':
        console.log('✅ Master 관리자');
        console.log('   - 모든 권한 보유');
        console.log('   - 승인 알림 수신: ✅');
        break;
      case 'emergency_center_admin':
        console.log('✅ 중앙응급의료센터 관리자');
        console.log('   - 사용자 승인 권한 보유');
        console.log('   - 승인 알림 수신: ✅');
        break;
      case 'ministry_admin':
        console.log('⚠️ 보건복지부 담당자');
        console.log('   - 데이터 조회/수정 권한');
        console.log('   - 사용자 승인 권한: ❌ 없음');
        console.log('   - 승인 알림 수신: ❌ 불필요 (현재는 받고 있음 - 수정 필요)');
        break;
      case 'regional_admin':
        console.log('지역 관리자');
        console.log('   - 해당 지역 데이터만 접근');
        console.log('   - 승인 알림 수신: ❌');
        break;
      case 'local_admin':
        console.log('보건소 담당자');
        console.log('   - 로컬 데이터만 접근');
        console.log('   - 승인 알림 수신: ❌');
        break;
      default:
        console.log('일반 사용자 또는 미승인 상태');
        console.log('   - 승인 알림 수신: ❌');
    }
    console.log('');

    // 승인 알림 대상 여부 확인
    const shouldReceiveNotifications =
      user.role === 'master' ||
      user.role === 'emergency_center_admin';

    console.log('📧 이메일 알림 상태:');
    console.log('-'.repeat(60));
    if (shouldReceiveNotifications) {
      console.log('✅ 승인 요청 알림을 받아야 합니다.');
    } else if (user.role === 'ministry_admin') {
      console.log('⚠️ 현재 알림을 받고 있지만, 받을 필요가 없습니다.');
      console.log('   → notify-new-signup 코드 수정 필요');
    } else {
      console.log('❌ 승인 요청 알림 대상이 아닙니다.');
    }
    console.log('');

    // 추가로 ministry_admin 전체 조회
    if (user.role === 'ministry_admin') {
      console.log('📊 ministry_admin 권한 사용자 전체:');
      console.log('-'.repeat(60));

      const ministryAdmins = await prisma.user_profiles.findMany({
        where: { role: 'ministry_admin', is_active: true },
        select: { email: true, full_name: true }
      });

      for (const admin of ministryAdmins) {
        console.log(`  - ${admin.email} (${admin.full_name || '이름 미설정'})`);
      }
      console.log('');
      console.log(`총 ${ministryAdmins.length}명이 불필요한 알림을 받고 있습니다.`);
    }

  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }

  console.log('='.repeat(60));
}

// 실행
checkUserRole().catch(console.error);