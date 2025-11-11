import { prisma } from '../lib/prisma';

async function testSeoulHealthCenter() {
  try {
    // 서울 강서구보건소 예시
    const target = await prisma.target_list_2024.findFirst({
      where: {
        institution_name: {
          contains: '강서구보건소'
        },
        sido: '서울'
      }
    });

    if (!target) {
      console.log('기관을 찾을 수 없습니다.');
      return;
    }

    console.log('=== 선택된 의무설치기관 ===');
    console.log(`기관명: ${target.institution_name}`);
    console.log(`시도: ${target.sido}`);
    console.log(`구군: ${target.gugun}`);
    console.log('');

    const targetName = target.institution_name;
    const year = 2024;

    // 새로운 실시간 confidence 계산
    const results: any = await prisma.$queryRaw`
      WITH grouped_data AS (
        SELECT DISTINCT ON (ad.management_number)
          ad.management_number,
          ad.installation_institution,
          COALESCE(ad.installation_location_address, ad.installation_address) as address,
          ad.equipment_serial,
          EXISTS(
            SELECT 1 FROM aedpics.target_list_devices tld
            WHERE tld.target_list_year = ${year}
              AND ad.equipment_serial = ANY(
                SELECT ad2.equipment_serial
                FROM aedpics.aed_data ad2
                WHERE ad2.management_number = ad.management_number
              )
          ) as is_matched,
          (
            SELECT t.target_key
            FROM aedpics.target_list_devices tld
            JOIN aedpics.aed_data ad2 ON tld.equipment_serial = ad2.equipment_serial
            JOIN aedpics.target_list_2024 t ON tld.target_institution_id = t.target_key
            WHERE ad2.management_number = ad.management_number
              AND tld.target_list_year = ${year}
            LIMIT 1
          ) as matched_to
        FROM aedpics.aed_data ad
        WHERE ad.management_number IS NOT NULL
          AND ad.sido = ${target.sido}
          AND ad.gugun = ${target.gugun}
        ORDER BY ad.management_number, ad.updated_at DESC
      )
      SELECT
        gd.management_number,
        gd.installation_institution as institution_name,
        gd.address,
        (SELECT COUNT(*) FROM aedpics.aed_data ad WHERE ad.management_number = gd.management_number) as equipment_count,
        CASE
          WHEN gd.installation_institution = ${targetName} THEN 100
          WHEN gd.installation_institution ILIKE '%' || ${targetName} || '%' THEN 90
          WHEN ${targetName} ILIKE '%' || gd.installation_institution || '%' THEN 85
          ELSE 60
        END as confidence,
        gd.is_matched,
        gd.matched_to
      FROM grouped_data gd
      WHERE (
        gd.installation_institution = ${targetName}
        OR gd.installation_institution ILIKE '%' || ${targetName} || '%'
        OR ${targetName} ILIKE '%' || gd.installation_institution || '%'
      )
      ORDER BY confidence DESC, equipment_count DESC
      LIMIT 20
    `;

    console.log(`\n=== 자동 추천 결과 (총 ${results.length}개) ===`);
    results.forEach((item: any, idx: number) => {
      console.log(`\n${idx + 1}. ${item.institution_name}`);
      console.log(`   관리번호: ${item.management_number}`);
      console.log(`   신뢰도: ${Number(item.confidence).toFixed(1)}%`);
      console.log(`   장비: ${item.equipment_count}대`);
      console.log(`   주소: ${item.address}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testSeoulHealthCenter();
