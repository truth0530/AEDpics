import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkMatchedInstitutions() {
  console.log('=== target_list_devices (2025) 전체 데이터 확인 ===\n');

  // 1. 모든 매칭 레코드 조회
  const allMatches = await prisma.target_list_devices.findMany({
    where: { target_list_year: 2025 }
  });

  console.log(`총 매칭 레코드 수: ${allMatches.length}\n`);

  if (allMatches.length === 0) {
    console.log('매칭 데이터가 없습니다!');
    await prisma.$disconnect();
    return;
  }

  // 2. 각 레코드 상세 정보
  console.log('매칭 레코드 상세:');
  allMatches.forEach((m, idx) => {
    console.log(`[${idx + 1}]`);
    console.log(`  target_institution_id: ${m.target_institution_id}`);
    console.log(`  equipment_serial: ${m.equipment_serial}`);
    console.log(`  matched_by: ${m.matched_by || 'N/A'}`);
    console.log(`  matched_at: ${m.matched_at || 'N/A'}`);
    console.log(`  verified_by: ${m.verified_by || 'N/A'}`);
    console.log(`  verified_at: ${m.verified_at || 'N/A'}`);
    console.log('');
  });

  // 3. 고유 기관 ID 목록
  const uniqueTargetIds = [...new Set(allMatches.map(m => m.target_institution_id))];
  console.log(`\n매칭된 고유 기관 수: ${uniqueTargetIds.length}`);

  // 4. 각 기관의 정보 조회
  const institutions = await prisma.target_list_2025.findMany({
    where: {
      target_key: { in: uniqueTargetIds }
    },
    select: {
      target_key: true,
      institution_name: true,
      sido: true,
      gugun: true,
      address: true,
      sub_division: true
    }
  });

  console.log('\n매칭된 기관 정보:');
  institutions.forEach((inst, idx) => {
    const matchCount = allMatches.filter(m => m.target_institution_id === inst.target_key).length;
    const equipmentSerials = allMatches
      .filter(m => m.target_institution_id === inst.target_key)
      .map(m => m.equipment_serial);

    console.log(`\n[기관 ${idx + 1}] ${inst.institution_name}`);
    console.log(`  target_key: ${inst.target_key}`);
    console.log(`  지역: ${inst.sido} ${inst.gugun}`);
    console.log(`  주소: ${inst.address || 'N/A'}`);
    console.log(`  구분: ${inst.sub_division || 'N/A'}`);
    console.log(`  매칭된 장비 수: ${matchCount}개`);
    console.log(`  장비 연번: ${equipmentSerials.join(', ')}`);
  });

  // 5. AED 데이터 확인
  console.log('\n=== 매칭된 장비의 AED 데이터 확인 ===');
  const equipmentSerials = allMatches.map(m => m.equipment_serial);
  const aedData = await prisma.aed_data.findMany({
    where: {
      equipment_serial: { in: equipmentSerials }
    },
    select: {
      equipment_serial: true,
      management_number: true,
      installation_institution: true,
      installation_location_address: true,
      sido: true,
      gugun: true
    }
  });

  console.log(`AED 데이터 조회 결과: ${aedData.length}/${equipmentSerials.length}개 발견`);
  aedData.forEach((aed, idx) => {
    console.log(`\n[장비 ${idx + 1}] ${aed.installation_institution || 'N/A'}`);
    console.log(`  equipment_serial: ${aed.equipment_serial}`);
    console.log(`  management_number: ${aed.management_number || 'N/A'}`);
    console.log(`  지역: ${aed.sido} ${aed.gugun}`);
    console.log(`  주소: ${aed.installation_location_address || 'N/A'}`);
  });

  await prisma.$disconnect();
}

checkMatchedInstitutions().catch(console.error);
