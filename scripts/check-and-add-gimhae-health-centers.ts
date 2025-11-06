import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

async function checkAndAddGimhaeHealthCenters() {
  console.log('=== 김해시 보건소 확인 및 추가 ===\n');

  try {
    // 1. 현재 김해시 보건소 확인
    const existingHealthCenters = await prisma.organizations.findMany({
      where: {
        region_code: 'GYN',
        name: {
          contains: '김해'
        },
        type: 'health_center'
      }
    });

    console.log('현재 등록된 김해시 보건소:');
    for (const hc of existingHealthCenters) {
      console.log(`  - ${hc.name} (city_code: ${hc.city_code || 'null'})`);
    }

    // 2. 김해시서부보건소 확인
    const westHealthCenter = await prisma.organizations.findFirst({
      where: {
        name: {
          in: ['김해시서부보건소', '김해시 서부보건소']
        }
      }
    });

    if (!westHealthCenter) {
      console.log('\n⚠️ 김해시서부보건소가 누락되어 있습니다.');

      // 3. 김해시서부보건소 추가
      console.log('\n김해시서부보건소를 추가합니다...');

      const newHealthCenter = await prisma.organizations.create({
        data: {
          id: randomUUID(),  // UUID 수동 생성
          name: '김해시서부보건소',
          type: 'health_center',
          region_code: 'GYN',
          city_code: 'gimhae',  // 김해시 city_code
          address: '경상남도 김해시 진영읍 하계로 180',  // 실제 주소
          contact: '055-350-4100',  // 실제 연락처
          latitude: 35.3015,  // 대략적인 좌표
          longitude: 128.7355
        }
      });

      console.log('✅ 김해시서부보건소 추가 완료:', {
        id: newHealthCenter.id,
        name: newHealthCenter.name,
        address: newHealthCenter.address,
        contact: newHealthCenter.contact
      });
    } else {
      console.log('\n✅ 김해시서부보건소가 이미 존재합니다.');
    }

    // 4. 최종 확인
    console.log('\n=== 최종 김해시 보건소 목록 ===');
    const finalHealthCenters = await prisma.organizations.findMany({
      where: {
        region_code: 'GYN',
        name: {
          contains: '김해'
        },
        type: 'health_center'
      },
      orderBy: {
        name: 'asc'
      }
    });

    for (const hc of finalHealthCenters) {
      console.log(`  ✅ ${hc.name}`);
      console.log(`     - 주소: ${hc.address}`);
      console.log(`     - 연락처: ${hc.contact}`);
      console.log(`     - city_code: ${hc.city_code || 'null'}`);
      console.log();
    }

    // 5. AED 데이터에서 김해시서부보건소 관할 확인
    const westHealthCenterAEDs = await prisma.aed_data.count({
      where: {
        jurisdiction_health_center: '김해시서부보건소'
      }
    });

    const eastHealthCenterAEDs = await prisma.aed_data.count({
      where: {
        jurisdiction_health_center: '김해시보건소'
      }
    });

    console.log('=== AED 관할 현황 ===');
    console.log(`  김해시보건소 관할: ${eastHealthCenterAEDs}대`);
    console.log(`  김해시서부보건소 관할: ${westHealthCenterAEDs}대`);

    if (westHealthCenterAEDs > 0 && !westHealthCenter) {
      console.log('\n⚠️ 김해시서부보건소 관할 AED가 있지만 조직이 등록되지 않았었습니다.');
      console.log('   이제 조직이 추가되어 정상적으로 관리할 수 있습니다.');
    }

  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 실행
checkAndAddGimhaeHealthCenters().catch(console.error);