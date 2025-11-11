import { prisma } from '../lib/prisma';

async function checkMatchedData() {
  try {
    // 1. target_list_devices 테이블에 데이터가 있는지 확인
    const matchedCount = await prisma.target_list_devices.count({
      where: { target_list_year: 2024 }
    });

    console.log('2024년 매칭된 장비 수:', matchedCount);

    // 2. 샘플 데이터 조회 (equipment_serial과 관리번호 매칭)
    if (matchedCount > 0) {
      const result: any = await prisma.$queryRaw`
        SELECT
          tld.equipment_serial,
          tld.target_institution_id,
          ad.management_number,
          ad.installation_institution
        FROM aedpics.target_list_devices tld
        LEFT JOIN aedpics.aed_data ad ON tld.equipment_serial = ad.equipment_serial
        WHERE tld.target_list_year = 2024
        LIMIT 5
      `;

      console.log('\n샘플 매칭 데이터:');
      result.forEach((row: any, idx: number) => {
        console.log(`${idx + 1}. equipment_serial: ${row.equipment_serial}`);
        console.log(`   target: ${row.target_institution_id}`);
        console.log(`   관리번호: ${row.management_number || '(없음)'}`);
        console.log(`   기관명: ${row.installation_institution || '(없음)'}`);
        console.log('');
      });
    } else {
      console.log('\n❌ 아직 매칭된 데이터가 없습니다.');
      console.log('   → "매칭된 항목 표시" 체크박스는 매칭된 데이터가 있어야 차이를 볼 수 있습니다.');
      console.log('   → 현재는 체크박스를 켜도 꺼도 동일한 결과가 표시됩니다.');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMatchedData();
