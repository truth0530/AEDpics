#!/usr/bin/env npx tsx

/**
 * 통합 City Code 매핑 관리 도구
 * 모든 지역 매핑 작업을 lib/constants/regions.ts 기반으로 통합
 *
 * 사용법:
 * - 검증: npx tsx scripts/unified-city-mapping.ts validate
 * - 수정: npx tsx scripts/unified-city-mapping.ts fix
 * - 통계: npx tsx scripts/unified-city-mapping.ts stats
 * - 매핑 생성: npx tsx scripts/unified-city-mapping.ts generate
 */

import { PrismaClient } from '@prisma/client';
import {
  mapCityCodeToGugun,
  mapGugunToCityCode,
  CITY_CODE_TO_GUGUN_MAP,
  normalizeJurisdictionName,
  extractRegionFromOrgName,
  REGIONS
} from '@/lib/constants/regions';

const prisma = new PrismaClient();

// 명령 타입
type Command = 'validate' | 'fix' | 'stats' | 'generate' | 'help';

// 실행 결과 타입
interface ExecutionResult {
  success: boolean;
  message: string;
  data?: any;
}

// 조직 타입
interface Organization {
  id: string;
  name: string;
  region_code?: string | null;
  city_code?: string | null;
  type: string;
  address?: string | null;
}

// 검증 함수
async function validateCityCodes(): Promise<ExecutionResult> {
  console.log('=== City Code 검증 시작 ===\n');

  try {
    const organizations = await prisma.organizations.findMany({
      where: { type: 'health_center' },
      orderBy: { name: 'asc' }
    });

    const validCodes = Object.keys(CITY_CODE_TO_GUGUN_MAP);
    const issues: Array<{
      org: Organization;
      issue: string;
      suggestion?: string;
    }> = [];

    for (const org of organizations) {
      if (!org.city_code) {
        const extracted = extractRegionFromOrgName(org.name);
        const suggestedCode = extracted ? mapGugunToCityCode(extracted) : null;

        issues.push({
          org,
          issue: 'city_code 누락',
          suggestion: suggestedCode || undefined
        });
      } else if (!validCodes.includes(org.city_code)) {
        issues.push({
          org,
          issue: `유효하지 않은 city_code: ${org.city_code}`
        });
      }
    }

    // 결과 출력
    console.log(`총 ${organizations.length}개 조직 검사 완료\n`);
    console.log(`✅ 정상: ${organizations.length - issues.length}개`);
    console.log(`❌ 문제: ${issues.length}개\n`);

    if (issues.length > 0) {
      console.log('=== 발견된 문제 ===\n');
      for (const { org, issue, suggestion } of issues) {
        console.log(`- ${org.name}`);
        console.log(`  문제: ${issue}`);
        if (suggestion) {
          console.log(`  제안: city_code를 '${suggestion}'로 설정`);
        }
        console.log('');
      }
    }

    return {
      success: true,
      message: `검증 완료: ${issues.length}개 문제 발견`,
      data: { total: organizations.length, issues: issues.length }
    };
  } catch (error) {
    return {
      success: false,
      message: `검증 실패: ${error}`
    };
  }
}

// 수정 함수
async function fixCityCodes(): Promise<ExecutionResult> {
  console.log('=== City Code 자동 수정 ===\n');

  try {
    const organizations = await prisma.organizations.findMany({
      where: {
        type: 'health_center',
        city_code: null
      }
    });

    let fixCount = 0;

    for (const org of organizations) {
      const extracted = extractRegionFromOrgName(org.name);
      const suggestedCode = extracted ? mapGugunToCityCode(extracted) : null;

      if (suggestedCode) {
        await prisma.organizations.update({
          where: { id: org.id },
          data: { city_code: suggestedCode }
        });

        console.log(`✅ ${org.name}: city_code를 '${suggestedCode}'로 설정`);
        fixCount++;
      } else {
        console.log(`⚠️  ${org.name}: 자동 추출 실패 (수동 확인 필요)`);
      }
    }

    return {
      success: true,
      message: `수정 완료: ${fixCount}개 조직 수정됨`,
      data: { fixed: fixCount, total: organizations.length }
    };
  } catch (error) {
    return {
      success: false,
      message: `수정 실패: ${error}`
    };
  }
}

// 통계 함수
async function generateStats(): Promise<ExecutionResult> {
  console.log('=== City Code 통계 ===\n');

  try {
    const organizations = await prisma.organizations.findMany({
      where: { type: 'health_center' }
    });

    // city_code별 집계
    const codeStats = new Map<string, number>();
    let nullCount = 0;

    for (const org of organizations) {
      const code = org.city_code || '(없음)';
      if (!org.city_code) nullCount++;
      codeStats.set(code, (codeStats.get(code) || 0) + 1);
    }

    // 시도별 집계
    const regionStats = new Map<string, number>();
    for (const org of organizations) {
      const region = org.region_code || '(없음)';
      regionStats.set(region, (regionStats.get(region) || 0) + 1);
    }

    // 출력
    console.log(`📊 전체 보건소: ${organizations.length}개\n`);

    console.log('=== City Code 사용 현황 (상위 10개) ===');
    const sortedCodes = Array.from(codeStats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    for (const [code, count] of sortedCodes) {
      const gugun = code !== '(없음)' ? mapCityCodeToGugun(code) || '(알 수 없음)' : '';
      const isValid = code === '(없음)' || Object.keys(CITY_CODE_TO_GUGUN_MAP).includes(code);
      const status = isValid ? '✅' : '❌';
      console.log(`${status} ${code.padEnd(20)} : ${count}개 ${gugun}`);
    }

    console.log('\n=== 시도별 보건소 현황 ===');
    const sortedRegions = Array.from(regionStats.entries())
      .sort((a, b) => b[1] - a[1]);

    for (const [regionCode, count] of sortedRegions) {
      try {
        // null/undefined 체크 및 문자열 변환
        const code = regionCode || '(없음)';
        if (code === '(없음)') {
          console.log(`(없음) (region_code 누락)   : ${count}개`);
          continue;
        }

        const region = REGIONS.find(r => r.code === code);
        const regionName = region ? region.name : `(알 수 없음: ${code})`;

        console.log(`${code.padEnd(5)} ${regionName.padEnd(20)} : ${count}개`);
      } catch (innerError) {
        console.error(`에러 발생 (regionCode=${regionCode}, count=${count}):`, innerError);
      }
    }

    console.log('\n=== 요약 ===');
    console.log(`✅ city_code 있음: ${organizations.length - nullCount}개`);
    console.log(`❌ city_code 없음: ${nullCount}개`);
    console.log(`📍 고유 city_code: ${codeStats.size}개`);

    return {
      success: true,
      message: '통계 생성 완료',
      data: {
        total: organizations.length,
        withCityCode: organizations.length - nullCount,
        withoutCityCode: nullCount,
        uniqueCodes: codeStats.size
      }
    };
  } catch (error) {
    return {
      success: false,
      message: `통계 생성 실패: ${error}`
    };
  }
}

// 매핑 생성 함수
async function generateMapping(): Promise<ExecutionResult> {
  console.log('=== City Code 매핑 생성 ===\n');

  try {
    const organizations = await prisma.organizations.findMany({
      where: { type: 'health_center' },
      select: {
        name: true,
        city_code: true,
        region_code: true
      },
      orderBy: { city_code: 'asc' }
    });

    // 매핑 생성
    const mapping = new Map<string, Set<string>>();

    for (const org of organizations) {
      if (org.city_code) {
        if (!mapping.has(org.city_code)) {
          mapping.set(org.city_code, new Set());
        }
        mapping.get(org.city_code)!.add(org.name);
      }
    }

    // 출력
    console.log('// 자동 생성된 City Code → 조직명 매핑');
    console.log('// 기준: lib/constants/regions.ts의 CITY_CODE_TO_GUGUN_MAP\n');
    console.log('export const CITY_CODE_TO_ORGANIZATIONS = {');

    for (const [code, orgNames] of Array.from(mapping.entries()).sort()) {
      const gugun = mapCityCodeToGugun(code);
      console.log(`  // ${gugun || '알 수 없음'}`);
      console.log(`  '${code}': [`);
      for (const name of Array.from(orgNames).sort()) {
        console.log(`    '${name}',`);
      }
      console.log(`  ],`);
    }

    console.log('};\n');
    console.log(`// 총 ${mapping.size}개 city_code, ${organizations.length}개 조직`);

    return {
      success: true,
      message: `매핑 생성 완료: ${mapping.size}개 코드`,
      data: { codes: mapping.size, organizations: organizations.length }
    };
  } catch (error) {
    return {
      success: false,
      message: `매핑 생성 실패: ${error}`
    };
  }
}

// 도움말
function showHelp(): ExecutionResult {
  console.log('=== 통합 City Code 매핑 관리 도구 ===\n');
  console.log('사용법: npx tsx scripts/unified-city-mapping.ts [명령]\n');
  console.log('명령:');
  console.log('  validate  - city_code 유효성 검증');
  console.log('  fix       - 누락된 city_code 자동 수정');
  console.log('  stats     - city_code 사용 통계');
  console.log('  generate  - city_code 매핑 파일 생성');
  console.log('  help      - 도움말 표시\n');
  console.log('예시:');
  console.log('  npx tsx scripts/unified-city-mapping.ts validate');
  console.log('  npx tsx scripts/unified-city-mapping.ts fix\n');

  return {
    success: true,
    message: '도움말 표시됨'
  };
}

// 메인 함수
async function main() {
  const command = (process.argv[2] as Command) || 'help';

  let result: ExecutionResult;

  switch (command) {
    case 'validate':
      result = await validateCityCodes();
      break;
    case 'fix':
      result = await fixCityCodes();
      break;
    case 'stats':
      result = await generateStats();
      break;
    case 'generate':
      result = await generateMapping();
      break;
    case 'help':
    default:
      result = showHelp();
      break;
  }

  if (!result.success) {
    console.error('\n❌ 실행 실패:', result.message);
    process.exit(1);
  }

  console.log('\n✅', result.message);
}

// 실행
main()
  .catch((error) => {
    console.error('스크립트 실행 실패:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });