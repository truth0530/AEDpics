import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  try {
    // 중부소방서 관련 AED 데이터 확인
    const fireStations = await prisma.aed_data.findMany({
      where: {
        OR: [
          { installation_institution: { contains: '중구 달구벌대로 1926' } },
          { installation_institution: { contains: '중부소방서' } },
          { installation_institution: { contains: '중부소방' } },
          { installation_address: { contains: '중구 달구벌대로 1926' } },
          { management_number: { in: ['998-2741', '998-1520', '998-9288', '998-2773', '998-2781', '998-2303'] } }
        ]
      },
      select: {
        management_number: true,
        installation_institution: true,
        installation_address: true,
        sido: true,
        gugun: true,
        equipment_serial: true
      }
    });

    console.log('\n=== 중부소방서 관련 AED 데이터 ===');
    console.log('총 결과:', fireStations.length);

    fireStations.forEach(station => {
      console.log('\n관리번호:', station.management_number);
      console.log('설치기관명:', station.installation_institution);
      console.log('설치주소:', station.installation_address);
      console.log('시도/구군:', station.sido, '/', station.gugun);
    });

    // target_list_2025에서 중부소방서 확인
    const targetJungbu = await prisma.target_list_2025.findMany({
      where: {
        institution_name: { contains: '중부소방서' }
      },
      select: {
        target_key: true,
        institution_name: true,
        sido: true,
        gugun: true,
        division: true
      }
    });

    console.log('\n=== target_list_2025에서 중부소방서 ===');
    console.log('결과:', targetJungbu);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

test();