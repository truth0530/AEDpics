import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

async function checkAndAddCheongjuHealthCenters() {
  console.log('=== 청주시 보건소 확인 및 추가 ===\n');

  try {
    // 청주시 보건소 정보 정의
    const cheongjuHealthCenters = [
      {
        name: '청주시상당보건소',
        alternativeNames: ['청주시 상당구 보건소', '청주시 상당보건소', '상당보건소'],
        city_code: 'cheongju-sangdang',
        address: '충청북도 청주시 상당구 남일면 단재로 480',
        contact: '043-201-3101'
      },
      {
        name: '청주시서원보건소',
        alternativeNames: ['청주시 서원구 보건소', '청주시 서원보건소', '서원보건소'],
        city_code: 'cheongju-seowon',
        address: '충청북도 청주시 서원구 구룡산로 149',
        contact: '043-201-3201'
      },
      {
        name: '청주시청원보건소',
        alternativeNames: ['청주시 청원구 보건소', '청주시 청원보건소', '청원보건소'],
        city_code: 'cheongju-cheongwon',
        address: '충청북도 청주시 청원구 오창읍 과학산업2로 249',
        contact: '043-201-3401'
      },
      {
        name: '청주시흥덕보건소',
        alternativeNames: ['청주시 흥덕구 보건소', '청주시 흥덕보건소', '흥덕보건소'],
        city_code: 'cheongju-heungdeok',
        address: '충청북도 청주시 흥덕구 비하로 15번길 12',
        contact: '043-201-3301'
      }
    ];

    // 1. 현재 청주시 보건소 확인
    const existingHealthCenters = await prisma.organizations.findMany({
      where: {
        region_code: 'CBN',  // 충청북도
        name: {
          contains: '청주'
        },
        type: 'health_center'
      }
    });

    console.log('현재 등록된 청주시 보건소:');
    if (existingHealthCenters.length === 0) {
      console.log('  - 등록된 청주시 보건소가 없습니다.\n');
    } else {
      for (const hc of existingHealthCenters) {
        console.log(`  - ${hc.name} (city_code: ${hc.city_code || 'null'})`);
      }
      console.log();
    }

    // 2. 각 보건소 확인 및 추가
    let addedCount = 0;
    let existingCount = 0;

    for (const healthCenter of cheongjuHealthCenters) {
      // 여러 이름으로 검색
      const existing = await prisma.organizations.findFirst({
        where: {
          OR: healthCenter.alternativeNames.map(name => ({ name }))
        }
      });

      if (!existing) {
        console.log(`⚠️ ${healthCenter.name}이(가) 누락되어 있습니다.`);
        console.log(`   ${healthCenter.name}을(를) 추가합니다...`);

        try {
          const newHealthCenter = await prisma.organizations.create({
            data: {
              id: randomUUID(),
              name: healthCenter.name,
              type: 'health_center',
              region_code: 'CBN',
              city_code: healthCenter.city_code,
              address: healthCenter.address,
              contact: healthCenter.contact
            }
          });

          console.log(`✅ ${healthCenter.name} 추가 완료`);
          console.log(`   - ID: ${newHealthCenter.id}`);
          console.log(`   - 주소: ${newHealthCenter.address}`);
          console.log(`   - 연락처: ${newHealthCenter.contact}\n`);
          addedCount++;
        } catch (error) {
          console.error(`❌ ${healthCenter.name} 추가 실패:`, error);
          console.log();
        }
      } else {
        console.log(`✅ ${healthCenter.name}이(가) 이미 존재합니다.`);
        console.log(`   - 등록명: ${existing.name}`);
        console.log(`   - city_code: ${existing.city_code || 'null'}\n`);
        existingCount++;
      }
    }

    // 3. 최종 확인
    console.log('=== 최종 청주시 보건소 목록 ===');
    const finalHealthCenters = await prisma.organizations.findMany({
      where: {
        region_code: 'CBN',
        name: {
          contains: '청주'
        },
        type: 'health_center'
      },
      orderBy: {
        name: 'asc'
      }
    });

    console.log(`총 ${finalHealthCenters.length}개 보건소:`);
    for (const hc of finalHealthCenters) {
      console.log(`  ✅ ${hc.name}`);
      console.log(`     - 주소: ${hc.address}`);
      console.log(`     - 연락처: ${hc.contact}`);
      console.log(`     - city_code: ${hc.city_code || 'null'}`);
      console.log();
    }

    // 4. AED 관할 현황 확인
    console.log('=== AED 관할 현황 ===');
    for (const healthCenter of cheongjuHealthCenters) {
      const count = await prisma.aed_data.count({
        where: {
          OR: healthCenter.alternativeNames.map(name => ({
            jurisdiction_health_center: name
          }))
        }
      });

      if (count > 0) {
        console.log(`  ${healthCenter.name} 관할: ${count}대`);
      }
    }

    // 5. 요약
    console.log('\n=== 작업 요약 ===');
    console.log(`  기존 보건소: ${existingCount}개`);
    console.log(`  새로 추가됨: ${addedCount}개`);
    console.log(`  총 보건소: ${finalHealthCenters.length}개`);

    if (finalHealthCenters.length < 4) {
      console.log('\n⚠️ 주의: 청주시 보건소가 4개 미만입니다. 확인이 필요합니다.');
    } else if (finalHealthCenters.length === 4) {
      console.log('\n✅ 청주시 보건소 4개가 모두 등록되어 있습니다.');
    } else {
      console.log('\n⚠️ 주의: 청주시 보건소가 4개를 초과합니다. 중복 확인이 필요합니다.');
    }

  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 실행
checkAndAddCheongjuHealthCenters().catch(console.error);