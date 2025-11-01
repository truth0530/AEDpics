/**
 * 전화번호 지역번호 기반 지역 자동 선택 유틸리티
 */

// 지역번호 → 지역명 매핑
export const AREA_CODE_TO_REGION: Record<string, string> = {
  '02': '서울특별시',
  '031': '경기도',
  '032': '인천광역시',
  '033': '강원특별자치도',
  '041': '충청남도',
  '042': '대전광역시',
  '043': '충청북도',
  '044': '세종특별자치시',
  '051': '부산광역시',
  '052': '울산광역시',
  '053': '대구광역시',
  '054': '경상북도',
  '055': '경상남도',
  '061': '전라남도',
  '062': '광주광역시',
  '063': '전북특별자치도',
  '064': '제주특별자치도',
};

/**
 * 전화번호에서 지역번호 추출
 * @param phone - 전화번호 (예: "02-1234-5678", "031-123-4567")
 * @returns 지역번호 (예: "02", "031") 또는 null
 */
export function extractAreaCode(phone: string): string | null {
  if (!phone) return null;

  // 숫자만 추출
  const numbers = phone.replace(/[^0-9]/g, '');

  // 최소 2자리 이상이어야 함
  if (numbers.length < 2) return null;

  // 02로 시작하는 경우 (서울)
  if (numbers.startsWith('02')) {
    return '02';
  }

  // 0으로 시작하는 3자리 지역번호
  if (numbers.startsWith('0') && numbers.length >= 3) {
    const threeDigit = numbers.substring(0, 3);
    if (AREA_CODE_TO_REGION[threeDigit]) {
      return threeDigit;
    }
  }

  return null;
}

/**
 * 지역번호로 지역명 가져오기
 * @param areaCode - 지역번호 (예: "02", "031")
 * @returns 지역명 (예: "서울특별시", "경기도") 또는 null
 */
export function getRegionByAreaCode(areaCode: string | null): string | null {
  if (!areaCode) return null;
  return AREA_CODE_TO_REGION[areaCode] || null;
}

/**
 * 전화번호에서 지역명 추출
 * @param phone - 전화번호
 * @returns 지역명 또는 null
 */
export function getRegionFromPhone(phone: string): string | null {
  const areaCode = extractAreaCode(phone);
  return getRegionByAreaCode(areaCode);
}

/**
 * 전화번호가 특정 지역에 속하는지 확인
 * @param phone - 전화번호
 * @param region - 지역명
 * @returns 해당 지역인지 여부
 */
export function isPhoneFromRegion(phone: string, region: string): boolean {
  const detectedRegion = getRegionFromPhone(phone);
  return detectedRegion === region;
}
