/**
 * QA Test Script: Find AEDs with Mismatched Location/Jurisdiction
 *
 * Purpose: Identify AEDs where the physical location (sido/gugun) differs
 * from the managing jurisdiction_health_center for testing address vs jurisdiction
 * filtering modes.
 *
 * Usage: npx tsx scripts/qa-find-mismatched-aeds.ts
 */

import { prisma } from '@/lib/prisma';

async function findMismatchedAEDs() {
  console.log('==========================================');
  console.log('QA: Finding AEDs with Mismatched Location/Jurisdiction');
  console.log('==========================================\n');

  try {
    // Find AEDs where physical location differs from managing jurisdiction
    const mismatchedAEDs = await prisma.aed_data.findMany({
      where: {
        AND: [
          { jurisdiction_health_center: { not: null } },
          { sido: { not: null } },
          { gugun: { not: null } }
        ]
      },
      select: {
        id: true,
        equipment_serial: true,
        sido: true,
        gugun: true,
        installation_address: true,
        installation_institution: true,
        jurisdiction_health_center: true,
        last_inspection_date: true
      },
      take: 100 // Get first 100 for analysis
    });

    // Filter to only those with actual mismatches
    const actualMismatches = mismatchedAEDs.filter(aed => {
      // Extract sido from jurisdiction_health_center name
      // Example: "대구광역시 중구 보건소" -> "대구광역시"
      const jurisdictionSido = aed.jurisdiction_health_center?.split(' ')[0];

      // Check if physical location differs from jurisdiction
      return jurisdictionSido && jurisdictionSido !== aed.sido;
    });

    console.log(`Total AEDs checked: ${mismatchedAEDs.length}`);
    console.log(`AEDs with mismatched location/jurisdiction: ${actualMismatches.length}\n`);

    if (actualMismatches.length === 0) {
      console.log('No mismatched AEDs found. All AEDs have consistent location/jurisdiction.');
      return;
    }

    console.log('Sample Mismatched AEDs (first 10):\n');
    console.log('==========================================');

    const samples = actualMismatches.slice(0, 10);
    samples.forEach((aed, index) => {
      const jurisdictionSido = aed.jurisdiction_health_center?.split(' ')[0];
      const jurisdictionGugun = aed.jurisdiction_health_center?.split(' ')[1];

      console.log(`\n${index + 1}. Equipment Serial: ${aed.equipment_serial}`);
      console.log(`   Physical Location: ${aed.sido} ${aed.gugun}`);
      console.log(`   Managing Authority: ${aed.jurisdiction_health_center}`);
      console.log(`   (Located in ${aed.sido}, but managed by ${jurisdictionSido})`);
      console.log(`   Installation: ${aed.installation_institution || 'N/A'}`);
      console.log(`   Address: ${aed.installation_address || 'N/A'}`);
      console.log(`   Last Inspection: ${aed.last_inspection_date ? new Date(aed.last_inspection_date).toLocaleString('ko-KR') : 'Never'}`);
    });

    console.log('\n==========================================');
    console.log('QA Test Strategy:\n');
    console.log('1. Select a local_admin account from the managing health center');
    console.log('   Example: local_admin from "' + samples[0].jurisdiction_health_center + '"');
    console.log(`\n2. In "점검이력" (Inspection History) tab, test both modes:\n`);
    console.log(`   Mode A: "주소" (Address) - Should EXCLUDE this AED`);
    console.log(`           (because it\'s located in ${samples[0].sido}, not the health center\'s region)\n`);
    console.log(`   Mode B: "관할보건소" (Jurisdiction) - Should INCLUDE this AED`);
    console.log(`           (because the health center manages it)\n`);

    console.log('3. Expected Results:');
    console.log('   - Address mode: Equipment not listed (location mismatch)');
    console.log('   - Jurisdiction mode: Equipment listed (managed by health center)');
    console.log('   - Result count difference proves two modes work independently\n');

    console.log('4. Verify in PM2 logs:');
    console.log('   pm2 logs app --lines 50 | grep "mode:"');
    console.log('   Should show alternating "mode: address" and "mode: jurisdiction" entries\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findMismatchedAEDs();
