import pkg from '@prisma/client';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

async function checkTargetDevices() {
  try {
    // target_list_devices 테이블 전체 개수
    const totalCount = await prisma.target_list_devices.count();
    console.log(`\n=== target_list_devices 전체 레코드 수: ${totalCount}개 ===\n`);

    // 2025년 데이터만
    const count2025 = await prisma.target_list_devices.count({
      where: { target_list_year: 2025 }
    });
    console.log(`2025년 매칭 데이터: ${count2025}개\n`);

    // 샘플 데이터 10개 조회
    const samples = await prisma.target_list_devices.findMany({
      where: { target_list_year: 2025 },
      take: 10,
      include: {
        target_list_2025: {
          select: {
            institution_name: true,
            sido: true,
            gugun: true
          }
        }
      }
    });

    console.log('=== 샘플 데이터 10개 ===');
    samples.forEach((item, idx) => {
      console.log(`\n${idx + 1}. 장비연번: ${item.equipment_serial}`);
      console.log(`   의무기관: ${item.target_list_2025?.institution_name || 'N/A'}`);
      console.log(`   지역: ${item.target_list_2025?.sido} ${item.target_list_2025?.gugun}`);
      console.log(`   매칭일시: ${item.matched_at}`);
    });

    // 어떤 관리번호가 매칭되어 있는지 확인
    const matchedManagementNumbers = await prisma.$queryRaw`
      SELECT DISTINCT ad.management_number, ad.installation_institution, COUNT(*) as device_count
      FROM aedpics.aed_data ad
      WHERE ad.equipment_serial IN (
        SELECT equipment_serial
        FROM aedpics.target_list_devices
        WHERE target_list_year = 2025
      )
      GROUP BY ad.management_number, ad.installation_institution
      ORDER BY device_count DESC
      LIMIT 10
    `;

    console.log('\n=== 매칭된 관리번호 TOP 10 ===');
    matchedManagementNumbers.forEach((item, idx) => {
      console.log(`${idx + 1}. ${item.management_number} - ${item.installation_institution} (${item.device_count}대)`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTargetDevices();
