import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const serials = ['13-0173897', '13-0174692', '13-0174693'];

console.log('Checking equipment serials in aed_data table...');

const result = await prisma.aed_data.findMany({
  where: {
    equipment_serial: { in: serials }
  },
  select: {
    equipment_serial: true,
    management_number: true,
    installation_institution: true,
    installation_location_address: true
  }
});

console.log('\n=== RESULT ===');
console.log('Found:', result.length, 'records');
console.log(JSON.stringify(result, null, 2));

await prisma.$disconnect();
