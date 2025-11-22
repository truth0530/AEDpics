import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Inline ambulance detection functions
function isAmbulanceFromTarget(institution) {
  const subDivision = (institution.sub_division || '').trim();
  const ambulancePatterns = [
    (text) => text.includes('119') && text.includes('구급차')
  ];
  return ambulancePatterns.some(pattern => pattern(subDivision));
}

function isAmbulanceFromAED(item) {
  const category1 = (item.category_1 || '').trim();
  const category2 = (item.category_2 || '').trim();
  const location = (item.installation_position || '').trim();

  const ambulanceRegex = /구급\s*차/;
  if (ambulanceRegex.test(category2)) {
    return true;
  }

  if (category1 === '구비의무기관 외' && category2 === '구급차') {
    return true;
  }

  if (ambulanceRegex.test(category1)) {
    return true;
  }

  // Phase 7: installation_position fallback
  if (ambulanceRegex.test(location)) {
    return true;
  }

  return false;
}

function validateMatching(targetIsAmbulance, sourceIsAmbulance) {
  if (targetIsAmbulance && !sourceIsAmbulance) {
    return {
      valid: false,
      error: '구급차 기관에는 구급차 장비만 매칭할 수 있습니다.'
    };
  }

  if (!targetIsAmbulance && sourceIsAmbulance) {
    return {
      valid: false,
      error: '일반 기관에는 일반 장비만 매칭할 수 있습니다. (구급차 장비 제외)'
    };
  }

  return { valid: true };
}

async function testGunwiValidation() {
  console.log('=== 군위군보건소 구급차 매칭 검증 테스트 ===\n');

  // 1. 군위군보건소 정보 조회
  const target = await prisma.target_list_2025.findFirst({
    where: {
      institution_name: { contains: '군위군보건소' },
      sub_division: { not: { contains: '구급차' } }
    },
    select: {
      target_key: true,
      institution_name: true,
      sub_division: true
    }
  });

  if (!target) {
    console.log('❌ 군위군보건소를 찾을 수 없습니다.');
    return;
  }

  console.log('1. Target Institution:');
  console.log(JSON.stringify(target, null, 2));
  console.log(`   Is Ambulance: ${isAmbulanceFromTarget(target)}\n`);

  // 2. 관리번호 20100707-249 조회
  const equipment = await prisma.aed_data.findMany({
    where: { management_number: '20100707-249' },
    select: {
      equipment_serial: true,
      installation_position: true,
      category_1: true,
      category_2: true
    }
  });

  console.log('2. Equipment (관리번호 20100707-249):');
  console.log(`   Total: ${equipment.length}개\n`);

  // 3. 각 장비별 구급차 여부 판별
  const targetIsAmbulance = isAmbulanceFromTarget(target);
  let hasError = false;

  equipment.forEach((eq, index) => {
    const sourceIsAmbulance = isAmbulanceFromAED(eq);
    const validation = validateMatching(targetIsAmbulance, sourceIsAmbulance);

    console.log(`   [${index + 1}] ${eq.equipment_serial}`);
    console.log(`       위치: ${eq.installation_position}`);
    console.log(`       Category 1: ${eq.category_1}`);
    console.log(`       Category 2: ${eq.category_2}`);
    console.log(`       Is Ambulance: ${sourceIsAmbulance}`);
    console.log(`       Validation: ${validation.valid ? '✅ VALID' : '❌ INVALID - ' + validation.error}`);
    console.log('');

    if (!validation.valid) {
      hasError = true;
    }
  });

  // 4. 최종 결과
  console.log('\n=== 최종 결과 ===');
  if (hasError) {
    console.log('❌ 검증 실패: 구급차 장비가 일반 기관에 매칭되려고 시도');
    console.log('   API는 이 요청을 400 에러로 차단해야 합니다.');
  } else {
    console.log('✅ 검증 통과: 모든 장비가 매칭 규칙을 준수');
  }

  await prisma.$disconnect();
}

testGunwiValidation().catch(console.error);
