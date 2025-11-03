import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. inspection_schedule_entries 테이블 구조 확인
  console.log('=== inspection_schedule_entries 테이블 샘플 ===');
  const schedules = await prisma.inspection_schedule_entries.findMany({
    take: 5,
    include: {
      aed_data: {
        select: {
          sido: true,
          gugun: true,
          category_1: true,
          equipment_serial: true
        }
      }
    }
  });
  
  console.log(`총 ${schedules.length}건`);
  schedules.forEach(s => {
    console.log({
      id: s.id,
      equipment_serial: s.equipment_serial,
      scheduled_date: s.scheduled_date,
      status: s.status,
      location: `${s.aed_data?.sido} ${s.aed_data?.gugun}`
    });
  });

  // 2. inspections와 schedule의 관계 확인
  console.log('\n=== Inspections 샘플 (schedule 연결 여부) ===');
  const inspections = await prisma.inspections.findMany({
    take: 5,
    select: {
      id: true,
      equipment_serial: true,
      inspection_date: true,
      overall_status: true,
      aed_data: {
        select: {
          sido: true,
          gugun: true
        }
      }
    }
  });

  for (const insp of inspections) {
    // 이 inspection에 대응하는 schedule이 있는지 확인
    const relatedSchedule = await prisma.inspection_schedule_entries.findFirst({
      where: {
        equipment_serial: insp.equipment_serial,
        // scheduled_date가 inspection_date와 비슷한지 확인할 수도 있음
      }
    });

    console.log({
      inspection_id: insp.id,
      equipment_serial: insp.equipment_serial,
      inspection_date: insp.inspection_date,
      location: `${insp.aed_data?.sido} ${insp.aed_data?.gugun}`,
      has_schedule: !!relatedSchedule
    });
  }

  // 3. 대구 데이터 확인
  console.log('\n=== 대구 데이터 요약 ===');
  const daeguSchedules = await prisma.inspection_schedule_entries.count({
    where: {
      aed_data: {
        sido: '대구'
      }
    }
  });

  const daeguInspections = await prisma.inspections.count({
    where: {
      aed_data: {
        sido: '대구'
      }
    }
  });

  console.log(`일정추가: ${daeguSchedules}건`);
  console.log(`현장점검: ${daeguInspections}건`);
  console.log(`\n사용자 요구사항: 현장점검 분모 = 일정추가 분자`);
  console.log(`즉: ${daeguInspections}/${daeguSchedules} 형태로 표시`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
