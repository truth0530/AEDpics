/**
 * 보건소 명칭 매칭 유틸리티
 * 인트라넷 데이터와 회원가입 폼의 보건소 명칭을 일치시키기 위한 정규화 함수
 */

export class HealthCenterMatcher {
  /**
   * 보건소 명칭을 정규화하여 매칭 키 생성
   * 예: "대구광역시 중구보건소" → "대구중구"
   * 예: "대구광역시중구보건소" → "대구중구"
   * 예: "중구보건소" → "중구"
   */
  static normalizeForMatching(name: string): string {
    if (!name) return '';
    
    return name
      .replace(/\s+/g, '')                    // 모든 공백 제거
      .replace(/특별시|광역시|특별자치시|특별자치도|도/g, '') // 시도 접미사 제거
      .replace(/보건소$/g, '')                // '보건소' 접미사 제거
      .replace(/^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)/g, '') // 시도명 제거
      .toLowerCase();                         // 소문자로 통일
  }

  /**
   * 시도와 구군명으로부터 정규화된 키 생성
   */
  static createKey(province: string, district: string): string {
    const simplifiedProvince = province
      .replace(/특별시|광역시|특별자치시|특별자치도|도/g, '');
    const simplifiedDistrict = district
      .replace(/\s+/g, '')
      .replace(/보건소$/g, '');
    
    return `${simplifiedProvince}${simplifiedDistrict}`.toLowerCase();
  }

  /**
   * 두 보건소 명칭이 동일한지 확인
   */
  static isMatch(name1: string, name2: string): boolean {
    const normalized1 = this.normalizeForMatching(name1);
    const normalized2 = this.normalizeForMatching(name2);
    
    // 완전 일치
    if (normalized1 === normalized2) return true;
    
    // 한쪽이 다른 쪽을 포함하는 경우 (부분 매칭)
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      return true;
    }
    
    return false;
  }

  /**
   * 회원가입 폼의 보건소 명칭을 표준화
   * "서울특별시 중구 보건소" → "중구보건소"
   */
  static standardizeForDisplay(name: string): string {
    // 불필요한 공백 정리
    const standardized = name.trim().replace(/\s+/g, ' ');

    // "시도명 구군명 보건소" 형식에서 구군명+보건소만 추출
    const match = standardized.match(/([가-힣]+(?:시|구|군))\s*보건소$/);
    if (match) {
      return `${match[1]}보건소`;
    }

    // 이미 "구군보건소" 형식이면 그대로 반환
    if (standardized.includes('보건소')) {
      return standardized;
    }

    // 보건소가 없으면 추가
    return `${standardized}보건소`;
  }

  /**
   * 보건소 명칭을 약어로 변환 (보건소 제거)
   * "서울특별시 중구 보건소" → "중구"
   * "대구광역시중구보건소" → "중구"
   * "중구보건소" → "중구"
   */
  static getAbbreviation(name: string | null | undefined): string {
    if (!name) return '미등록';

    // 불필요한 공백 정리
    const cleaned = name.trim().replace(/\s+/g, ' ');

    // "보건소" 제거
    const withoutSuffix = cleaned.replace(/보건소$/g, '').trim();

    // "시도명 구군명" 형식에서 구군명만 추출
    const match = withoutSuffix.match(/(?:특별시|광역시|특별자치시|특별자치도|도)?\s*([가-힣]+(?:시|구|군))$/);
    if (match) {
      return match[1];
    }

    // 이미 구군명만 있으면 그대로 반환
    return withoutSuffix || '미등록';
  }

  /**
   * 인트라넷 데이터의 보건소명을 회원가입 폼의 선택지와 매칭
   * @param intranetName 인트라넷에서 온 보건소명 (예: "대구광역시중구보건소")
   * @param formOptions 회원가입 폼의 선택지 배열
   * @returns 매칭된 선택지 또는 null
   */
  static findMatchingOption(
    intranetName: string, 
    formOptions: string[]
  ): string | null {
    const normalizedIntranet = this.normalizeForMatching(intranetName);
    
    for (const option of formOptions) {
      const normalizedOption = this.normalizeForMatching(option);
      
      // 정규화된 형태가 일치하면 매칭
      if (normalizedIntranet === normalizedOption) {
        return option;
      }
      
      // 부분 매칭 (구/군명만 일치하는 경우)
      if (normalizedIntranet.includes(normalizedOption) || 
          normalizedOption.includes(normalizedIntranet)) {
        return option;
      }
    }
    
    return null;
  }

  /**
   * 매칭 스코어 계산 (유사도 기반)
   * Levenshtein Distance 간단 버전
   */
  static calculateSimilarity(str1: string, str2: string): number {
    const normalized1 = this.normalizeForMatching(str1);
    const normalized2 = this.normalizeForMatching(str2);
    
    if (normalized1 === normalized2) return 1.0;
    
    const longer = normalized1.length > normalized2.length ? normalized1 : normalized2;
    const shorter = normalized1.length > normalized2.length ? normalized2 : normalized1;
    
    if (longer.length === 0) return 0;
    
    // 포함 관계면 높은 점수
    if (longer.includes(shorter)) {
      return shorter.length / longer.length;
    }
    
    // 공통 문자 비율 계산
    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (longer.includes(shorter[i])) matches++;
    }
    
    return matches / longer.length;
  }

  /**
   * 가장 유사한 보건소 찾기
   */
  static findBestMatch(
    intranetName: string, 
    formOptions: string[]
  ): { option: string; score: number } | null {
    let bestMatch = null;
    let bestScore = 0;
    
    for (const option of formOptions) {
      const score = this.calculateSimilarity(intranetName, option);
      if (score > bestScore && score > 0.5) { // 50% 이상 유사도
        bestMatch = option;
        bestScore = score;
      }
    }
    
    return bestMatch ? { option: bestMatch, score: bestScore } : null;
  }
}

/**
 * 보건소 매칭 맵 (수동 매핑이 필요한 특수 케이스)
 */
export const SPECIAL_MAPPINGS: Record<string, string> = {
  // 대구 지역 특수 케이스
  '달성군보건소': '대구광역시 달성군 보건소',
  '대구광역시군위군보건소': '대구광역시 군위군 보건소', // 2023년 편입
  
  // 세종시 특수 케이스
  '세종시보건소': '세종특별자치시',
  '세종특별자치시보건소': '세종특별자치시',
  
  // 약어 처리
  '서울중구보건소': '서울특별시 중구 보건소',
  '부산중구보건소': '부산광역시 중구 보건소',
};

/**
 * 사용 예시
 * 
 * // 인트라넷 데이터 매칭
 * const intranetName = "대구광역시중구보건소";
 * const formOptions = ["대구광역시 중구 보건소", "대구광역시 동구 보건소"];
 * 
 * const matched = HealthCenterMatcher.findMatchingOption(intranetName, formOptions);
 * console.log(matched); // "대구광역시 중구 보건소"
 * 
 * // 유사도 기반 매칭
 * const bestMatch = HealthCenterMatcher.findBestMatch(intranetName, formOptions);
 * console.log(bestMatch); // { option: "대구광역시 중구 보건소", score: 0.95 }
 */