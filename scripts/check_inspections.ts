import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Check total inspections
  const totalInspections = await prisma.inspections.count();
  console.log(`=== Total Inspections: ${totalInspections} ===\n`);

  // Check inspections with aed_data relation
  const inspections = await prisma.inspections.findMany({
    include: {
      aed_data: {
        select: {
          sido: true,
          gugun: true,
          equipment_serial: true,
          jurisdiction_health_center: true
        }
      }
    }
  });

  console.log(`=== All Inspections (${inspections.length}) ===`);
  inspections.forEach(insp => {
    console.log({
      id: insp.id,
      date: insp.inspection_date,
      status: insp.overall_status,
      location: insp.aed_data ? `${insp.aed_data.sido} ${insp.aed_data.gugun}` : 'No location',
      serial: insp.equipment_serial
    });
  });

  // Check Daegu inspections
  const daeguAEDs = await prisma.aed_data.findMany({
    where: {
      sido: { contains: '대구' },
      gugun: { contains: '중구' }
    },
    select: {
      equipment_serial: true
    }
  });

  console.log(`\n=== Daegu Jung-gu AED Count: ${daeguAEDs.length} ===`);

  if (daeguAEDs.length > 0) {
    const daeguSerials = daeguAEDs.map(aed => aed.equipment_serial);
    const daeguInspections = await prisma.inspections.findMany({
      where: {
        equipment_serial: { in: daeguSerials }
      },
      include: {
        aed_data: {
          select: {
            sido: true,
            gugun: true
          }
        }
      }
    });

    console.log(`=== Daegu Jung-gu Inspections: ${daeguInspections.length} ===`);
    daeguInspections.forEach(insp => {
      console.log({
        date: insp.inspection_date,
        status: insp.overall_status,
        location: insp.aed_data ? `${insp.aed_data.sido} ${insp.aed_data.gugun}` : 'Unknown',
        serial: insp.equipment_serial
      });
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
