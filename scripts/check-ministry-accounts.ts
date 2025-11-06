import { prisma } from '@/lib/prisma';

async function checkMinistryAccounts() {
  console.log('=== 보건복지부 계정 확인 ===\n');

  try {
    // 1. @korea.kr 도메인 중 보건복지부로 추정되는 계정 찾기
    const koreaAccounts = await prisma.user_profiles.findMany({
      where: {
        email: {
          endsWith: '@korea.kr'
        }
      },
      include: {
        organizations: {
          select: {
            id: true,
            name: true,
            type: true,
            region_code: true,
            city_code: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    console.log(`전체 @korea.kr 계정: ${koreaAccounts.length}개\n`);

    // 2. 보건복지부 계정 식별 (세종 지역 또는 조직명에 보건복지부 포함)
    const ministryAccounts = koreaAccounts.filter(account =>
      account.organizations?.region_code === 'SEJ' ||
      account.organizations?.name?.includes('보건복지부') ||
      account.region === '세종특별자치시' ||
      account.region_code === 'SEJ'
    );

    console.log('=== 보건복지부로 추정되는 계정 ===\n');

    for (const account of ministryAccounts) {
      console.log(`이메일: ${account.email}`);
      console.log(`역할: ${account.role}`);
      console.log(`지역: ${account.region || 'N/A'}`);
      console.log(`지역코드: ${account.region_code || 'N/A'}`);
      console.log(`조직: ${account.organizations?.name || 'N/A'}`);
      console.log(`조직 타입: ${account.organizations?.type || 'N/A'}`);
      console.log(`조직 지역코드: ${account.organizations?.region_code || 'N/A'}`);
      console.log(`생성일: ${account.created_at}`);

      // 권한 문제 진단
      if (account.role !== 'ministry_admin') {
        console.log(`\n⚠️ 문제 발견!`);
        console.log(`현재 역할이 '${account.role}'이지만 보건복지부는 'ministry_admin'이어야 합니다!`);
        console.log(`이로 인해 전국 권한이 없고 ${account.region || account.region_code} 지역으로 제한됩니다.`);
      } else {
        console.log(`✅ 올바른 역할 설정 (ministry_admin)`);
      }
      console.log('\n' + '='.repeat(50) + '\n');
    }

    // 3. ministry_admin 역할을 가진 모든 계정 확인
    console.log('=== ministry_admin 역할 계정 ===\n');

    const ministryAdmins = await prisma.user_profiles.findMany({
      where: {
        role: 'ministry_admin'
      },
      select: {
        email: true,
        name: true,
        region: true,
        region_code: true,
        created_at: true
      }
    });

    if (ministryAdmins.length === 0) {
      console.log('⚠️ ministry_admin 역할을 가진 계정이 없습니다!');
      console.log('이것이 보건복지부 계정이 전국 권한을 갖지 못하는 원인입니다.');
    } else {
      for (const admin of ministryAdmins) {
        console.log(`- ${admin.email} (${admin.name || 'N/A'})`);
      }
    }

    // 4. 해결 방안 제시
    if (ministryAccounts.length > 0 && ministryAccounts.some(a => a.role !== 'ministry_admin')) {
      console.log('\n=== 해결 방안 ===\n');
      console.log('보건복지부 계정의 역할을 ministry_admin으로 변경해야 합니다:');

      for (const account of ministryAccounts.filter(a => a.role !== 'ministry_admin')) {
        console.log(`\nUPDATE user_profiles`);
        console.log(`SET role = 'ministry_admin'`);
        console.log(`WHERE email = '${account.email}';`);
      }
    }

  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMinistryAccounts().catch(console.error);