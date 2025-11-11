import { prisma } from '../lib/prisma';

async function testNewConfidenceCalculation() {
  try {
    // 1. 군위군보건소를 예시로 확인
    const gunwiTarget = await prisma.target_list_2024.findFirst({
      where: {
        institution_name: {
          contains: '군위군'
        },
        sido: '대구'
      }
    });

    if (!gunwiTarget) {
      console.log('군위군 기관을 찾을 수 없습니다.');
      return;
    }

    console.log('=== 선택된 의무설치기관 ===');
    console.log(`기관명: ${gunwiTarget.institution_name}`);
    console.log(`시도: ${gunwiTarget.sido}`);
    console.log(`구군: ${gunwiTarget.gugun}`);
    console.log('');

    const targetName = gunwiTarget.institution_name;
    const year = 2024;

    // 2. 새로운 실시간 confidence 계산 방식 (시도+구군 필터)
    console.log('=== 새로운 실시간 Confidence 계산 ===');
    const newAutoSuggestions: any = await prisma.$queryRaw`
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
          AND ad.sido = ${gunwiTarget.sido}
          AND ad.gugun = ${gunwiTarget.gugun}
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
      LIMIT 10
    `;

    console.log(`\n찾은 결과: ${newAutoSuggestions.length}개`);
    newAutoSuggestions.forEach((item: any, idx: number) => {
      console.log(`\n${idx + 1}. ${item.institution_name}`);
      console.log(`   관리번호: ${item.management_number}`);
      console.log(`   주소: ${item.address}`);
      console.log(`   신뢰도: ${Number(item.confidence).toFixed(1)}%`);
      console.log(`   장비: ${item.equipment_count}대`);
      console.log(`   매칭여부: ${item.is_matched ? '✅ 매칭됨' : '❌ 미매칭'}`);
    });

    // 3. 상위 3개 기관명 상세 분석
    console.log('\n\n=== 상위 3개 기관 유사도 분석 ===');
    newAutoSuggestions.slice(0, 3).forEach((item: any, idx: number) => {
      const institutionName = item.institution_name;
      const confidence = Number(item.confidence);

      console.log(`\n${idx + 1}. ${institutionName} (${confidence}%)`);
      console.log(`   선택된 기관: "${targetName}"`);

      // 매칭 조건 분석
      if (institutionName === targetName) {
        console.log(`   ✅ 완전 일치 → 100%`);
      } else if (institutionName.includes(targetName)) {
        console.log(`   ✅ "${targetName}"를 포함 → 90%`);
      } else if (targetName.includes(institutionName)) {
        console.log(`   ✅ "${institutionName}"이 포함됨 → 85%`);
      } else {
        console.log(`   ℹ️  문자열 거리 기반 계산 → ${confidence}%`);
      }
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testNewConfidenceCalculation();
