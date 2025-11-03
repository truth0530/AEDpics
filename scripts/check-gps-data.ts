import { prisma } from '../lib/prisma';

async function checkGPSData() {
  console.log('GPS 데이터 통계 확인 중...\n');

  // 전체 AED 개수
  const total = await prisma.aed_data.count();

  // GPS 좌표가 있는 AED 개수
  const withGPS = await prisma.aed_data.count({
    where: {
      AND: [
        { latitude: { not: null } },
        { longitude: { not: null } },
        { latitude: { not: 0 } },
        { longitude: { not: 0 } }
      ]
    }
  });

  // 대구 데이터 확인
  const daeguTotal = await prisma.aed_data.count({
    where: { sido: { in: ['대구', '대구광역시'] } }
  });

  const daeguWithGPS = await prisma.aed_data.count({
    where: {
      sido: { in: ['대구', '대구광역시'] },
      AND: [
        { latitude: { not: null } },
        { longitude: { not: null } },
        { latitude: { not: 0 } },
        { longitude: { not: 0 } }
      ]
    }
  });

  // GPS 좌표가 있는 샘플 데이터
  const sampleWithGPS = await prisma.aed_data.findMany({
    where: {
      AND: [
        { latitude: { not: null } },
        { longitude: { not: null } },
        { latitude: { not: 0 } },
        { longitude: { not: 0 } }
      ]
    },
    select: {
      equipment_serial: true,
      sido: true,
      gugun: true,
      latitude: true,
      longitude: true,
      installation_institution: true
    },
    take: 5
  });

  console.log('=== 전국 GPS 데이터 통계 ===');
  console.log(`전체 AED: ${total.toLocaleString()}개`);
  console.log(`GPS 있음: ${withGPS.toLocaleString()}개 (${((withGPS/total)*100).toFixed(2)}%)`);
  console.log(`GPS 없음: ${(total - withGPS).toLocaleString()}개 (${(((total-withGPS)/total)*100).toFixed(2)}%)`);
  console.log('');
  console.log('=== 대구 GPS 데이터 통계 ===');
  console.log(`대구 전체: ${daeguTotal.toLocaleString()}개`);
  console.log(`대구 GPS 있음: ${daeguWithGPS.toLocaleString()}개`);
  console.log('');

  if (sampleWithGPS.length > 0) {
    console.log('=== GPS 좌표 있는 샘플 (5개) ===');
    sampleWithGPS.forEach((aed, idx) => {
      console.log(`${idx + 1}. ${aed.sido} ${aed.gugun} - ${aed.installation_institution}`);
      console.log(`   시리얼: ${aed.equipment_serial}`);
      console.log(`   좌표: ${aed.latitude}, ${aed.longitude}\n`);
    });
  } else {
    console.log('⚠️ GPS 좌표가 있는 AED가 없습니다!\n');
  }

  await prisma.$disconnect();
}

checkGPSData().catch(console.error);
