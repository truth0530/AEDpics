#!/usr/bin/env node

/**
 * 자동추천 API 테스트 스크립트
 * 실제 매칭 데이터를 사용하여 API 응답을 검증
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testAutoSuggestAPI() {
  console.log('=== 자동추천 API 테스트 시작 ===');
  console.log('시간:', new Date().toISOString());

  try {
    // 1. 다양한 신뢰도 케이스 선택
    console.log('\n[1] 테스트 케이스 준비 중...');

    // 높은 신뢰도 케이스
    const highConfidenceCase = await prisma.tnms_matching_results.findFirst({
      where: { confidence_score: { gte: 95 } },
      orderBy: { confidence_score: 'desc' }
    });

    // 중간 신뢰도 케이스
    const mediumConfidenceCase = await prisma.tnms_matching_results.findFirst({
      where: {
        confidence_score: { gte: 70, lt: 90 }
      }
    });

    // 낮은 신뢰도 케이스
    const lowConfidenceCase = await prisma.tnms_matching_results.findFirst({
      where: {
        confidence_score: { lt: 70, gt: 0 }
      }
    });

    // 매칭 실패 케이스
    const unmatchedCase = await prisma.tnms_matching_results.findFirst({
      where: { matched_equipment_serial: null }
    });

    // 2. 각 케이스에 대해 API 테스트
    const testCases = [
      { label: '높은 신뢰도 (95%+)', data: highConfidenceCase },
      { label: '중간 신뢰도 (70-90%)', data: mediumConfidenceCase },
      { label: '낮은 신뢰도 (<70%)', data: lowConfidenceCase },
      { label: '매칭 실패', data: unmatchedCase }
    ];

    console.log('\n[2] API 호출 테스트 시작...\n');

    for (const testCase of testCases) {
      if (!testCase.data) {
        console.log(`${testCase.label}: 테스트 데이터 없음`);
        continue;
      }

      console.log(`=== ${testCase.label} 테스트 ===`);
      console.log(`Target Key: ${testCase.data.target_key}`);
      console.log(`기관명: ${testCase.data.target_institution_name}`);
      console.log(`신뢰도: ${testCase.data.confidence_score}%`);

      // API 호출 시뮬레이션 (실제 API 호출 대신 DB 쿼리)
      const suggestions = await getAutoSuggestions(testCase.data.target_key);

      console.log(`\n추천 결과 (${suggestions.suggestions.length}개):`);
      suggestions.suggestions.forEach((suggestion, idx) => {
        console.log(`  ${idx + 1}. ${suggestion.institution_name}`);
        console.log(`     - 장비연번: ${suggestion.equipment_serial}`);
        console.log(`     - 관리번호: ${suggestion.management_number}`);
        console.log(`     - 신뢰도: ${suggestion.confidence_score}%`);
        console.log(`     - 매치타입: ${suggestion.match_type}`);
      });
      console.log('');
    }

    // 3. 특정 케이스 상세 테스트 - 대구중부소방서
    console.log('=== 특정 케이스 상세 테스트 (대구중부소방서) ===');
    const daeguCase = await prisma.tnms_matching_results.findFirst({
      where: {
        OR: [
          { target_institution_name: { contains: '대구중부소방서' } },
          { matched_institution_name: { contains: '중부소방서' } }
        ]
      }
    });

    if (daeguCase) {
      console.log(`Target: ${daeguCase.target_institution_name}`);
      console.log(`Matched: ${daeguCase.matched_institution_name}`);
      console.log(`신뢰도: ${daeguCase.confidence_score}%`);

      const suggestions = await getAutoSuggestions(daeguCase.target_key);
      console.log(`\n자동추천 결과:`);
      console.log(`- 신뢰도 레벨: ${suggestions.confidenceLevel}`);
      console.log(`- 매치 타입: ${suggestions.matchType}`);
      console.log(`- 추천 개수: ${suggestions.suggestions.length}`);

      if (suggestions.metadata) {
        console.log(`\n메타데이터:`);
        console.log(`- 이름 신뢰도: ${suggestions.metadata.nameConfidence}%`);
        console.log(`- 주소 신뢰도: ${suggestions.metadata.addressConfidence}%`);
        console.log(`- 데이터 변경: ${suggestions.metadata.dataChanged ? '감지됨' : '없음'}`);
      }
    }

    // 4. 통계 요약
    console.log('\n=== 테스트 통계 요약 ===');
    const stats = await prisma.$queryRaw`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN confidence_score >= 90 THEN 1 END) as high_confidence,
        COUNT(CASE WHEN confidence_score >= 70 AND confidence_score < 90 THEN 1 END) as medium_confidence,
        COUNT(CASE WHEN confidence_score < 70 AND confidence_score > 0 THEN 1 END) as low_confidence,
        COUNT(CASE WHEN matched_equipment_serial IS NULL THEN 1 END) as unmatched
      FROM aedpics.tnms_matching_results
    `;

    console.log('매칭 결과 분포:');
    console.log(`- 전체: ${stats[0].total}건`);
    console.log(`- 높은 신뢰도: ${stats[0].high_confidence}건`);
    console.log(`- 중간 신뢰도: ${stats[0].medium_confidence}건`);
    console.log(`- 낮은 신뢰도: ${stats[0].low_confidence}건`);
    console.log(`- 매칭 실패: ${stats[0].unmatched}건`);

    console.log('\n=== 테스트 완료 ===');

  } catch (error) {
    console.error('테스트 실패:', error);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * 자동추천 로직 시뮬레이션 (API와 동일한 로직)
 */
async function getAutoSuggestions(targetKey) {
  // tnms_matching_current 뷰 사용 (항상 최신 데이터)
  const matchingResult = await prisma.$queryRaw`
    SELECT
      tmr.target_key,
      tmr.target_institution_name,
      tmr.target_address,
      tmr.current_management_number,
      tmr.matched_equipment_serial,
      tmr.current_institution_name,
      tmr.current_address,
      tmr.confidence_score,
      tmr.name_confidence,
      tmr.address_confidence,
      tmr.matching_rules,
      tmr.data_changed,
      ad.installation_position,
      ad.sido,
      ad.gugun
    FROM aedpics.tnms_matching_current tmr
    LEFT JOIN aedpics.aed_data ad ON tmr.matched_equipment_serial = ad.equipment_serial
    WHERE tmr.target_key = ${targetKey}
  `;

  if (matchingResult.length === 0) {
    // 폴백: 매칭 결과가 없으면 빈 추천 반환
    return {
      targetKey,
      matchType: 'no_match',
      confidenceLevel: 'none',
      suggestions: []
    };
  }

  const match = matchingResult[0];
  let recommendations = [];

  // 신뢰도별 추천 전략
  if (match.confidence_score >= 90) {
    // 높은 신뢰도: 단일 추천
    recommendations = [{
      equipment_serial: match.matched_equipment_serial,
      management_number: match.current_management_number,
      institution_name: match.current_institution_name,
      address: match.current_address,
      confidence_score: match.confidence_score,
      match_type: 'high_confidence',
      data_changed: match.data_changed
    }];
  } else if (match.confidence_score >= 70) {
    // 중간 신뢰도: 주변 후보도 함께 제시
    const nearbyAeds = await prisma.$queryRaw`
      SELECT
        equipment_serial,
        management_number,
        installation_institution,
        installation_address
      FROM aedpics.aed_data
      WHERE
        sido = ${match.sido}
        AND gugun = ${match.gugun}
        AND equipment_serial != ${match.matched_equipment_serial}
        AND similarity(installation_institution, ${match.target_institution_name}) > 0.5
      ORDER BY
        similarity(installation_institution, ${match.target_institution_name}) DESC
      LIMIT 2
    `;

    recommendations = [
      {
        equipment_serial: match.matched_equipment_serial,
        management_number: match.current_management_number,
        institution_name: match.current_institution_name,
        address: match.current_address,
        confidence_score: match.confidence_score,
        match_type: 'medium_confidence',
        is_primary: true
      },
      ...nearbyAeds.map(aed => ({
        equipment_serial: aed.equipment_serial,
        management_number: aed.management_number,
        institution_name: aed.installation_institution,
        address: aed.installation_address,
        confidence_score: null,
        match_type: 'alternative',
        is_primary: false
      }))
    ];
  } else if (match.confidence_score > 0) {
    // 낮은 신뢰도: 여러 후보 제시
    let candidates;
    if (match.gugun) {
      candidates = await prisma.$queryRaw`
        SELECT
          equipment_serial,
          management_number,
          installation_institution,
          installation_address,
          similarity(installation_institution, ${match.target_institution_name}) * 100 as similarity_score
        FROM aedpics.aed_data
        WHERE
          sido = ${match.sido}
          AND gugun = ${match.gugun}
        ORDER BY similarity_score DESC
        LIMIT 3
      `;
    } else {
      candidates = await prisma.$queryRaw`
        SELECT
          equipment_serial,
          management_number,
          installation_institution,
          installation_address,
          similarity(installation_institution, ${match.target_institution_name}) * 100 as similarity_score
        FROM aedpics.aed_data
        WHERE
          sido = ${match.sido}
        ORDER BY similarity_score DESC
        LIMIT 3
      `;
    }

    recommendations = candidates.map((aed, index) => ({
      equipment_serial: aed.equipment_serial,
      management_number: aed.management_number,
      institution_name: aed.installation_institution,
      address: aed.installation_address,
      confidence_score: Math.round(aed.similarity_score),
      match_type: index === 0 ? 'low_confidence_primary' : 'low_confidence_alternative',
      is_primary: index === 0
    }));
  }

  return {
    targetKey,
    targetName: match.target_institution_name,
    targetAddress: match.target_address,
    matchType: 'tnms_matching',
    confidenceLevel: match.confidence_score >= 90 ? 'high' :
                     match.confidence_score >= 70 ? 'medium' : 'low',
    suggestions: recommendations,
    metadata: {
      nameConfidence: match.name_confidence,
      addressConfidence: match.address_confidence,
      matchingRules: match.matching_rules,
      dataChanged: match.data_changed,
      lastUpdated: new Date().toISOString()
    }
  };
}

// 실행
testAutoSuggestAPI();