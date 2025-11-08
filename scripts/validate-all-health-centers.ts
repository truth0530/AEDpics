import { prisma } from '@/lib/prisma';
import { getGugunListByRegionCode, mapGugunToCityCode } from '@/lib/constants/regions';

async function validateAllHealthCenters() {
  console.log('=== 전국 보건소 city_code 검증 시작 ===\n');

  try {
    // 전체 health_center 조회
    const healthCenters = await prisma.organizations.findMany({
      where: {
        type: 'health_center'
      },
      select: {
        id: true,
        name: true,
        address: true,
        region_code: true,
        city_code: true
      },
      orderBy: [
        { region_code: 'asc' },
        { name: 'asc' }
      ]
    });

    console.log(`전국 보건소 ${healthCenters.length}개 발견\n`);

    // 통계
    const stats = {
      total: healthCenters.length,
      missing: 0,
      incorrect: 0,
      correct: 0,
      fixed: 0,
      failed: 0
    };

    // 시도별 그룹화
    const byRegion: Record<string, typeof healthCenters> = {};

    for (const hc of healthCenters) {
      const region = hc.region_code || 'UNKNOWN';
      if (!byRegion[region]) {
        byRegion[region] = [];
      }
      byRegion[region].push(hc);
    }

    // 시도별 검증 및 수정
    for (const [regionCode, centers] of Object.entries(byRegion)) {
      console.log(`\n===== ${regionCode} 지역 =====`);
      const gugunNames = regionCode === 'UNKNOWN' ? [] : getGugunListByRegionCode(regionCode);

      if (gugunNames.length === 0 && regionCode !== 'UNKNOWN') {
        console.log(`⚠️  ${regionCode}에 대한 구군 목록이 정의되지 않았습니다.`);
        continue;
      }

      for (const center of centers) {
        let status = '';
        let detectedCity = null;
        let expectedCode = null;

        // 주소나 이름에서 구군 추출
        if (gugunNames.length > 0) {
          for (const cityName of gugunNames) {
            if (center.name.includes(cityName) || center.address?.includes(cityName)) {
              detectedCity = cityName;
              expectedCode = mapGugunToCityCode(cityName);
              break;
            }
          }
        }

        // 상태 판단
        if (!center.city_code) {
          status = '❌ 누락';
          stats.missing++;

          // 수정 시도
          if (expectedCode) {
            try {
              await prisma.organizations.update({
                where: { id: center.id },
                data: { city_code: expectedCode }
              });
              status += ` → ✅ 수정됨 (${expectedCode})`;
              stats.fixed++;
            } catch (error) {
              status += ` → ⚠️ 수정 실패`;
              stats.failed++;
            }
          } else {
            status += ` → ⚠️ 구군 식별 불가`;
          }
        } else if (expectedCode && center.city_code !== expectedCode) {
          status = `⚠️ 불일치 (현재: ${center.city_code}, 예상: ${expectedCode})`;
          stats.incorrect++;

          // 수정 시도
          try {
            await prisma.organizations.update({
              where: { id: center.id },
              data: { city_code: expectedCode }
            });
            status += ` → ✅ 수정됨`;
            stats.fixed++;
          } catch (error) {
            status += ` → ⚠️ 수정 실패`;
            stats.failed++;
          }
        } else {
          status = '✅ 정상';
          stats.correct++;
        }

        // 문제가 있는 것만 출력
        if (!status.includes('✅ 정상')) {
          console.log(`${center.name}`);
          console.log(`  - 주소: ${center.address || '없음'}`);
          console.log(`  - city_code: ${center.city_code || '없음'}`);
          console.log(`  - 상태: ${status}`);
        }
      }

      // 시도별 요약
      const regionStats = centers.reduce((acc, c) => {
        if (!c.city_code) acc.missing++;
        else acc.correct++;
        return acc;
      }, { missing: 0, correct: 0 });

      console.log(`\n${regionCode} 요약: 정상 ${regionStats.correct}개, 누락 ${regionStats.missing}개`);
    }

    // 전체 통계
    console.log('\n' + '='.repeat(60));
    console.log('전체 검증 결과:');
    console.log(`  - 전체 보건소: ${stats.total}개`);
    console.log(`  - 정상: ${stats.correct}개 (${(stats.correct/stats.total*100).toFixed(1)}%)`);
    console.log(`  - 누락: ${stats.missing}개`);
    console.log(`  - 불일치: ${stats.incorrect}개`);
    console.log(`  - 수정 완료: ${stats.fixed}개`);
    console.log(`  - 수정 실패: ${stats.failed}개`);

    // 보건소 담당자 영향 분석
    console.log('\n=== 영향받는 보건소 담당자 ===\n');
    const affectedUsers = await prisma.user_profiles.findMany({
      where: {
        role: 'local_admin',
        organizations: {
          type: 'health_center',
          city_code: null
        }
      },
      include: {
        organizations: {
          select: {
            name: true,
            region_code: true,
            city_code: true
          }
        }
      }
    });

    if (affectedUsers.length > 0) {
      console.log(`city_code가 없는 보건소 담당자: ${affectedUsers.length}명`);
      for (const user of affectedUsers) {
        console.log(`- ${user.full_name} (${user.email})`);
        console.log(`  조직: ${user.organizations?.name}`);
        console.log(`  지역: ${user.organizations?.region_code}`);
      }
    } else {
      console.log('모든 보건소 담당자의 city_code가 정상 설정되어 있습니다.');
    }

  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

validateAllHealthCenters().catch(console.error);
