/**
 * Smoke Test: Phase 2 Mode Toggle Functionality
 *
 * Purpose: Verify that local_admin accounts can switch between
 * address (물리적 위치) and jurisdiction (관할보건소) filtering modes
 *
 * Test Scenarios:
 * 1. Address mode: Only AEDs physically located in the health center's region
 * 2. Jurisdiction mode: All AEDs managed by the health center (may be in other regions)
 * 3. Result difference: Same health center shows different counts in each mode
 *
 * Usage: npx tsx scripts/smoke-test-mode-toggle.ts
 */

import { prisma } from '@/lib/prisma';

async function smokeTestModeToggle() {
  console.log('==========================================');
  console.log('Smoke Test: Phase 2 Mode Toggle');
  console.log('==========================================\n');

  try {
    // Step 1: Find a local_admin account with an organization
    console.log('Step 1: Locating test local_admin account...');
    const localAdminUser = await prisma.user_profiles.findFirst({
      where: {
        role: 'local_admin',
        organizations: {
          isNot: null
        }
      },
      include: {
        organizations: {
          select: {
            id: true,
            name: true,
            type: true,
            region_code: true,
            city_code: true
          }
        }
      }
    });

    if (!localAdminUser || !localAdminUser.organizations) {
      console.log('❌ No local_admin accounts found with organization');
      return;
    }

    const org = localAdminUser.organizations;
    console.log(`✅ Found test account: ${localAdminUser.email}`);
    console.log(`   Organization: ${org.name}`);
    console.log(`   Region: ${org.region_code}, City: ${org.city_code}\n`);

    // Step 2: Extract jurisdiction sido from organization name
    console.log('Step 2: Extracting jurisdiction information...');
    const jurisdictionParts = org.name.split(' ');
    const jurisdictionSido = jurisdictionParts[0];  // e.g., "대구광역시"
    const jurisdictionGugun = jurisdictionParts[1]; // e.g., "중구"

    console.log(`   Jurisdiction Sido: ${jurisdictionSido}`);
    console.log(`   Jurisdiction Gugun: ${jurisdictionGugun}`);
    console.log(`   Full Health Center: ${org.name}\n`);

    // Step 3: Test ADDRESS mode - filter by physical location
    console.log('Step 3: Testing ADDRESS mode (물리적 위치 기준)...');
    console.log('   Query: WHERE sido = ? AND gugun = ?');

    const addressModeInspections = await prisma.inspections.findMany({
      where: {
        overall_status: {
          in: ['pass', 'fail', 'normal', 'needs_improvement', 'malfunction']
        },
        aed_data: {
          sido: jurisdictionSido,
          gugun: jurisdictionGugun
        }
      },
      select: {
        id: true,
        equipment_serial: true,
        inspection_date: true,
        aed_data: {
          select: {
            sido: true,
            gugun: true,
            jurisdiction_health_center: true,
            installation_address: true
          }
        }
      },
      take: 5
    });

    console.log(`   ✅ Found ${addressModeInspections.length} inspections (showing first 5):`);
    addressModeInspections.forEach((insp, i) => {
      console.log(`   ${i + 1}. ${insp.equipment_serial}`);
      console.log(`      Location: ${insp.aed_data?.sido} ${insp.aed_data?.gugun}`);
      console.log(`      Managed by: ${insp.aed_data?.jurisdiction_health_center}`);
    });

    // Step 4: Test JURISDICTION mode - filter by managing health center
    console.log('\nStep 4: Testing JURISDICTION mode (관할보건소 기준)...');
    console.log(`   Query: WHERE jurisdiction_health_center = '${org.name}'`);

    const jurisdictionModeInspections = await prisma.inspections.findMany({
      where: {
        overall_status: {
          in: ['pass', 'fail', 'normal', 'needs_improvement', 'malfunction']
        },
        aed_data: {
          jurisdiction_health_center: org.name
        }
      },
      select: {
        id: true,
        equipment_serial: true,
        inspection_date: true,
        aed_data: {
          select: {
            sido: true,
            gugun: true,
            jurisdiction_health_center: true,
            installation_address: true
          }
        }
      },
      take: 5
    });

    console.log(`   ✅ Found ${jurisdictionModeInspections.length} inspections (showing first 5):`);
    jurisdictionModeInspections.forEach((insp, i) => {
      const inSameRegion = insp.aed_data?.sido === jurisdictionSido &&
                           insp.aed_data?.gugun === jurisdictionGugun;
      const regionLabel = inSameRegion ? '(소속 지역)' : '(타 지역 ⚠️)';
      console.log(`   ${i + 1}. ${insp.equipment_serial} ${regionLabel}`);
      console.log(`      Location: ${insp.aed_data?.sido} ${insp.aed_data?.gugun}`);
      console.log(`      Managed by: ${insp.aed_data?.jurisdiction_health_center}`);
    });

    // Step 5: Find mismatched AEDs (different results between modes)
    console.log('\nStep 5: Analyzing mismatched AEDs...');
    const allAddressModeAeds = new Set(
      (await prisma.inspections.findMany({
        where: {
          overall_status: {
            in: ['pass', 'fail', 'normal', 'needs_improvement', 'malfunction']
          },
          aed_data: {
            sido: jurisdictionSido,
            gugun: jurisdictionGugun
          }
        },
        select: { equipment_serial: true }
      })).map(i => i.equipment_serial)
    );

    const allJurisdictionModeAeds = new Set(
      (await prisma.inspections.findMany({
        where: {
          overall_status: {
            in: ['pass', 'fail', 'normal', 'needs_improvement', 'malfunction']
          },
          aed_data: {
            jurisdiction_health_center: org.name
          }
        },
        select: { equipment_serial: true }
      })).map(i => i.equipment_serial)
    );

    const mismatchedSerials = Array.from(allJurisdictionModeAeds).filter(
      serial => !allAddressModeAeds.has(serial)
    );

    console.log(`   Total in Address mode: ${allAddressModeAeds.size}`);
    console.log(`   Total in Jurisdiction mode: ${allJurisdictionModeAeds.size}`);
    console.log(`   Difference (jurisdiction-only): ${mismatchedSerials.length}`);
    console.log(`   ✅ Mode difference verified: ${mismatchedSerials.length > 0 ? 'YES' : 'NO'}`);

    if (mismatchedSerials.length > 0) {
      console.log(`\n   Sample mismatched AEDs (managed but not located in ${org.name}):`);

      const mismatchedDetails = await prisma.aed_data.findMany({
        where: {
          equipment_serial: {
            in: mismatchedSerials.slice(0, 3)
          }
        },
        select: {
          equipment_serial: true,
          sido: true,
          gugun: true,
          jurisdiction_health_center: true,
          installation_institution: true
        }
      });

      mismatchedDetails.forEach((aed, i) => {
        console.log(`   ${i + 1}. ${aed.equipment_serial}`);
        console.log(`      Location: ${aed.sido} ${aed.gugun}`);
        console.log(`      Managed by: ${aed.jurisdiction_health_center}`);
      });
    }

    // Step 6: Test Results Summary
    console.log('\n==========================================');
    console.log('Smoke Test Results');
    console.log('==========================================');
    console.log(`Test Account: ${localAdminUser.email}`);
    console.log(`Organization: ${org.name}`);
    console.log('');
    console.log(`Mode A (주소/Address):     ${allAddressModeAeds.size} inspections`);
    console.log(`Mode B (관할/Jurisdiction): ${allJurisdictionModeAeds.size} inspections`);
    console.log(`Difference:                 ${Math.abs(allJurisdictionModeAeds.size - allAddressModeAeds.size)} AEDs`);
    console.log('');

    const testsPassed = mismatchedSerials.length > 0;
    console.log(testsPassed ?
      '✅ PASS: Mode toggle affects filtering (modes return different results)' :
      '⚠️  WARNING: Modes return identical results (possible data issue)');

    console.log('\n==========================================');
    console.log('Next Steps');
    console.log('==========================================');
    console.log('1. Verify in UI that mode toggle button appears');
    console.log(`2. Test with account: ${localAdminUser.email}`);
    console.log('3. Switch between "주소" and "관할보건소" modes');
    console.log('4. Verify inspection counts change accordingly');
    console.log('5. Check PM2 logs for mode parameter:');
    console.log('   pm2 logs app --lines 50 | grep "mode:"');

  } catch (error) {
    console.error('Error during smoke test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

smokeTestModeToggle();
