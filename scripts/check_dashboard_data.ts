import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. 대구 중구 inspections 건수 확인 (의무기관/비의무기관 구분)
  const daeguInspections = await prisma.$queryRaw<Array<{
    count: bigint;
    mandatory_count: bigint;
    non_mandatory_count: bigint;
  }>>`
    SELECT
      COUNT(DISTINCT i.id)::bigint as count,
      COUNT(DISTINCT CASE WHEN a.category_1 = '구비의무기관' THEN i.id END)::bigint as mandatory_count,
      COUNT(DISTINCT CASE WHEN a.category_1 != '구비의무기관' THEN i.id END)::bigint as non_mandatory_count
    FROM aedpics.inspections i
    INNER JOIN aedpics.aed_data a ON i.equipment_serial = a.equipment_serial
    WHERE a.sido = '대구' AND a.gugun = '중구'
  `;

  console.log('=== 대구 중구 점검 건수 ===');
  const daeguData = daeguInspections[0];
  if (daeguData) {
    console.log(`전체: ${daeguData.count}건`);
    console.log(`의무기관: ${daeguData.mandatory_count}건`);
    console.log(`비의무기관: ${daeguData.non_mandatory_count}건`);
  }

  // 2. 대구 전체 inspections 건수 확인
  const daeguAllInspections = await prisma.$queryRaw<Array<{
    gugun: string;
    count: bigint;
    mandatory_count: bigint;
    non_mandatory_count: bigint;
  }>>`
    SELECT
      a.gugun,
      COUNT(DISTINCT i.id)::bigint as count,
      COUNT(DISTINCT CASE WHEN a.category_1 = '구비의무기관' THEN i.id END)::bigint as mandatory_count,
      COUNT(DISTINCT CASE WHEN a.category_1 != '구비의무기관' THEN i.id END)::bigint as non_mandatory_count
    FROM aedpics.inspections i
    INNER JOIN aedpics.aed_data a ON i.equipment_serial = a.equipment_serial
    WHERE a.sido = '대구'
    GROUP BY a.gugun
    ORDER BY count DESC
  `;

  console.log('\n=== 대구 전체 점검 건수 (구군별) ===');
  daeguAllInspections.forEach(row => {
    console.log(`${row.gugun}: 전체 ${row.count}건, 의무 ${row.mandatory_count}건, 비의무 ${row.non_mandatory_count}건`);
  });

  // 3. inspection_schedule_entries 테이블 확인
  const scheduleCount = await prisma.inspection_schedule_entries.count();
  console.log(`\n=== inspection_schedule_entries 총 건수: ${scheduleCount}건 ===`);

  if (scheduleCount > 0) {
    const daeguSchedules = await prisma.$queryRaw<Array<{
      gugun: string;
      count: bigint;
      mandatory_count: bigint;
      non_mandatory_count: bigint;
    }>>`
      SELECT
        a.gugun,
        COUNT(DISTINCT s.id)::bigint as count,
        COUNT(DISTINCT CASE WHEN a.category_1 = '구비의무기관' THEN s.id END)::bigint as mandatory_count,
        COUNT(DISTINCT CASE WHEN a.category_1 != '구비의무기관' THEN s.id END)::bigint as non_mandatory_count
      FROM aedpics.inspection_schedule_entries s
      INNER JOIN aedpics.aed_data a ON s.equipment_serial = a.equipment_serial
      WHERE a.sido = '대구'
      GROUP BY a.gugun
      ORDER BY count DESC
    `;

    console.log('\n=== 대구 일정추가 건수 (구군별) ===');
    daeguSchedules.forEach(row => {
      console.log(`${row.gugun}: 전체 ${row.count}건, 의무 ${row.mandatory_count}건, 비의무 ${row.non_mandatory_count}건`);
    });
  } else {
    console.log('일정추가 데이터 없음 (inspection_schedule_entries 테이블 비어있음)');
  }

  // 4. 샘플 inspection 데이터 확인
  const sampleInspections = await prisma.inspections.findMany({
    include: {
      aed_data: {
        select: {
          sido: true,
          gugun: true,
          category_1: true,
          equipment_serial: true
        }
      }
    },
    take: 5
  });

  console.log('\n=== 샘플 Inspection 데이터 ===');
  sampleInspections.forEach(insp => {
    console.log({
      id: insp.id,
      location: `${insp.aed_data?.sido} ${insp.aed_data?.gugun}`,
      category: insp.aed_data?.category_1,
      serial: insp.equipment_serial,
      date: insp.inspection_date
    });
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
