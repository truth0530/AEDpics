import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== 대시보드 쿼리 디버깅 ===\n');

  // 1. 전체 inspection_schedule_entries 건수
  const totalSchedules = await prisma.inspection_schedule_entries.count();
  console.log(`전체 일정 건수: ${totalSchedules}건`);

  // 2. 대구 중구 일정 (실제 dashboard-queries.ts와 동일한 쿼리)
  const scheduleCounts = await prisma.$queryRaw<Array<{
    region: string;
    count: bigint;
    mandatory_count: bigint;
    non_mandatory_count: bigint;
  }>>`
    SELECT
      a.gugun as region,
      COUNT(DISTINCT s.id)::bigint as count,
      COUNT(DISTINCT CASE WHEN a.category_1 = '구비의무기관' THEN s.id END)::bigint as mandatory_count,
      COUNT(DISTINCT CASE WHEN a.category_1 != '구비의무기관' THEN s.id END)::bigint as non_mandatory_count
    FROM aedpics.inspection_schedule_entries s
    INNER JOIN aedpics.aed_data a ON s.device_equipment_serial = a.equipment_serial
    WHERE a.sido = '대구' AND a.gugun = '중구'
    GROUP BY a.gugun
  `;

  console.log('\n=== dashboard-queries.ts와 동일한 쿼리 결과 ===');
  if (scheduleCounts.length > 0) {
    scheduleCounts.forEach(row => {
      console.log(`${row.region}:`);
      console.log(`  전체: ${row.count}건`);
      console.log(`  의무: ${row.mandatory_count}건`);
      console.log(`  비의무: ${row.non_mandatory_count}건`);
    });
  } else {
    console.log('결과 없음');
  }

  // 3. inspection_schedule_entries의 샘플 데이터 확인
  const sampleSchedules = await prisma.inspection_schedule_entries.findMany({
    take: 5,
    select: {
      id: true,
      device_equipment_serial: true,
      scheduled_for: true,
      status: true
    }
  });

  console.log('\n=== inspection_schedule_entries 샘플 데이터 ===');
  for (const schedule of sampleSchedules) {
    const aed = await prisma.aed_data.findFirst({
      where: {
        equipment_serial: schedule.device_equipment_serial
      },
      select: {
        sido: true,
        gugun: true,
        category_1: true
      }
    });

    console.log(`ID: ${schedule.id}`);
    console.log(`  장비번호: ${schedule.device_equipment_serial}`);
    console.log(`  지역: ${aed?.sido} ${aed?.gugun}`);
    console.log(`  분류: ${aed?.category_1}`);
    console.log(`  상태: ${schedule.status}`);
    console.log('');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
