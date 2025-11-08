#!/usr/bin/env npx tsx

/**
 * 제주도 보건소 city_code 수정 - 통합 관리 시스템 사용 버전
 */

import { prisma } from '@/lib/prisma';
import {
  categorizeHealthCenters,
  extractRegionInfoFromHealthCenter,
  validateHealthCenter,
  suggestCityCodeFixes
} from './utils/health-center-utils';

async function fixJejuCityCodesImproved() {
  console.log('=== 제주도 city_code 수정 (통합 관리 버전) ===\n');

  try {
    // 1. 제주도 보건소 조회
    const jejuHealthCenters = await prisma.organizations.findMany({
      where: {
        region_code: 'JEJ',
        type: 'health_center'
      },
      orderBy: {
        name: 'asc'
      }
    });

    console.log(`제주도 보건소 총 ${jejuHealthCenters.length}개 발견\n`);

    // 2. 현재 상태 분석
    const categorized = categorizeHealthCenters(jejuHealthCenters);

    console.log('=== 현재 상태 분석 ===');
    console.log(`✅ 유효한 city_code: ${categorized.withValidCityCode.length}개`);
    console.log(`❌ city_code 누락: ${categorized.withMissingCityCode.length}개`);
    console.log(`⚠️  잘못된 city_code: ${categorized.withInvalidCityCode.length}개\n`);

    // 3. 각 보건소 검증
    console.log('=== 보건소별 검증 결과 ===\n');
    for (const center of jejuHealthCenters) {
      const validation = validateHealthCenter(center);
      console.log(`${center.name} (city_code: ${center.city_code || 'null'})`);

      if (validation.issues.length > 0) {
        console.log('  문제:');
        validation.issues.forEach(issue => console.log(`    - ${issue}`));
      }

      if (validation.suggestions.length > 0) {
        console.log('  제안:');
        validation.suggestions.forEach(sug => console.log(`    - ${sug}`));
      }

      if (validation.isValid) {
        console.log('  ✅ 정상');
      }
      console.log('');
    }

    // 4. city_code 수정 제안
    const fixes = suggestCityCodeFixes(jejuHealthCenters);

    if (fixes.length > 0) {
      console.log('=== city_code 수정 제안 ===\n');
      for (const fix of fixes) {
        console.log(`${fix.center.name}`);
        console.log(`  현재: ${fix.currentCityCode || '(없음)'}`);
        console.log(`  제안: ${fix.suggestedCityCode}`);
        console.log(`  이유: ${fix.reason}\n`);
      }

      // 5. 수정 실행 여부 확인
      const shouldFix = process.argv.includes('--fix');

      if (shouldFix) {
        console.log('=== 수정 작업 시작 ===\n');

        for (const fix of fixes) {
          await prisma.organizations.update({
            where: { id: fix.center.id },
            data: {
              city_code: fix.suggestedCityCode,
              updated_at: new Date()
            }
          });

          console.log(`✅ ${fix.center.name}: ${fix.currentCityCode || '(없음)'} → ${fix.suggestedCityCode}`);
        }

        console.log(`\n총 ${fixes.length}개 항목 수정 완료!`);
      } else {
        console.log('💡 수정하려면 --fix 옵션을 추가하세요:');
        console.log('   npx tsx scripts/fix-jeju-city-codes-improved.ts --fix');
      }
    } else {
      console.log('✅ 모든 제주도 보건소의 city_code가 정상입니다.');
    }

    // 6. 구군별 그룹 표시
    console.log('\n=== 구군별 보건소 현황 ===\n');
    for (const [gugun, centers] of Object.entries(categorized.byGugun)) {
      console.log(`${gugun}: ${centers.length}개`);
      for (const center of centers) {
        console.log(`  - ${center.name}`);
      }
    }

  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 실행
fixJejuCityCodesImproved()
  .then(() => {
    console.log('\n스크립트 실행 완료');
  })
  .catch((error) => {
    console.error('스크립트 실행 실패:', error);
    process.exit(1);
  });