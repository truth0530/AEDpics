import pkg from '@prisma/client';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

async function analyzeTeamMembers() {
  try {
    console.log('\n=== 1. team_members 테이블 상세 분석 ===\n');

    // 전체 team_members 조회
    const allMembers = await prisma.team_members.findMany({
      include: {
        organizations: {
          select: {
            name: true,
            type: true,
            region_code: true,
            city_code: true,
          }
        },
        user_profiles_team_members_user_profile_idTouser_profiles: {
          select: {
            id: true,
            full_name: true,
            email: true,
            role: true,
            region_code: true,
            district: true,
            is_active: true,
            approved_at: true,
          }
        }
      }
    });

    console.log(`총 team_members: ${allMembers.length}개\n`);

    // member_type 분포
    const typeDistribution = allMembers.reduce((acc, m) => {
      acc[m.member_type] = (acc[m.member_type] || 0) + 1;
      return acc;
    }, {});

    console.log('=== 2. member_type 분포 ===');
    Object.entries(typeDistribution).forEach(([type, count]) => {
      console.log(`${type}: ${count}명`);
    });

    // user_profile_id 연결 여부
    const withUserProfile = allMembers.filter(m => m.user_profile_id !== null);
    const withoutUserProfile = allMembers.filter(m => m.user_profile_id === null);

    console.log('\n=== 3. user_profile_id 연결 상태 ===');
    console.log(`user_profile_id 있음: ${withUserProfile.length}명`);
    console.log(`user_profile_id 없음: ${withoutUserProfile.length}명`);

    // user_profile_id가 있는 샘플 10개
    console.log('\n=== 4. user_profile_id 연결된 샘플 (최대 10개) ===');
    withUserProfile.slice(0, 10).forEach((m, idx) => {
      const profile = m.user_profiles_team_members_user_profile_idTouser_profiles;
      console.log(`\n${idx + 1}. ${m.name} (${m.member_type})`);
      console.log(`   소속: ${m.organizations.name}`);
      console.log(`   조직 지역: ${m.organizations.region_code} ${m.organizations.city_code || ''}`);
      if (profile) {
        console.log(`   연결된 user_profile: ${profile.full_name} (${profile.email})`);
        console.log(`   프로필 역할: ${profile.role}`);
        console.log(`   프로필 지역: ${profile.region_code} ${profile.district || ''}`);
        console.log(`   승인 여부: ${profile.approved_at ? '승인됨' : '미승인'}`);
      } else {
        console.log(`   연결된 user_profile: NULL (ID만 있고 레코드 없음)`);
      }
    });

    // user_profile_id가 없는 샘플 5개
    if (withoutUserProfile.length > 0) {
      console.log('\n=== 5. user_profile_id 없는 샘플 (최대 5개) ===');
      withoutUserProfile.slice(0, 5).forEach((m, idx) => {
        console.log(`\n${idx + 1}. ${m.name} (${m.member_type})`);
        console.log(`   소속: ${m.organizations.name}`);
        console.log(`   조직 지역: ${m.organizations.region_code} ${m.organizations.city_code || ''}`);
        console.log(`   이메일: ${m.email || 'N/A'}`);
        console.log(`   전화번호: ${m.phone || 'N/A'}`);
      });
    }

    // 조직별 팀원 수
    console.log('\n=== 6. 조직별 팀원 수 (상위 10개) ===');
    const orgDistribution = allMembers.reduce((acc, m) => {
      const key = m.organizations.name;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    Object.entries(orgDistribution)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([org, count]) => {
        console.log(`${org}: ${count}명`);
      });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeTeamMembers();
