import { prisma } from '@/lib/prisma';

async function checkOrganizations() {
  try {
    const totalOrgs = await prisma.organizations.count();
    console.log(`Total organizations: ${totalOrgs}`);

    const daeOrgs = await prisma.organizations.findMany({
      where: {
        OR: [
          { region_code: 'DAE' },
          { city_code: 'DAE' }
        ]
      },
      select: {
        id: true,
        name: true,
        region_code: true,
        city_code: true,
        type: true
      }
    });

    console.log(`Organizations in DAE region: ${daeOrgs.length}`);
    if (daeOrgs.length > 0) {
      console.log("First 5 organizations:");
      daeOrgs.slice(0, 5).forEach(org => {
        console.log(`  - ${org.name} (${org.id})`);
      });
    }

    // Check all region codes available
    const allCodes = await prisma.organizations.findMany({
      select: {
        region_code: true
      },
      distinct: ['region_code']
    });
    const codes = allCodes.map(c => c.region_code).filter(Boolean).join(', ');
    console.log(`Available region codes: ${codes}`);

  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : String(error));
  } finally {
    await prisma.$disconnect();
  }
}

checkOrganizations();
