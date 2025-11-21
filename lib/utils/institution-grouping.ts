/**
 * 의무기관 중복 통합을 위한 유틸리티 함수
 */

// 타입 정의
export interface TargetInstitution {
  target_key: string;
  institution_name: string;
  sido: string;
  gugun: string;
  division: string;
  sub_division: string;
  unique_key?: string;
  address?: string;
  equipment_count: number;
  matched_count: number;
  unmatched_count: number;
}

export interface InstitutionGroup {
  groupId: string;
  masterInstitution: TargetInstitution;  // 대표 기관 (장비 수가 가장 많은 기관)
  members: TargetInstitution[];          // 그룹 멤버들
  similarity: number;                    // 평균 유사도
  totalEquipment: number;               // 총 장비 수
  confidence: 'high' | 'medium' | 'low'; // 그룹핑 신뢰도
}

export interface SimilarityResult {
  score: number;
  factors: {
    nameScore: number;
    addressScore: number;
    divisionScore: number;
  };
}

/**
 * 기관명 정규화
 * 공백, 특수문자 제거 및 일반적인 표기 통일
 */
export function normalizeInstitutionName(name: string): string {
  if (!name) return '';

  return name
    .toLowerCase()
    .replace(/\s+/g, '')                    // 모든 공백 제거
    .replace(/[\(\)（）\[\]]/g, '')         // 괄호 제거
    .replace(/[·・,，]/g, '')               // 구분자 제거
    .replace(/대학교병원|대학병원|대병원/g, '대병원')  // 병원명 통일
    .replace(/센터|센타/g, '센터')           // 센터 표기 통일
    .replace(/보건소|보건지소/g, '보건소')    // 보건소 통일
    .replace(/의원|클리닉/g, '의원')         // 의원 통일
    .replace(/주식회사|주\)|㈜|\(주\)/g, ''); // 회사 표기 제거
}

/**
 * Levenshtein Distance 계산
 * 두 문자열 간의 편집 거리를 계산
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const dp: number[][] = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) dp[i][0] = i;
  for (let j = 0; j <= len2; j++) dp[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // 삭제
        dp[i][j - 1] + 1,      // 삽입
        dp[i - 1][j - 1] + cost // 치환
      );
    }
  }

  return dp[len1][len2];
}

/**
 * 두 기관 간의 유사도 계산
 * 0 ~ 1 사이의 값 반환 (1에 가까울수록 유사)
 */
export function calculateSimilarity(
  inst1: TargetInstitution,
  inst2: TargetInstitution
): SimilarityResult {
  // 1. 기관명 유사도 (40%)
  const name1 = normalizeInstitutionName(inst1.institution_name);
  const name2 = normalizeInstitutionName(inst2.institution_name);
  const maxLen = Math.max(name1.length, name2.length);
  const distance = levenshteinDistance(name1, name2);
  const nameScore = maxLen > 0 ? (1 - distance / maxLen) : 0;

  // 2. 주소 유사도 (30%)
  let addressScore = 0;
  if (inst1.sido === inst2.sido) {
    addressScore += 0.5;
    if (inst1.gugun === inst2.gugun) {
      addressScore += 0.5;
    }
  }

  // 3. 분류 유사도 (30%)
  let divisionScore = 0;
  if (inst1.division === inst2.division) {
    divisionScore += 0.6;
    if (inst1.sub_division === inst2.sub_division) {
      divisionScore += 0.4;
    }
  }

  // 가중 평균 계산
  const totalScore = (nameScore * 0.4) + (addressScore * 0.3) + (divisionScore * 0.3);

  return {
    score: totalScore,
    factors: {
      nameScore,
      addressScore,
      divisionScore
    }
  };
}

/**
 * 기관 리스트를 그룹으로 묶기
 * @param institutions 기관 리스트
 * @param threshold 그룹핑 임계값 (기본 0.85)
 */
export function groupInstitutions(
  institutions: TargetInstitution[],
  threshold: number = 0.85
): {
  groups: InstitutionGroup[];
  ungrouped: TargetInstitution[];
} {
  const groups: InstitutionGroup[] = [];
  const processed = new Set<string>();
  const ungrouped: TargetInstitution[] = [];

  // 각 기관에 대해 그룹 찾기
  for (let i = 0; i < institutions.length; i++) {
    const current = institutions[i];

    // 이미 처리된 기관은 건너뛰기
    if (processed.has(current.target_key)) continue;

    // 현재 기관과 유사한 기관들 찾기
    const similarInstitutions: TargetInstitution[] = [current];
    const similarities: number[] = [];

    for (let j = i + 1; j < institutions.length; j++) {
      const candidate = institutions[j];

      // 이미 처리된 기관은 건너뛰기
      if (processed.has(candidate.target_key)) continue;

      const similarity = calculateSimilarity(current, candidate);

      if (similarity.score >= threshold) {
        similarInstitutions.push(candidate);
        similarities.push(similarity.score);
        processed.add(candidate.target_key);
      }
    }

    // 그룹 생성 (2개 이상일 때만)
    if (similarInstitutions.length >= 2) {
      // 장비 수가 가장 많은 기관을 대표로 선정
      const master = similarInstitutions.reduce((prev, curr) =>
        prev.equipment_count > curr.equipment_count ? prev : curr
      );

      const avgSimilarity = similarities.length > 0
        ? similarities.reduce((a, b) => a + b, 0) / similarities.length
        : 1;

      const totalEquipment = similarInstitutions.reduce(
        (sum, inst) => sum + inst.equipment_count,
        0
      );

      // 신뢰도 결정
      let confidence: 'high' | 'medium' | 'low' = 'low';
      if (avgSimilarity >= 0.95) confidence = 'high';
      else if (avgSimilarity >= 0.9) confidence = 'medium';

      groups.push({
        groupId: `group_${groups.length + 1}`,
        masterInstitution: master,
        members: similarInstitutions,
        similarity: avgSimilarity,
        totalEquipment,
        confidence
      });

      similarInstitutions.forEach(inst => processed.add(inst.target_key));
    } else {
      ungrouped.push(current);
      processed.add(current.target_key);
    }
  }

  // 그룹을 총 장비 수 기준으로 정렬 (많은 순)
  groups.sort((a, b) => b.totalEquipment - a.totalEquipment);

  return { groups, ungrouped };
}

/**
 * 빠른 그룹핑을 위한 해시 기반 접근
 * 정확도는 낮지만 속도가 빠름
 */
export function quickGroupByHash(institutions: TargetInstitution[]): Map<string, TargetInstitution[]> {
  const hashMap = new Map<string, TargetInstitution[]>();

  institutions.forEach(inst => {
    // 간단한 해시 생성 (시도 + 정규화된 기관명 앞 5글자)
    const normalized = normalizeInstitutionName(inst.institution_name);
    const hash = `${inst.sido}_${normalized.slice(0, 5)}`;

    if (!hashMap.has(hash)) {
      hashMap.set(hash, []);
    }
    hashMap.get(hash)!.push(inst);
  });

  // 단일 항목 그룹 제거
  const filteredMap = new Map<string, TargetInstitution[]>();
  hashMap.forEach((value, key) => {
    if (value.length >= 2) {
      filteredMap.set(key, value);
    }
  });

  return filteredMap;
}

/**
 * 그룹 통계 계산
 */
export function calculateGroupStats(
  groups: InstitutionGroup[],
  ungrouped: TargetInstitution[]
): {
  totalInstitutions: number;
  groupedInstitutions: number;
  ungroupedInstitutions: number;
  groupCount: number;
  averageGroupSize: number;
  potentialDuplicates: number;
  equipmentInGroups: number;
  equipmentInUngrouped: number;
} {
  const groupedInstitutions = groups.reduce((sum, g) => sum + g.members.length, 0);
  const averageGroupSize = groups.length > 0
    ? groupedInstitutions / groups.length
    : 0;

  const equipmentInGroups = groups.reduce((sum, g) => sum + g.totalEquipment, 0);
  const equipmentInUngrouped = ungrouped.reduce((sum, inst) => sum + inst.equipment_count, 0);

  // 잠재적 중복 수 (그룹핑된 기관 수 - 그룹 수)
  const potentialDuplicates = groupedInstitutions - groups.length;

  return {
    totalInstitutions: groupedInstitutions + ungrouped.length,
    groupedInstitutions,
    ungroupedInstitutions: ungrouped.length,
    groupCount: groups.length,
    averageGroupSize: Math.round(averageGroupSize * 10) / 10,
    potentialDuplicates,
    equipmentInGroups,
    equipmentInUngrouped
  };
}