import pkg from '@prisma/client';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

async function checkNullDistrictIssue() {
  try {
    console.log('\n=== 1. district가 null인 사용자 조회 ===\n');

    const nullDistrictUsers = await prisma.user_profiles.findMany({
      where: {
        district: null,
        is_active: true,
        approved_at: { not: null },
      },
      select: {
        id: true,
        full_name: true,
        email: true,
        role: true,
        region_code: true,
        district: true,
      },
      orderBy: [
        { region_code: 'asc' },
        { full_name: 'asc' },
      ]
    });

    console.log(`district가 null인 활성 사용자: ${nullDistrictUsers.length}명\n`);

    if (nullDistrictUsers.length > 0) {
      nullDistrictUsers.forEach((u, idx) => {
        console.log(`${idx + 1}. ${u.full_name} (${u.email})`);
        console.log(`   역할: ${u.role}`);
        console.log(`   지역: ${u.region_code} / district: ${u.district === null ? 'NULL' : u.district}\n`);
      });
    }

    // DAE null 사용자들 중 local_admin만
    console.log('\n=== 2. DAE 지역 district null인 local_admin ===\n');
    const daeNullLocalAdmins = await prisma.user_profiles.findMany({
      where: {
        region_code: 'DAE',
        district: null,
        role: 'local_admin',
        is_active: true,
        approved_at: { not: null },
      },
      select: {
        id: true,
        full_name: true,
        email: true,
      }
    });

    console.log(`DAE + null + local_admin: ${daeNullLocalAdmins.length}명`);
    daeNullLocalAdmins.forEach((u, idx) => {
      console.log(`  ${idx + 1}. ${u.full_name} (${u.email})`);
    });

    // 각 사용자가 볼 수 있는 팀원 시뮬레이션
    if (daeNullLocalAdmins.length > 0) {
      console.log('\n=== 3. 팀원 필터링 시뮬레이션 ===\n');

      for (const user of daeNullLocalAdmins) {
        // 현행 로직 시뮬레이션
        const teamMembers = await prisma.user_profiles.findMany({
          where: {
            is_active: true,
            approved_at: { not: null },
            id: { not: user.id },
            region_code: user.region_code,
            district: user.district,  // null
          },
          select: {
            full_name: true,
            email: true,
          }
        });

        console.log(`${user.full_name}이 보는 팀원: ${teamMembers.length}명`);
        if (teamMembers.length > 0) {
          teamMembers.forEach((tm, idx) => {
            console.log(`  ${idx + 1}. ${tm.full_name} (${tm.email})`);
          });
        } else {
          console.log('  → 팀원 없음 (NULL 매칭 실패?)');
        }
        console.log('');
      }
    }

    // district가 정상적으로 설정된 케이스 비교
    console.log('\n=== 4. 비교: DAE 중구 (district 정상 설정) ===\n');
    const daeJunggus = await prisma.user_profiles.findMany({
      where: {
        region_code: 'DAE',
        district: '중구',
        role: 'local_admin',
        is_active: true,
        approved_at: { not: null },
      },
      select: {
        id: true,
        full_name: true,
        email: true,
      }
    });

    console.log(`DAE 중구 local_admin: ${daeJunggus.length}명`);

    if (daeJunggus.length > 0) {
      const firstUser = daeJunggus[0];
      const teamMembers = await prisma.user_profiles.findMany({
        where: {
          is_active: true,
          approved_at: { not: null },
          id: { not: firstUser.id },
          region_code: 'DAE',
          district: '중구',
        },
        select: {
          full_name: true,
          email: true,
        }
      });

      console.log(`${firstUser.full_name}이 보는 팀원: ${teamMembers.length}명`);
      teamMembers.forEach((tm, idx) => {
        console.log(`  ${idx + 1}. ${tm.full_name} (${tm.email})`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkNullDistrictIssue();
