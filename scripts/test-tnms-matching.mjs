#!/usr/bin/env node

/**
 * TNMS 통합 매칭 테스트 및 모니터링
 * 투명성: 어떤 규칙이 적용되었는지 확인
 * 확장성: 새로운 테스트 케이스 쉽게 추가 가능
 */

import { PrismaClient } from '@prisma/client';
import { textNormalizer } from '../lib/services/tnms/text-normalizer.js';

const prisma = new PrismaClient();

// 테스트 케이스 (실제 문제 사례 + 추가 케이스)
const testCases = [
  {
    name: '대구 소방서 케이스 (원본 문제)',
    target: '대구중부소방서',
    aed: '중부소방서(본대구급대)',
    expectedMatch: true,
    description: '지역 접두어와 괄호 제거로 매칭되어야 함'
  },
  {
    name: '법인 표기 케이스',
    target: '한국철도공사',
    aed: '(주)한국철도공사',
    expectedMatch: true,
    description: '법인 표기 제거로 매칭되어야 함'
  },
  {
    name: '보건소 케이스',
    target: '서울특별시강서구보건소',
    aed: '강서구보건소',
    expectedMatch: true,
    description: '지역 접두어 제거로 매칭되어야 함 (지역 접두어 규칙 활성화 시)'
  },
  {
    name: '병원 케이스',
    target: '서울대학교병원',
    aed: '서울대학교병원(본원)',
    expectedMatch: true,
    description: '괄호 제거로 매칭되어야 함'
  },
  {
    name: '공백 정규화 케이스',
    target: '인천국제공항   공사',
    aed: '인천국제공항공사',
    expectedMatch: true,
    description: '공백 정규화로 매칭되어야 함'
  }
];

async function runTests() {
  console.log('=== TNMS 매칭 테스트 시작 ===\n');
  console.log('현재 시간:', new Date().toISOString());
  console.log('테스트 케이스:', testCases.length, '개\n');

  // 활성 규칙 확인
  console.log('1. 현재 활성 정규화 규칙');
  console.log('-------------------------');
  const activeRules = await prisma.normalization_rules.findMany({
    where: { is_active: true },
    orderBy: { priority: 'desc' }
  });

  activeRules.forEach(rule => {
    console.log(`  [${rule.priority}] ${rule.rule_name} (${rule.rule_type})`);
  });

  // 테스트 실행
  console.log('\n2. 테스트 케이스 실행');
  console.log('---------------------\n');

  let passCount = 0;
  let failCount = 0;

  for (const testCase of testCases) {
    console.log(`테스트: ${testCase.name}`);
    console.log(`  원본: "${testCase.target}" vs "${testCase.aed}"`);

    // 정규화 실행 (신호 포함)
    const [targetResult, aedResult] = await Promise.all([
      textNormalizer.normalize(testCase.target),
      textNormalizer.normalize(testCase.aed)
    ]);

    console.log(`  정규화 후: "${targetResult.normalized}" vs "${aedResult.normalized}"`);

    // 적용된 규칙 표시 (투명성)
    console.log('  적용된 규칙:');
    console.log('    Target:');
    targetResult.signals.forEach(signal => {
      if (signal.applied) {
        console.log(`      - ${signal.rule_name}: "${signal.before}" → "${signal.after}"`);
      }
    });

    console.log('    AED:');
    aedResult.signals.forEach(signal => {
      if (signal.applied) {
        console.log(`      - ${signal.rule_name}: "${signal.before}" → "${signal.after}"`);
      }
    });

    // 매칭 확인
    const isMatched = targetResult.normalized === aedResult.normalized;
    const result = isMatched ? '✓ 매칭' : '✗ 불일치';

    if (isMatched === testCase.expectedMatch) {
      passCount++;
      console.log(`  결과: ${result} (예상대로)`);
    } else {
      failCount++;
      console.log(`  결과: ${result} (예상과 다름!)`);
    }

    console.log(`  설명: ${testCase.description}`);
    console.log();
  }

  // 결과 요약
  console.log('3. 테스트 결과 요약');
  console.log('-------------------');
  console.log(`  통과: ${passCount}/${testCases.length}`);
  console.log(`  실패: ${failCount}/${testCases.length}`);
  console.log(`  성공률: ${Math.round((passCount / testCases.length) * 100)}%`);

  // 지역 접두어 규칙 활성화 제안
  if (failCount > 0) {
    const regionRule = activeRules.find(r => r.rule_type === 'region_prefix_removal');
    if (!regionRule || !regionRule.is_active) {
      console.log('\n💡 제안: 지역 접두어 제거 규칙을 활성화하면 더 많은 매칭이 가능할 수 있습니다.');
      console.log('   다음 명령으로 활성화: UPDATE normalization_rules SET is_active = true WHERE rule_type = \'region_prefix_removal\';');
    }
  }

  console.log('\n=== 테스트 완료 ===');
}

// 실시간 매칭 테스트 함수 (확장성)
export async function testSingleMatch(target, aed) {
  const [targetResult, aedResult] = await Promise.all([
    textNormalizer.normalize(target),
    textNormalizer.normalize(aed)
  ]);

  return {
    target: {
      original: target,
      normalized: targetResult.normalized,
      signals: targetResult.signals
    },
    aed: {
      original: aed,
      normalized: aedResult.normalized,
      signals: aedResult.signals
    },
    matched: targetResult.normalized === aedResult.normalized
  };
}

runTests()
  .catch(console.error)
  .finally(() => prisma.$disconnect());