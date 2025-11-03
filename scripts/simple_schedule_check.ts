import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // inspection_schedule_entries 테이블 총 건수
  const total = await prisma.inspection_schedule_entries.count();
  console.log(`=== inspection_schedule_entries 총 건수: ${total}건 ===\n`);

  if (total > 0) {
    const samples = await prisma.inspection_schedule_entries.findMany({
      take: 5
    });
    console.log('샘플 데이터:');
    samples.forEach(s => {
      console.log({
        id: s.id,
        device_equipment_serial: s.device_equipment_serial,
        scheduled_for: s.scheduled_for,
        status: s.status
      });
    });
  }

  // inspection 테이블 확인
  const inspTotal = await prisma.inspections.count();
  console.log(`\n=== inspections 총 건수: ${inspTotal}건 ===`);

  // 사용자 요구사항
  console.log('\n=== 사용자 요구사항 ===');
  console.log('현재: 현장점검 = Y/전체');
  console.log('수정: 현장점검 = Y/X (X는 일정추가 분자)');
  console.log(`\n현재 데이터로는: ${inspTotal}/${total} 형태로 표시해야 함`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
