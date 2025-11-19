import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSpecificFireStation() {
  try {
    // 관리번호로 직접 조회
    const aedData = await prisma.aed_data.findMany({
      where: {
        management_number: '20130329-1'
      },
      select: {
        management_number: true,
        installation_institution: true,
        sido: true,
        gugun: true,
        installation_address: true
      }
    });

    console.log('\n=== 관리번호 20130329-1 AED 데이터 ===');
    aedData.forEach(item => {
      console.log({
        기관명: item.installation_institution,
        관리번호: item.management_number,
        시도: item.sido,
        구군: item.gugun,
        주소: item.installation_address
      });
    });

    // 대구 중구의 중부소방 관련 데이터 검색
    const daeguData = await prisma.aed_data.findMany({
      where: {
        sido: '대구',
        gugun: '중구',
        installation_institution: {
          contains: '중부소방'
        }
      },
      select: {
        management_number: true,
        installation_institution: true,
        sido: true,
        gugun: true
      },
      distinct: ['management_number']
    });

    console.log('\n=== 대구 중구 중부소방 관련 데이터 ===');
    console.log(`총 ${daeguData.length}개 발견`);
    daeguData.forEach(item => {
      console.log({
        기관명: item.installation_institution,
        관리번호: item.management_number,
        시도: item.sido,
        구군: item.gugun
      });
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSpecificFireStation();
