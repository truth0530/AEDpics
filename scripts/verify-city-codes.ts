import { prisma } from '@/lib/prisma';

async function verifyCityCodes() {
  console.log('=== city_code 검증 시작 ===\n');

  try {
    // 1. 대구 보건소 확인
    const daeguHealthCenters = await prisma.organizations.findMany({
      where: {
        region_code: 'DAE',
        type: 'health_center'
      },
      select: {
        id: true,
        name: true,
        city_code: true,
        address: true,
        updated_at: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    console.log('=== 대구 보건소 현재 상태 ===');
    console.log(`총 ${daeguHealthCenters.length}개 보건소\n`);

    for (const hc of daeguHealthCenters) {
      const status = hc.city_code ? '✅' : '❌';
      console.log(`${status} ${hc.name}`);
      console.log(`   city_code: ${hc.city_code || 'NULL'}`);
      console.log(`   주소: ${hc.address}`);
      console.log(`   최종수정: ${hc.updated_at.toLocaleString('ko-KR')}`);
    }

    // 2. 전체 보건소 통계
    const allHealthCenters = await prisma.organizations.findMany({
      where: {
        type: 'health_center'
      },
      select: {
        city_code: true,
        region_code: true,
        name: true
      }
    });

    const withCityCode = allHealthCenters.filter(hc => hc.city_code !== null && hc.city_code !== undefined);
    const withoutCityCode = allHealthCenters.filter(hc => hc.city_code === null || hc.city_code === undefined);

    console.log(`\n=== 전체 보건소 통계 ===`);
    console.log(`전체 보건소: ${allHealthCenters.length}개`);
    console.log(`city_code 있음: ${withCityCode.length}개`);
    console.log(`city_code 없음: ${withoutCityCode.length}개`);

    // 3. 시도별 누락 현황
    const byRegion: Record<string, { total: number; missing: number; names: string[] }> = {};

    for (const hc of allHealthCenters) {
      const region = hc.region_code || 'UNKNOWN';
      if (!byRegion[region]) {
        byRegion[region] = { total: 0, missing: 0, names: [] };
      }
      byRegion[region].total++;
      if (!hc.city_code) {
        byRegion[region].missing++;
        byRegion[region].names.push(hc.name);
      }
    }

    console.log(`\n=== 시도별 city_code 누락 현황 ===`);
    let totalMissing = 0;

    for (const [region, stats] of Object.entries(byRegion).sort()) {
      if (stats.missing > 0) {
        console.log(`\n${region}: ${stats.missing}개 누락 (전체 ${stats.total}개)`);
        console.log('누락된 보건소:');
        for (const name of stats.names.slice(0, 3)) {
          console.log(`  - ${name}`);
        }
        if (stats.names.length > 3) {
          console.log(`  ... 외 ${stats.names.length - 3}개`);
        }
        totalMissing += stats.missing;
      }
    }

    console.log(`\n=== 총계 ===`);
    console.log(`전체 누락: ${totalMissing}개`);

    // 4. city_code 유효성 확인 (값이 있지만 잘못된 경우)
    const invalidCodes = allHealthCenters.filter(hc => {
      if (!hc.city_code) return false;
      // city_code는 영문 소문자여야 함
      return !/^[a-z]+$/.test(hc.city_code);
    });

    if (invalidCodes.length > 0) {
      console.log(`\n=== 잘못된 city_code 형식 ===`);
      console.log(`${invalidCodes.length}개 발견`);
      for (const hc of invalidCodes.slice(0, 5)) {
        console.log(`  - ${hc.name}: "${hc.city_code}"`);
      }
    }

    // 5. 최근 수정된 보건소 확인
    const recentlyUpdated = await prisma.organizations.findMany({
      where: {
        type: 'health_center',
        updated_at: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24시간 이내
        }
      },
      select: {
        name: true,
        city_code: true,
        updated_at: true,
        region_code: true
      },
      orderBy: {
        updated_at: 'desc'
      },
      take: 10
    });

    if (recentlyUpdated.length > 0) {
      console.log(`\n=== 최근 24시간 이내 수정된 보건소 ===`);
      for (const hc of recentlyUpdated) {
        console.log(`${hc.name} (${hc.region_code})`);
        console.log(`  city_code: ${hc.city_code || 'NULL'}`);
        console.log(`  수정시간: ${hc.updated_at.toLocaleString('ko-KR')}`);
      }
    }

  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyCityCodes().catch(console.error);