import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Check for Daegu users
  const daeguUsers = await prisma.user_profiles.findMany({
    where: {
      region_code: 'DAE'
    },
    include: {
      organizations: true
    },
    take: 5
  });

  console.log('=== Daegu Users ===');
  daeguUsers.forEach(user => {
    console.log({
      email: user.email,
      role: user.role,
      approval_status: user.approval_status,
      region: user.region_code,
      org_region: user.organizations?.region_code,
      city: user.organizations?.city_code
    });
  });

  // Check for master users
  const masterEmails = ['truth0530@nmc.or.kr', 'inhak@nmc.or.kr', 'woo@nmc.or.kr'];
  const masterUsers = await prisma.user_profiles.findMany({
    where: {
      email: {
        in: masterEmails
      }
    }
  });

  console.log('\n=== Master Users ===');
  masterUsers.forEach(user => {
    console.log({
      email: user.email,
      role: user.role,
      approval_status: user.approval_status
    });
  });

  // Check inspection count for Daegu
  const daeguInspections = await prisma.inspections.findMany({
    where: {
      aed_devices: {
        시도: { contains: '대구' }
      }
    },
    take: 5,
    select: {
      id: true,
      inspection_date: true,
      overall_status: true,
      aed_devices: {
        select: {
          시도: true,
          시군구: true,
          equipment_serial: true
        }
      }
    }
  });

  console.log('\n=== Daegu Inspections (sample) ===');
  console.log(`Found ${daeguInspections.length} inspections`);
  daeguInspections.forEach(insp => {
    console.log({
      date: insp.inspection_date,
      status: insp.overall_status,
      location: `${insp.aed_devices?.시도} ${insp.aed_devices?.시군구}`,
      serial: insp.aed_devices?.equipment_serial
    });
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
