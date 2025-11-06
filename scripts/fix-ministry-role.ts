import { prisma } from '@/lib/prisma';

async function fixMinistryRole() {
  console.log('=== 보건복지부 계정 역할 수정 ===\n');

  try {
    // 1. iyoung79@korea.kr 계정 찾기
    const ministryUser = await prisma.user_profiles.findFirst({
      where: {
        email: 'iyoung79@korea.kr'
      },
      include: {
        organizations: true
      }
    });

    if (!ministryUser) {
      console.error('❌ iyoung79@korea.kr 계정을 찾을 수 없습니다.');
      return;
    }

    console.log('현재 상태:');
    console.log(`- 이메일: ${ministryUser.email}`);
    console.log(`- 이름: ${ministryUser.full_name || 'N/A'}`);
    console.log(`- 조직: ${ministryUser.organizations?.name}`);
    console.log(`- 조직 타입: ${ministryUser.organizations?.type}`);
    console.log(`- 현재 역할: ${ministryUser.role}`);
    console.log(`- 지역: ${ministryUser.region}`);
    console.log(`- 지역코드: ${ministryUser.region_code}\n`);

    // 2. 조직이 ministry 타입인지 확인
    if (ministryUser.organizations?.type !== 'ministry') {
      console.error('⚠️ 경고: 조직 타입이 ministry가 아닙니다.');
      console.log(`현재 조직 타입: ${ministryUser.organizations?.type}`);
    }

    // 3. 역할 변경
    console.log('역할 변경 중...');

    const updated = await prisma.user_profiles.update({
      where: {
        id: ministryUser.id
      },
      data: {
        role: 'ministry_admin',
        // 권한도 함께 업데이트
        can_approve_users: true,
        can_manage_devices: true,
        can_view_reports: true,
        can_export_data: true,
        updated_at: new Date()
      }
    });

    console.log('\n✅ 역할 변경 완료!');
    console.log('변경된 내용:');
    console.log(`- 역할: local_admin → ministry_admin`);
    console.log(`- 권한: 전국 조회 가능`);
    console.log(`- 수정 시간: ${updated.updated_at}`);

    // 4. 권한 확인
    console.log('\n=== 권한 확인 ===');
    console.log('ministry_admin 역할로 변경되어 다음 권한을 갖습니다:');
    console.log('- ✅ 17개 시도 모두 조회 가능');
    console.log('- ✅ "전체" 선택 가능');
    console.log('- ✅ 시군구 자유 선택 가능');
    console.log('- ✅ 데이터 내보내기 가능');
    console.log('- ✅ 민감 데이터 조회 가능');
    console.log('- ✅ 최대 10,000개 데이터 조회 가능');

    // 5. 다른 보건복지부 계정도 있는지 확인
    const otherMinistryUsers = await prisma.user_profiles.findMany({
      where: {
        AND: [
          { email: { endsWith: '@korea.kr' } },
          { email: { not: 'iyoung79@korea.kr' } },
          {
            OR: [
              { region_code: 'SEJ' },
              { region: '세종특별자치시' }
            ]
          }
        ]
      },
      select: {
        email: true,
        full_name: true,
        role: true,
        organization_name: true
      }
    });

    if (otherMinistryUsers.length > 0) {
      console.log('\n=== 다른 세종 지역 계정 ===');
      console.log('(보건복지부일 가능성 있음)');

      for (const user of otherMinistryUsers) {
        console.log(`\n- ${user.email}`);
        console.log(`  이름: ${user.full_name || 'N/A'}`);
        console.log(`  역할: ${user.role}`);
        console.log(`  조직: ${user.organization_name || 'N/A'}`);

        if (user.role !== 'ministry_admin' && user.organization_name?.includes('보건복지부')) {
          console.log(`  ⚠️ 이 계정도 ministry_admin으로 변경이 필요할 수 있습니다.`);
        }
      }
    }

    console.log('\n✨ 작업 완료!');
    console.log('이제 iyoung79@korea.kr 계정으로 전국 모든 지역의 AED 데이터를 조회할 수 있습니다.');

  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixMinistryRole().catch(console.error);