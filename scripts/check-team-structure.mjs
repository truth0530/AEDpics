import pkg from '@prisma/client';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

async function checkTeamStructure() {
  try {
    console.log('\n=== 1. user_profiles 전체 통계 ===');
    const totalUsers = await prisma.user_profiles.count();
    const approvedUsers = await prisma.user_profiles.count({
      where: { approved_at: { not: null }, is_active: true }
    });

    console.log(`전체 사용자: ${totalUsers}명`);
    console.log(`승인된 활성 사용자: ${approvedUsers}명\n`);

    console.log('=== 2. 역할별 승인된 사용자 수 ===');
    const usersByRole = await prisma.user_profiles.groupBy({
      by: ['role'],
      where: { approved_at: { not: null }, is_active: true },
      _count: { id: true }
    });

    usersByRole.forEach(role => {
      console.log(`${role.role}: ${role._count.id}명`);
    });

    console.log('\n=== 3. 지역별 승인된 사용자 수 (상위 10개) ===');
    const usersByRegion = await prisma.user_profiles.groupBy({
      by: ['region_code', 'district'],
      where: { approved_at: { not: null }, is_active: true },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } }
    });

    usersByRegion.slice(0, 10).forEach((region, idx) => {
      console.log(`${idx + 1}. ${region.region_code || 'N/A'} ${region.district || 'N/A'}: ${region._count.id}명`);
    });

    console.log('\n=== 4. team_members 테이블 통계 ===');
    const totalTeamMembers = await prisma.team_members.count();
    const activeTeamMembers = await prisma.team_members.count({
      where: { is_active: true }
    });

    console.log(`team_members 전체: ${totalTeamMembers}개`);
    console.log(`team_members 활성: ${activeTeamMembers}개`);

    if (activeTeamMembers > 0) {
      const sampleTeamMembers = await prisma.team_members.findMany({
        take: 5,
        include: {
          organizations: {
            select: { name: true }
          }
        }
      });

      console.log('\n샘플 team_members:');
      sampleTeamMembers.forEach((tm, idx) => {
        console.log(`${idx + 1}. ${tm.name} - ${tm.organizations.name}`);
      });
    }

    console.log('\n=== 5. 보건소(local_admin) 담당자 지역별 분포 ===');
    const localAdminsByDistrict = await prisma.user_profiles.groupBy({
      by: ['region_code', 'district'],
      where: {
        role: 'local_admin',
        approved_at: { not: null },
        is_active: true
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } }
    });

    console.log(`보건소 담당자 총 ${localAdminsByDistrict.length}개 지역에 분포`);
    console.log('\n1명인 지역 (팀원 없음 문제 발생):');
    const singlePersonDistricts = localAdminsByDistrict.filter(d => d._count.id === 1);
    console.log(`${singlePersonDistricts.length}개 지역`);
    singlePersonDistricts.slice(0, 10).forEach((d, idx) => {
      console.log(`  ${idx + 1}. ${d.region_code} ${d.district}`);
    });

    console.log('\n2명 이상인 지역 (팀원 있음):');
    const multiPersonDistricts = localAdminsByDistrict.filter(d => d._count.id > 1);
    console.log(`${multiPersonDistricts.length}개 지역`);
    multiPersonDistricts.forEach((d, idx) => {
      console.log(`  ${idx + 1}. ${d.region_code} ${d.district}: ${d._count.id}명`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTeamStructure();
