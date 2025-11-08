#!/usr/bin/env npx tsx

/**
 * City Code 매핑 자동 생성 스크립트
 * organization_name에서 구군명을 추출하여 city_code와 매핑
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 복합 행정구역 패턴 (시+구가 결합된 경우)
const COMPOSITE_PATTERNS = [
  // 수원시 구
  { pattern: /수원시\s*(권선|영통|장안|팔달)구/, extract: (match: RegExpMatchArray) => match[1] + '구' },
  // 성남시 구
  { pattern: /성남시\s*(분당|수정|중원)구/, extract: (match: RegExpMatchArray) => match[1] + '구' },
  // 고양시 구
  { pattern: /고양시\s*(덕양|일산동|일산서)구/, extract: (match: RegExpMatchArray) => match[1] + '구' },
  // 안산시 구
  { pattern: /안산시\s*(단원|상록)구/, extract: (match: RegExpMatchArray) => match[1] + '구' },
  // 안양시 구
  { pattern: /안양시\s*(동안|만안)구/, extract: (match: RegExpMatchArray) => match[1] + '구' },
  // 용인시 구
  { pattern: /용인시\s*(기흥|수지|처인)구/, extract: (match: RegExpMatchArray) => match[1] + '구' },
  // 청주시 구
  { pattern: /청주시\s*(상당|서원|흥덕|청원)구/, extract: (match: RegExpMatchArray) => match[1] + '구' },
  // 천안시 구
  { pattern: /천안시\s*(동남|서북)구/, extract: (match: RegExpMatchArray) => match[1] + '구' },
  // 전주시 구
  { pattern: /전주시\s*(완산|덕진)구/, extract: (match: RegExpMatchArray) => match[1] + '구' },
  // 포항시 구
  { pattern: /포항시\s*(남|북)구/, extract: (match: RegExpMatchArray) => match[1] + '구' },
  // 창원시 구
  { pattern: /창원시\s*(의창|성산|마산합포|마산회원|진해)구/, extract: (match: RegExpMatchArray) => match[1] + '구' },
];

// 일반 패턴 (구/군/시)
const GENERAL_PATTERN = /([가-힣]+(?:구|군|시))\s*(?:보건소|$)/;

function extractGugunFromOrgName(orgName: string): string | null {
  if (!orgName) return null;

  // 1. 복합 행정구역 패턴 먼저 체크
  for (const composite of COMPOSITE_PATTERNS) {
    const match = orgName.match(composite.pattern);
    if (match) {
      return composite.extract(match);
    }
  }

  // 2. 일반 패턴
  const match = orgName.match(GENERAL_PATTERN);
  if (match) {
    // "수원시", "성남시" 같은 상위 시는 제외 (구가 따로 있는 경우)
    const cityWithDistricts = ['수원시', '성남시', '고양시', '안산시', '안양시', '용인시', '청주시', '천안시', '전주시', '포항시', '창원시'];
    if (cityWithDistricts.includes(match[1])) {
      return null;
    }
    return match[1];
  }

  return null;
}

async function generateCityMapping() {
  console.log('=== City Code 매핑 자동 생성 ===\n');

  try {
    // 1. 모든 조직 데이터 가져오기
    const orgs = await prisma.organizations.findMany({
      where: {
        city_code: { not: null }
      },
      select: {
        name: true,
        city_code: true,
        region_code: true
      }
    });

    // 2. city_code -> gugun 매핑 생성
    const mapping: Map<string, { gugun: string; count: number; examples: string[] }> = new Map();

    for (const org of orgs) {
      if (!org.city_code) continue;

      const gugun = extractGugunFromOrgName(org.name);
      if (gugun) {
        const existing = mapping.get(org.city_code);
        if (existing) {
          if (existing.gugun === gugun) {
            existing.count++;
            if (existing.examples.length < 3) {
              existing.examples.push(org.name);
            }
          } else {
            console.log(`⚠️ 충돌: ${org.city_code} → ${existing.gugun} vs ${gugun} (${org.name})`);
          }
        } else {
          mapping.set(org.city_code, {
            gugun,
            count: 1,
            examples: [org.name]
          });
        }
      }
    }

    // 3. 기존 매핑과 비교
    const { CITY_CODE_TO_GUGUN_MAP } = await import('../lib/constants/regions');
    const existingKeys = new Set(Object.keys(CITY_CODE_TO_GUGUN_MAP));

    // 4. TypeScript 코드 생성
    console.log('\n=== 생성된 매핑 (lib/constants/regions.ts에 추가) ===\n');
    console.log('export const CITY_CODE_TO_GUGUN_MAP: Record<string, string> = {');

    // 기존 매핑 먼저
    console.log('  // === 기존 매핑 ===');
    for (const [code, gugun] of Object.entries(CITY_CODE_TO_GUGUN_MAP)) {
      console.log(`  '${code}': '${gugun}',`);
    }

    // 시도별로 그룹화하여 출력
    const byRegion = new Map<string, Array<[string, { gugun: string; count: number; examples: string[] }]>>();

    for (const [code, data] of mapping.entries()) {
      if (!existingKeys.has(code)) {
        // region_code 찾기
        const org = orgs.find(o => o.city_code === code);
        const region = org?.region_code || 'UNKNOWN';

        if (!byRegion.has(region)) {
          byRegion.set(region, []);
        }
        byRegion.get(region)!.push([code, data]);
      }
    }

    // 새로운 매핑
    console.log('\n  // === 자동 생성 매핑 ===');

    // 서울특별시
    if (byRegion.has('SEO')) {
      console.log('  // 서울특별시');
      for (const [code, data] of byRegion.get('SEO')!) {
        console.log(`  '${code}': '${data.gugun}',  // ${data.examples[0]}`);
      }
    }

    // 부산광역시
    if (byRegion.has('BUS')) {
      console.log('\n  // 부산광역시');
      for (const [code, data] of byRegion.get('BUS')!) {
        console.log(`  '${code}': '${data.gugun}',  // ${data.examples[0]}`);
      }
    }

    // 대구광역시
    if (byRegion.has('DAE')) {
      console.log('\n  // 대구광역시');
      for (const [code, data] of byRegion.get('DAE')!) {
        console.log(`  '${code}': '${data.gugun}',  // ${data.examples[0]}`);
      }
    }

    // 인천광역시
    if (byRegion.has('INC')) {
      console.log('\n  // 인천광역시');
      for (const [code, data] of byRegion.get('INC')!) {
        console.log(`  '${code}': '${data.gugun}',  // ${data.examples[0]}`);
      }
    }

    // 광주광역시
    if (byRegion.has('GWA')) {
      console.log('\n  // 광주광역시');
      for (const [code, data] of byRegion.get('GWA')!) {
        console.log(`  '${code}': '${data.gugun}',  // ${data.examples[0]}`);
      }
    }

    // 대전광역시
    if (byRegion.has('DAJ')) {
      console.log('\n  // 대전광역시');
      for (const [code, data] of byRegion.get('DAJ')!) {
        console.log(`  '${code}': '${data.gugun}',  // ${data.examples[0]}`);
      }
    }

    // 울산광역시
    if (byRegion.has('ULS')) {
      console.log('\n  // 울산광역시');
      for (const [code, data] of byRegion.get('ULS')!) {
        console.log(`  '${code}': '${data.gugun}',  // ${data.examples[0]}`);
      }
    }

    // 경기도
    if (byRegion.has('GYE')) {
      console.log('\n  // 경기도');
      for (const [code, data] of byRegion.get('GYE')!.sort((a, b) => a[0].localeCompare(b[0]))) {
        console.log(`  '${code}': '${data.gugun}',  // ${data.examples[0]}`);
      }
    }

    // 강원도
    if (byRegion.has('GAN')) {
      console.log('\n  // 강원특별자치도');
      for (const [code, data] of byRegion.get('GAN')!.sort((a, b) => a[0].localeCompare(b[0]))) {
        console.log(`  '${code}': '${data.gugun}',  // ${data.examples[0]}`);
      }
    }

    // 충청북도
    if (byRegion.has('CHB')) {
      console.log('\n  // 충청북도');
      for (const [code, data] of byRegion.get('CHB')!.sort((a, b) => a[0].localeCompare(b[0]))) {
        console.log(`  '${code}': '${data.gugun}',  // ${data.examples[0]}`);
      }
    }

    // 충청남도
    if (byRegion.has('CHN')) {
      console.log('\n  // 충청남도');
      for (const [code, data] of byRegion.get('CHN')!.sort((a, b) => a[0].localeCompare(b[0]))) {
        console.log(`  '${code}': '${data.gugun}',  // ${data.examples[0]}`);
      }
    }

    // 전라북도
    if (byRegion.has('JEB')) {
      console.log('\n  // 전북특별자치도');
      for (const [code, data] of byRegion.get('JEB')!.sort((a, b) => a[0].localeCompare(b[0]))) {
        console.log(`  '${code}': '${data.gugun}',  // ${data.examples[0]}`);
      }
    }

    // 전라남도
    if (byRegion.has('JEN')) {
      console.log('\n  // 전라남도');
      for (const [code, data] of byRegion.get('JEN')!.sort((a, b) => a[0].localeCompare(b[0]))) {
        console.log(`  '${code}': '${data.gugun}',  // ${data.examples[0]}`);
      }
    }

    // 경상북도
    if (byRegion.has('GYB')) {
      console.log('\n  // 경상북도');
      for (const [code, data] of byRegion.get('GYB')!.sort((a, b) => a[0].localeCompare(b[0]))) {
        console.log(`  '${code}': '${data.gugun}',  // ${data.examples[0]}`);
      }
    }

    // 경상남도
    if (byRegion.has('GYN')) {
      console.log('\n  // 경상남도');
      for (const [code, data] of byRegion.get('GYN')!.sort((a, b) => a[0].localeCompare(b[0]))) {
        console.log(`  '${code}': '${data.gugun}',  // ${data.examples[0]}`);
      }
    }

    // 제주도
    if (byRegion.has('JEJ')) {
      console.log('\n  // 제주특별자치도');
      for (const [code, data] of byRegion.get('JEJ')!.sort((a, b) => a[0].localeCompare(b[0]))) {
        console.log(`  '${code}': '${data.gugun}',  // ${data.examples[0]}`);
      }
    }

    console.log('};');

    console.log('\n=== 요약 ===');
    console.log(`기존 매핑: ${existingKeys.size}개`);
    console.log(`새로 생성된 매핑: ${mapping.size - existingKeys.size}개`);
    console.log(`총 매핑: ${mapping.size}개`);

    // 5. 매핑되지 않은 city_code 확인
    const unmapped = orgs
      .filter(org => org.city_code && !mapping.has(org.city_code) && !existingKeys.has(org.city_code))
      .map(org => ({ code: org.city_code, name: org.name }));

    if (unmapped.length > 0) {
      console.log('\n=== 매핑 실패 (수동 확인 필요) ===');
      for (const { code, name } of unmapped) {
        console.log(`'${code}': '???',  // ${name}`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

generateCityMapping().catch(console.error);