import pkg from '@prisma/client';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

async function checkManagementNumbers() {
  try {
    // 티웨이항공 매칭 데이터
    const tway = await prisma.$queryRaw`
      SELECT DISTINCT
        ad.management_number,
        ad.installation_institution,
        COUNT(*) as equipment_count
      FROM aedpics.target_list_devices tld
      LEFT JOIN aedpics.aed_data ad ON tld.equipment_serial = ad.equipment_serial
      WHERE tld.target_list_year = 2025
        AND tld.target_institution_id = 'DAE_20404'
      GROUP BY ad.management_number, ad.installation_institution
    `;

    console.log('=== 1. DAE_20404 (주)티웨이항공 - 60개 매칭 ===');
    console.log(`관리번호: ${tway[0].management_number}`);
    console.log(`기관명: ${tway[0].installation_institution}`);
    console.log(`장비 수: ${tway[0].equipment_count}개\n`);

    // 군위군보건소 매칭 데이터
    const gunwi = await prisma.$queryRaw`
      SELECT DISTINCT
        ad.management_number,
        ad.installation_institution,
        COUNT(*) as equipment_count
      FROM aedpics.target_list_devices tld
      LEFT JOIN aedpics.aed_data ad ON tld.equipment_serial = ad.equipment_serial
      WHERE tld.target_list_year = 2025
        AND tld.target_institution_id = '71보4348'
      GROUP BY ad.management_number, ad.installation_institution
    `;

    console.log('=== 2. 71보4348 (군위군보건소) - 7개 매칭 ===');
    console.log(`관리번호: ${gunwi[0].management_number}`);
    console.log(`기관명: ${gunwi[0].installation_institution}`);
    console.log(`장비 수: ${gunwi[0].equipment_count}개\n`);

    console.log('=== 핵심 문제 ===');
    console.log('위 2개 관리번호가 모든 의무기관 화면에서 "이미 매칭됨"으로 표시됩니다.');
    console.log('API의 is_matched 로직이 target_institution_id를 체크하지 않기 때문입니다.');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkManagementNumbers();
