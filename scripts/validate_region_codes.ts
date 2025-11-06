/**
 * Region Code Mapping Validation Script
 * Checks sidoMap in API against actual region_code values in database
 */

import { prisma } from '@/lib/prisma';

async function validateRegionCodes() {
  console.log('========================================');
  console.log('Region Code Validation');
  console.log('========================================\n');

  // sidoMap from route.ts
  const sidoMap: Record<string, string> = {
    'SEL': '서울특별시',
    'BUS': '부산광역시',
    'DAE': '대구광역시',
    'INC': '인천광역시',
    'GWA': '광주광역시',
    'DAJ': '대전광역시',
    'ULS': '울산광역시',
    'SEJ': '세종특별자치시',
    'GYG': '경기도',
    'GAN': '강원도',
    'CHB': '충청북도',
    'CHN': '충청남도',
    'JEB': '전라북도',
    'JEN': '전라남도',
    'GYB': '경상북도',
    'GYN': '경상남도',
    'JEJ': '제주특별자치도'
  };

  console.log('sidoMap from API route.ts:');
  console.log('Region codes:', Object.keys(sidoMap).join(', '));
  console.log('\n');

  // Get actual region_codes from database
  try {
    const organizations = await prisma.organizations.findMany({
      where: {
        region_code: {
          not: null
        }
      },
      select: {
        region_code: true,
        name: true
      }
    });

    const regionCodes = new Set<string>();
    const samples: Record<string, string> = {};
    
    organizations.forEach(org => {
      if (org.region_code) {
        regionCodes.add(org.region_code);
        if (!samples[org.region_code]) {
          samples[org.region_code] = org.name;
        }
      }
    });

    console.log('Actual region_codes in database:');
    const sortedCodes = Array.from(regionCodes).sort();
    console.log(sortedCodes.join(', '));
    console.log(`\nTotal unique codes: ${regionCodes.size}`);
    console.log('\n');

    // Check for mismatches
    console.log('Validation Results:');
    console.log('----------------------------------------');
    let hasIssues = false;

    sortedCodes.forEach(code => {
      if (!sidoMap[code]) {
        console.log(`⚠️  WARNING: Code "${code}" in database but NOT in sidoMap`);
        hasIssues = true;
      } else {
        console.log(`✅ Code "${code}" -> "${sidoMap[code]}"`);
      }
    });

    // Check for unused mappings in sidoMap
    Object.keys(sidoMap).forEach(code => {
      if (!regionCodes.has(code)) {
        console.log(`⚠️  WARNING: Code "${code}" in sidoMap but NOT in database`);
        hasIssues = true;
      }
    });

    console.log('\n========================================');
    if (!hasIssues) {
      console.log('✅ All region codes are valid');
    } else {
      console.log('❌ Found region code mismatches');
    }
    console.log('========================================\n');

    // Show sample organizations for each region code
    console.log('Sample organizations by region code:');
    console.log('----------------------------------------');
    for (const code of sortedCodes) {
      if (samples[code]) {
        console.log(`${code}: ${samples[code]}`);
      }
    }

  } catch (error) {
    console.error('Error validating region codes:', error);
  }

  await prisma.$disconnect();
}

validateRegionCodes();
