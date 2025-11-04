const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkTodayInspections() {
  try {
    // 오늘 날짜 (KST 기준)
    const kstOffset = 9 * 60 * 60 * 1000;
    const now = new Date();
    const kstNow = new Date(now.getTime() + kstOffset);
    const todayStart = new Date(kstNow.getFullYear(), kstNow.getMonth(), kstNow.getDate());
    const todayStartUTC = new Date(todayStart.getTime() - kstOffset);

    console.log('=== Today\'s Inspections (KST 2025-11-04) ===');
    console.log(`Query Start Time (UTC): ${todayStartUTC.toISOString()}`);
    console.log(`Current Time (KST): ${kstNow.toISOString()}\n`);

    const inspections = await prisma.inspections.findMany({
      where: {
        created_at: {
          gte: todayStartUTC
        }
      },
      orderBy: {
        created_at: 'desc'
      },
      select: {
        id: true,
        equipment_serial: true,
        inspection_date: true,
        created_at: true,
        aed_data: {
          select: {
            sido: true,
            gugun: true
          }
        }
      }
    });

    console.log(`Total inspections found: ${inspections.length}\n`);

    inspections.forEach((inspection, index) => {
      const createdTime = new Date(inspection.created_at);
      const kstTime = new Date(createdTime.getTime() + kstOffset);
      const hour = kstTime.getUTCHours();

      console.log(`${index + 1}. ID: ${inspection.id}`);
      console.log(`   Serial: ${inspection.equipment_serial}`);
      console.log(`   Created UTC: ${createdTime.toISOString()}`);
      console.log(`   Created KST: ${kstTime.toISOString()}`);
      console.log(`   Hour: ${hour}시`);
      console.log(`   Inspection Date: ${inspection.inspection_date}`);
      console.log(`   Location: ${inspection.aed_data?.sido || 'N/A'} ${inspection.aed_data?.gugun || 'N/A'}`);
      console.log('');
    });

    // 시간대별 집계
    const hourlyCount = {};
    inspections.forEach(inspection => {
      const createdTime = new Date(inspection.created_at);
      const kstTime = new Date(createdTime.getTime() + kstOffset);
      const hour = kstTime.getUTCHours();
      hourlyCount[hour] = (hourlyCount[hour] || 0) + 1;
    });

    console.log('=== Hourly Summary ===');
    Object.keys(hourlyCount).sort((a, b) => a - b).forEach(hour => {
      console.log(`${hour}시: ${hourlyCount[hour]}건`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTodayInspections();
