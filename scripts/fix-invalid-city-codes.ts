#!/usr/bin/env npx tsx

/**
 * 잘못된 city_code를 검출하고 수정하는 스크립트
 * - 통합 관리 시스템(lib/constants/regions.ts)의 CITY_CODE_TO_GUGUN_MAP과 비교
 * - 잘못된 city_code를 가진 organization 검출 및 수정
 */

import { PrismaClient } from '@prisma/client';
import { CITY_CODE_TO_GUGUN_MAP, mapGugunToCityCode } from '../lib/constants/regions';

const prisma = new PrismaClient();

// 알려진 잘못된 매핑 (호환성 유지용)
const KNOWN_INVALID_MAPPINGS: Record<string, string> = {
  'seju': 'sejong',  // 세종시 오타
  'jongno': 'jongno-gu',  // 표준화
  'gangbuk': 'gangbuk-gu',  // 표준화
  // 필요시 추가
};

async function fixInvalidCityCodes() {
  console.log('========================================');
  console.log('잘못된 city_code 검출 및 수정 시작');
  console.log('========================================\n');

  try {
    // 1. 모든 보건소 조직 가져오기
    const healthCenters = await prisma.organizations.findMany({
      where: { type: 'health_center' },
      select: {
        id: true,
        name: true,
        city_code: true,
        address: true,
        created_at: true
      },
      orderBy: { name: 'asc' }
    });

    console.log(`총 ${healthCenters.length}개 보건소 검사 시작\n`);

    // 2. 유효한 city_code 목록
    const validCityCodes = Object.keys(CITY_CODE_TO_GUGUN_MAP);

    // 3. 잘못된 city_code 찾기
    const invalidEntries: typeof healthCenters = [];
    const fixableEntries: Array<{
      id: string;
      name: string;
      currentCode: string | null;
      suggestedCode: string;
      reason: string;
    }> = [];

    for (const center of healthCenters) {
      const cityCode = center.city_code;

      // city_code가 없는 경우
      if (!cityCode) {
        // 조직명에서 구군 추출 시도
        const gugun = extractGugunFromName(center.name);
        if (gugun) {
          const suggestedCode = mapGugunToCityCode(gugun);
          if (suggestedCode) {
            fixableEntries.push({
              id: center.id,
              name: center.name,
              currentCode: null,
              suggestedCode,
              reason: `조직명 "${center.name}"에서 "${gugun}" 추출`
            });
          }
        }
        invalidEntries.push(center);
        continue;
      }

      // 유효하지 않은 city_code
      if (!validCityCodes.includes(cityCode)) {
        // 알려진 잘못된 매핑인지 확인
        if (KNOWN_INVALID_MAPPINGS[cityCode]) {
          fixableEntries.push({
            id: center.id,
            name: center.name,
            currentCode: cityCode,
            suggestedCode: KNOWN_INVALID_MAPPINGS[cityCode],
            reason: '알려진 오타/비표준 코드'
          });
        }
        invalidEntries.push(center);
      }
    }

    // 4. 결과 출력
    console.log('=== 검사 결과 ===\n');
    console.log(`✅ 정상: ${healthCenters.length - invalidEntries.length}개`);
    console.log(`❌ 문제: ${invalidEntries.length}개`);
    console.log(`🔧 수정 가능: ${fixableEntries.length}개\n`);

    if (invalidEntries.length > 0) {
      console.log('=== 잘못된 city_code 목록 ===\n');
      for (const entry of invalidEntries) {
        console.log(`- ${entry.name}`);
        console.log(`  현재 city_code: ${entry.city_code || '(없음)'}`);
        console.log(`  주소: ${entry.address || '(없음)'}`);
        console.log('');
      }
    }

    if (fixableEntries.length > 0) {
      console.log('=== 수정 가능한 항목 ===\n');
      for (const fix of fixableEntries) {
        console.log(`- ${fix.name}`);
        console.log(`  현재: ${fix.currentCode || '(없음)'} → 제안: ${fix.suggestedCode}`);
        console.log(`  이유: ${fix.reason}`);
        console.log('');
      }

      // 5. 수정 여부 확인 (실제로는 명령줄 인자로 처리)
      const shouldFix = process.argv.includes('--fix');

      if (shouldFix) {
        console.log('=== 수정 작업 시작 ===\n');

        for (const fix of fixableEntries) {
          await prisma.organizations.update({
            where: { id: fix.id },
            data: { city_code: fix.suggestedCode }
          });
          console.log(`✅ 수정 완료: ${fix.name} (${fix.currentCode || '없음'} → ${fix.suggestedCode})`);
        }

        console.log(`\n총 ${fixableEntries.length}개 항목 수정 완료!`);
      } else {
        console.log('\n💡 수정하려면 --fix 옵션을 추가하세요:');
        console.log('   npm run fix:city-codes -- --fix');
      }
    }

    // 6. city_code 통계
    console.log('\n=== city_code 사용 통계 ===\n');
    const codeStats = new Map<string, number>();
    for (const center of healthCenters) {
      const code = center.city_code || '(없음)';
      codeStats.set(code, (codeStats.get(code) || 0) + 1);
    }

    const sortedStats = Array.from(codeStats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    for (const [code, count] of sortedStats) {
      const isValid = code === '(없음)' || validCityCodes.includes(code);
      const status = isValid ? '✅' : '❌';
      const gugun = code !== '(없음)' ? CITY_CODE_TO_GUGUN_MAP[code] || '(알 수 없음)' : '';
      console.log(`${status} ${code.padEnd(20)} : ${count}개 ${gugun}`);
    }

  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 조직명에서 구군 추출 헬퍼
function extractGugunFromName(name: string): string | null {
  // 보건소 패턴: "XX구보건소", "XX시보건소", "XX군보건소"
  const match = name.match(/^(.+?)(구|시|군)보건소/);
  if (match) {
    return match[1] + match[2];
  }
  return null;
}

// 실행
fixInvalidCityCodes()
  .then(() => {
    console.log('\n스크립트 실행 완료');
  })
  .catch((error) => {
    console.error('스크립트 실행 실패:', error);
    process.exit(1);
  });