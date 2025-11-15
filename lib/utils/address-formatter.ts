/**
 * 주소 약식 표현 유틸리티
 *
 * 목적: 화면마다 주소를 약식으로 표현하여 UI를 간결하게 유지
 * 원칙: 통합 시스템을 통해 일관되게 컨트롤 (하드코딩 금지)
 *
 * 예: "대구광역시 중구 ..." → "대구 중구 ..."
 */

import { REGION_LONG_LABELS, REGION_CODE_TO_LABEL } from '@/lib/constants/regions';

/**
 * 주소 문자열에서 긴 시도명을 짧은 형태로 변환
 *
 * @example
 * shortenSidoInAddress("대구광역시 중구 동덕로 167")
 * // "대구 중구 동덕로 167"
 *
 * shortenSidoInAddress("서울특별시 강남구 테헤란로 123")
 * // "서울 강남구 테헤란로 123"
 *
 * shortenSidoInAddress("충청남도 천안시 서북구")
 * // "충남 천안시 서북구"
 *
 * @param address - 원본 주소 문자열
 * @returns 시도명이 약식으로 변환된 주소
 */
export function shortenSidoInAddress(address: string | null | undefined): string {
  if (!address) {
    return '';
  }

  let result = address;

  // REGION_LONG_LABELS의 모든 긴 형태를 짧은 형태로 변환
  // 예: "대구광역시" → "대구", "서울특별시" → "서울"
  // 중요: 길이순으로 정렬하여 긴 문자열부터 먼저 처리
  // 이유: "중앙대로"에서 "중앙"이 먼저 매칭되면 "대구광역시" 변환을 못함
  const entries = Object.entries(REGION_LONG_LABELS).sort((a, b) => b[0].length - a[0].length);

  for (const [longName, code] of entries) {
    const shortName = REGION_CODE_TO_LABEL[code];

    if (shortName && result.includes(longName)) {
      // 긴 이름을 짧은 이름으로 치환
      result = result.replace(longName, shortName);
      // 첫 번째 매칭만 처리 (주소는 보통 시도명이 한 번만 나옴)
      break;
    }
  }

  return result;
}

/**
 * 시도/구군 컬럼 표시용 약식 변환
 *
 * @example
 * shortenSidoGugun("대구광역시 중구")
 * // "대구 중구"
 *
 * shortenSidoGugun("서울특별시 강남구")
 * // "서울 강남구"
 *
 * @param sidoGugun - "시도 구군" 형식의 문자열
 * @returns 시도명이 약식으로 변환된 문자열
 */
export function shortenSidoGugun(sidoGugun: string | null | undefined): string {
  return shortenSidoInAddress(sidoGugun);
}

/**
 * 배열의 모든 주소를 일괄 약식 변환
 *
 * @example
 * shortenAddressBatch([
 *   "대구광역시 중구 동덕로 167",
 *   "서울특별시 강남구 테헤란로 123"
 * ])
 * // ["대구 중구 동덕로 167", "서울 강남구 테헤란로 123"]
 *
 * @param addresses - 주소 문자열 배열
 * @returns 약식 변환된 주소 배열
 */
export function shortenAddressBatch(addresses: string[]): string[] {
  return addresses.map(address => shortenSidoInAddress(address));
}
