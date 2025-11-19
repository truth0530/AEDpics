#!/usr/bin/env node

/**
 * TNMS 매칭 결과 검증 스크립트
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyMatching() {
  console.log('=== TNMS 매칭 결과 검증 ===');
  console.log('시간:', new Date().toISOString());

  try {
    // 1. 전체 통계
    const targetCount = await prisma.target_list_2025.count();
    const aedCount = await prisma.aed_data.count();
    const matchingCount = await prisma.tnms_matching_results.count();
    const matchedCount = await prisma.tnms_matching_results.count({
      where: { matched_equipment_serial: { not: null } }
    });

    console.log('\n전체 통계:');
    console.log(`  - 타겟 총 개수: ${targetCount.toLocaleString()}건`);
    console.log(`  - AED 총 개수: ${aedCount.toLocaleString()}건`);
    console.log(`  - 매칭 레코드: ${matchingCount.toLocaleString()}건`);
    console.log(`  - 매칭 성공: ${matchedCount.toLocaleString()}건 (${Math.round((matchedCount/targetCount)*100)}%)`);

    // 2. 신뢰도별 분포
    const highConfidence = await prisma.tnms_matching_results.count({
      where: { confidence_score: { gte: 90 } }
    });
    const mediumConfidence = await prisma.tnms_matching_results.count({
      where: {
        confidence_score: { gte: 70, lt: 90 }
      }
    });
    const lowConfidence = await prisma.tnms_matching_results.count({
      where: {
        confidence_score: { lt: 70, gt: 0 }
      }
    });

    console.log('\n신뢰도 분포:');
    console.log(`  - 높음 (90% 이상): ${highConfidence.toLocaleString()}건`);
    console.log(`  - 중간 (70-90%): ${mediumConfidence.toLocaleString()}건`);
    console.log(`  - 낮음 (70% 미만): ${lowConfidence.toLocaleString()}건`);
    console.log(`  - 매칭 실패: ${(targetCount - matchedCount).toLocaleString()}건`);

    // 3. 시도별 매칭 결과
    const sidoStats = await prisma.$queryRaw`
      SELECT
        target_sido as sido,
        COUNT(*) as total,
        COUNT(matched_equipment_serial) as matched,
        ROUND(AVG(confidence_score), 2) as avg_confidence
      FROM aedpics.tnms_matching_results
      GROUP BY target_sido
      ORDER BY target_sido
    `;

    console.log('\n시도별 매칭 현황:');
    for (const stat of sidoStats) {
      const matchRate = Math.round((Number(stat.matched) / Number(stat.total)) * 100);
      console.log(`  ${stat.sido}: ${stat.matched}/${stat.total} (${matchRate}%), 평균 신뢰도: ${stat.avg_confidence}%`);
    }

    // 4. 매칭 성공 샘플 (높은 신뢰도)
    const successSamples = await prisma.tnms_matching_results.findMany({
      where: {
        confidence_score: { gte: 95 },
        matched_equipment_serial: { not: null }
      },
      orderBy: { confidence_score: 'desc' },
      take: 5
    });

    console.log('\n매칭 성공 사례 (신뢰도 95% 이상):');
    for (const sample of successSamples) {
      console.log(`  - [${sample.target_key}] ${sample.target_institution_name}`);
      console.log(`    → ${sample.matched_institution_name} (${sample.confidence_score}%)`);
    }

    // 5. 매칭 실패 샘플
    const failedSamples = await prisma.tnms_matching_results.findMany({
      where: {
        matched_equipment_serial: null
      },
      take: 5
    });

    console.log('\n매칭 실패 사례:');
    for (const sample of failedSamples) {
      console.log(`  - [${sample.target_key}] ${sample.target_institution_name} (${sample.target_sido} ${sample.target_gugun})`);
    }

    // 6. 특정 케이스 확인 - 대구중부소방서
    const daeguCase = await prisma.tnms_matching_results.findFirst({
      where: {
        OR: [
          { target_institution_name: { contains: '대구중부소방서' } },
          { target_institution_name: { contains: '중부소방서' } }
        ]
      }
    });

    if (daeguCase) {
      console.log('\n특정 케이스 확인 (대구중부소방서):');
      console.log(`  타겟: ${daeguCase.target_institution_name}`);
      console.log(`  매칭: ${daeguCase.matched_institution_name || '매칭 실패'}`);
      console.log(`  신뢰도: ${daeguCase.confidence_score}%`);
      console.log(`  이름 신뢰도: ${daeguCase.name_confidence}%`);
      console.log(`  주소 신뢰도: ${daeguCase.address_confidence}%`);
    }

    // 7. 뷰 통계 확인
    const viewStats = await prisma.$queryRaw`
      SELECT * FROM aedpics.tnms_matching_stats
    `;

    console.log('\n통계 뷰 (tnms_matching_stats):');
    console.log(viewStats[0]);

  } catch (error) {
    console.error('검증 오류:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 실행
verifyMatching();