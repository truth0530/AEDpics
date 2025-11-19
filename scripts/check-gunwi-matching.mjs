import pkg from '@prisma/client';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

console.log('='.repeat(80));
console.log('군위군 관련 매칭 데이터 확인');
console.log('='.repeat(80));

try {
  // 1. 타겟 기관 조회
  console.log('\n[1] 타겟 기관 리스트 (target_list_2025):');
  const targetInstitutions = await prisma.$queryRaw`
    SELECT
      target_key,
      institution_name,
      unique_key,
      address
    FROM aedpics.target_list_2025
    WHERE institution_name LIKE '%군위군보건소%'
       OR unique_key LIKE '%군위%'
    ORDER BY institution_name;
  `;
  console.table(targetInstitutions);

  // 2. 관리번호 20100707-249 매칭 상태
  console.log('\n[2] 관리번호 20100707-249 상세 정보:');
  const mgmtNumber249 = await prisma.$queryRaw`
    SELECT
      ad.management_number,
      ad.installation_institution as aed_institution,
      ad.equipment_serial,
      ad.installation_address,
      tld.target_institution_id,
      ti.institution_name as matched_to_institution,
      ti.unique_key as matched_to_unique_key
    FROM aedpics.aed_data ad
    LEFT JOIN aedpics.target_list_devices tld
      ON ad.equipment_serial = tld.equipment_serial
      AND tld.target_list_year = 2025
    LEFT JOIN aedpics.target_list_2025 ti
      ON tld.target_institution_id = ti.target_key
    WHERE ad.management_number = '20100707-249'
    ORDER BY ad.equipment_serial;
  `;
  console.table(mgmtNumber249);

  // 3. 군위군보건소 관련 모든 AED 데이터
  console.log('\n[3] 군위군보건소 관련 모든 관리번호:');
  const allGunwiAEDs = await prisma.$queryRaw`
    SELECT
      ad.management_number,
      ad.installation_institution as aed_institution,
      COUNT(ad.equipment_serial) as equipment_count,
      STRING_AGG(DISTINCT ti.institution_name, ', ') as matched_institutions
    FROM aedpics.aed_data ad
    LEFT JOIN aedpics.target_list_devices tld
      ON ad.equipment_serial = tld.equipment_serial
      AND tld.target_list_year = 2025
    LEFT JOIN aedpics.target_list_2025 ti
      ON tld.target_institution_id = ti.target_key
    WHERE ad.installation_institution LIKE '%군위군보건소%'
       OR ad.installation_address LIKE '%군위군 군위읍 군청로 70%'
    GROUP BY ad.management_number, ad.installation_institution
    ORDER BY ad.management_number;
  `;
  console.table(allGunwiAEDs);

  // 4. 이미 매칭된 항목 중 군위 관련
  console.log('\n[4] 군위 관련 매칭된 장비 상세:');
  const matchedDevices = await prisma.$queryRaw`
    SELECT
      tld.equipment_serial,
      ad.management_number,
      ad.installation_institution as aed_institution,
      ti.institution_name as matched_to_institution,
      ti.unique_key
    FROM aedpics.target_list_devices tld
    JOIN aedpics.aed_data ad ON tld.equipment_serial = ad.equipment_serial
    JOIN aedpics.target_list_2025 ti ON tld.target_institution_id = ti.target_key
    WHERE tld.target_list_year = 2025
      AND (ti.institution_name LIKE '%군위%'
           OR ad.installation_institution LIKE '%군위%'
           OR ad.installation_address LIKE '%군위군 군위읍 군청로 70%')
    ORDER BY ad.management_number, tld.equipment_serial;
  `;
  console.table(matchedDevices);

  console.log('\n='.repeat(80));
  console.log('데이터 확인 완료');
  console.log('='.repeat(80));

} catch (error) {
  console.error('에러 발생:', error);
} finally {
  await prisma.$disconnect();
}
