import { prisma } from '../lib/prisma';

async function checkConfidenceCalculation() {
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

    // 2. 현재 자동 추천 방식으로 조회 (신뢰도 70% 이상)
    const autoSuggestions: any = await prisma.$queryRaw`
      SELECT
        ad.management_number,
        ad.installation_institution as institution_name,
        COALESCE(ad.installation_location_address, ad.installation_address) as address,
        ad.sido,
        ad.gugun,
        COUNT(*) OVER (PARTITION BY ad.management_number) as equipment_count,
        COALESCE(mngm.auto_confidence_2024::numeric, 0) as confidence
      FROM aedpics.aed_data ad
      LEFT JOIN aedpics.management_number_group_mapping mngm
        ON mngm.management_number = ad.management_number
      WHERE ad.management_number IS NOT NULL
        AND ad.sido = ${gunwiTarget.sido}
        AND ad.gugun = ${gunwiTarget.gugun}
        AND mngm.auto_confidence_2024 >= 70
      ORDER BY mngm.auto_confidence_2024 DESC NULLS LAST
      LIMIT 10
    `;

    console.log('=== 현재 자동 추천 결과 (신뢰도 70% 이상) ===');
    autoSuggestions.forEach((item: any, idx: number) => {
      console.log(`\n${idx + 1}. ${item.institution_name}`);
      console.log(`   관리번호: ${item.management_number}`);
      console.log(`   주소: ${item.address}`);
      console.log(`   신뢰도: ${Number(item.confidence).toFixed(1)}%`);
      console.log(`   장비: ${item.equipment_count}대`);
    });

    // 3. 이름 유사도가 높은 관리번호 확인
    console.log('\n\n=== 기관명 유사도가 높은 관리번호 ===');
    const similarNames: any = await prisma.$queryRaw`
      SELECT
        ad.management_number,
        ad.installation_institution as institution_name,
        COALESCE(ad.installation_location_address, ad.installation_address) as address,
        ad.sido,
        ad.gugun,
        COUNT(*) OVER (PARTITION BY ad.management_number) as equipment_count,
        COALESCE(mngm.auto_confidence_2024::numeric, 0) as current_confidence,
        SIMILARITY(ad.installation_institution, ${gunwiTarget.institution_name}) as name_similarity
      FROM aedpics.aed_data ad
      LEFT JOIN aedpics.management_number_group_mapping mngm
        ON mngm.management_number = ad.management_number
      WHERE ad.management_number IS NOT NULL
        AND ad.sido = ${gunwiTarget.sido}
        AND ad.gugun = ${gunwiTarget.gugun}
      ORDER BY name_similarity DESC
      LIMIT 10
    `;

    similarNames.forEach((item: any, idx: number) => {
      console.log(`\n${idx + 1}. ${item.institution_name}`);
      console.log(`   관리번호: ${item.management_number}`);
      console.log(`   주소: ${item.address}`);
      console.log(`   이름 유사도: ${(Number(item.name_similarity) * 100).toFixed(1)}%`);
      console.log(`   저장된 신뢰도: ${Number(item.current_confidence).toFixed(1)}%`);
      console.log(`   장비: ${item.equipment_count}대`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkConfidenceCalculation();
