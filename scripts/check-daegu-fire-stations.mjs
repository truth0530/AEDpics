import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDaeguFireStations() {
  try {
    // 대구 지역의 소방 관련 AED 데이터 조회
    const aedData = await prisma.aed_data.findMany({
      where: {
        sido: '대구',
        installation_institution: {
          contains: '소방'
        }
      },
      select: {
        management_number: true,
        installation_institution: true,
        sido: true,
        gugun: true,
        installation_address: true
      },
      orderBy: {
        installation_institution: 'asc'
      },
      take: 50
    });

    console.log('\n=== 대구 지역 소방 관련 AED 데이터 ===');
    console.log(`총 ${aedData.length}개 발견`);
    
    const uniqueInstitutions = [...new Set(aedData.map(item => item.installation_institution))];
    console.log('\n고유 기관명:');
    uniqueInstitutions.forEach(name => {
      const count = aedData.filter(item => item.installation_institution === name).length;
      console.log(`- ${name} (${count}대)`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDaeguFireStations();
