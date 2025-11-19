import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSidoMismatch() {
  try {
    // 대구중부소방서 관련 AED 데이터 조회
    const aedData = await prisma.aed_data.findMany({
      where: {
        installation_institution: {
          contains: '중부소방'
        }
      },
      select: {
        management_number: true,
        installation_institution: true,
        sido: true,
        gugun: true,
        installation_address: true
      },
      take: 10
    });

    console.log('\n=== AED 데이터 (중부소방 관련) ===');
    aedData.forEach(item => {
      console.log({
        기관명: item.installation_institution,
        관리번호: item.management_number,
        시도: item.sido,
        구군: item.gugun,
        주소: item.installation_address
      });
    });

    // target_list_2025에서 중부소방 관련 조회
    const targetData = await prisma.target_list_2025.findMany({
      where: {
        institution_name: {
          contains: '중부소방'
        }
      },
      select: {
        target_key: true,
        institution_name: true,
        sido: true,
        gugun: true
      }
    });

    console.log('\n=== Target List (중부소방 관련) ===');
    targetData.forEach(item => {
      console.log({
        기관명: item.institution_name,
        target_key: item.target_key,
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

checkSidoMismatch();
