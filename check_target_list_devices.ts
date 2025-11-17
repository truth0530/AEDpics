import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n=== 매칭된 기관 조회 (target_list_devices) ===');
  
  // 군위군보건소와 용대보건진료소의 target_key 찾기
  const targets = await prisma.target_list_2025.findMany({
    where: {
      institution_name: {
        in: ['군위군보건소', '용대보건진료소']
      },
      sido: '대구광역시',
      gugun: '군위군',
      data_year: 2025
    },
    select: {
      target_key: true,
      institution_name: true
    }
  });
  
  console.log('타겟 기관:', JSON.stringify(targets, null, 2));
  
  const targetKeys = targets.map(t => t.target_key);
  
  // target_list_devices에서 매칭 확인
  const matchedDevices = await prisma.target_list_devices.findMany({
    where: {
      target_institution_id: { in: targetKeys },
      target_list_year: 2025
    },
    select: {
      target_institution_id: true,
      equipment_serial: true,
      matched_by: true,
      matched_at: true
    }
  });
  
  console.log(`\n매칭된 레코드 수: ${matchedDevices.length}`);
  console.log('매칭 상세:', JSON.stringify(matchedDevices, null, 2));
  
  // 각 기관별로 정리
  targets.forEach(t => {
    const deviceCount = matchedDevices.filter(m => m.target_institution_id === t.target_key).length;
    console.log(`${t.institution_name} (${t.target_key}): ${deviceCount}개 장비 매칭됨`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
