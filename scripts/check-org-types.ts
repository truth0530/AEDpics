import { prisma } from '@/lib/prisma';

async function checkOrganizationTypes() {
  try {
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
        type: true,
        region_code: true,
        city_code: true
      }
    });

    console.log("Organizations in DAE region:");
    console.log("================================");
    const typeGroups: Record<string, typeof daeOrgs> = {};
    daeOrgs.forEach(org => {
      if (!typeGroups[org.type]) {
        typeGroups[org.type] = [];
      }
      typeGroups[org.type].push(org);
    });

    for (const [type, orgs] of Object.entries(typeGroups)) {
      console.log(`\nType: "${type}" (${orgs.length} organizations)`);
      orgs.forEach(org => {
        console.log(`  - ${org.name}`);
      });
    }

  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : String(error));
  } finally {
    await prisma.$disconnect();
  }
}

checkOrganizationTypes();
