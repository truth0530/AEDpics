import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTway() {
  console.log('=== 1. target_list_2025에서 티웨이항공 검색 ===');
  const targets = await prisma.target_list_2025.findMany({
    where: {
      OR: [
        { institution_name: { contains: '티웨이', mode: 'insensitive' } },
        { institution_name: { contains: 'TWAY', mode: 'insensitive' } }
      ],
      data_year: 2025
    },
    orderBy: { target_key: 'asc' }
  });

  console.log(`\n총 ${targets.length}개 발견:`);
  targets.forEach((t, i) => {
    console.log(`\n[${i + 1}]`);
    console.log(`  target_key: ${t.target_key}`);
    console.log(`  institution_name: ${t.institution_name}`);
    console.log(`  sido: ${t.sido}, gugun: ${t.gugun}`);
    console.log(`  address: ${t.address}`);
    console.log(`  unique_key: ${t.unique_key}`);
  });

  console.log('\n\n=== 2. target_list_devices에서 티웨이 매칭 데이터 확인 ===');
  const targetKeys = targets.map(t => t.target_key);

  const devices = await prisma.target_list_devices.findMany({
    where: {
      target_institution_id: { in: targetKeys },
      target_list_year: 2025
    },
    orderBy: { matched_at: 'desc' }
  });

  console.log(`\n총 ${devices.length}개 매칭 레코드:`);
  devices.forEach((d, i) => {
    console.log(`\n[${i + 1}]`);
    console.log(`  target_institution_id: ${d.target_institution_id}`);
    console.log(`  equipment_serial: ${d.equipment_serial}`);
    console.log(`  matched_at: ${d.matched_at}`);
    console.log(`  matched_by: ${d.matched_by}`);
  });

  console.log('\n\n=== 3. AED 데이터에서 티웨이 검색 ===');
  const aedData = await prisma.aed_data.findMany({
    where: {
      OR: [
        { installation_institution: { contains: '티웨이', mode: 'insensitive' } },
        { installation_institution: { contains: 'TWAY', mode: 'insensitive' } }
      ]
    },
    select: {
      management_number: true,
      installation_institution: true,
      equipment_serial: true,
      installation_location_address: true
    },
    orderBy: { management_number: 'asc' }
  });

  console.log(`\n총 ${aedData.length}개 AED:`);
  const grouped = aedData.reduce((acc, a) => {
    if (!acc[a.management_number]) {
      acc[a.management_number] = [];
    }
    acc[a.management_number].push(a);
    return acc;
  }, {});

  Object.entries(grouped).forEach(([mgmtNum, devs]) => {
    console.log(`\n관리번호: ${mgmtNum}`);
    console.log(`  설치기관: ${devs[0].installation_institution}`);
    console.log(`  주소: ${devs[0].installation_location_address}`);
    console.log(`  장비 수: ${devs.length}개`);
    console.log(`  장비연번: ${devs.map(d => d.equipment_serial).join(', ')}`);
  });

  await prisma.$disconnect();
}

checkTway().catch(console.error);
