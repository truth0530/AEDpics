import pkg from '@prisma/client';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

async function verifyTeamMemberFix() {
  try {
    console.log('\n=== 팀원 필터링 수정 검증 ===\n');

    // 테스트 케이스 1: district가 정상 설정된 보건소 담당자
    console.log('1. district 정상 (DAE 중구) - 이광성중구보건소');
    const daeJungguUser = await prisma.user_profiles.findFirst({
      where: {
        email: 'nemcdg@korea.kr',
        is_active: true,
        approved_at: { not: null },
      },
      select: {
        id: true,
        full_name: true,
        region_code: true,
        district: true,
        role: true,
      }
    });

    if (daeJungguUser) {
      console.log(`   사용자: ${daeJungguUser.full_name}`);
      console.log(`   지역: ${daeJungguUser.region_code} / ${daeJungguUser.district}`);

      const teamMembers = await prisma.user_profiles.findMany({
        where: {
          is_active: true,
          approved_at: { not: null },
          id: { not: daeJungguUser.id },
          region_code: daeJungguUser.region_code,
          district: daeJungguUser.district,
        },
        select: {
          full_name: true,
          email: true,
        }
      });

      console.log(`   팀원 수: ${teamMembers.length}명`);
      if (teamMembers.length > 0 && teamMembers.length <= 5) {
        teamMembers.forEach((tm, idx) => {
          console.log(`     ${idx + 1}. ${tm.full_name} (${tm.email})`);
        });
      }
    }

    // 테스트 케이스 2: 보정된 사용자 (김민주 - DAE 동구)
    console.log('\n2. 보정 완료 (DAE 동구) - 김민주');
    const kimMinju = await prisma.user_profiles.findFirst({
      where: {
        email: 'kimnju629@korea.kr',
        is_active: true,
        approved_at: { not: null },
      },
      select: {
        id: true,
        full_name: true,
        region_code: true,
        district: true,
        role: true,
      }
    });

    if (kimMinju) {
      console.log(`   사용자: ${kimMinju.full_name}`);
      console.log(`   지역: ${kimMinju.region_code} / ${kimMinju.district}`);

      const teamMembers = await prisma.user_profiles.findMany({
        where: {
          is_active: true,
          approved_at: { not: null },
          id: { not: kimMinju.id },
          region_code: kimMinju.region_code,
          district: kimMinju.district,
        },
        select: {
          full_name: true,
          email: true,
        }
      });

      console.log(`   팀원 수: ${teamMembers.length}명`);
      if (teamMembers.length === 0) {
        console.log(`   ✓ 동구는 1명만 있어 팀원 없음 (정상)`);
      }
    }

    // 테스트 케이스 3: district null 남은 사용자 (emergency_center_admin)
    console.log('\n3. district null (응급센터) - 김동휘');
    const kimDonghwi = await prisma.user_profiles.findFirst({
      where: {
        email: 'blackman10@nmc.or.kr',
        is_active: true,
        approved_at: { not: null },
      },
      select: {
        id: true,
        full_name: true,
        region_code: true,
        district: true,
        role: true,
      }
    });

    if (kimDonghwi) {
      console.log(`   사용자: ${kimDonghwi.full_name}`);
      console.log(`   지역: ${kimDonghwi.region_code} / ${kimDonghwi.district === null ? 'NULL' : kimDonghwi.district}`);
      console.log(`   역할: ${kimDonghwi.role}`);

      const teamMembers = await prisma.user_profiles.findMany({
        where: {
          is_active: true,
          approved_at: { not: null },
          id: { not: kimDonghwi.id },
          region_code: kimDonghwi.region_code,
          district: kimDonghwi.district,
        },
        select: {
          full_name: true,
          email: true,
          region_code: true,
        }
      });

      console.log(`   Prisma 쿼리 결과: ${teamMembers.length}명`);

      // NULL 매칭 확인
      const otherNullUsers = teamMembers.filter(tm => tm.region_code === kimDonghwi.region_code);
      const crossRegion = teamMembers.filter(tm => tm.region_code !== kimDonghwi.region_code);

      if (otherNullUsers.length > 0) {
        console.log(`   ⚠️  같은 DAE + NULL 사용자: ${otherNullUsers.length}명`);
      }
      if (crossRegion.length > 0) {
        console.log(`   ❌ 다른 지역 사용자: ${crossRegion.length}명 (문제!)`);
      }
      if (teamMembers.length === 0) {
        console.log(`   ✓ 팀원 없음 (예상대로, 하지만 역할상 district 불필요)`);
      }
    }

    // 전체 district null 사용자 확인
    console.log('\n4. district null 남은 사용자 전체 확인');
    const remainingNull = await prisma.user_profiles.findMany({
      where: {
        district: null,
        is_active: true,
        approved_at: { not: null },
      },
      select: {
        full_name: true,
        email: true,
        role: true,
        region_code: true,
      },
      orderBy: {
        role: 'asc'
      }
    });

    console.log(`   총 ${remainingNull.length}명`);
    const roleGroups = remainingNull.reduce((acc, u) => {
      acc[u.role] = (acc[u.role] || 0) + 1;
      return acc;
    }, {});

    Object.entries(roleGroups).forEach(([role, count]) => {
      console.log(`   ${role}: ${count}명`);
    });

    console.log('\n=== 검증 완료 ===\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyTeamMemberFix();
