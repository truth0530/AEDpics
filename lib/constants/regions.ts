/**
 * 지역 관련 상수 및 유틸리티
 * 모든 컴포넌트에서 일관된 지역 코드/라벨을 사용하기 위한 중앙 관리 파일
 */

export interface Region {
  code: string;  // DB에 저장되는 코드 (예: 'KR', 'SEO')
  label: string; // UI에 표시되는 한글명 (예: '중앙', '서울특별시')
  type: 'central' | 'metropolitan' | 'province' | 'special';
  latitude?: number;  // 지역 중심 위도
  longitude?: number; // 지역 중심 경도
}

// 지역 상수 정의 (UI 표시용 짧은 이름 사용)
export const REGIONS: Region[] = [
  { code: 'KR', label: '중앙', type: 'central', latitude: 37.5665, longitude: 126.9780 },  // 서울 시청
  { code: 'SEO', label: '서울', type: 'metropolitan', latitude: 37.5665, longitude: 126.9780 },
  { code: 'BUS', label: '부산', type: 'metropolitan', latitude: 35.1796, longitude: 129.0756 },
  { code: 'DAE', label: '대구', type: 'metropolitan', latitude: 35.8714, longitude: 128.6014 },
  { code: 'INC', label: '인천', type: 'metropolitan', latitude: 37.4563, longitude: 126.7052 },
  { code: 'GWA', label: '광주', type: 'metropolitan', latitude: 35.1595, longitude: 126.8526 },
  { code: 'DAJ', label: '대전', type: 'metropolitan', latitude: 36.3504, longitude: 127.3845 },
  { code: 'ULS', label: '울산', type: 'metropolitan', latitude: 35.5384, longitude: 129.3114 },
  { code: 'SEJ', label: '세종', type: 'special', latitude: 36.4800, longitude: 127.2890 },
  { code: 'GYE', label: '경기', type: 'province', latitude: 37.4138, longitude: 127.5183 },
  { code: 'GAN', label: '강원', type: 'special', latitude: 37.8228, longitude: 128.1555 },
  { code: 'CHB', label: '충북', type: 'province', latitude: 36.6357, longitude: 127.4912 },
  { code: 'CHN', label: '충남', type: 'province', latitude: 36.5184, longitude: 126.8000 },
  { code: 'JEB', label: '전북', type: 'special', latitude: 35.7175, longitude: 127.1530 },
  { code: 'JEN', label: '전남', type: 'province', latitude: 34.8679, longitude: 126.9910 },
  { code: 'GYB', label: '경북', type: 'province', latitude: 36.4919, longitude: 128.8889 },
  { code: 'GYN', label: '경남', type: 'province', latitude: 35.4606, longitude: 128.2132 },
  { code: 'JEJ', label: '제주', type: 'special', latitude: 33.4890, longitude: 126.4983 }
];

// 코드 → 라벨 매핑
export const REGION_CODE_TO_LABEL: Record<string, string> = REGIONS.reduce(
  (acc, region) => ({ ...acc, [region.code]: region.label }),
  {}
);

// 라벨 → 코드 매핑 (짧은 형태)
export const REGION_LABEL_TO_CODE: Record<string, string> = REGIONS.reduce(
  (acc, region) => ({ ...acc, [region.label]: region.code }),
  {}
);

// 긴 형태 지역명 별칭 매핑 (승인 페이지 등에서 사용)
export const REGION_LONG_LABELS: Record<string, string> = {
  '중앙': 'KR',
  '서울특별시': 'SEO',
  '서울시': 'SEO',
  '부산광역시': 'BUS',
  '부산시': 'BUS',
  '대구광역시': 'DAE',
  '대구시': 'DAE',
  '인천광역시': 'INC',
  '인천시': 'INC',
  '광주광역시': 'GWA',
  '광주시': 'GWA',
  '대전광역시': 'DAJ',
  '대전시': 'DAJ',
  '울산광역시': 'ULS',
  '울산시': 'ULS',
  '세종특별자치시': 'SEJ',
  '세종시': 'SEJ',
  '경기도': 'GYE',
  '강원특별자치도': 'GAN',
  '강원도': 'GAN',
  '충청북도': 'CHB',
  '충청남도': 'CHN',
  '전북특별자치도': 'JEB',
  '전라북도': 'JEB',
  '전라남도': 'JEN',
  '경상북도': 'GYB',
  '경상남도': 'GYN',
  '제주특별자치도': 'JEJ',
  '제주도': 'JEJ'
};

// 승인 페이지용 정식 명칭 리스트
export const REGION_FULL_NAMES = [
  { code: 'KR', label: '중앙' },
  { code: 'SEO', label: '서울특별시' },
  { code: 'BUS', label: '부산광역시' },
  { code: 'DAE', label: '대구광역시' },
  { code: 'INC', label: '인천광역시' },
  { code: 'GWA', label: '광주광역시' },
  { code: 'DAJ', label: '대전광역시' },
  { code: 'ULS', label: '울산광역시' },
  { code: 'SEJ', label: '세종특별자치시' },
  { code: 'GYE', label: '경기도' },
  { code: 'GAN', label: '강원특별자치도' },
  { code: 'CHB', label: '충청북도' },
  { code: 'CHN', label: '충청남도' },
  { code: 'JEB', label: '전북특별자치도' },
  { code: 'JEN', label: '전라남도' },
  { code: 'GYB', label: '경상북도' },
  { code: 'GYN', label: '경상남도' },
  { code: 'JEJ', label: '제주특별자치도' }
];

const REGION_CODE_TO_FULL_LABEL: Record<string, string> = REGION_FULL_NAMES.reduce(
  (acc, region) => ({ ...acc, [region.code]: region.label }),
  {}
);

/**
 * 17개 시도 정식 명칭 배열 (중앙 제외)
 * 점검 비교 등 실제 지역 선택이 필요한 UI에서 사용
 */
export const REGION_FULL_NAME_LABELS = REGION_FULL_NAMES
  .filter(r => r.code !== 'KR')  // '중앙' 제외
  .map(r => r.label);

/**
 * 시도별 구군 목록 (UI/필터용)
 */
export const REGION_CODE_TO_GUGUNS: Record<string, string[]> = {
  SEO: ['종로구', '중구', '용산구', '성동구', '광진구', '동대문구', '중랑구', '성북구', '강북구', '도봉구', '노원구', '은평구', '서대문구', '마포구', '양천구', '강서구', '구로구', '금천구', '영등포구', '동작구', '관악구', '서초구', '강남구', '송파구', '강동구'],
  BUS: ['중구', '서구', '동구', '영도구', '부산진구', '동래구', '남구', '북구', '해운대구', '사하구', '금정구', '강서구', '연제구', '수영구', '사상구', '기장군'],
  DAE: ['중구', '동구', '서구', '남구', '북구', '수성구', '달서구', '달성군', '군위군'],
  INC: ['중구', '동구', '미추홀구', '연수구', '남동구', '부평구', '계양구', '서구', '강화군', '옹진군'],
  GWA: ['동구', '서구', '남구', '북구', '광산구'],
  DAJ: ['동구', '중구', '서구', '유성구', '대덕구'],
  ULS: ['중구', '남구', '동구', '북구', '울주군'],
  SEJ: ['세종시'],
  GYE: ['수원시', '성남시', '고양시', '용인시', '부천시', '안산시', '안양시', '남양주시', '화성시', '평택시', '의정부시', '시흥시', '파주시', '김포시', '광명시', '광주시', '군포시', '오산시', '이천시', '양주시', '안성시', '구리시', '포천시', '의왕시', '하남시', '여주시', '양평군', '동두천시', '과천시', '가평군', '연천군'],
  GAN: ['춘천시', '원주시', '강릉시', '동해시', '태백시', '속초시', '삼척시', '홍천군', '횡성군', '영월군', '평창군', '정선군', '철원군', '화천군', '양구군', '인제군', '고성군', '양양군'],
  CHB: ['청주시', '충주시', '제천시', '보은군', '옥천군', '영동군', '증평군', '진천군', '괴산군', '음성군', '단양군'],
  CHN: ['천안시', '공주시', '보령시', '아산시', '서산시', '논산시', '계룡시', '당진시', '금산군', '부여군', '서천군', '청양군', '홍성군', '예산군', '태안군'],
  JEB: ['전주시', '군산시', '익산시', '정읍시', '남원시', '김제시', '완주군', '진안군', '무주군', '장수군', '임실군', '순창군', '고창군', '부안군'],
  JEN: ['목포시', '여수시', '순천시', '나주시', '광양시', '담양군', '곡성군', '구례군', '고흥군', '보성군', '화순군', '장흥군', '강진군', '해남군', '영암군', '무안군', '함평군', '영광군', '장성군', '완도군', '진도군', '신안군'],
  GYB: ['포항시', '경주시', '김천시', '안동시', '구미시', '영주시', '영천시', '상주시', '문경시', '경산시', '군위군', '의성군', '청송군', '영양군', '영덕군', '청도군', '고령군', '성주군', '칠곡군', '예천군', '봉화군', '울진군', '울릉군'],
  GYN: ['창원시', '진주시', '통영시', '사천시', '김해시', '밀양시', '거제시', '양산시', '의령군', '함안군', '창녕군', '고성군', '남해군', '하동군', '산청군', '함양군', '거창군', '합천군'],
  JEJ: ['제주시', '서귀포시'],
};

/**
 * 복합 행정구역 계층 구조 (시 + 구)
 * 예: 천안시 → [동남구, 서북구]
 */
export interface GugunHierarchy {
  gugun: string;
  subGuguns: string[];
}

/**
 * 시도별 복합 행정구역 매핑
 * 시+구 구조를 가진 구군의 하위 구 목록
 */
export const COMPOSITE_GUGUNS: Record<string, Record<string, string[]>> = {
  GYE: { // 경기도
    '수원시': ['장안구', '권선구', '팔달구', '영통구'],
    '성남시': ['수정구', '중원구', '분당구'],
    '고양시': ['덕양구', '일산동구', '일산서구'],
    '안산시': ['상록구', '단원구'],
    '안양시': ['만안구', '동안구'],
    '용인시': ['처인구', '기흥구', '수지구'],
  },
  CHB: { // 충청북도
    '청주시': ['상당구', '서원구', '흥덕구', '청원구'],
  },
  CHN: { // 충청남도
    '천안시': ['동남구', '서북구'],
  },
  JEB: { // 전북특별자치도
    '전주시': ['완산구', '덕진구'],
  },
  GYB: { // 경상북도
    '포항시': ['남구', '북구'],
  },
  GYN: { // 경상남도
    '창원시': ['의창구', '성산구', '마산합포구', '마산회원구', '진해구'],
  },
};

export function getGugunListByRegionCode(regionCode: string): string[] {
  return REGION_CODE_TO_GUGUNS[regionCode] || [];
}

/**
 * 특정 구군의 하위 구 목록 가져오기
 * @param regionCode 시도 코드 (예: 'GYE')
 * @param gugun 구군명 (예: '천안시')
 * @returns 하위 구 목록 (예: ['동남구', '서북구']) 또는 빈 배열
 */
export function getSubGuguns(regionCode: string, gugun: string): string[] {
  return COMPOSITE_GUGUNS[regionCode]?.[gugun] || [];
}

/**
 * 특정 구군이 하위 구를 가지고 있는지 확인
 * @param regionCode 시도 코드
 * @param gugun 구군명
 * @returns 하위 구가 있으면 true
 */
export function hasSubGuguns(regionCode: string, gugun: string): boolean {
  return getSubGuguns(regionCode, gugun).length > 0;
}

/**
 * 시도별 모든 구군을 플랫하게 반환 (복합 행정구역 포함)
 * @param regionCode 시도 코드
 * @param includeSubGuguns 하위 구도 포함할지 여부 (기본: true)
 * @returns 구군 목록 (복합 행정구역의 경우 시와 하위 구 모두 포함)
 */
export function getAllGugunsFlat(regionCode: string, includeSubGuguns: boolean = true): string[] {
  const baseGuguns = REGION_CODE_TO_GUGUNS[regionCode] || [];

  if (!includeSubGuguns) {
    return baseGuguns;
  }

  const result: string[] = [];
  const compositeGuguns = COMPOSITE_GUGUNS[regionCode] || {};

  for (const gugun of baseGuguns) {
    result.push(gugun);

    // 하위 구가 있으면 추가
    const subGuguns = compositeGuguns[gugun];
    if (subGuguns) {
      result.push(...subGuguns);
    }
  }

  return result;
}

/**
 * 구군 계층 구조 가져오기
 * @param regionCode 시도 코드
 * @returns GugunHierarchy 배열
 */
export function getGugunHierarchy(regionCode: string): GugunHierarchy[] {
  const baseGuguns = REGION_CODE_TO_GUGUNS[regionCode] || [];
  const compositeGuguns = COMPOSITE_GUGUNS[regionCode] || {};

  return baseGuguns.map(gugun => ({
    gugun,
    subGuguns: compositeGuguns[gugun] || [],
  }));
}

// Supabase 원본 데이터에서 사용하는 한글 시도 라벨 매핑
// 짧은 이름 → DB 저장된 긴 이름 변환용
export const REGION_CODE_TO_DB_LABELS: Record<string, string[]> = {
  'SEO': ['서울특별시', '서울'],
  'BUS': ['부산광역시', '부산'],
  'DAE': ['대구광역시', '대구'],
  'INC': ['인천광역시', '인천'],
  'GWA': ['광주광역시', '광주'],
  'DAJ': ['대전광역시', '대전'],
  'ULS': ['울산광역시', '울산'],
  'SEJ': ['세종특별자치시', '세종특별시', '세종시', '세종'],
  'GYE': ['경기도', '경기'],
  'GAN': ['강원특별자치도', '강원'],
  'CHB': ['충청북도', '충북'],
  'CHN': ['충청남도', '충남'],
  'JEB': ['전북특별자치도', '전북'],
  'JEN': ['전라남도', '전남'],
  'GYB': ['경상북도', '경북'],
  'GYN': ['경상남도', '경남'],
  'JEJ': ['제주특별자치도', '제주'],
};

/**
 * 지역 코드로 라벨 가져오기
 */
export function getRegionLabel(code: string): string {
  return REGION_CODE_TO_LABEL[code] || code;
}

/**
 * 지역 라벨로 코드 가져오기 (짧은 형태, 긴 형태 모두 지원)
 */
export function getRegionCode(label: string): string {
  // 먼저 짧은 형태에서 찾기
  if (REGION_LABEL_TO_CODE[label]) {
    return REGION_LABEL_TO_CODE[label];
  }
  // 긴 형태에서 찾기
  if (REGION_LONG_LABELS[label]) {
    return REGION_LONG_LABELS[label];
  }
  // 못 찾으면 원본 반환
  return label;
}

/**
 * ⭐ 카카오맵 역지오코딩용: 정식명칭 → DB 짧은 이름 변환
 *
 * @example
 * normalizeRegionName("충청남도") // "충남"
 * normalizeRegionName("대구광역시") // "대구"
 * normalizeRegionName("전북특별자치도") // "전북"
 *
 * @description
 * 카카오맵 API가 반환하는 정식 지역명(예: "충청남도")을
 * DB에 저장된 짧은 이름(예: "충남")으로 변환합니다.
 *
 * ⚠️ 주의: 정규식으로 "도"를 제거하면 "충청남"이 되어 DB와 불일치!
 * 반드시 이 함수를 사용하세요.
 */
export function normalizeRegionName(fullName: string): string {
  // 먼저 긴 형식에서 코드 찾기
  let code = REGION_LONG_LABELS[fullName];

  // 긴 형식에 없으면 짧은 형식에서 찾기
  if (!code) {
    code = REGION_LABEL_TO_CODE[fullName];
  }

  if (!code) {
    // 매핑에 없으면 원본 반환
    return fullName;
  }

  // 코드로 짧은 이름 찾기
  const region = REGIONS.find(r => r.code === code);
  return region?.label || fullName;
}

/**
 * ⭐ 기관명에서 지역 추출 (보건소 매칭용)
 *
 * @example
 * extractRegionFromOrgName("대구광역시 수성구 보건소")
 * // { sido: "대구", gugun: "수성구" }
 *
 * extractRegionFromOrgName("충청남도 천안시 서북구 보건소")
 * // { sido: "충남", gugun: "서북구" }
 *
 * extractRegionFromOrgName("경기도 수원시 영통구 보건소")
 * // { sido: "경기", gugun: "영통구" }
 */
export function extractRegionFromOrgName(orgName: string): { sido: string | null; gugun: string | null } {
  if (!orgName) {
    return { sido: null, gugun: null };
  }

  // 복합 행정구역 패턴 (시+구 조합)
  const compositePatterns = [
    // 경기도 도시들
    { pattern: /수원시\s*([가-힣]+구)/, extract: (m: RegExpMatchArray) => m[1] },
    { pattern: /성남시\s*([가-힣]+구)/, extract: (m: RegExpMatchArray) => m[1] },
    { pattern: /고양시\s*([가-힣]+구)/, extract: (m: RegExpMatchArray) => m[1] },
    { pattern: /안산시\s*([가-힣]+구)/, extract: (m: RegExpMatchArray) => m[1] },
    { pattern: /안양시\s*([가-힣]+구)/, extract: (m: RegExpMatchArray) => m[1] },
    { pattern: /용인시\s*([가-힣]+구)/, extract: (m: RegExpMatchArray) => m[1] },
    // 충청도
    { pattern: /청주시\s*([가-힣]+구)/, extract: (m: RegExpMatchArray) => m[1] },
    { pattern: /천안시\s*([가-힣]+구)/, extract: (m: RegExpMatchArray) => m[1] },
    // 전라도
    { pattern: /전주시\s*([가-힣]+구)/, extract: (m: RegExpMatchArray) => m[1] },
    // 경상도
    { pattern: /포항시\s*([가-힣]+구)/, extract: (m: RegExpMatchArray) => m[1] },
    { pattern: /창원시\s*([가-힣]+구)/, extract: (m: RegExpMatchArray) => m[1] },
  ];

  // 시도 찾기
  let sido: string | null = null;
  let gugun: string | null = null;

  // 정식명칭을 먼저 찾기
  for (const [fullName, code] of Object.entries(REGION_LONG_LABELS)) {
    if (orgName.includes(fullName)) {
      sido = REGIONS.find(r => r.code === code)?.label || null;
      break;
    }
  }

  // 짧은 이름으로 찾기
  if (!sido) {
    for (const region of REGIONS) {
      if (orgName.includes(region.label)) {
        sido = region.label;
        break;
      }
    }
  }

  // 세종특별자치시 특별 처리 (실제 AED 데이터는 구군='세종시')
  if (orgName.includes('세종특별자치시')) {
    return { sido: '세종', gugun: '세종시' };
  }

  // 구군 추출: 복합 행정구역 먼저 체크
  for (const composite of compositePatterns) {
    const match = orgName.match(composite.pattern);
    if (match) {
      gugun = composite.extract(match);
      return { sido, gugun };
    }
  }

  // 일반 패턴 (단독 구/군/시)
  // 여러 개가 있을 수 있으므로 모두 추출
  const allMatches = orgName.matchAll(/([가-힣]+(?:구|군|시))/g);
  const matches = Array.from(allMatches);

  if (matches.length > 0) {
    // 마지막 매칭이 대부분 정확한 구군명
    gugun = matches[matches.length - 1][1];

    // 복합 시(수원시, 성남시 등)는 제외하고 구만 반환
    const compositeCity = ['수원시', '성남시', '고양시', '안산시', '안양시', '용인시', '청주시', '천안시', '전주시', '포항시', '창원시'];
    if (compositeCity.includes(gugun)) {
      // 다음 매칭이 있으면 그것이 구
      if (matches.length > 1) {
        gugun = matches[matches.length - 1][1];
      } else {
        gugun = null; // 구가 명시되지 않은 경우
      }
    }
  }

  return { sido, gugun };
}

/**
 * 지역 객체 가져오기
 */
export function getRegion(codeOrLabel: string): Region | undefined {
  return REGIONS.find(r => r.code === codeOrLabel || r.label === codeOrLabel);
}

/**
 * 긴 형태의 지역 라벨(예: 서울특별시) 가져오기
 */
export function getRegionFullLabel(code: string): string {
  return REGION_CODE_TO_FULL_LABEL[code] || getRegionLabel(code);
}

/**
 * ⭐ City Code (시군구) → Gugun (한글 시군구명) 매핑
 *
 * organizations.city_code (영문) → aed_data.gugun (한글) 변환
 * local_admin 권한 검증에 사용
 *
 * @example
 * mapCityCodeToGugun('seogwipo')  // '서귀포시'
 * mapCityCodeToGugun('jung')      // '중구'
 * mapCityCodeToGugun('unknown')   // null (매핑 실패 시 null 반환)
 * mapCityCodeToGugun(null)        // null
 *
 * @param cityCode - organizations.city_code (예: 'seogwipo', 'jung')
 * @returns aed_data.gugun 형식의 한글 시군구명, 또는 매핑 실패 시 null
 */
export const CITY_CODE_TO_GUGUN_MAP: Record<string, string> = {
  // 서울특별시
  'gangnam': '강남구',
  'gangdong': '강동구',
  'gangbuk': '강북구',
  'gangseo': '강서구',
  'gwanak': '관악구',
  'gwangjin': '광진구',
  'guro': '구로구',
  'geumcheon': '금천구',
  'nowon': '노원구',
  'dobong': '도봉구',
  'dongdaemun': '동대문구',
  'dongjak': '동작구',
  'mapo': '마포구',
  'seodaemun': '서대문구',
  'seocho': '서초구',
  'seongdong': '성동구',
  'seongbuk': '성북구',
  'songpa': '송파구',
  'yangcheon': '양천구',
  'yeongdeungpo': '영등포구',
  'yongsan': '용산구',
  'eunpyeong': '은평구',
  'jongno': '종로구',
  'jungnang': '중랑구',

  // 부산광역시
  'jung': '중구',
  'seo': '서구',
  'dong': '동구',
  'yeongdo': '영도구',
  'busanjin': '부산진구',
  'dongnae': '동래구',
  'nam': '남구',
  'buk': '북구',
  'haeundae': '해운대구',
  'saha': '사하구',
  'geumjeong': '금정구',
  'gangseo_gadeok': '강서구',
  'yeonje': '연제구',
  'suyeong': '수영구',
  'sasang': '사상구',
  'gijang': '기장군',

  // 대구광역시
  'dalseo': '달서구',
  'suseong': '수성구',
  'dalseong': '달성군',
  'gunwi': '군위군',

  // 인천광역시
  'donggu': '동구',
  'michuhol': '미추홀구',
  'yeonsu': '연수구',
  'namdong': '남동구',
  'bupyeong': '부평구',
  'gyeyang': '계양구',
  'ganghwa': '강화군',
  'ongjin': '옹진군',
  'jung_yeongjong': '중구',

  // 광주광역시
  'gwangsan': '광산구',

  // 대전광역시
  'daedeok': '대덕구',
  'yuseong': '유성구',

  // 울산광역시
  'ulju': '울주군',

  // 세종특별자치시
  'sejong': '세종시',  // 실제 AED 데이터는 구군='세종시'
  'seju': '세종시',    // 실제 AED 데이터는 구군='세종시'

  // 경기도
  'suwon': '수원시',
  'suwon-jangan': '장안구',
  'suwon-kwonseon': '권선구',
  'suwon-paldal': '팔달구',
  'suwon-yeongtong': '영통구',
  'seongnam': '성남시',
  'seongnam-sujeong': '수정구',
  'seongnam-jungwon': '중원구',
  'seongnam-bundang': '분당구',
  'uijeongbu': '의정부시',
  'anyang': '안양시',
  'anyang-manan': '만안구',
  'anyang-dongan': '동안구',
  'bucheon': '부천시',
  'gwangmyeong': '광명시',
  'pyeongtaek': '평택시',
  'dongducheon': '동두천시',
  'ansan': '안산시',
  'ansan-sangnok': '상록구',
  'ansan-danwon': '단원구',
  'goyang': '고양시',
  'goyang-deogyang': '덕양구',
  'goyang-ilsandong': '일산동구',
  'goyang-ilsanseo': '일산서구',
  'gwacheon': '과천시',
  'guri': '구리시',
  'namyangju': '남양주시',
  'namyangju_pungyang': '남양주시',
  'osan': '오산시',
  'siheung': '시흥시',
  'gunpo': '군포시',
  'uiwang': '의왕시',
  'hanam': '하남시',
  'yongin': '용인시',
  'yongin-cheoin': '처인구',
  'yongin-giheung': '기흥구',
  'yongin-suji': '수지구',
  'paju': '파주시',
  'icheon': '이천시',
  'anseong': '안성시',
  'gimpo': '김포시',
  'hwaseong': '화성시',
  'hwaseong_dongtan': '화성시',
  'gwangju': '광주시',
  'yangju': '양주시',
  'pocheon': '포천시',
  'yeoju': '여주시',
  'yeoncheon': '연천군',
  'gapyeong': '가평군',
  'yangpyeong': '양평군',

  // 강원특별자치도
  'chuncheon': '춘천시',
  'wonju': '원주시',
  'gangneung': '강릉시',
  'donghae': '동해시',
  'taebaek': '태백시',
  'sokcho': '속초시',
  'samcheok': '삼척시',
  'hongcheon': '홍천군',
  'hoengseong': '횡성군',
  'yeongwol': '영월군',
  'pyeongchang': '평창군',
  'jeongseon': '정선군',
  'cheorwon': '철원군',
  'hwacheon': '화천군',
  'yanggu': '양구군',
  'inje': '인제군',
  'goseong': '고성군',
  'yangyang': '양양군',

  // 충청북도
  'cheongju': '청주시',
  'cheongju-sangdang': '상당구',
  'cheongju-seowon': '서원구',
  'cheongju-heungdeok': '흥덕구',
  'cheongju-cheongwon': '청원구',
  'chungju': '충주시',
  'jecheon': '제천시',
  'boeun': '보은군',
  'okcheon': '옥천군',
  'yeongdong': '영동군',
  'jincheon': '진천군',
  'goesan': '괴산군',
  'eumseong': '음성군',
  'danyang': '단양군',
  'jeungpyeong': '증평군',

  // 충청남도
  'cheonan': '천안시',
  'cheonan-dongnam': '동남구',
  'cheonan-seobuk': '서북구',
  'gongju': '공주시',
  'boryeong': '보령시',
  'asan': '아산시',
  'seosan': '서산시',
  'nonsan': '논산시',
  'gyeryong': '계룡시',
  'dangjin': '당진시',
  'geumsan': '금산군',
  'buyeo': '부여군',
  'seocheon': '서천군',
  'cheongyang': '청양군',
  'hongseong': '홍성군',
  'yesan': '예산군',
  'taean': '태안군',

  // 전북특별자치도
  'jeonju': '전주시',
  'jeonju-wansan': '완산구',
  'jeonju-deokjin': '덕진구',
  'gunsan': '군산시',
  'iksan': '익산시',
  'jeongeup': '정읍시',
  'namwon': '남원시',
  'gimje': '김제시',
  'wanju': '완주군',
  'jinan': '진안군',
  'muju': '무주군',
  'jangsu': '장수군',
  'imsil': '임실군',
  'sunchang': '순창군',
  'gochang': '고창군',
  'buan': '부안군',

  // 전라남도
  'mokpo': '목포시',
  'yeosu': '여수시',
  'suncheon': '순천시',
  'naju': '나주시',
  'gwangyang': '광양시',
  'damyang': '담양군',
  'gokseong': '곡성군',
  'gurye': '구례군',
  'goheung': '고흥군',
  'boseong': '보성군',
  'hwasun': '화순군',
  'jangheung': '장흥군',
  'gangjin': '강진군',
  'haenam': '해남군',
  'yeongam': '영암군',
  'muan': '무안군',
  'hampyeong': '함평군',
  'yeonggwang': '영광군',
  'jangseong': '장성군',
  'wando': '완도군',
  'jindo': '진도군',
  'sinan': '신안군',

  // 경상북도
  'pohang': '포항시',
  'gyeongju': '경주시',
  'gimcheon': '김천시',
  'andong': '안동시',
  'gumi': '구미시',
  'yeongju': '영주시',
  'yeongcheon': '영천시',
  'sangju': '상주시',
  'mungyeong': '문경시',
  'gyeongsan': '경산시',
  'uiseong': '의성군',
  'cheongsong': '청송군',
  'yeongyang': '영양군',
  'yeongdeok': '영덕군',
  'cheongdo': '청도군',
  'goryeong': '고령군',
  'seongju': '성주군',
  'chilgok': '칠곡군',
  'yecheon': '예천군',
  'bonghwa': '봉화군',
  'uljin': '울진군',
  'ulleung': '울릉군',

  // 경상남도
  'changwon': '창원시',
  'changwon-uichang': '의창구',
  'changwon-seongsan': '성산구',
  'changwon-masanhappo': '마산합포구',
  'changwon-masanhoewon': '마산회원구',
  'changwon-jinhae': '진해구',
  'jinju': '진주시',
  'tongyeong': '통영시',
  'tongyeong_yokji': '통영시',
  'sacheon': '사천시',
  'gimhae': '김해시',
  'miryang': '밀양시',
  'geoje': '거제시',
  'yangsan': '양산시',
  'uiryeong': '의령군',
  'haman': '함안군',
  'changnyeong': '창녕군',
  'namhae': '남해군',
  'hadong': '하동군',
  'sancheong': '산청군',
  'hamyang': '함양군',
  'geochang': '거창군',
  'hapcheon': '합천군',

  // 제주특별자치도
  'jeju': '제주시',
  'seogwipo': '서귀포시',
};

const GUGUN_TO_CITY_CODE_MAP: Record<string, string> = Object.entries(CITY_CODE_TO_GUGUN_MAP)
  .reduce((acc, [cityCode, gugun]) => {
    if (!acc[gugun]) {
      acc[gugun] = cityCode;
    }
    return acc;
  }, {} as Record<string, string>);

/**
 * City Code를 Gugun으로 매핑하는 함수
 * @param cityCode - organizations.city_code
 * @returns 매핑된 gugun, 또는 매핑 실패 시 null
 */
export function mapCityCodeToGugun(cityCode: string | null | undefined): string | null {
  if (!cityCode) return null;
  return CITY_CODE_TO_GUGUN_MAP[cityCode] || null;
}

export function mapGugunToCityCode(gugun: string | null | undefined): string | null {
  if (!gugun) {
    return null;
  }
  return GUGUN_TO_CITY_CODE_MAP[gugun] || null;
}

/**
 * Supabase RPC 호출용으로 지역 코드를 한글 라벨 배열로 변환
 */
export function mapRegionCodesToDbLabels(codes?: string[] | null): string[] | null {
  if (!codes || codes.length === 0) {
    return null;
  }

  const mapped = codes.flatMap((code) => {
    const labels = REGION_CODE_TO_DB_LABELS[code];
    if (!labels || labels.length === 0) {
      // 매핑이 없으면 코드를 그대로 반환
      return [code];
    }
    // 매핑이 있으면 라벨만 반환 (코드는 제외)
    return labels;
  });

  const normalized = mapped
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  if (normalized.length === 0) {
    return null;
  }

  return Array.from(new Set(normalized));
}

/**
 * 관할보건소 명칭 정규화 (다중 변형 패턴 생성)
 *
 * 중앙 관리: lib/constants/regions.ts의 REGION_LONG_LABELS 사용 (하드코딩 금지)
 *
 * organizations 테이블의 명칭을 aed_data.jurisdiction_health_center의
 * 모든 가능한 변형 패턴으로 변환하여 배열로 반환
 *
 * @param name organizations 테이블의 명칭 (예: "대구광역시 중구 보건소")
 * @returns 매칭 가능한 모든 변형 패턴 배열
 *
 * @example
 * // "대구광역시 중구 보건소" → ["대구광역시중구보건소", "중구보건소"]
 * normalizeJurisdictionName("대구광역시 중구 보건소")
 *
 * @example
 * // "제주특별자치도 서귀포시 보건소" → ["제주특별자치도서귀포시보건소", "서귀포시보건소", "서귀포시서귀포보건소"]
 * normalizeJurisdictionName("제주특별자치도 서귀포시 보건소")
 */
export function normalizeJurisdictionName(name?: string | null): string[] {
  if (!name) {
    return [];
  }
  const trimmed = name.trim();
  if (!trimmed) {
    return [];
  }

  const variants: string[] = [];

  // 1. 공백 제거 (기본 형식)
  const noSpace = trimmed.replace(/\s+/g, '');
  variants.push(noSpace);  // "대구광역시중구보건소"

  // 2. 시도명 제거 패턴
  // 중앙 관리: REGION_LONG_LABELS의 키를 동적으로 사용 (하드코딩 금지)
  const sidoNames = Object.keys(REGION_LONG_LABELS)
    .filter(name => name !== '중앙')  // 중앙 제외
    .sort((a, b) => b.length - a.length);  // 긴 이름부터 매칭 ("서울특별시" before "서울시")

  // 정규표현식 동적 생성
  const sidoPattern = new RegExp(`^(${sidoNames.join('|')})`);
  const sidoRemoved = noSpace.replace(sidoPattern, '');

  if (sidoRemoved !== noSpace && sidoRemoved.endsWith('보건소')) {
    variants.push(sidoRemoved);  // "중구보건소"
  }

  // 3. 구군명 중복 패턴
  // "서귀포시보건소" → "서귀포시서귀포보건소"
  const districtMatch = sidoRemoved.match(/^(.+?)(시|군|구)보건소$/);
  if (districtMatch) {
    const cityName = districtMatch[1];  // "서귀포"
    const districtType = districtMatch[2];  // "시"
    const duplicated = cityName + districtType + cityName + '보건소';
    variants.push(duplicated);  // "서귀포시서귀포보건소"
  }

  // 4. 중복 제거 및 반환
  return [...new Set(variants)];
}

/**
 * 역할에 따라 허용된 지역 필터링
 */
export function getAllowedRegions(role: string): Region[] {
  switch (role) {
    case 'emergency_center_admin':
    case 'ministry_admin':
      // 중앙 역할은 중앙 지역만
      return REGIONS.filter(r => r.code === 'KR');

    case 'regional_admin':
      // 시도 관리자는 중앙 제외한 모든 지역
      return REGIONS.filter(r => r.code !== 'KR');

    case 'local_admin':
      // 보건소 담당자는 중앙 제외한 모든 지역
      return REGIONS.filter(r => r.code !== 'KR');

    default:
      return REGIONS;
  }
}

/**
 * 지역 유효성 검사
 */
export function isValidRegionForRole(regionCode: string, role: string): boolean {
  const allowedRegions = getAllowedRegions(role);
  return allowedRegions.some(r => r.code === regionCode);
}

/**
 * 지역 라벨 리스트 (드롭다운용)
 */
export function getRegionLabels(): string[] {
  return REGIONS.map(r => r.label);
}

/**
 * 지역 코드 리스트
 */
export function getRegionCodes(): string[] {
  return REGIONS.map(r => r.code);
}

/**
 * ⭐ 조직명에서 region_code 자동 추출
 *
 * @example
 * getRegionCodeFromOrgName("서울응급의료지원센터") // "SEO"
 * getRegionCodeFromOrgName("대구광역시 수성구 보건소") // "DAE"
 * getRegionCodeFromOrgName("충청남도") // "CHN"
 *
 * @description
 * 조직명이나 지역명에서 region_code를 자동으로 추출합니다.
 * 긴 형태(서울특별시)와 짧은 형태(서울) 모두 지원합니다.
 */
export function getRegionCodeFromOrgName(orgName: string): string | null {
  if (!orgName) return null;

  // 1. 긴 형태의 지역명 검색
  for (const [longLabel, code] of Object.entries(REGION_LONG_LABELS)) {
    if (orgName.includes(longLabel)) {
      return code;
    }
  }

  // 2. 짧은 형태의 지역명 검색
  for (const region of REGIONS) {
    if (orgName.includes(region.label)) {
      return region.code;
    }
  }

  return null;
}

/**
 * ⭐ 한글 지역명을 region_code로 변환 (통합 버전)
 *
 * @example
 * normalizeRegionCode("대구광역시") // "DAE"
 * normalizeRegionCode("대구") // "DAE"
 * normalizeRegionCode("DAE") // "DAE"
 *
 * @description
 * 다양한 형태의 지역명을 표준 region_code로 변환합니다.
 * - 이미 코드인 경우: 그대로 반환
 * - 긴 형태(대구광역시): 코드로 변환
 * - 짧은 형태(대구): 코드로 변환
 */
export function normalizeRegionCode(value: string): string | null {
  if (!value) return null;

  // 이미 유효한 코드인 경우
  if (REGIONS.some(r => r.code === value)) {
    return value;
  }

  // 긴 형태에서 찾기
  if (REGION_LONG_LABELS[value]) {
    return REGION_LONG_LABELS[value];
  }

  // 짧은 형태에서 찾기
  if (REGION_LABEL_TO_CODE[value]) {
    return REGION_LABEL_TO_CODE[value];
  }

  return null;
}

/**
 * ⭐ 지역 정렬 순서 가져오기
 *
 * @example
 * getRegionSortOrder("서울") // 1
 * getRegionSortOrder("부산") // 2
 * getRegionSortOrder("제주") // 17
 *
 * @description
 * 지역명의 표준 정렬 순서를 반환합니다.
 * REGIONS 배열의 순서를 기준으로 합니다.
 * 매핑되지 않은 지역은 999를 반환하여 맨 뒤로 정렬됩니다.
 */
export function getRegionSortOrder(regionLabel: string): number {
  const index = REGIONS.findIndex(r => r.label === regionLabel);
  return index >= 0 ? index : 999;
}

/**
 * ⭐ AED 데이터 정규화: e-gen 원본 데이터의 모든 지역명 변형을 표준 형태로 변환
 *
 * e-gen에서 오는 실제 데이터는 다음과 같은 변형들이 섞여 있습니다:
 * - 정식명: "경기도", "충청남도", "서울특별시"
 * - 약어: "경기", "충남", "서울"
 * - 비표준: "경기도청", "경 기" (공백 포함), "경기,경기도" 등
 *
 * 이 함수는 모든 변형을 정규화된 값으로 변환하여
 * 대시보드 GROUP BY와 권한 검증에서 일관된 결과를 제공합니다.
 *
 * @example
 * normalizeAedDataRegion("경기도")      // "경기도"
 * normalizeAedDataRegion("경기")        // "경기도"
 * normalizeAedDataRegion("경기도청")    // "경기도"
 * normalizeAedDataRegion("경 기")       // "경기도"
 * normalizeAedDataRegion("서울")        // "서울특별시"
 * normalizeAedDataRegion("충남")        // "충청남도"
 *
 * @param rawRegionValue - aed_data.sido의 원본값 또는 사용자 입력값
 * @returns 정규화된 지역명 (또는 매핑 실패 시 원본값)
 * @description 적용 위치: 대시보드 쿼리, API 필터링, 권한 검증
 */
export function normalizeAedDataRegion(rawRegionValue: string | null | undefined): string {
  if (!rawRegionValue) {
    return '';
  }

  let normalized = rawRegionValue.trim();

  // 1. 공백 제거 (예: "경 기" → "경기")
  normalized = normalized.replace(/\s+/g, '');

  // 2. 접미사 제거 (예: "경기도청" → "경기도", "충남청" → "충남")
  normalized = normalized.replace(/청$/g, '');

  // 3. 정규화: 약어를 정식명칭으로 변환
  const abbreviationToFullName: Record<string, string> = {
    '경기': '경기도',
    '강원': '강원도',
    '충북': '충청북도',
    '충남': '충청남도',
    '전북': '전라북도',
    '전남': '전라남도',
    '경북': '경상북도',
    '경남': '경상남도',
    '제주': '제주도',
    '서울': '서울특별시',
    '부산': '부산광역시',
    '대구': '대구광역시',
    '인천': '인천광역시',
    '광주': '광주광역시',
    '대전': '대전광역시',
    '울산': '울산광역시',
    '세종': '세종특별자치시',
  };

  // 약어 매핑 확인
  if (abbreviationToFullName[normalized]) {
    return abbreviationToFullName[normalized];
  }

  // 4. 이미 정식명칭이면 그대로 반환
  // (예: "경기도", "서울특별시", "제주특별자치도")
  if (REGION_LONG_LABELS[normalized]) {
    return normalized;
  }

  // 5. 직접 코드 매핑을 통해 정식명칭 찾기
  // 예를 들어 "경기도"의 코드는 'GYE'이고,
  // REGION_FULL_NAMES에서 'GYE' → "경기도"를 찾음
  const code = REGION_LONG_LABELS[normalized] || REGION_LABEL_TO_CODE[normalized];
  if (code) {
    const fullName = REGION_FULL_NAMES.find(r => r.code === code)?.label;
    if (fullName) {
      return fullName;
    }
  }

  // 6. 그 외는 원본 반환
  return rawRegionValue;
}

/**
 * ⭐ 대시보드/API 쿼리에서 사용할 정규화 함수 (SQL/Prisma용)
 *
 * 대시보드 쿼리에서 GROUP BY할 때 정규화된 값을 사용합니다.
 * Prisma에서는 readOnlyAfter() 후 normalizeAedDataRegion을 적용합니다.
 * Raw SQL 쿼리에서는 PostgreSQL CASE WHEN으로 처리하거나
 * 어플리케이션 레이어에서 정규화합니다.
 *
 * @example
 * // Prisma 사용 (권장)
 * const data = await prisma.aed_data.findMany();
 * const normalized = data.map(d => ({
 *   ...d,
 *   sido: normalizeAedDataRegion(d.sido)
 * }));
 *
 * // Raw SQL (복잡한 집계인 경우)
 * const results = await prisma.$queryRaw`
 *   SELECT
 *     normalizeAedDataRegion(sido) as normalized_sido,
 *     COUNT(*) as count
 *   FROM aed_data
 *   GROUP BY normalizeAedDataRegion(sido)
 * `
 */
export function getNormalizedRegionLabel(regionCode: string): string {
  // 코드를 정식명칭으로 변환
  const fullName = REGION_FULL_NAMES.find(r => r.code === regionCode)?.label;
  return fullName || REGION_CODE_TO_LABEL[regionCode] || regionCode;
}

// ============================================================================
// Phase 0: Factory 생성 지원용 헬퍼 함수들 (2025-11-09 추가)
// ============================================================================

/**
 * ⭐ 정식 지역명 조회
 *
 * @example
 * getFullRegionName('SEO')  // '서울특별시'
 * getFullRegionName('DAE')  // '대구광역시'
 * getFullRegionName('KR')   // '중앙'
 *
 * @description
 * 지역 코드(regionCode)를 정식 지역명으로 변환합니다.
 * Factory에서 fullRegionName 필드를 채울 때 사용됩니다.
 */
export function getFullRegionName(regionCode: string): string {
  return REGION_CODE_TO_FULL_LABEL[regionCode] || REGION_CODE_TO_LABEL[regionCode] || regionCode;
}

/**
 * ⭐ 응급의료지원센터 명칭 생성
 *
 * @example
 * getEmergencyCenterName('SEO')  // '서울응급의료지원센터'
 * getEmergencyCenterName('BUS')  // '부산응급의료지원센터'
 * getEmergencyCenterName('KR')   // '중앙응급의료지원센터'
 *
 * @description
 * 지역 코드를 기반으로 응급의료지원센터 조직명을 생성합니다.
 * Factory에서 organizations 배열에 추가할 때 사용됩니다.
 */
export function getEmergencyCenterName(regionCode: string): string {
  const shortLabel = REGION_CODE_TO_LABEL[regionCode] || regionCode;
  return `${shortLabel}응급의료지원센터`;
}

/**
 * ⭐ 보건소 명칭 생성
 *
 * @example
 * generateHealthCenterName('SEO', '강남구')  // '서울특별시 강남구 보건소'
 * generateHealthCenterName('DAE', '중구')    // '대구광역시 중구 보건소'
 * generateHealthCenterName('SEJ', '세종시')  // '세종특별자치시 세종시 보건소'
 *
 * @description
 * 지역 코드와 구군명으로 보건소 조직명을 생성합니다.
 * Factory에서 organizations 배열에 추가할 때 사용됩니다.
 *
 * 형식: `${정식지역명} ${구군명} 보건소`
 */
export function generateHealthCenterName(regionCode: string, gugun: string): string {
  const fullName = getFullRegionName(regionCode);
  return `${fullName} ${gugun} 보건소`;
}

/**
 * ⭐ 지역명 패턴 객체 가져오기 (healthCenterMatcher 정규화용)
 *
 * @returns { fullNames: string[], shortNames: string[] }
 *
 * @example
 * const patterns = getRegionNamePatterns();
 * patterns.fullNames   // ['서울특별시', '부산광역시', ...]
 * patterns.shortNames  // ['서울', '부산', ...]
 *
 * @description
 * healthCenterMatcher.ts의 normalizeHealthCenterName()에서
 * 지역명 prefix를 제거할 때 정규식 생성 목적으로 사용합니다.
 *
 * 짧은 이름과 정식명칭 모두를 포함하여
 * '서울 강남구 보건소'과 '서울특별시 강남구 보건소' 둘 다 정규화됩니다.
 */
export function getRegionNamePatterns(): { fullNames: string[]; shortNames: string[] } {
  const fullNames = REGION_FULL_NAMES.map(r => r.label);
  const shortNames = Object.values(REGION_CODE_TO_LABEL);

  return {
    fullNames,
    shortNames
  };
}

// =============================================================================
// ⭐ 복합 행정구역 정규화 (2025-01-12 추가)
// =============================================================================

/**
 * 하위 구 → 부모 시 역매핑
 *
 * @description
 * 사용자가 드롭다운에서 "상당구"를 선택했을 때,
 * 실제 DB에는 "청주시 상당구"로 저장되어 있어서
 * 이를 자동으로 변환하기 위한 매핑 테이블입니다.
 *
 * @example
 * SUB_GUGUN_TO_PARENT['상당구'] // '청주시'
 * SUB_GUGUN_TO_PARENT['동남구'] // '천안시'
 */
export const SUB_GUGUN_TO_PARENT: Record<string, string> = {
  // 경기도
  '장안구': '수원시',
  '권선구': '수원시',
  '팔달구': '수원시',
  '영통구': '수원시',
  '수정구': '성남시',
  '중원구': '성남시',
  '분당구': '성남시',
  '덕양구': '고양시',
  '일산동구': '고양시',
  '일산서구': '고양시',
  '상록구': '안산시',
  '단원구': '안산시',
  '만안구': '안양시',
  '동안구': '안양시',
  '처인구': '용인시',
  '기흥구': '용인시',
  '수지구': '용인시',

  // 충청북도
  '상당구': '청주시',
  '서원구': '청주시',
  '흥덕구': '청주시',
  '청원구': '청주시',

  // 충청남도
  '동남구': '천안시',
  '서북구': '천안시',

  // 전라북도
  '완산구': '전주시',
  '덕진구': '전주시',

  // 경상북도
  // NOTE: '남구', '북구'는 여러 도시에 존재하므로 매핑 불가
  // (광주/대구/부산/울산 등)

  // 경상남도
  '의창구': '창원시',
  '성산구': '창원시',
  '마산합포구': '창원시',
  '마산회원구': '창원시',
  '진해구': '창원시',
};

/**
 * ⭐ 하위 구를 완전한 형태로 변환
 *
 * @example
 * getFullGugunName('상당구')    // '청주시 상당구'
 * getFullGugunName('동남구')    // '천안시 동남구'
 * getFullGugunName('수원시')    // '수원시' (이미 완전한 형태)
 * getFullGugunName('서귀포시')  // '서귀포시' (단일 시)
 *
 * @description
 * 사용자가 드롭다운에서 "상당구"를 선택했을 때,
 * DB 검색을 위해 "청주시 상당구" 형태로 자동 변환합니다.
 */
export function getFullGugunName(gugun: string): string {
  // 이미 완전한 형태인지 확인 (예: "청주시 상당구", "수원시")
  if (gugun.includes(' ')) {
    return gugun;
  }

  // "시" 또는 "군"으로 끝나면 그대로 반환
  if (gugun.endsWith('시') || gugun.endsWith('군')) {
    return gugun;
  }

  // 띄어쓰기 없는 복합 형식 처리 (예: "청주상당구" → "청주시 상당구")
  // 부모 시를 먼저 찾고, 해당 부모 시로 시작하는지 확인
  for (const [subGugun, parentCity] of Object.entries(SUB_GUGUN_TO_PARENT)) {
    const cityWithoutSi = parentCity.replace('시', ''); // "청주시" → "청주"
    if (gugun.startsWith(cityWithoutSi) && gugun.endsWith(subGugun)) {
      // "청주상당구" → "청주시 상당구"
      return `${parentCity} ${subGugun}`;
    }
  }

  // 하위 구인 경우 부모 시를 찾아서 조합
  const parentCity = SUB_GUGUN_TO_PARENT[gugun];
  if (parentCity) {
    return `${parentCity} ${gugun}`;
  }

  // 부모 시만 있는 경우 (예: "청주" → "청주시")
  for (const city of Object.values(SUB_GUGUN_TO_PARENT)) {
    const cityWithoutSi = city.replace('시', '');
    if (gugun === cityWithoutSi) {
      return city;
    }
  }

  // 매핑에 없으면 원본 반환
  return gugun;
}

/**
 * ⭐ DB 검색용 구군 정규화 (복합 행정구역 지원)
 *
 * @example
 * normalizeGugunForDB('상당구')       // '청주시 상당구'
 * normalizeGugunForDB('청주시')       // '청주시'
 * normalizeGugunForDB('청주시 상당구') // '청주시 상당구'
 * normalizeGugunForDB('전체')        // undefined
 *
 * @description
 * API route나 필터에서 사용자가 선택한 구군을
 * DB 검색용 형태로 정규화합니다.
 *
 * - "전체" → undefined (모든 구군 조회)
 * - 하위 구 → "부모시 + 하위구" 형태
 * - 일반 시/군 → 그대로
 */
export function normalizeGugunForDB(gugun: string | undefined): string | undefined {
  if (!gugun || gugun === '전체' || gugun === '구군') {
    return undefined;
  }

  return getFullGugunName(gugun);
}

/**
 * ⭐ DB 검색용 시도 정규화 (짧은 이름 → 긴 공식 명칭)
 *
 * @example
 * normalizeSidoForDB('대구')    // '대구광역시'
 * normalizeSidoForDB('서울')    // '서울특별시'
 * normalizeSidoForDB('충남')    // '충청남도'
 * normalizeSidoForDB('전체')    // undefined
 * normalizeSidoForDB('대구광역시') // '대구광역시' (이미 긴 형태)
 *
 * @description
 * API route에서 사용자가 선택한 시도를
 * DB 검색용 공식 명칭으로 정규화합니다.
 *
 * - "전체" / "시도" → undefined (모든 시도 조회)
 * - 짧은 형태 → 긴 공식 명칭 (예: "대구" → "대구광역시")
 * - 이미 긴 형태 → 그대로 반환
 */
export function normalizeSidoForDB(sido: string | undefined): string | undefined {
  if (!sido || sido === '전체' || sido === '시도') {
    return undefined;
  }

  // 짧은 형태 → 코드 변환
  const code = getRegionCode(sido);
  if (!code) {
    return sido; // 매핑에 없으면 원본 반환
  }

  // 코드 → 첫 번째 DB 라벨 (공식 명칭)
  const dbLabels = REGION_CODE_TO_DB_LABELS[code];
  if (dbLabels && dbLabels.length > 0) {
    return dbLabels[0]; // 첫 번째가 항상 공식 긴 이름 (예: "대구" → "대구광역시")
  }

  return sido; // 매핑에 없으면 원본 반환
}

/**
 * DB에 저장된 시도명의 모든 변형을 반환 (약칭 + 정식명)
 *
 * DB에는 약칭("서울", "부산")과 정식명("서울특별시", "부산광역시")이 혼재되어 있으므로
 * 모든 변형을 포함하여 검색해야 누락 없이 데이터를 조회할 수 있습니다.
 *
 * @param sido - 시도명 (약칭 또는 정식명)
 * @returns 모든 변형 배열 또는 undefined
 *
 * @example
 * getSidoVariantsForDB("서울") → ["서울특별시", "서울"]
 * getSidoVariantsForDB("서울특별시") → ["서울특별시", "서울"]
 * getSidoVariantsForDB("대구") → ["대구광역시", "대구"]
 * getSidoVariantsForDB("전체") → undefined
 * getSidoVariantsForDB("시도") → undefined
 */
export function getSidoVariantsForDB(sido: string | undefined): string[] | undefined {
  if (!sido || sido === '전체' || sido === '시도') {
    return undefined;
  }

  // 1. 시도명 → 지역코드 변환
  const code = getRegionCode(sido);
  if (!code) {
    // 코드 찾기 실패 시 원본만 반환
    return [sido];
  }

  // 2. 해당 코드의 모든 DB 라벨 반환 (정식명 + 약칭)
  const variants = REGION_CODE_TO_DB_LABELS[code];
  if (variants && variants.length > 0) {
    return variants; // 예: ['서울특별시', '서울'] 또는 ['대구광역시', '대구']
  }

  return [sido];
}
