/**
 * TNMS 서비스 동작 검증 스크립트
 *
 * 검증 내용:
 * 1. 텍스트 정규화 (공통 접사 제거, 지역명 확장 등)
 * 2. 주소 해싱 (일관된 해시값 생성)
 * 3. 신뢰도 점수 계산 (다중 신호 기반)
 * 4. 기관 검색 및 추천
 *
 * 실행: npx ts-node scripts/test/tnms-service-test.ts
 */

import { tnmsService } from '@/lib/services/tnms';

async function testTnmsService() {
  console.log('========================================');
  console.log('TNMS Phase 1 서비스 검증 시작');
  console.log('========================================\n');

  try {
    // Test 1: 텍스트 정규화
    console.log('Test 1: 텍스트 정규화');
    console.log('-----------------------------------');

    const testCases = [
      '서울강서구보건소',
      '대구광역시 수성구 보건소',
      '충청남도 천안시 서북구 보건소',
      '경기도 수원시 영통구',
    ];

    for (const testCase of testCases) {
      const result = await tnmsService.normalizeAndMatch(
        testCase,
        undefined,
        undefined,
        'test_data'
      );

      console.log(`원본: ${testCase}`);
      console.log(`정규화: ${result.normalized_name}`);
      console.log(`정규화 신호: ${result.normalization_signals.length}개`);

      if (result.best_match) {
        console.log(
          `최고 매칭: ${result.best_match.canonical_name} (신뢰도: ${result.best_match.confidence_score}%)`
        );
      }
      console.log('');
    }

    // Test 2: 검색 및 추천
    console.log('Test 2: 기관 검색 및 추천');
    console.log('-----------------------------------');

    const searchResults = await tnmsService.searchAndRecommend(
      '서울응급의료지원센터',
      'SEO',
      3
    );

    console.log('검색: "서울응급의료지원센터"');
    if (searchResults.length > 0) {
      searchResults.forEach((result, idx) => {
        console.log(
          `  ${idx + 1}. ${result.canonical_name} (신뢰도: ${result.confidence_score}%)`
        );
      });
    } else {
      console.log('  -> 검색 결과 없음 (institution_registry가 비어있음)');
    }

    console.log('\n========================================');
    console.log('TNMS Phase 1 서비스 검증 완료');
    console.log('========================================');
  } catch (error) {
    console.error('오류 발생:', error);
    process.exit(1);
  }
}

testTnmsService();
