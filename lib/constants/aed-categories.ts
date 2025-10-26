/**
 * AED 분류 체계 정의
 * 대분류 > 중분류 > 소분류
 */

export interface Category {
  label: string;
  value: string;
}

export interface CategoryGroup {
  label: string;
  value: string;
  subcategories: Category[];
}

export interface CategoryHierarchy {
  label: string;
  value: string;
  subcategories: {
    label: string;
    value: string;
    items: Category[];
  }[];
}

// 대분류 옵션
export const CATEGORY_1_OPTIONS: Category[] = [
  { label: '의무', value: '의무' },
  { label: '비의무', value: '비의무' },
];

// 중분류 옵션 (대분류별로 구분)
export const CATEGORY_2_BY_CATEGORY_1: Record<string, Category[]> = {
  '의무': [
    { label: '보건의료기관', value: '보건의료기관' },
    { label: '관공서', value: '관공서' },
    { label: '기타공중이용시설', value: '기타공중이용시설' },
    { label: '산업시설', value: '산업시설' },
    { label: '교통시설', value: '교통시설' },
    { label: '운동시설', value: '운동시설' },
    { label: '종교시설', value: '종교시설' },
  ],
  '비의무': [
    { label: '집합건물', value: '집합건물' },
    { label: '상업시설', value: '상업시설' },
    { label: '기타시설', value: '기타시설' },
  ],
};

// 소분류 옵션 (중분류별로 구분)
export const CATEGORY_3_BY_CATEGORY_2: Record<string, Category[]> = {
  // 의무 > 보건의료기관
  '보건의료기관': [
    { label: '종합병원', value: '종합병원' },
    { label: '병원', value: '병원' },
    { label: '의원', value: '의원' },
    { label: '치과병원', value: '치과병원' },
    { label: '한의원', value: '한의원' },
    { label: '약국', value: '약국' },
  ],
  // 의무 > 관공서
  '관공서': [
    { label: '경찰서', value: '경찰서' },
    { label: '소방서', value: '소방서' },
    { label: '시청', value: '시청' },
    { label: '군청', value: '군청' },
    { label: '구청', value: '구청' },
    { label: '읍면사무소', value: '읍면사무소' },
    { label: '기타관공서', value: '기타관공서' },
  ],
  // 의무 > 기타공중이용시설
  '기타공중이용시설': [
    { label: '학교', value: '학교' },
    { label: '도서관', value: '도서관' },
    { label: '박물관', value: '박물관' },
    { label: '미술관', value: '미술관' },
    { label: '공연장', value: '공연장' },
    { label: '호텔', value: '호텔' },
    { label: '백화점', value: '백화점' },
    { label: '쇼핑센터', value: '쇼핑센터' },
    { label: '기타공중이용시설', value: '기타공중이용시설' },
  ],
  // 의무 > 산업시설
  '산업시설': [
    { label: '공장', value: '공장' },
    { label: '발전소', value: '발전소' },
    { label: '기타산업시설', value: '기타산업시설' },
  ],
  // 의무 > 교통시설
  '교통시설': [
    { label: '공항', value: '공항' },
    { label: '철도역', value: '철도역' },
    { label: '버스터미널', value: '버스터미널' },
    { label: '기차', value: '기차' },
    { label: '선박', value: '선박' },
    { label: '기타교통시설', value: '기타교통시설' },
  ],
  // 의무 > 운동시설
  '운동시설': [
    { label: '체육관', value: '체육관' },
    { label: '수영장', value: '수영장' },
    { label: '운동장', value: '운동장' },
    { label: '헬스장', value: '헬스장' },
    { label: '골프장', value: '골프장' },
    { label: '기타운동시설', value: '기타운동시설' },
  ],
  // 의무 > 종교시설
  '종교시설': [
    { label: '교회', value: '교회' },
    { label: '사찰', value: '사찰' },
    { label: '성당', value: '성당' },
    { label: '사원', value: '사원' },
    { label: '기타종교시설', value: '기타종교시설' },
  ],
  // 비의무 > 집합건물
  '집합건물': [
    { label: '아파트', value: '아파트' },
    { label: '주상복합', value: '주상복합' },
    { label: '오피스텔', value: '오피스텔' },
    { label: '상가주택', value: '상가주택' },
    { label: '컨벤션센터', value: '컨벤션센터' },
  ],
  // 비의무 > 상업시설
  '상업시설': [
    { label: '음식점', value: '음식점' },
    { label: '카페', value: '카페' },
    { label: '클럽', value: '클럽' },
    { label: '나이트', value: '나이트' },
    { label: '기타상업시설', value: '기타상업시설' },
  ],
  // 비의무 > 기타시설
  '기타시설': [
    { label: '종교시설', value: '종교시설' },
    { label: '문화시설', value: '문화시설' },
    { label: '주택', value: '주택' },
    { label: '기타시설', value: '기타시설' },
  ],
};

/**
 * Category 1에 따른 Category 2 옵션 반환
 */
export function getCategory2Options(category1: string | null): Category[] {
  if (!category1) return [];
  return CATEGORY_2_BY_CATEGORY_1[category1] || [];
}

/**
 * Category 2에 따른 Category 3 옵션 반환
 */
export function getCategory3Options(category2: string | null): Category[] {
  if (!category2) return [];
  return CATEGORY_3_BY_CATEGORY_2[category2] || [];
}

/**
 * 계층적 카테고리 전체 구조 반환
 */
export function getCategoryHierarchy(): CategoryHierarchy[] {
  return CATEGORY_1_OPTIONS.map((cat1) => ({
    label: cat1.label,
    value: cat1.value,
    subcategories: (CATEGORY_2_BY_CATEGORY_1[cat1.value] || []).map((cat2) => ({
      label: cat2.label,
      value: cat2.value,
      items: CATEGORY_3_BY_CATEGORY_2[cat2.value] || [],
    })),
  }));
}
