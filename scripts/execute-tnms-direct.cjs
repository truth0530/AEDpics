#!/usr/bin/env node

/**
 * TNMS 기반 전체 매칭 실행 스크립트 (직접 DB 접근)
 * CommonJS 형식으로 작성
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// 배치 크기 설정
const BATCH_SIZE = 100;

/**
 * 간단한 정규화 함수 (기본 정규화만)
 */
function normalizeText(text) {
  if (!text) return '';
  return text
    .replace(/\s+/g, '') // 공백 제거
    .replace(/\([^)]*\)/g, '') // 괄호 내용 제거
    .replace(/주식회사|㈜|\(주\)/g, '') // 회사 형태 제거
    .toLowerCase(); // 소문자 변환
}

/**
 * 문자열 유사도 계산 (Levenshtein)
 */
function calculateSimilarity(s1, s2) {
  if (s1 === s2) return 100;
  if (!s1 || !s2) return 0;

  const matrix = [];
  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  const distance = matrix[s2.length][s1.length];
  const maxLength = Math.max(s1.length, s2.length);
  return Math.round((1 - distance / maxLength) * 100);
}

/**
 * 기관명과 주소를 기반으로 최적 매칭 찾기
 */
async function findBestMatch(target, aedCandidates) {
  // Target 정규화
  const targetNormalizedName = normalizeText(target.institution_name || '');
  const targetNormalizedAddress = normalizeText(target.road_address || target.lot_address || '');

  let bestMatch = null;
  let bestScore = 0;

  for (const aed of aedCandidates) {
    // AED 정규화
    const aedNormalizedName = normalizeText(aed.installation_institution || '');

    // 이름 유사도
    const nameSimilarity = calculateSimilarity(targetNormalizedName, aedNormalizedName);

    // 주소 유사도
    let addressSimilarity = 0;
    if (targetNormalizedAddress && aed.installation_address) {
      const aedNormalizedAddress = normalizeText(aed.installation_address);
      addressSimilarity = calculateSimilarity(targetNormalizedAddress, aedNormalizedAddress);
    }

    // 가중 평균 (이름 60%, 주소 40%)
    const totalScore = addressSimilarity > 0
      ? nameSimilarity * 0.6 + addressSimilarity * 0.4
      : nameSimilarity;

    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestMatch = {
        ...aed,
        normalizedName: aedNormalizedName,
        nameSimilarity,
        addressSimilarity
      };
    }
  }

  return {
    match: bestMatch,
    score: bestScore,
    targetNormalizedName
  };
}

async function executeTnmsMatching() {
  console.log('=== TNMS 전체 매칭 시작 (Direct DB) ===');
  console.log('시작 시간:', new Date().toISOString());

  try {
    // 1. 통계 확인
    const targetCount = await prisma.target_list_2025.count();
    const aedCount = await prisma.aed_data.count();

    console.log(`\n대상 데이터:`);
    console.log(`  - target_list_2025: ${targetCount.toLocaleString()}건`);
    console.log(`  - aed_data: ${aedCount.toLocaleString()}건`);

    // 2. 기존 매칭 결과 확인
    console.log('\n기존 매칭 결과 확인...');
    const existingCount = await prisma.tnms_matching_results.count();
    if (existingCount > 0) {
      console.log(`  기존 결과: ${existingCount.toLocaleString()}건`);
    }

    // 3. 배치 처리
    console.log('\n매칭 시작...');
    let processedCount = 0;
    let matchedCount = 0;
    let highConfidenceCount = 0;
    let mediumConfidenceCount = 0;
    let lowConfidenceCount = 0;

    // 모든 target 조회
    const targets = await prisma.target_list_2025.findMany({
      orderBy: { target_key: 'asc' }
    });

    // 시도별 AED 데이터를 미리 로드 (메모리 최적화)
    const aedBySido = {};
    const sidoList = [...new Set(targets.map(t => t.sido).filter(Boolean))];

    console.log('\nAED 데이터 로드 중...');
    for (const sido of sidoList) {
      aedBySido[sido] = await prisma.aed_data.findMany({
        where: {
          sido,
          management_number: { not: null }
        },
        select: {
          equipment_serial: true,
          management_number: true,
          installation_institution: true,
          installation_address: true,
          installation_position: true,
          sido: true,
          gugun: true
        }
      });
      console.log(`  ${sido}: ${aedBySido[sido].length}건 로드`);
    }

    // 배치 처리
    console.log('\n배치 처리 시작...');
    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      const batch = targets.slice(i, Math.min(i + BATCH_SIZE, targets.length));
      const matchingResults = [];

      for (const target of batch) {
        // 해당 시도의 AED 데이터 우선
        let candidates = aedBySido[target.sido] || [];

        // 구군까지 일치하는 것 우선
        if (target.gugun && candidates.length > 0) {
          const gugunCandidates = candidates.filter(a => a.gugun === target.gugun);
          if (gugunCandidates.length > 0) {
            candidates = gugunCandidates;
          }
        }

        // 후보가 너무 많으면 상위 N개만
        if (candidates.length > 500) {
          candidates = candidates.slice(0, 500);
        }

        // 최적 매칭 찾기
        const result = await findBestMatch(target, candidates);

        const matchingRecord = {
          target_key: target.target_key,
          target_institution_name: target.institution_name,
          target_sido: target.sido,
          target_gugun: target.gugun,
          target_address: target.road_address || target.lot_address,
          target_normalized_name: result.targetNormalizedName,

          matched_management_number: result.match?.management_number || null,
          matched_equipment_serial: result.match?.equipment_serial || null,
          matched_institution_name: result.match?.installation_institution || null,
          matched_address: result.match?.installation_address || result.match?.installation_position || null,
          matched_normalized_name: result.match?.normalizedName || null,

          confidence_score: result.score,
          name_confidence: result.match?.nameSimilarity || 0,
          address_confidence: result.match?.addressSimilarity || 0,
          matching_rules: [], // 간단한 버전에서는 규칙 추적 없음
          match_type: 'auto',

          updated_by: 'tnms_direct_batch'
        };

        matchingResults.push(matchingRecord);

        // 통계 업데이트
        if (result.match) {
          matchedCount++;
          if (result.score >= 90) highConfidenceCount++;
          else if (result.score >= 70) mediumConfidenceCount++;
          else lowConfidenceCount++;
        }
      }

      // 배치 저장 (upsert)
      for (const record of matchingResults) {
        await prisma.tnms_matching_results.upsert({
          where: { target_key: record.target_key },
          create: record,
          update: {
            ...record,
            updated_at: new Date()
          }
        });
      }

      processedCount += batch.length;

      // 진행 상황 출력
      const progress = Math.round((processedCount / targets.length) * 100);
      console.log(`진행: ${processedCount.toLocaleString()}/${targets.length.toLocaleString()} (${progress}%)`);
      console.log(`  매칭: ${matchedCount}건, 높음: ${highConfidenceCount}, 중간: ${mediumConfidenceCount}, 낮음: ${lowConfidenceCount}`);
    }

    // 4. 최종 통계
    console.log('\n=== 매칭 완료 ===');
    console.log(`처리된 타겟: ${processedCount.toLocaleString()}건`);
    console.log(`매칭 성공: ${matchedCount.toLocaleString()}건 (${Math.round((matchedCount/processedCount)*100)}%)`);
    console.log(`신뢰도 분포:`);
    console.log(`  - 높음 (90% 이상): ${highConfidenceCount.toLocaleString()}건`);
    console.log(`  - 중간 (70-90%): ${mediumConfidenceCount.toLocaleString()}건`);
    console.log(`  - 낮음 (70% 미만): ${lowConfidenceCount.toLocaleString()}건`);
    console.log(`매칭 실패: ${(processedCount - matchedCount).toLocaleString()}건`);

    // 5. 뷰 통계 확인
    const stats = await prisma.$queryRaw`
      SELECT * FROM aedpics.tnms_matching_stats
    `;
    console.log('\n데이터베이스 통계:', stats[0]);

    console.log('\n종료 시간:', new Date().toISOString());

  } catch (error) {
    console.error('매칭 오류:', error);
    process.exit(1);
  }
}

// 실행
executeTnmsMatching()
  .catch(console.error)
  .finally(() => prisma.$disconnect());