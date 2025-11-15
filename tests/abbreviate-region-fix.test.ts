/**
 * region-utils.ts abbreviateRegion 부작용 검증 테스트
 *
 * 목적: replace('도') 부작용 제거 확인
 * 수정: .replace('도', '') → .replace(/도$/g, '')
 */

import { describe, it, expect } from '@jest/globals';
import { abbreviateRegion } from '@/lib/utils/region-utils';

describe('abbreviateRegion 부작용 검증', () => {

  /**
   * 테스트 1: 정상 시도명 축약
   */
  it('시도명이 올바르게 축약되는지 확인', () => {
    expect(abbreviateRegion('서울특별시')).toBe('서울');
    expect(abbreviateRegion('부산광역시')).toBe('부산');
    expect(abbreviateRegion('대구광역시')).toBe('대구');
    expect(abbreviateRegion('인천광역시')).toBe('인천');
    expect(abbreviateRegion('광주광역시')).toBe('광주');
    expect(abbreviateRegion('대전광역시')).toBe('대전');
    expect(abbreviateRegion('울산광역시')).toBe('울산');
    expect(abbreviateRegion('세종특별자치시')).toBe('세종');
    expect(abbreviateRegion('경기도')).toBe('경기');
    expect(abbreviateRegion('강원특별자치도')).toBe('강원');
    expect(abbreviateRegion('충청북도')).toBe('충청북');
    expect(abbreviateRegion('충청남도')).toBe('충청남');
    expect(abbreviateRegion('전북특별자치도')).toBe('전북');
    expect(abbreviateRegion('전라남도')).toBe('전라남');
    expect(abbreviateRegion('경상북도')).toBe('경상북');
    expect(abbreviateRegion('경상남도')).toBe('경상남');
    expect(abbreviateRegion('제주특별자치도')).toBe('제주');
  });

  /**
   * 테스트 2: 부작용 없음 확인 (중요!)
   * 수정 전에는 '도'가 중간에 있어도 제거됨 (버그)
   * 수정 후에는 끝에 있는 '도'만 제거 (정상)
   */
  it('중간에 있는 "도" 문자가 제거되지 않는지 확인', () => {
    // 구군명 테스트
    expect(abbreviateRegion('도봉구')).toBe('도봉구');
    expect(abbreviateRegion('도림동')).toBe('도림동');

    // 도로명 테스트 (만약 잘못 입력되더라도)
    expect(abbreviateRegion('중앙대로')).toBe('중앙대로');
    expect(abbreviateRegion('테헤란로')).toBe('테헤란로');

    // 기타 '도' 포함 문자열
    expect(abbreviateRegion('도청')).toBe('도청');
    expect(abbreviateRegion('도서관')).toBe('도서관');
  });

  /**
   * 테스트 3: 정규식 경계 조건 확인
   * /도$/g는 '도'가 끝에 있을 때만 매칭
   */
  it('끝에 있는 "도"만 제거되는지 확인', () => {
    expect(abbreviateRegion('경기도')).toBe('경기');
    expect(abbreviateRegion('강원도')).not.toBe('강원'); // '강원특별자치도'가 아니면 변화 없음
    expect(abbreviateRegion('도봉구도')).toBe('도봉구'); // 비현실적이지만 경계 테스트
  });

  /**
   * 테스트 4: 복합 접미사 처리
   */
  it('여러 접미사가 올바르게 제거되는지 확인', () => {
    expect(abbreviateRegion('서울특별시')).toBe('서울');
    expect(abbreviateRegion('세종특별자치시')).toBe('세종');
    expect(abbreviateRegion('강원특별자치도')).toBe('강원');
  });

  /**
   * 테스트 5: 빈 문자열 및 엣지 케이스
   */
  it('엣지 케이스가 올바르게 처리되는지 확인', () => {
    expect(abbreviateRegion('')).toBe('');
    expect(abbreviateRegion('도')).toBe(''); // '도'만 있으면 제거
    expect(abbreviateRegion('광역시')).toBe('');
    expect(abbreviateRegion('특별시')).toBe('');
  });

  /**
   * 테스트 6: 실제 사용 시나리오
   * ComparisonView.tsx에서 지역 버튼 표시용
   */
  it('ComparisonView에서 사용하는 17개 지역명이 올바르게 축약되는지 확인', () => {
    const REGIONS = [
      '서울특별시',
      '부산광역시',
      '대구광역시',
      '인천광역시',
      '광주광역시',
      '대전광역시',
      '울산광역시',
      '세종특별자치시',
      '경기도',
      '강원특별자치도',
      '충청북도',
      '충청남도',
      '전북특별자치도',
      '전라남도',
      '경상북도',
      '경상남도',
      '제주특별자치도',
    ];

    const expectedAbbreviations = [
      '서울',
      '부산',
      '대구',
      '인천',
      '광주',
      '대전',
      '울산',
      '세종',
      '경기',
      '강원',
      '충청북',
      '충청남',
      '전북',
      '전라남',
      '경상북',
      '경상남',
      '제주',
    ];

    REGIONS.forEach((region, index) => {
      expect(abbreviateRegion(region)).toBe(expectedAbbreviations[index]);
    });
  });
});

/**
 * 회귀 테스트 시나리오
 *
 * 수정 전 버그 재현 (참고용):
 * - abbreviateRegion('도봉구') → '봉구' ❌ (수정 전)
 * - abbreviateRegion('도봉구') → '도봉구' ✅ (수정 후)
 *
 * 실제 UI 테스트 (수동 실행 필요):
 * 1. components/inspections/ComparisonView.tsx 접속
 * 2. 지역 선택 버튼 확인
 * 3. 모든 지역명이 올바르게 표시되는지 확인
 */

export {};
