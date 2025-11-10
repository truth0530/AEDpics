import { prisma } from '@/lib/prisma';

async function testOrgAPI() {
  try {
    console.log("Testing organization API logic...\n");

    const region = 'DAE';
    const includeAll = true;

    // Simulate the API query
    const organizationsWithAdmin = await prisma.organizations.findMany({
      where: {
        ...(region && {
          OR: [
            { region_code: region },
            { city_code: region }
          ]
        }),
        // includeAll이 true일 때는 모든 타입, false일 때는 health_center만
        ...(includeAll === false && {
          type: 'health_center'
        }),
        // includeAll이 false일 때만 local_admin 조건 추가
        ...(includeAll === false && {
          user_profiles: {
            some: {
              role: 'local_admin',
              is_active: true
            }
          }
        })
      },
      select: {
        id: true,
        name: true,
        region_code: true,
        city_code: true,
        type: true,
        _count: {
          select: {
            user_profiles: {
              where: {
                role: 'local_admin',
                is_active: true
              }
            }
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    // Format response
    const result = organizationsWithAdmin.map(org => ({
      id: org.id,
      name: org.name,
      region_code: org.region_code,
      city_code: org.city_code,
      type: org.type,
      adminCount: org._count.user_profiles,
      hasAdmin: org._count.user_profiles > 0
    }));

    console.log(`Request: GET /api/organizations/with-admin?region=${region}&includeAll=${includeAll}`);
    console.log(`\nResponse (${result.length} organizations):`);
    console.log(JSON.stringify({
      success: true,
      organizations: result,
      total: result.length,
      withoutAdmin: 0
    }, null, 2));

  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : String(error));
  } finally {
    await prisma.$disconnect();
  }
}

testOrgAPI();
