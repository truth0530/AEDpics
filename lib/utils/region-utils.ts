/**
 * 지역명 유틸리티 함수
 */

/**
 * 지역명에서 불필요한 접미사를 제거하여 축약된 형태로 반환
 *
 * @param region - 전체 지역명 (예: "서울특별시", "부산광역시")
 * @returns 축약된 지역명 (예: "서울", "부산")
 *
 * @example
 * abbreviateRegion("서울특별시") // "서울"
 * abbreviateRegion("부산광역시") // "부산"
 * abbreviateRegion("경기도") // "경기"
 * abbreviateRegion("세종특별자치시") // "세종"
 * abbreviateRegion("도봉구") // "도봉구" (부작용 없음)
 */
export function abbreviateRegion(region: string): string {
  return region
    .replace(/광역시$/g, '')
    .replace(/특별시$/g, '')
    .replace(/특별자치시$/g, '')
    .replace(/특별자치도$/g, '')
    .replace(/도$/g, '');  // 끝에만 매칭 (부작용 방지)
}

/**
 * 17개 시도 목록
 */
export const REGIONS = [
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
