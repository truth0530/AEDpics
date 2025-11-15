/**
 * healthCenterMatcher.ts 하드코딩 제거 검증 테스트
 *
 * 목적: 하드코딩된 지역명 → getRegionNamePatterns() 사용 확인
 * 수정: /^(서울|부산|...|제주)/g → 동적 정규식 생성
 */

import { describe, it, expect } from '@jest/globals';
import { HealthCenterMatcher } from '@/lib/utils/healthCenterMatcher';
import { getRegionNamePatterns } from '@/lib/constants/regions';

describe('HealthCenterMatcher 하드코딩 제거 검증', () => {

  /**
   * 테스트 1: getRegionNamePatterns 함수 동작 확인
   */
  it('getRegionNamePatterns가 17개 지역명을 반환하는지 확인', () => {
    const patterns = getRegionNamePatterns();

    expect(patterns.fullNames).toHaveLength(17);
    expect(patterns.shortNames).toHaveLength(17);

    // 대표 지역명 확인
    expect(patterns.fullNames).toContain('서울특별시');
    expect(patterns.fullNames).toContain('대구광역시');
    expect(patterns.fullNames).toContain('경기도');

    expect(patterns.shortNames).toContain('서울');
    expect(patterns.shortNames).toContain('대구');
    expect(patterns.shortNames).toContain('경기');
  });

  /**
   * 테스트 2: normalizeForMatching 정상 동작 확인
   */
  it('보건소 명칭이 올바르게 정규화되는지 확인', () => {
    // 정식 명칭
    expect(HealthCenterMatcher.normalizeForMatching('대구광역시 중구보건소')).toBe('중구');
    expect(HealthCenterMatcher.normalizeForMatching('서울특별시 강남구보건소')).toBe('강남구');
    expect(HealthCenterMatcher.normalizeForMatching('경기도 수원시보건소')).toBe('수원시');

    // 공백 없음
    expect(HealthCenterMatcher.normalizeForMatching('대구광역시중구보건소')).toBe('중구');
    expect(HealthCenterMatcher.normalizeForMatching('서울특별시강남구보건소')).toBe('강남구');

    // 구군명만
    expect(HealthCenterMatcher.normalizeForMatching('중구보건소')).toBe('중구');
    expect(HealthCenterMatcher.normalizeForMatching('강남구보건소')).toBe('강남구');
  });

  /**
   * 테스트 3: 모든 17개 시도 처리 확인 (하드코딩 제거 검증)
   */
  it('17개 시도명이 모두 올바르게 제거되는지 확인', () => {
    const testCases = [
      { input: '서울 강남구보건소', expected: '강남구' },
      { input: '부산 해운대구보건소', expected: '해운대구' },
      { input: '대구 중구보건소', expected: '중구' },
      { input: '인천 남동구보건소', expected: '남동구' },
      { input: '광주 동구보건소', expected: '동구' },
      { input: '대전 서구보건소', expected: '서구' },
      { input: '울산 남구보건소', expected: '남구' },
      { input: '세종 보건소', expected: '' },  // 세종은 구군 없음
      { input: '경기 수원시보건소', expected: '수원시' },
      { input: '강원 춘천시보건소', expected: '춘천시' },
      { input: '충북 청주시보건소', expected: '청주시' },
      { input: '충남 천안시보건소', expected: '천안시' },
      { input: '전북 전주시보건소', expected: '전주시' },
      { input: '전남 목포시보건소', expected: '목포시' },
      { input: '경북 포항시보건소', expected: '포항시' },
      { input: '경남 창원시보건소', expected: '창원시' },
      { input: '제주 제주시보건소', expected: '제주시' },
    ];

    testCases.forEach(({ input, expected }) => {
      const result = HealthCenterMatcher.normalizeForMatching(input);
      expect(result).toBe(expected);
    });
  });

  /**
   * 테스트 4: createKey 함수 동작 확인
   */
  it('시도와 구군으로 정규화된 키가 생성되는지 확인', () => {
    expect(HealthCenterMatcher.createKey('대구광역시', '중구보건소')).toBe('대구중구');
    expect(HealthCenterMatcher.createKey('서울특별시', '강남구 보건소')).toBe('서울강남구');
    expect(HealthCenterMatcher.createKey('경기도', '수원시보건소')).toBe('경기수원시');
  });

  /**
   * 테스트 5: isMatch 함수 동작 확인
   */
  it('보건소 명칭 매칭이 올바르게 동작하는지 확인', () => {
    expect(HealthCenterMatcher.isMatch('대구광역시 중구보건소', '중구보건소')).toBe(true);
    expect(HealthCenterMatcher.isMatch('대구광역시중구보건소', '중구보건소')).toBe(true);
    expect(HealthCenterMatcher.isMatch('서울특별시 강남구보건소', '강남구보건소')).toBe(true);

    // 다른 보건소
    expect(HealthCenterMatcher.isMatch('대구광역시 중구보건소', '동구보건소')).toBe(false);
  });

  /**
   * 테스트 6: 정규식 동적 생성 검증
   * 하드코딩 제거로 인해 regions.ts 변경 시 자동 반영되는지 확인
   */
  it('동적 정규식이 올바르게 생성되는지 확인', () => {
    const patterns = getRegionNamePatterns();
    const regionPattern = new RegExp(`^(${patterns.shortNames.join('|')})`, 'g');

    // 정규식이 17개 지역명을 모두 포함하는지 확인
    expect(regionPattern.source).toContain('서울');
    expect(regionPattern.source).toContain('부산');
    expect(regionPattern.source).toContain('대구');
    expect(regionPattern.source).toContain('제주');

    // 정규식 플래그 확인
    expect(regionPattern.flags).toBe('g');
  });

  /**
   * 테스트 7: 특수 케이스 처리
   */
  it('특수 케이스가 올바르게 처리되는지 확인', () => {
    // 공백 다수
    expect(HealthCenterMatcher.normalizeForMatching('대구   중구   보건소')).toBe('중구');

    // 대소문자 혼용 (소문자 변환)
    const result = HealthCenterMatcher.normalizeForMatching('대구광역시 중구보건소');
    expect(result).toBe(result.toLowerCase());

    // 빈 문자열
    expect(HealthCenterMatcher.normalizeForMatching('')).toBe('');
  });

  /**
   * 테스트 8: 회귀 테스트 - 하드코딩 제거 전후 동일 동작
   */
  it('하드코딩 제거 전후 동일하게 동작하는지 확인', () => {
    // 수정 전 하드코딩된 17개 지역
    const hardcodedRegions = [
      '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
      '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'
    ];

    // getRegionNamePatterns로 가져온 지역
    const dynamicRegions = getRegionNamePatterns().shortNames;

    // 정렬 후 비교 (순서는 다를 수 있음)
    const sortedHardcoded = [...hardcodedRegions].sort();
    const sortedDynamic = [...dynamicRegions].sort();

    expect(sortedDynamic).toEqual(sortedHardcoded);
  });
});

/**
 * 통합 테스트 시나리오
 *
 * 실제 사용 시나리오 테스트 (수동 실행 필요):
 *
 * 1. 회원가입 폼에서 보건소 선택
 *    - 시도 선택 시 해당 시도의 보건소 목록 로딩
 *    - 보건소명이 올바르게 매칭되는지 확인
 *
 * 2. 인트라넷 데이터 import
 *    - 다양한 형태의 보건소명이 올바르게 매칭되는지 확인
 *    - 예: "대구광역시중구보건소" → "대구광역시 중구 보건소"
 *
 * 3. regions.ts 변경 시나리오
 *    - regions.ts에서 지역명 수정
 *    - healthCenterMatcher가 자동으로 새 지역명을 사용하는지 확인
 */

export {};
