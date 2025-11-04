const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // 대구 지역 AED의 일정 추가 건수
  const count = await prisma.inspection_schedule_entries.count({
    where: {
      aed_data: {
        sido: '대구광역시'
      }
    }
  });

  console.log(`\n대구 지역 일정 추가 총 건수: ${count}건\n`);

  const schedules = await prisma.inspection_schedule_entries.findMany({
    where: {
      aed_data: {
        sido: '대구광역시'
      }
    },
    select: {
      id: true,
      device_equipment_serial: true,
      scheduled_for: true,
      status: true,
      aed_data: {
        select: {
          sido: true,
          gugun: true,
          installation_location: true
        }
      }
    },
    take: 5,
    orderBy: {
      created_at: 'desc'
    }
  });

  console.log('최근 추가된 일정 5건:\n');

  schedules.forEach((s, idx) => {
    console.log(`${idx + 1}. ${s.aed_data.gugun} - ${s.aed_data.installation_location}`);
    console.log(`   Serial: ${s.device_equipment_serial}`);
    console.log(`   예정일: ${s.scheduled_for}`);
    console.log(`   상태: ${s.status}\n`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
