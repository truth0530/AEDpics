/**
 * city_code 데이터 무결성 검증 스크립트
 *
 * 목적:
 * 1. city_code가 null인 organizations 찾기
 * 2. local_admin 역할을 가진 사용자 중 city_code 없는 조직에 속한 사용자 찾기
 * 3. 데이터 보완 필요 여부 판단
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCityCodeIntegrity() {
  console.log('🔍 city_code 데이터 무결성 검증 시작...\n');

  try {
    // 1. 전체 organizations 통계
    const totalOrgs = await prisma.organizations.count();
    console.log(`📊 총 조직 수: ${totalOrgs}개`);

    // 2. city_code가 null인 organizations
    const orgsWithoutCityCode = await prisma.organizations.findMany({
      where: {
        city_code: null
      },
      select: {
        id: true,
        name: true,
        type: true,
        region_code: true,
        city_code: true,
      }
    });

    console.log(`\n❌ city_code가 null인 조직: ${orgsWithoutCityCode.length}개`);

    if (orgsWithoutCityCode.length > 0) {
      console.log('\n상세 목록:');
      orgsWithoutCityCode.forEach((org, index) => {
        console.log(`  ${index + 1}. ${org.name} (ID: ${org.id})`);
        console.log(`     타입: ${org.type}, 시도: ${org.region_code || 'null'}`);
      });
    }

    // 3. city_code가 있는 organizations
    const orgsWithCityCode = await prisma.organizations.count({
      where: {
        city_code: { not: null }
      }
    });

    console.log(`\n✅ city_code가 있는 조직: ${orgsWithCityCode}개`);

    // 4. local_admin 사용자 중 city_code 없는 조직에 속한 사용자
    const localAdmins = await prisma.user_profiles.findMany({
      where: {
        role: 'local_admin'
      },
      select: {
        id: true,
        email: true,
        full_name: true,
        organization_id: true,
      }
    });

    // 조직 정보와 수동 조인
    const localAdminsWithOrgData = await Promise.all(
      localAdmins.map(async (user) => {
        if (!user.organization_id) return { ...user, organization: null };
        const org = await prisma.organizations.findUnique({
          where: { id: user.organization_id },
          select: {
            id: true,
            name: true,
            type: true,
            region_code: true,
            city_code: true,
          }
        });
        return { ...user, organization: org };
      })
    );

    const localAdminsWithoutCityCode = localAdminsWithOrgData.filter(
      user => user.organization && user.organization.city_code === null
    );

    console.log(`\n⚠️  city_code 없는 조직에 속한 local_admin: ${localAdminsWithoutCityCode.length}명`);

    if (localAdminsWithoutCityCode.length > 0) {
      console.log('\n🚨 영향받는 사용자:');
      localAdminsWithoutCityCode.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.email}`);
        console.log(`     조직: ${user.organization?.name || 'N/A'}`);
        console.log(`     시도: ${user.organization?.region_code || 'N/A'}`);
      });
    }

    // 5. 전체 local_admin 수
    const totalLocalAdmins = await prisma.user_profiles.count({
      where: { role: 'local_admin' }
    });

    console.log(`\n📊 전체 local_admin 사용자: ${totalLocalAdmins}명`);

    // 6. 조직 타입별 통계
    const orgsByType = await prisma.organizations.groupBy({
      by: ['type'],
      _count: {
        id: true
      }
    });

    console.log('\n📈 조직 타입별 통계:');
    orgsByType.forEach(stat => {
      console.log(`  ${stat.type}: ${stat._count.id}개`);
    });

    // 7. city_code 없는 조직을 타입별로 분류
    const orgsWithoutCityCodeByType = await prisma.organizations.groupBy({
      by: ['type'],
      where: {
        city_code: null
      },
      _count: {
        id: true
      }
    });

    if (orgsWithoutCityCodeByType.length > 0) {
      console.log('\n❌ city_code 없는 조직 (타입별):');
      orgsWithoutCityCodeByType.forEach(stat => {
        console.log(`  ${stat.type}: ${stat._count.id}개`);
      });
    }

    // 8. 결론 및 권장사항
    console.log('\n' + '='.repeat(60));
    console.log('📋 결론 및 권장사항');
    console.log('='.repeat(60));

    if (orgsWithoutCityCode.length === 0) {
      console.log('✅ 모든 조직에 city_code가 설정되어 있습니다.');
      console.log('✅ 데이터 무결성 검증 통과!');
    } else {
      console.log(`⚠️  ${orgsWithoutCityCode.length}개 조직에 city_code가 없습니다.`);

      if (localAdminsWithoutCityCode.length > 0) {
        console.log(`🚨 ${localAdminsWithoutCityCode.length}명의 local_admin 사용자가 영향받습니다.`);
        console.log('\n권장 조치:');
        console.log('  1. 해당 조직들의 city_code를 수동으로 설정');
        console.log('  2. 또는 access-control.ts에서 city_code 없을 때 대체 로직 구현');
      } else {
        console.log('✅ 하지만 local_admin 사용자는 영향받지 않습니다.');
        console.log('\n선택사항:');
        console.log('  - 데이터 정규화를 위해 모든 조직에 city_code 설정 권장');
      }
    }

    console.log('\n');

  } catch (error) {
    console.error('❌ 검증 중 오류 발생:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 실행
checkCityCodeIntegrity()
  .then(() => {
    console.log('✅ 검증 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 검증 실패:', error);
    process.exit(1);
  });
