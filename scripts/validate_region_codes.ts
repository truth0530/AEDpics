/**
 * Region Code Mapping Validation Script
 * Checks sidoMap in API against actual region_code values in database
 */

import { prisma } from '@/lib/prisma';

async function validateRegionCodes() {
  console.log('========================================');
  console.log('Region Code Validation');
  console.log('========================================\n');

  // sidoMap from route.ts (updated 2025-11-07)
  const sidoMap: Record<string, string> = {
    'SEO': '서울특별시',      // Fixed: SEL -> SEO (중앙응급의료센터 코드)
    'BUS': '부산광역시',
    'DAE': '대구광역시',
    'INC': '인천광역시',
    'GWA': '광주광역시',
    'DAJ': '대전광역시',
    'ULS': '울산광역시',
    'SEJ': '세종특별자치시',
    'GYE': '경기도',           // Fixed: GYG -> GYE (경기도 정확한 코드)
    'GAN': '강원도',
    'CHB': '충청북도',
    'CHN': '충청남도',
    'JEB': '전라북도',
    'JEN': '전라남도',
    'GYB': '경상북도',
    'GYN': '경상남도',
    'JEJ': '제주특별자치도'
    // NOTE: KR (보건복지부/중앙)은 지역 필터링에서 제외됨 - 별도 처리
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
    console.log('Mismatch Analysis:');
    console.log('----------------------------------------');
    console.log('Expected mismatches (can be ignored):');
    console.log('  - CBN: 청주시상당보건소 조직명 (시도가 아닌 조직 고유 코드)');
    console.log('  - GYG: 안양시만안구 (레거시 코드, 데이터 정리 필요)');
    console.log('  - KR: 보건복지부 (국가 권한, 의도적으로 필터링 제외)');
    console.log('\nStatus:');
    if (!hasIssues) {
      console.log('✅ All valid region codes are matched');
    } else {
      const validCodes = Object.keys(sidoMap).length;
      const dbCodes = Array.from(regionCodes).length;
      console.log(`⚠️  Found mismatches (유효한 시도 코드 ${validCodes}개 중 대부분 일치)`);
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
