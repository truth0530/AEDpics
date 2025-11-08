#!/usr/bin/env npx tsx

/**
 * 최종 City Code 매핑 생성
 * 정확한 구군명 추출
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 복합 행정구역 패턴
const COMPOSITE_CITY_PATTERNS = [
  '수원시', '성남시', '고양시', '안산시', '안양시',
  '용인시', '청주시', '천안시', '전주시', '포항시',
  '창원시'
];

function extractGugun(orgName: string): string | null {
  if (!orgName) return null;

  // 복합 행정구역 패턴 (예: "수원시 영통구 보건소" -> "영통구")
  for (const city of COMPOSITE_CITY_PATTERNS) {
    const pattern = new RegExp(`${city}\\s*([가-힣]+구)`);
    const match = orgName.match(pattern);
    if (match) {
      return match[1];
    }
  }

  // 일반 구/군/시 패턴
  // 광역시 구 패턴 (예: "서울특별시 강남구 보건소" -> "강남구")
  const metropolitanPattern = /(?:서울특별시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시)\s*([가-힣]+구)/;
  const metropolitanMatch = orgName.match(metropolitanPattern);
  if (metropolitanMatch) {
    return metropolitanMatch[1];
  }

  // 도 시/군 패턴 (예: "경기도 화성시 보건소" -> "화성시")
  const provincePattern = /(?:경기도|강원도|강원특별자치도|충청북도|충청남도|전라북도|전북특별자치도|전라남도|경상북도|경상남도|제주도|제주특별자치도)\s*([가-힣]+(?:시|군))/;
  const provinceMatch = orgName.match(provincePattern);
  if (provinceMatch) {
    return provinceMatch[1];
  }

  // 세종특별자치시
  if (orgName.includes('세종특별자치시')) {
    return '세종특별자치시';
  }

  // 패턴 매칭 실패
  return null;
}

async function generateFinalMapping() {
  try {
    // 모든 조직 데이터 가져오기
    const orgs = await prisma.$queryRaw<
      Array<{ city_code: string; name: string; region_code: string }>
    >`
      SELECT city_code, name, region_code
      FROM organizations
      WHERE city_code IS NOT NULL
      ORDER BY region_code, city_code
    `;

    // city_code -> gugun 매핑
    const mapping = new Map<string, { gugun: string; examples: string[]; region: string }>();

    for (const org of orgs) {
      const gugun = extractGugun(org.name);

      if (!gugun) {
        console.error(`⚠️ 추출 실패: ${org.city_code} - ${org.name}`);
        continue;
      }

      if (mapping.has(org.city_code)) {
        const existing = mapping.get(org.city_code)!;
        if (existing.gugun !== gugun) {
          // 복합 행정구역 충돌 (예: changwon -> 여러 구)
          // 첫 번째 것만 사용
          if (!existing.examples.includes(org.name)) {
            existing.examples.push(org.name);
          }
        }
      } else {
        mapping.set(org.city_code, {
          gugun,
          examples: [org.name],
          region: org.region_code
        });
      }
    }

    // 특수 케이스 추가
    const specialCases: Array<[string, string, string]> = [
      // 특수 보건소
      ['namyangju_pungyang', '남양주시', 'GYE'],  // 풍양보건소
      ['hwaseong_dongtan', '화성시', 'GYE'],  // 동탄보건소
      ['gangseo_gadeok', '강서구', 'BUS'],  // 가덕보건소
      ['tongyeong_yokji', '통영시', 'GYN'],  // 욕지보건소

      // 청주시 구 (특수 형태)
      ['cheongju-sangdang', '상당구', 'CHB'],
      ['cheongju-seowon', '서원구', 'CHB'],
      ['cheongju-heungdeok', '흥덕구', 'CHB'],
      ['cheongju-cheongwon', '청원구', 'CHB'],
    ];

    for (const [code, gugun, region] of specialCases) {
      if (!mapping.has(code)) {
        mapping.set(code, {
          gugun,
          examples: [],
          region
        });
      }
    }

    // 출력
    console.log(`// 총 ${mapping.size}개 매핑\n`);
    console.log('export const CITY_CODE_TO_GUGUN_MAP: Record<string, string> = {');

    // 지역별로 그룹화
    const byRegion = new Map<string, Array<[string, string]>>();
    for (const [code, data] of mapping.entries()) {
      if (!byRegion.has(data.region)) {
        byRegion.set(data.region, []);
      }
      byRegion.get(data.region)!.push([code, data.gugun]);
    }

    // 지역 순서 및 이름
    const regionOrder = [
      'SEO', 'BUS', 'DAE', 'INC', 'GWA', 'DAJ', 'ULS', 'SEJ',
      'GYE', 'GAN', 'CHB', 'CHN', 'JEB', 'JEN', 'GYB', 'GYN', 'JEJ'
    ];

    const regionNames: Record<string, string> = {
      'SEO': '서울특별시',
      'BUS': '부산광역시',
      'DAE': '대구광역시',
      'INC': '인천광역시',
      'GWA': '광주광역시',
      'DAJ': '대전광역시',
      'ULS': '울산광역시',
      'SEJ': '세종특별자치시',
      'GYE': '경기도',
      'GAN': '강원특별자치도',
      'CHB': '충청북도',
      'CHN': '충청남도',
      'JEB': '전북특별자치도',
      'JEN': '전라남도',
      'GYB': '경상북도',
      'GYN': '경상남도',
      'JEJ': '제주특별자치도'
    };

    for (const region of regionOrder) {
      const items = byRegion.get(region);
      if (!items || items.length === 0) continue;

      console.log(`  // ${regionNames[region] || region}`);
      for (const [code, gugun] of items.sort((a, b) => a[0].localeCompare(b[0]))) {
        console.log(`  '${code}': '${gugun}',`);
      }
      console.log('');
    }

    console.log('};');

    console.log('\n// === 통계 ===');
    console.log(`// 총 ${mapping.size}개 city_code 매핑 생성`);

    // 복합 행정구역 충돌 확인
    const conflicts = new Map<string, Set<string>>();
    for (const org of orgs) {
      const gugun = extractGugun(org.name);
      if (gugun) {
        if (!conflicts.has(org.city_code)) {
          conflicts.set(org.city_code, new Set());
        }
        conflicts.get(org.city_code)!.add(gugun);
      }
    }

    const multiConflicts = Array.from(conflicts.entries())
      .filter(([_, guguns]) => guguns.size > 1);

    if (multiConflicts.length > 0) {
      console.log('\n// === 복합 행정구역 (세분화 필요) ===');
      for (const [code, guguns] of multiConflicts) {
        console.log(`// ${code}: ${Array.from(guguns).join(', ')}`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

generateFinalMapping().catch(console.error);