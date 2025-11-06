import { prisma } from '@/lib/prisma';

async function diagnoseApiIssue() {
  console.log('=== API 청크 인코딩 오류 진단 ===\n');

  try {
    // 1. inspection_assignments 데이터 현황
    console.log('1. 일정 데이터 현황:');
    const totalAssignments = await prisma.inspection_assignments.count();
    console.log(`  - 전체 일정: ${totalAssignments}개`);

    const pendingCount = await prisma.inspection_assignments.count({
      where: { status: 'pending' }
    });
    console.log(`  - Pending 상태: ${pendingCount}개`);

    const inProgressCount = await prisma.inspection_assignments.count({
      where: { status: 'in_progress' }
    });
    console.log(`  - In Progress 상태: ${inProgressCount}개`);

    const allScheduled = await prisma.inspection_assignments.count({
      where: { status: { in: ['pending', 'in_progress'] } }
    });
    console.log(`  - 조회 가능 일정(pending+in_progress): ${allScheduled}개`);

    // 2. 특정 사용자의 일정
    console.log('\n2. 특정 사용자별 일정 현황:');
    const userAssignments = await prisma.inspection_assignments.groupBy({
      by: ['assigned_to'],
      _count: true,
      where: {
        status: { in: ['pending', 'in_progress'] }
      }
    });

    console.log(`  - 활성 일정 보유 사용자: ${userAssignments.length}명`);
    for (const ua of userAssignments) {
      console.log(`    * ${ua.assigned_to.substring(0, 10)}...: ${ua._count}개`);
    }

    // 3. 가장 많은 일정을 가진 사용자 확인
    console.log('\n3. 가장 많은 일정을 가진 사용자:');
    if (userAssignments.length > 0) {
      const sortedByCount = userAssignments.sort((a, b) => b._count - a._count);
      const topUser = sortedByCount[0];
      const userProfile = await prisma.user_profiles.findUnique({
        where: { id: topUser.assigned_to },
        select: { email: true, full_name: true }
      });

      console.log(`  - ${userProfile?.full_name} (${userProfile?.email})`);
      console.log(`  - 일정 개수: ${topUser._count}개`);

      // 이 사용자의 일정 샘플
      const sample = await prisma.inspection_assignments.findMany({
        where: {
          assigned_to: topUser.assigned_to,
          status: { in: ['pending', 'in_progress'] }
        },
        select: {
          equipment_serial: true,
          status: true,
          scheduled_date: true
        },
        take: 3
      });

      console.log(`  - 일정 샘플 (첫 3개):`);
      for (const s of sample) {
        console.log(`    * ${s.equipment_serial} - ${s.status}`);
      }
    }

    // 4. AED 데이터 현황
    console.log('\n4. AED 데이터 현황:');
    const totalAed = await prisma.aed_data.count();
    console.log(`  - 전체 AED: ${totalAed}개`);

    const byRegion = await prisma.aed_data.groupBy({
      by: ['sido'],
      _count: true
    });
    console.log(`  - 지역 수: ${byRegion.length}개`);

    // 5. 지역별 city_code 현황
    console.log('\n5. 보건소 city_code 현황:');
    const orgs = await prisma.organizations.findMany({
      where: { type: 'health_center' },
      select: { name: true, city_code: true, region_code: true },
      distinct: ['city_code'],
      take: 20
    });

    const codeSamples = orgs.slice(0, 10);
    for (const org of codeSamples) {
      const isKorean = /[가-힣]/.test(org.city_code || '');
      const format = isKorean ? '한글' : '영어';
      console.log(`  - ${org.region_code}: "${org.city_code}" (${format})`);
    }

    // 6. 청크 인코딩 오류의 가능 원인 분석
    console.log('\n6. 가능한 원인 분석:');

    if (allScheduled > 10000) {
      console.log('  ⚠️ WARNING: 일정 데이터가 너무 많음 (10,000개 초과)');
      console.log('     → JSON 직렬화 시 응답이 매우 클 수 있음');
    } else if (allScheduled > 1000) {
      console.log('  ⚠️ CAUTION: 일정 데이터가 많음 (1,000개 초과)');
      console.log('     → 네트워크 상황에 따라 청크 인코딩 오류 가능');
    } else {
      console.log('  ✓ 일정 데이터 크기는 정상 범위');
    }

    // 7. city_code 불일치 확인
    console.log('\n7. City Code 일관성 확인:');
    const koreanCodes = await prisma.organizations.count({
      where: {
        type: 'health_center',
        city_code: {
          not: null
        }
      }
    });

    const englishCodeCount = orgs.filter(
      o => !/[가-힣]/.test(o.city_code || '')
    ).length;

    console.log(`  - 한글 city_code 사용 보건소: ${
      orgs.length - englishCodeCount
    }개`);
    console.log(`  - 영어 city_code 사용 보건소: ${englishCodeCount}개`);

  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

diagnoseApiIssue().catch(console.error);
