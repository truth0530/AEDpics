#!/usr/bin/env npx tsx

/**
 * region_code 불일치 수정 스크립트
 * DB와 REGIONS 상수 간의 불일치를 해결
 *
 * 문제:
 * 1. GYG (DB) vs GYE (REGIONS) - 경기도
 * 2. CBN (DB) vs CHB (REGIONS) - 충북 중복
 */

import { PrismaClient } from '@prisma/client';
import { REGIONS } from '@/lib/constants/regions';

const prisma = new PrismaClient();

// 수정 매핑
const REGION_CODE_FIX_MAP: Record<string, string> = {
  'GYG': 'GYE',  // 경기도 코드 수정
  'CBN': 'CHB',  // 충북 코드 통일
};

async function fixRegionCodeMismatch() {
  console.log('========================================');
  console.log('Region Code 불일치 수정 시작');
  console.log('========================================\n');

  try {
    // 1. 현재 상태 확인
    console.log('=== 현재 Region Code 사용 현황 ===\n');

    const organizations = await prisma.organizations.findMany({
      where: { type: 'health_center' },
      select: {
        id: true,
        name: true,
        region_code: true
      }
    });

    // 통계 수집
    const stats = new Map<string, number>();
    const needsFix: typeof organizations = [];

    for (const org of organizations) {
      const code = org.region_code;
      if (code) {
        stats.set(code, (stats.get(code) || 0) + 1);

        // 수정이 필요한 경우
        if (REGION_CODE_FIX_MAP[code]) {
          needsFix.push(org);
        }
      }
    }

    // 현재 상태 출력
    console.log('현재 region_code 통계:');
    const validCodes = REGIONS.map(r => r.code);

    for (const [code, count] of Array.from(stats.entries()).sort((a, b) => b[1] - a[1])) {
      const isValid = validCodes.includes(code);
      const status = isValid ? '✅' : '❌';
      const fixTo = REGION_CODE_FIX_MAP[code];
      const fixNote = fixTo ? ` → ${fixTo}로 수정 필요` : '';
      console.log(`${status} ${code}: ${count}개${fixNote}`);
    }

    console.log('\n=== 수정 대상 ===\n');
    console.log(`수정이 필요한 조직: ${needsFix.length}개\n`);

    if (needsFix.length > 0) {
      // 수정 대상 그룹별 표시
      for (const [oldCode, newCode] of Object.entries(REGION_CODE_FIX_MAP)) {
        const targets = needsFix.filter(org => org.region_code === oldCode);
        if (targets.length > 0) {
          console.log(`\n${oldCode} → ${newCode} (${targets.length}개):`);
          for (const org of targets.slice(0, 5)) {
            console.log(`  - ${org.name}`);
          }
          if (targets.length > 5) {
            console.log(`  ... 외 ${targets.length - 5}개`);
          }
        }
      }

      // 수정 여부 확인
      const shouldFix = process.argv.includes('--fix');

      if (shouldFix) {
        console.log('\n=== 수정 작업 시작 ===\n');

        for (const [oldCode, newCode] of Object.entries(REGION_CODE_FIX_MAP)) {
          const result = await prisma.organizations.updateMany({
            where: {
              type: 'health_center',
              region_code: oldCode
            },
            data: {
              region_code: newCode
            }
          });

          console.log(`✅ ${oldCode} → ${newCode}: ${result.count}개 수정 완료`);
        }

        // 수정 후 검증
        console.log('\n=== 수정 후 검증 ===\n');

        const afterFix = await prisma.organizations.findMany({
          where: { type: 'health_center' },
          select: { region_code: true }
        });

        const afterStats = new Map<string, number>();
        for (const org of afterFix) {
          if (org.region_code) {
            afterStats.set(org.region_code, (afterStats.get(org.region_code) || 0) + 1);
          }
        }

        let allValid = true;
        for (const [code, count] of Array.from(afterStats.entries()).sort((a, b) => b[1] - a[1])) {
          const isValid = validCodes.includes(code);
          const status = isValid ? '✅' : '❌';
          console.log(`${status} ${code}: ${count}개`);
          if (!isValid) allValid = false;
        }

        if (allValid) {
          console.log('\n🎉 모든 region_code가 정상화되었습니다!');
        } else {
          console.log('\n⚠️ 아직 유효하지 않은 region_code가 있습니다.');
        }

      } else {
        console.log('\n💡 수정하려면 --fix 옵션을 추가하세요:');
        console.log('   npm run fix:region-codes');
      }
    } else {
      console.log('✅ 모든 region_code가 이미 정상입니다!');
    }

  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 실행
fixRegionCodeMismatch()
  .then(() => {
    console.log('\n스크립트 실행 완료');
  })
  .catch((error) => {
    console.error('스크립트 실행 실패:', error);
    process.exit(1);
  });