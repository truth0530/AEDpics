#!/usr/bin/env node

/**
 * TNMS 트리거 자동 업데이트 테스트
 * AED 데이터 변경 시 tnms_matching_results가 자동 업데이트되는지 확인
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testTriggerUpdate() {
  console.log('=== TNMS 트리거 업데이트 테스트 ===');
  console.log('시간:', new Date().toISOString());

  try {
    // 1. 테스트할 매칭 레코드 선택 (높은 신뢰도)
    const testMatch = await prisma.tnms_matching_results.findFirst({
      where: {
        matched_equipment_serial: { not: null },
        confidence_score: { gte: 95 }
      },
      orderBy: { confidence_score: 'desc' }
    });

    if (!testMatch) {
      console.log('테스트할 매칭 레코드를 찾을 수 없습니다.');
      return;
    }

    console.log('\n[1] 테스트 대상 선택:');
    console.log(`  - Target Key: ${testMatch.target_key}`);
    console.log(`  - Equipment Serial: ${testMatch.matched_equipment_serial}`);
    console.log(`  - 현재 기관명: ${testMatch.matched_institution_name}`);
    console.log(`  - 현재 주소: ${testMatch.matched_address}`);

    // 2. AED 데이터 원본 확인
    const originalAed = await prisma.aed_data.findUnique({
      where: { equipment_serial: testMatch.matched_equipment_serial }
    });

    console.log('\n[2] AED 원본 데이터:');
    console.log(`  - 기관명: ${originalAed.installation_institution}`);
    console.log(`  - 주소: ${originalAed.installation_address}`);

    // 3. AED 데이터 변경 (테스트용)
    console.log('\n[3] AED 데이터 변경 중...');
    const updatedAed = await prisma.aed_data.update({
      where: { equipment_serial: testMatch.matched_equipment_serial },
      data: {
        installation_institution: originalAed.installation_institution + ' (테스트변경)',
        installation_address: originalAed.installation_address + ' - 업데이트됨'
      }
    });

    console.log('  - 변경된 기관명:', updatedAed.installation_institution);
    console.log('  - 변경된 주소:', updatedAed.installation_address);

    // 4. 잠시 대기 (트리거 실행 시간)
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 5. 매칭 결과 재확인
    console.log('\n[4] 트리거 실행 후 매칭 결과 확인:');
    const updatedMatch = await prisma.tnms_matching_results.findUnique({
      where: { target_key: testMatch.target_key }
    });

    console.log(`  - 업데이트된 기관명: ${updatedMatch.matched_institution_name}`);
    console.log(`  - 업데이트된 주소: ${updatedMatch.matched_address}`);
    console.log(`  - 업데이트 시간: ${updatedMatch.updated_at}`);
    console.log(`  - 업데이트 주체: ${updatedMatch.updated_by}`);

    // 6. 트리거 작동 확인
    if (updatedMatch.matched_institution_name === updatedAed.installation_institution) {
      console.log('\n✅ 트리거 성공! AED 변경이 자동으로 매칭 결과에 반영되었습니다.');
    } else {
      console.log('\n❌ 트리거 실패. 수동 업데이트 필요.');
    }

    // 7. 뷰(tnms_matching_current) 확인
    console.log('\n[5] 동적 뷰 확인 (tnms_matching_current):');
    const currentView = await prisma.$queryRaw`
      SELECT
        target_key,
        current_institution_name,
        current_address,
        data_changed
      FROM aedpics.tnms_matching_current
      WHERE target_key = ${testMatch.target_key}
    `;

    if (currentView.length > 0) {
      console.log(`  - 현재 기관명 (뷰): ${currentView[0].current_institution_name}`);
      console.log(`  - 현재 주소 (뷰): ${currentView[0].current_address}`);
      console.log(`  - 데이터 변경 감지: ${currentView[0].data_changed ? '예' : '아니오'}`);
    }

    // 8. 원복 (테스트 완료)
    console.log('\n[6] 테스트 데이터 원복 중...');
    await prisma.aed_data.update({
      where: { equipment_serial: testMatch.matched_equipment_serial },
      data: {
        installation_institution: originalAed.installation_institution,
        installation_address: originalAed.installation_address
      }
    });

    // 잠시 대기
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 원복 확인
    const restoredMatch = await prisma.tnms_matching_results.findUnique({
      where: { target_key: testMatch.target_key }
    });

    console.log('  - 원복된 기관명:', restoredMatch.matched_institution_name);
    console.log('  - 원복된 주소:', restoredMatch.matched_address);

    console.log('\n=== 트리거 테스트 완료 ===');

  } catch (error) {
    console.error('테스트 오류:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 실행
testTriggerUpdate();