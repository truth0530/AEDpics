#!/usr/bin/env node

/**
 * Pre-Phase 1: Region Consolidation (경기/경기도 및 기타 약어 통합)
 *
 * 문제: aed_data.sido 칼럼에 다음과 같이 혼합된 데이터 존재:
 * - 경기: 15,193개 (약어)
 * - 경기도: 3개 (전체명)
 *
 * FK 제약 추가 전에 이러한 데이터 불일치를 반드시 수정해야 함.
 * 이 스크립트는 모든 약어 시도명을 정규화된 전체명으로 통합.
 *
 * Usage:
 * npx tsx scripts/data-validation/fix-region-consolidation.ts
 *
 * 검증 쿼리:
 * SELECT sido, COUNT(*) as count FROM aed_data GROUP BY sido ORDER BY count DESC;
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface RegionMapping {
  abbreviation: string;
  fullName: string;
}

// 공식 시도명 매핑 (약어 → 전체명)
const REGION_CONSOLIDATION_MAP: RegionMapping[] = [
  { abbreviation: '경기', fullName: '경기도' },
  { abbreviation: '강원', fullName: '강원도' },
  { abbreviation: '충북', fullName: '충청북도' },
  { abbreviation: '충남', fullName: '충청남도' },
  { abbreviation: '전북', fullName: '전라북도' },
  { abbreviation: '전남', fullName: '전라남도' },
  { abbreviation: '경북', fullName: '경상북도' },
  { abbreviation: '경남', fullName: '경상남도' },
  { abbreviation: '제주', fullName: '제주특별자치도' },
];

async function analyzeCurrentState(): Promise<void> {
  console.log('\n========================================');
  console.log('현재 상태 분석');
  console.log('========================================\n');

  const results = await prisma.$queryRaw<
    Array<{ sido: string | null; count: bigint }>
  >`
    SELECT sido, COUNT(*)::int as count
    FROM aed_data
    GROUP BY sido
    ORDER BY count DESC
  `;

  console.log('aed_data.sido 통계:');
  let total = 0;
  for (const row of results) {
    const count = Number(row.count);
    total += count;
    const status = row.sido === null ? '(NULL)' : `'${row.sido}'`;
    console.log(`  ${status.padEnd(20)} : ${count.toLocaleString('ko-KR')} 개`);
  }
  console.log(`  ${'─'.repeat(40)}`);
  console.log(`  총합: ${total.toLocaleString('ko-KR')} 개\n`);
}

async function consolidateRegions(): Promise<void> {
  console.log('========================================');
  console.log('지역 데이터 통합 실행');
  console.log('========================================\n');

  let totalUpdated = 0;

  for (const mapping of REGION_CONSOLIDATION_MAP) {
    // 약어로 등록된 레코드 수 확인
    const abbreviatedCount = await prisma.$queryRaw<
      Array<{ count: bigint }>
    >`
      SELECT COUNT(*)::int as count
      FROM aed_data
      WHERE sido = ${mapping.abbreviation}
    `;

    const count = Number(abbreviatedCount[0]?.count || 0n);

    if (count > 0) {
      console.log(`${mapping.abbreviation.padEnd(6)} → ${mapping.fullName.padEnd(12)}: ${count.toLocaleString('ko-KR')} 개 변환`);

      // UPDATE 실행
      await prisma.$executeRaw`
        UPDATE aed_data
        SET sido = ${mapping.fullName}
        WHERE sido = ${mapping.abbreviation}
      `;

      totalUpdated += count;
    }
  }

  console.log(`\n✅ 통합 완료: 총 ${totalUpdated.toLocaleString('ko-KR')} 개 레코드 업데이트\n`);
}

async function verifyConsolidation(): Promise<void> {
  console.log('========================================');
  console.log('통합 결과 검증');
  console.log('========================================\n');

  const results = await prisma.$queryRaw<
    Array<{ sido: string | null; count: bigint }>
  >`
    SELECT sido, COUNT(*)::int as count
    FROM aed_data
    GROUP BY sido
    ORDER BY count DESC
  `;

  console.log('aed_data.sido 통계 (통합 후):');
  let total = 0;
  for (const row of results) {
    const count = Number(row.count);
    total += count;
    const status = row.sido === null ? '(NULL)' : `'${row.sido}'`;
    console.log(`  ${status.padEnd(20)} : ${count.toLocaleString('ko-KR')} 개`);
  }
  console.log(`  ${'─'.repeat(40)}`);
  console.log(`  총합: ${total.toLocaleString('ko-KR')} 개\n`);

  // 특정 지역 검증 (경기/경기도)
  const gyeonggiData = await prisma.$queryRaw<
    Array<{ sido: string; count: bigint }>
  >`
    SELECT sido, COUNT(*)::int as count
    FROM aed_data
    WHERE sido IN ('경기', '경기도')
    GROUP BY sido
  `;

  if (gyeonggiData.length === 0) {
    console.log('✅ 경기/경기도 통합 완료: 모든 약어가 "경기도"로 통합됨\n');
  } else {
    console.log('❌ 경기/경기도 통합 실패:');
    for (const row of gyeonggiData) {
      console.log(`  ${row.sido}: ${Number(row.count).toLocaleString('ko-KR')} 개\n`);
    }
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║ Phase 1 사전작업: 지역 데이터 통합   ║');
  console.log('║ (경기/경기도 및 기타 약어 정규화)    ║');
  console.log('╚════════════════════════════════════════╝');
  console.log(`\n시작 시간: ${new Date().toISOString()}`);
  console.log(`환경: ${process.env.NODE_ENV || 'development'}\n`);

  try {
    // 1. 현재 상태 분석
    await analyzeCurrentState();

    // 2. 사용자 확인 (프로덕션에서는 dry-run 권장)
    const isDryRun = process.env.DRY_RUN === 'true';
    if (isDryRun) {
      console.log('⚠️  DRY_RUN 모드: 실제 데이터 변경 없음\n');
    } else {
      console.log('ℹ️  실행 모드: 실제 데이터 변경 진행\n');
    }

    // 3. 통합 실행 (dry-run이 아닐 때만)
    if (!isDryRun) {
      await consolidateRegions();
    } else {
      console.log('ℹ️  DRY_RUN 모드이므로 실제 업데이트는 스킵\n');
      for (const mapping of REGION_CONSOLIDATION_MAP) {
        const abbreviatedCount = await prisma.$queryRaw<
          Array<{ count: bigint }>
        >`
          SELECT COUNT(*)::int as count
          FROM aed_data
          WHERE sido = ${mapping.abbreviation}
        `;
        const count = Number(abbreviatedCount[0]?.count || 0n);
        if (count > 0) {
          console.log(`${mapping.abbreviation.padEnd(6)} → ${mapping.fullName.padEnd(12)}: ${count.toLocaleString('ko-KR')} 개 변환 예상`);
        }
      }
      console.log();
    }

    // 4. 검증
    await verifyConsolidation();

    // 5. 결과 요약
    console.log('========================================');
    console.log('지역 데이터 통합 완료');
    console.log('========================================');
    console.log('\n다음 단계:');
    console.log('  1. 통합 결과 검증 완료');
    console.log('  2. Phase 1 마이그레이션 실행:');
    console.log('     npx prisma migrate dev --name add_equipment_fk_to_inspections');
    console.log('  3. FK/인덱스 생성 확인\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ 오류 발생:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
