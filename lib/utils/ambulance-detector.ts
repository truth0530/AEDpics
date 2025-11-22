/**
 * 구급차 판별 유틸리티
 *
 * 단일 진실 소스(Single Source of Truth)로
 * 모든 구급차 판별 로직을 중앙화
 */

// 구급차 타입 (선택적 사용)
export type AmbulanceType = '119구급대' | '의료기관' | '기타' | null;

/**
 * target_list_2025용 구급차 판별
 * InstitutionGroupCard.tsx에서 사용
 *
 * @param institution - target_list_2025 레코드
 * @returns 구급차 여부
 */
export function isAmbulanceFromTarget(institution: {
  sub_division?: string | null
}): boolean {
  const subDivision = (institution.sub_division || '').trim();

  // "119및 의료기관 구급차" 패턴 감지
  // 현재는 단일 패턴이지만, 향후 확장 가능하도록 배열 관리
  const ambulancePatterns = [
    (text: string) => text.includes('119') && text.includes('구급차')
  ];

  return ambulancePatterns.some(pattern => pattern(subDivision));
}

/**
 * aed_data용 구급차 판별
 * ManagementNumberPanel.tsx에서 사용
 *
 * 현재 문제: "의료기관에서 운용 중인 구급차"만 감지 (46% 감지율)
 * 개선: 모든 구급차 패턴 감지 (목표 100%)
 *
 * @param item - aed_data 레코드
 * @returns 구급차 여부
 */
export function isAmbulanceFromAED(item: {
  category_1?: string | null;
  category_2?: string | null;
  installation_position?: string | null;
  location_detail?: string | null;
}): boolean {
  const category1 = (item.category_1 || '').trim();
  const category2 = (item.category_2 || '').trim();
  // installation_position 또는 location_detail 사용 (둘 다 같은 의미로 쓰임)
  const location = (item.installation_position || item.location_detail || '').trim();

  // 방어적 감지: category_2 우선, category_1 보조

  // 1. category_2에 "구급차" 포함 (대부분의 케이스)
  // 공백/오타 대비 정규식 사용
  const ambulanceRegex = /구급\s*차/;
  if (ambulanceRegex.test(category2)) {
    return true;
  }

  // 2. category_1이 "구비의무기관 외"이고 category_2가 정확히 "구급차"
  // (category_2가 비어있거나 특수한 경우 대비)
  if (category1 === '구비의무기관 외' && category2 === '구급차') {
    return true;
  }

  // 3. 안전망: category_1에도 "구급차" 포함 확인
  // (예외적인 데이터 구조 대비)
  if (ambulanceRegex.test(category1)) {
    // console.warn('Unusual ambulance pattern in category_1:', { category1, category2 });
    return true;
  }

  // 4. 데이터 품질 문제 대응: 설치 위치(installation_position)에서 "구급차" 키워드 확인
  // (DB에 카테고리 정보가 누락된 경우 대비)
  if (ambulanceRegex.test(location)) {
    return true;
  }

  // 5. 차량번호 패턴 감지 (예: "71보4348")
  // 구급차는 보통 차량번호가 함께 기재됨
  // 간단한 4자리 숫자 패턴 + 한글 조합 확인 (너무 일반적인 패턴이라 "구급" 키워드와 함께 있을 때만 유효할 수 있으나, 
  // 현재는 "구급차" 키워드가 없는 경우를 위해 보조적으로 사용하지 않음. 
  // 사용자 요청: "구급차라는 문구나 차량번호가 발견되면" -> 차량번호 패턴 추가 고려
  // 하지만 일반 장비에도 숫자가 있을 수 있으므로, "구급" 키워드가 가장 확실함.
  // 차량번호 패턴은 오탐 가능성이 있어 일단 "구급차" 키워드에 집중.

  return false;
}

/**
 * 구급차 타입 구분 (선택적, Phase 2용)
 *
 * @param item - aed_data 레코드
 * @returns 구급차 타입 또는 null
 */
export function getAmbulanceType(item: {
  category_1?: string | null;
  category_2?: string | null;
}): AmbulanceType {
  const category2 = (item.category_2 || '').trim();

  // 정확한 패턴 매칭 (우선순위 순)
  if (category2.includes('119구급대')) return '119구급대';
  if (category2.includes('의료기관')) return '의료기관';
  if (/구급\s*차/.test(category2)) return '기타';

  return null;
}

/**
 * 매칭 유효성 검증 (Strict Rule)
 * 구급차(Target) ↔ 일반 장비(AED) 간의 교차 매칭 차단
 *
 * @param targetIsAmbulance - Target(기관)이 구급차인지 여부
 * @param sourceIsAmbulance - Source(장비)가 구급차인지 여부
 */
export function validateMatching(
  targetIsAmbulance: boolean,
  sourceIsAmbulance: boolean
): { valid: boolean; error?: string } {
  if (targetIsAmbulance && !sourceIsAmbulance) {
    return {
      valid: false,
      error: '구급차(기관)에는 구급차 장비만 매칭할 수 있습니다.'
    };
  }

  if (!targetIsAmbulance && sourceIsAmbulance) {
    return {
      valid: false,
      error: '일반 기관에는 구급차 장비를 매칭할 수 없습니다.'
    };
  }

  return { valid: true };
}

/**
 * Basket 유효성 검증 (Soft Rule)
 * 구급차와 일반 장비가 섞여 있는지 확인
 *
 * @param items - Basket에 담긴 아이템들 (isAmbulanceFromAED로 판별 가능한 객체 배열)
 */
export function validateBasket(
  items: Array<{ category_1?: string | null; category_2?: string | null }>
): { valid: boolean; warning?: string } {
  if (items.length === 0) return { valid: true };

  const hasAmbulance = items.some(item => isAmbulanceFromAED(item));
  const hasGeneral = items.some(item => !isAmbulanceFromAED(item));

  if (hasAmbulance && hasGeneral) {
    return {
      valid: true, // 차단하지 않음 (Soft Rule)
      warning: '구급차와 일반 장비가 섞여 있습니다. 의도한 것이 아니라면 확인해주세요.'
    };
  }

  return { valid: true };
}
