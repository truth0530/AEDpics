import pkg from '@prisma/client';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

async function checkMatchedData() {
  try {
    const devices = await prisma.$queryRaw`
      SELECT
        tld.equipment_serial,
        tld.target_institution_id,
        tld.matched_at,
        ad.management_number,
        ad.installation_institution
      FROM aedpics.target_list_devices tld
      LEFT JOIN aedpics.aed_data ad ON tld.equipment_serial = ad.equipment_serial
      WHERE tld.target_list_year = 2025
      ORDER BY tld.matched_at DESC
      LIMIT 15
    `;

    console.log('\n=== 최근 매칭된 데이터 15개 ===\n');
    devices.forEach((d, i) => {
      console.log(`${i+1}. 장비연번: ${d.equipment_serial}`);
      console.log(`   관리번호: ${d.management_number}`);
      console.log(`   기관명: ${d.installation_institution}`);
      console.log(`   의무기관ID: ${d.target_institution_id}`);
      console.log(`   매칭일시: ${d.matched_at}\n`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMatchedData();
