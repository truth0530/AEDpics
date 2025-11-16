/**
 * Match Tier System for Confidence Score Categorization
 * 매칭 신뢰도를 7단계 티어로 분류
 */

export type MatchTier = 'S' | 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D';

export interface MatchTierInfo {
  tier: MatchTier;
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
  description: string;
}

/**
 * 신뢰도 점수를 티어로 변환
 * @param confidence 매칭 신뢰도 (0-100)
 * @returns 티어 정보
 */
export function getMatchTier(confidence: number | null): MatchTierInfo {
  if (confidence === null || confidence < 70) {
    return {
      tier: 'D',
      label: '매칭불가',
      color: 'gray',
      bgColor: 'bg-gray-100 dark:bg-gray-800',
      textColor: 'text-gray-600 dark:text-gray-400',
      description: '신뢰도 매우 낮음'
    };
  }

  if (confidence >= 98) {
    return {
      tier: 'S',
      label: '확실',
      color: 'purple',
      bgColor: 'bg-purple-100 dark:bg-purple-900',
      textColor: 'text-purple-700 dark:text-purple-300',
      description: '이름+주소 완전 일치'
    };
  }

  if (confidence >= 95) {
    return {
      tier: 'A+',
      label: '매우높음',
      color: 'cyan',
      bgColor: 'bg-cyan-100 dark:bg-cyan-900',
      textColor: 'text-cyan-700 dark:text-cyan-300',
      description: '이름 완전 일치 또는 정규화 일치'
    };
  }

  if (confidence >= 91) {
    return {
      tier: 'A',
      label: '높음',
      color: 'green',
      bgColor: 'bg-green-100 dark:bg-green-900',
      textColor: 'text-green-700 dark:text-green-300',
      description: '부분 일치 + 주소 일치'
    };
  }

  if (confidence >= 86) {
    return {
      tier: 'B+',
      label: '중상',
      color: 'yellow',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900',
      textColor: 'text-yellow-700 dark:text-yellow-300',
      description: '부분 일치 + 구군 일치'
    };
  }

  if (confidence >= 81) {
    return {
      tier: 'B',
      label: '중',
      color: 'orange',
      bgColor: 'bg-orange-100 dark:bg-orange-900',
      textColor: 'text-orange-700 dark:text-orange-300',
      description: '부분 일치 또는 역방향 포함'
    };
  }

  // 71-80
  return {
    tier: 'C',
    label: '낮음',
    color: 'red',
    bgColor: 'bg-red-100 dark:bg-red-900',
    textColor: 'text-red-600 dark:text-red-300',
    description: 'Levenshtein 유사도만'
  };
}

/**
 * 티어가 고품질인지 판단 (A 티어 이상)
 * @param confidence 매칭 신뢰도
 * @returns A 티어 이상 여부
 */
export function isHighQualityMatch(confidence: number | null): boolean {
  if (confidence === null) return false;
  return confidence >= 91; // A 티어 이상
}

/**
 * 티어가 중간 이상인지 판단 (B+ 티어 이상)
 * @param confidence 매칭 신뢰도
 * @returns B+ 티어 이상 여부
 */
export function isMediumQualityMatch(confidence: number | null): boolean {
  if (confidence === null) return false;
  return confidence >= 86; // B+ 티어 이상
}
