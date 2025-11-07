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
  '부산광역시': 'BUS',
  '대구광역시': 'DAE',
  '인천광역시': 'INC',
  '광주광역시': 'GWA',
  '대전광역시': 'DAJ',
  '울산광역시': 'ULS',
  '세종특별자치시': 'SEJ',
  '경기도': 'GYE',
  '강원특별자치도': 'GAN',
  '충청북도': 'CHB',
  '충청남도': 'CHN',
  '전북특별자치도': 'JEB',
  '전라남도': 'JEN',
  '경상북도': 'GYB',
  '경상남도': 'GYN',
  '제주특별자치도': 'JEJ'
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
  'SEJ': ['세종특별자치시', '세종'],
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
 * // { sido: "충남", gugun: "천안시 서북구" }
 */
export function extractRegionFromOrgName(orgName: string): { sido: string | null; gugun: string | null } {
  if (!orgName) {
    return { sido: null, gugun: null };
  }

  // 정식명칭을 먼저 찾기
  for (const [fullName, code] of Object.entries(REGION_LABEL_TO_CODE)) {
    if (orgName.includes(fullName)) {
      const shortName = REGIONS.find(r => r.code === code)?.label || fullName;

      // 구/군/시 추출
      const gugunMatch = orgName.match(/([가-힣]+(?:구|군|시))/);
      const gugun = gugunMatch ? gugunMatch[1] : null;

      return { sido: shortName, gugun };
    }
  }

  // 짧은 이름으로 찾기
  for (const region of REGIONS) {
    if (orgName.includes(region.label)) {
      const gugunMatch = orgName.match(/([가-힣]+(?:구|군|시))/);
      const gugun = gugunMatch ? gugunMatch[1] : null;

      return { sido: region.label, gugun };
    }
  }

  return { sido: null, gugun: null };
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
  // 제주도 (JEJ)
  'jeju': '제주시',
  'seogwipo': '서귀포시',

  // 대구광역시 (DAE)
  'jung': '중구',
  'dalseo': '달서구',
  'buk': '북구',
  'suseong': '수성구',
  'seo': '서구',

  // 인천광역시 (INC)
  'namdong': '남동구',
  'ganghwa': '강화군',
  'gyeyang': '계양구',
  'michuhol': '미추홀구',
  'bupyeong': '부평구',
  'yeonsu': '연수구',
  'ongjin': '옹진군',
  'jung_yeongjong': '영종',

  // 경남 (GYN)
  'gimhae': '김해시',

  // 충청북도 (CHB)
  'goesan': '괴산군',
  'danyang': '단양군',
  'boeun': '보은군',
  'yeongdong': '영동군',
  'okcheon': '옥천군',
  'eumseong': '음성군',
  'jecheon': '제천시',
  'jeungpyeong': '증평군',
  'jincheon': '진천군',
  'cheongju': '청주시',
  'chungju': '충주시',

  // 세종특별자치시 (SEJ)
  'seju': '세종특별자치시',
};

/**
 * City Code를 Gugun으로 매핑하는 함수
 * @param cityCode - organizations.city_code
 * @returns 매핑된 gugun, 또는 매핑 실패 시 null
 */
export function mapCityCodeToGugun(cityCode: string | null | undefined): string | null {
  if (!cityCode) return null;
  return CITY_CODE_TO_GUGUN_MAP[cityCode] || null;
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
