import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testTNMSIntegration() {
  try {
    // 1. 대구중부소방서 target_key 찾기
    const target = await prisma.$queryRaw`
      SELECT target_key, institution_name, sido, gugun
      FROM aedpics.target_list_2025
      WHERE institution_name LIKE '%대구중부소방서%'
      LIMIT 1
    `;

    if (!target || target.length === 0) {
      console.log('대구중부소방서를 찾을 수 없습니다.');

      // 중부소방서로 다시 검색
      const target2 = await prisma.$queryRaw`
        SELECT target_key, institution_name, sido, gugun
        FROM aedpics.target_list_2025
        WHERE institution_name LIKE '%중부소방서%'
          AND sido = '대구'
        LIMIT 5
      `;

      console.log('대구 중부소방서 검색 결과:');
      console.log(target2);
      return;
    }

    const targetKey = target[0].target_key;
    console.log('\n=== Target 정보 ===');
    console.log('target_key:', targetKey);
    console.log('institution_name:', target[0].institution_name);
    console.log('시도/구군:', target[0].sido, target[0].gugun);

    // 2. TNMS 매칭 결과 확인
    const tnmsMatches = await prisma.$queryRaw`
      SELECT
        tmr.matched_equipment_serial,
        tmr.confidence_score,
        tmr.match_type,
        tmr.matched_management_number,
        tmr.matched_institution_name,
        tmr.matched_address
      FROM aedpics.tnms_matching_results tmr
      WHERE tmr.target_key = ${targetKey}
      ORDER BY tmr.confidence_score DESC
      LIMIT 10
    `;

    console.log('\n=== TNMS 매칭 결과 (상위 10개) ===');
    console.log(`총 ${tnmsMatches.length}개 매칭 결과`);

    tnmsMatches.forEach((match, i) => {
      console.log(`\n${i + 1}. 관리번호: ${match.matched_management_number}`);
      console.log(`   기관명: ${match.matched_institution_name}`);
      console.log(`   주소: ${match.matched_address}`);
      console.log(`   장비연번: ${match.matched_equipment_serial}`);
      console.log(`   신뢰도: ${match.confidence_score}%`);
      console.log(`   매칭타입: ${match.match_type}`);
    });

    // 3. 중부소방서 관련 AED 직접 검색
    const relatedAEDs = await prisma.$queryRaw`
      SELECT DISTINCT
        management_number,
        installation_institution,
        installation_address,
        COUNT(*) as equipment_count
      FROM aedpics.aed_data
      WHERE installation_institution LIKE '%중부소방서%'
        AND sido = '대구'
      GROUP BY management_number, installation_institution, installation_address
      ORDER BY installation_institution
      LIMIT 10
    `;

    console.log('\n=== 대구 중부소방서 관련 AED (직접 검색) ===');
    relatedAEDs.forEach((aed, i) => {
      console.log(`${i + 1}. ${aed.installation_institution} (${aed.equipment_count}대)`);
      console.log(`   관리번호: ${aed.management_number}`);
      console.log(`   주소: ${aed.installation_address}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testTNMSIntegration();