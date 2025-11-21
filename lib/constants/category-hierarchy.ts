// AED 설치기관 분류체계 (모범사례 기준)
// 대분류 > 중분류 > 소분류

export const CATEGORY_HIERARCHY: Record<string, Record<string, string[]>> = {
  '구비의무기관': {
    '119구급대에서 운용 중인 구급차': ['119구급대에서 운용 중인 구급차'],
    '공공보건의료기관': ['공공보건의료기관'],
    '공동주택(500이상)': ['공동주택(500이상)'],
    '공항': ['공항'],
    '그밖에 대통령령으로 정하는 다중이용시설': [
      '경마장',
      '경주장',
      '교도소, 소년교도소, 구치소, 외국인보호소, 소년원',
      '시도청사',
      '여객자동차터미널의 대합실',
      '종합운동장(5천석이상)',
      '중앙행정기관청사',
      '철도역사의 대합실',
      '카지노',
    ],
    '보건관리자를 두어야 하는 300인 이상 사업장': ['보건관리자를 두어야 하는 300인 이상 사업장'],
    '여객항공기': ['여객항공기'],
    '의료기관에서 운용 중인 구급차': ['의료기관에서 운용 중인 구급차'],
    '철도 차량 중 객차': ['철도 차량 중 객차'],
    '총 톤수 20톤 이상인 선박': ['총 톤수 20톤 이상인 선박'],
  },
  '구비의무기관 외': {
    '500세대 미만': ['500세대 미만'],
    '건강': ['요양기관', '의료기관'],
    '공공시설': [
      '경찰관서',
      '구비의무기관 외 국가 또는 지방자치단체의 청사',
      '국방·군사시설',
      '기타',
      '사회복지시설',
      '종교시설',
      '학교',
    ],
    '교통시설': ['기타', '버스정류장', '지하철역'],
    '구급차': ['일반 구급차', '특수 구급차'],
    '구비의무기관 외': ['구비의무기관 외'],
    '기타': ['기타'],
    '상업시설': ['기타', '사무실', '쇼핑몰', '식당', '은행', '주유소'],
    '숙박,여가': ['공원', '그 밖의 스포츠시설', '기타', '수영장', '숙박시설', '헬스장'],
  },
};

// 대분류 목록
export const CATEGORY_1_OPTIONS = Object.keys(CATEGORY_HIERARCHY).sort();

// 특정 대분류에 대한 중분류 목록
export function getCategory2Options(category1: string): string[] {
  if (!category1 || !CATEGORY_HIERARCHY[category1]) {
    return [];
  }
  return Object.keys(CATEGORY_HIERARCHY[category1]).sort();
}

// 특정 대분류/중분류에 대한 소분류 목록
export function getCategory3Options(category1: string, category2: string): string[] {
  if (!category1 || !category2 || !CATEGORY_HIERARCHY[category1]?.[category2]) {
    return [];
  }
  return CATEGORY_HIERARCHY[category1][category2].sort();
}

// 전체 중분류 목록 (중복 제거)
export function getAllCategory2Options(): string[] {
  const allCat2 = new Set<string>();
  Object.values(CATEGORY_HIERARCHY).forEach(cat2Map => {
    Object.keys(cat2Map).forEach(cat2 => allCat2.add(cat2));
  });
  return Array.from(allCat2).sort();
}

// 전체 소분류 목록 (중복 제거)
export function getAllCategory3Options(): string[] {
  const allCat3 = new Set<string>();
  Object.values(CATEGORY_HIERARCHY).forEach(cat2Map => {
    Object.values(cat2Map).forEach(cat3Array => {
      cat3Array.forEach(cat3 => allCat3.add(cat3));
    });
  });
  return Array.from(allCat3).sort();
}
