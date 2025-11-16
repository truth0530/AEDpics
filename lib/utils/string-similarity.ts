/**
 * String Similarity Utilities for Fuzzy Matching
 * TEMPORARY: This will be replaced by TNMS standard_code based matching
 *
 * 2025-11-14: Created for temporary institution name matching improvement
 * Solves: "광주남구보건소" vs "광주광역시남구보건소" matching problem
 */

/**
 * Levenshtein Distance (Edit Distance)
 * 한 문자열을 다른 문자열로 변환하기 위해 필요한 최소 편집 작업 수
 * @param str1 첫 번째 문자열
 * @param str2 두 번째 문자열
 * @returns 편집 거리 (낮을수록 유사도 높음)
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;

  // 동적 프로그래밍 행렬
  const dp: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  // 초기값 설정
  for (let i = 0; i <= len1; i++) dp[i][0] = i;
  for (let j = 0; j <= len2; j++) dp[0][j] = j;

  // 행렬 채우기
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],    // 삭제
          dp[i][j - 1],    // 삽입
          dp[i - 1][j - 1] // 치환
        );
      }
    }
  }

  return dp[len1][len2];
}

/**
 * Normalized Similarity Score (0-100)
 * Levenshtein 거리를 정규화된 유사도 점수로 변환
 * @param str1 첫 번째 문자열
 * @param str2 두 번째 문자열
 * @returns 유사도 점수 (0-100, 100이 완전 일치)
 */
export function getSimilarityScore(str1: string, str2: string): number {
  if (str1 === str2) return 100;

  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 100;

  const distance = levenshteinDistance(str1, str2);
  const similarity = 100 - (distance / maxLen) * 100;

  return Math.round(similarity);
}

/**
 * 한글 특수 문자 정규화 (e.g., "광역시" 처리)
 * 행정구역 약칭화 + 공통 접사 제거로 기관명 동치 비교 개선
 * @param text 입력 텍스트
 * @returns 정규화된 텍스트
 */
export function normalizeKoreanText(text: string): string {
  return text
    // 행정구역 약칭화
    .replace(/광역시/g, '광시')
    .replace(/특별시/g, '특시')
    .replace(/자치도/g, '도')

    // 공통 기관 접사 제거 (기관명 동일성 판단 시)
    // "광주남구보건소" vs "광주광역시남구보건소" → "광주남구" vs "광주광시남구" → Levenshtein 개선
    .replace(/보건소$/g, '')           // 보건소
    .replace(/보건지소$/g, '')         // 보건지소
    .replace(/센터$/g, '')             // 센터
    .replace(/지소$/g, '')             // 지소
    .replace(/의료원$/g, '')           // 의료원
    .replace(/병원$/g, '')             // 병원
    .replace(/의원$/g, '')             // 의원
    .replace(/주민센터$/g, '')         // 주민센터
    .replace(/행정복지센터$/g, '')     // 행정복지센터

    // 공백 제거
    .replace(/\s+/g, '')

    // 특수문자 제거 (괄호, 쉼표 등)
    .replace(/[()(),.\-·]/g, '');
}

/**
 * 주소에서 읍면동 추출
 * @param address 주소 문자열
 * @returns 읍면동 문자열 또는 null
 */
function extractEupMyeonDong(address: string): string | null {
  // 읍/면/동/가/리/로 패턴 추출
  const pattern = /([가-힣]+(?:읍|면|동|가|리))/;
  const match = address.match(pattern);
  return match ? match[1] : null;
}

/**
 * 주소 유사도 비교 (가중치 계산용)
 * @param aedAddress AED 설치 주소
 * @param targetAddress 의무설치기관 주소
 * @returns 주소 매칭 점수 (0-100)
 */
export function compareAddresses(aedAddress: string, targetAddress: string): number {
  if (!aedAddress || !targetAddress) return 0;

  const aedNorm = aedAddress.replace(/\s+/g, '');
  const targetNorm = targetAddress.replace(/\s+/g, '');

  // 정확 일치
  if (aedNorm === targetNorm) return 100;

  // === 읍면동 레벨 비교 (2025-11-16 추가) ===
  // 군위읍 vs 의흥면 같은 경우를 감지하여 낮은 점수 부여
  const aedEupMyeonDong = extractEupMyeonDong(aedAddress);
  const targetEupMyeonDong = extractEupMyeonDong(targetAddress);

  if (aedEupMyeonDong && targetEupMyeonDong) {
    // 읍면동이 다르면 주소 점수 대폭 감소
    if (aedEupMyeonDong !== targetEupMyeonDong) {
      // 다른 읍면동 = 최대 30점만 부여 (기존 90점에서 대폭 감소)
      return 30;
    }
  }

  // 부분 일치 (포함 관계) - 읍면동이 같은 경우에만 높은 점수
  if (aedNorm.includes(targetNorm) || targetNorm.includes(aedNorm)) return 90;

  // Levenshtein 기반 유사도 (주소는 이름보다 엄격함)
  const similarity = getSimilarityScore(aedNorm, targetNorm);

  // 주소가 80% 이상 유사하면 인정
  return similarity >= 80 ? similarity : 0;
}

/**
 * 임시 퍼지 매칭 (TEMPORARY) - 가중치 기반 신뢰도 계산
 * 기관명 + 주소 + 지역 정보를 종합하여 신뢰도 산출
 *
 * TNMS 도입 후 이 함수는 제거되고 standard_code 기반 매칭으로 대체됨
 * @param aedInstitution AED 데이터의 기관명
 * @param targetInstitution 의무설치기관의 기관명
 * @param aedAddress AED 설치 주소
 * @param targetAddress 의무설치기관 주소
 * @param aedSido AED 시도 (주소 기반)
 * @param targetSido 의무설치기관 시도
 * @param aedGugun AED 구군 (주소 기반, 옵션)
 * @param targetGugun 의무설치기관 구군 (옵션)
 * @returns 매칭 신뢰도 (0-100, null = 매칭 불가)
 */
export function calculateInstitutionMatchConfidence(
  aedInstitution: string,
  targetInstitution: string,
  aedAddress?: string,
  targetAddress?: string,
  aedSido?: string,
  targetSido?: string,
  aedGugun?: string,
  targetGugun?: string
): number | null {
  if (!aedInstitution || !targetInstitution) return null;

  // === 단계 0: 부속시설 패턴 감지 및 제외 ===
  // "군위군보건소" vs "군위군보건소의흥면보건지소" 같은 경우 탐지
  const subsidiaryPatterns = [
    /보건지소$/,        // 보건지소
    /분소$/,            // 분소
    /출장소$/,          // 출장소
    /지소$/,            // 지소
    /지부$/,            // 지부
    /분원$/,            // 분원
  ];

  const aedNormalized = aedInstitution.replace(/\s+/g, '');
  const targetNormalized = targetInstitution.replace(/\s+/g, '');

  // 한 쪽이 다른 쪽의 substring이면서 부속시설 패턴을 가진 경우
  const isAedSubsidiaryOfTarget = targetNormalized.includes(aedNormalized) &&
    subsidiaryPatterns.some(pattern => targetNormalized.match(pattern));

  const isTargetSubsidiaryOfAed = aedNormalized.includes(targetNormalized) &&
    subsidiaryPatterns.some(pattern => aedNormalized.match(pattern));

  // 부속시설 관계인 경우 매칭 불가
  if (isAedSubsidiaryOfTarget || isTargetSubsidiaryOfAed) {
    return null;
  }

  // === 단계 1: 이름 유사도 계산 ===
  let nameScore = 0;

  if (aedNormalized === targetNormalized) {
    nameScore = 100; // 정확 일치
  } else if (aedNormalized.includes(targetNormalized) || targetNormalized.includes(aedNormalized)) {
    // 부분 일치이지만 부속시설이 아닌 경우
    // 점수를 낮춤 (90 → 75)
    nameScore = 75;
  } else {
    // 한글 정규화 후 유사도 계산
    const aedKoreanNormalized = normalizeKoreanText(aedInstitution);
    const targetKoreanNormalized = normalizeKoreanText(targetInstitution);

    if (aedKoreanNormalized === targetKoreanNormalized) {
      nameScore = 95; // 정규화 후 정확 일치
    } else {
      // Levenshtein 거리 기반 유사도
      nameScore = getSimilarityScore(aedKoreanNormalized, targetKoreanNormalized);
    }
  }

  // === 단계 2: 주소 유사도 계산 ===
  const addressScore = aedAddress && targetAddress
    ? compareAddresses(aedAddress, targetAddress)
    : 0;

  // === 단계 3: 지역 매칭 (시도) ===
  const regionScore = aedSido && targetSido && aedSido === targetSido
    ? 100
    : 0;

  // === 단계 4: 가중치 기반 최종 신뢰도 계산 ===
  // 주소 정보가 있는 경우: 이름 40% + 주소 40% + 지역 20%
  // 주소 정보가 없는 경우: 이름 50% + 주소 30% + 지역 20% (기존 방식 유지)
  let weightedConfidence: number;

  if (addressScore > 0) {
    // 주소 정보가 있으면 주소 가중치 증가 (30% → 40%)
    weightedConfidence = Math.round(
      (nameScore * 0.4) +
      (addressScore * 0.4) +
      (regionScore * 0.2)
    );
  } else {
    // 주소 정보가 없으면 기존 가중치 유지
    weightedConfidence = Math.round(
      (nameScore * 0.5) +
      (addressScore * 0.3) +
      (regionScore * 0.2)
    );
  }

  // === 단계 5: 키워드 보너스 (2025-11-16 추가) ===
  // 특정 키워드 매칭 시 보너스 점수 추가 (최대 100점 제한)
  let keywordBonus = 0;

  // 보건소 매칭 (+3점)
  if (aedInstitution.includes('보건소') && targetInstitution.includes('보건소')) {
    keywordBonus += 3;
  }

  // 구군 매칭 (+5점)
  if (aedGugun && targetGugun && aedGugun === targetGugun) {
    keywordBonus += 5;
  }

  // 법정동 매칭 (+2점) - 주소에서 "동", "로", "가" 포함 시
  if (aedAddress && targetAddress) {
    const dongPattern = /[가-힣]+동|[가-힣]+로|[가-힣]+가/;
    const aedDong = aedAddress.match(dongPattern)?.[0];
    const targetDong = targetAddress.match(dongPattern)?.[0];
    if (aedDong && targetDong && aedDong === targetDong) {
      keywordBonus += 2;
    }
  }

  // 의료 기관 키워드 매칭 (+2점)
  const medicalKeywords = ['센터', '의료원'];
  const hasCommonMedicalKeyword = medicalKeywords.some(
    keyword => aedInstitution.includes(keyword) && targetInstitution.includes(keyword)
  );
  if (hasCommonMedicalKeyword) {
    keywordBonus += 2;
  }

  // 키워드 보너스 적용 (최대 100점 제한)
  weightedConfidence = Math.min(100, weightedConfidence + keywordBonus);

  // 최소 임계값: 50% (이름 30% + 주소 20% 정도)
  // 하지만 주소가 0이면 이름만 사용 (이전 호환성)
  if (addressScore === 0 && nameScore >= 70) {
    // 주소 정보 없으면 이름 기반만 사용 (보너스 포함)
    const nameWithBonus = Math.min(100, nameScore + keywordBonus);
    return nameWithBonus;
  }

  return weightedConfidence >= 50 ? weightedConfidence : null;
}

/**
 * 단순 일치 여부 판단 (TRUE/FALSE만 반환)
 * 매칭/미매칭 필터링용
 * @param aedInstitution AED 데이터의 기관명
 * @param targetInstitution 의무설치기관의 기관명
 * @returns 매칭 여부
 */
export function shouldIncludeInMatch(
  aedInstitution: string,
  targetInstitution: string
): boolean {
  const confidence = calculateInstitutionMatchConfidence(aedInstitution, targetInstitution);
  return confidence !== null && confidence >= 70; // 임시 임계값: 70%
}
