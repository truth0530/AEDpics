/**
 * AED 설치 의무 대상 검증 규칙
 * 「응급의료에 관한 법률」 제47조의2 및 시행령 제26조의5 기준
 */

export interface ValidationRule {
  category: string;
  subCategory?: string;
  patterns: RegExp[];
  conditions?: {
    area?: number;  // 면적 기준 (㎡)
    dailyVisitors?: number;  // 일평균 이용객 수
    seats?: number;  // 좌석 수
    households?: number;  // 세대 수
    floors?: number;  // 층수
    workers?: number;  // 상시근로자 수
    tonnage?: number;  // 톤수
  };
  requiresAllConditions?: boolean;  // true: AND 조건, false/undefined: OR 조건
  description: string;
  legalBasis: string;
}

export interface ValidationResult {
  isMandatory: boolean;
  category?: string;
  reason?: string;
  conditions?: string[];
  needsVerification?: boolean;
  legalBasis?: string;
}

// AED 설치 의무 대상 규칙
export const AED_VALIDATION_RULES: ValidationRule[] = [
  // 1. 공공보건의료기관
  {
    category: '공공보건의료기관',
    patterns: [
      /공공.*병원/,
      /국립.*병원/,
      /시립.*병원/,
      /도립.*병원/,
      /보건소/,
      /보건지소/,
      /보건진료소/,
      /의료원/,
      /적십자.*병원/
    ],
    description: '공공보건의료기관',
    legalBasis: '「공공보건의료에 관한 법률」 제2조 제3호'
  },

  // 2. 구급차
  {
    category: '구급차',
    patterns: [
      /119.*구급/,
      /구급차/,
      /응급.*차량/,
      /구조.*구급/
    ],
    description: '구급차',
    legalBasis: '「119구조·구급에 관한 법률」 제10조, 「의료법」 제3조'
  },

  // 3. 교통시설 - 공항
  {
    category: '교통시설',
    subCategory: '공항',
    patterns: [
      /공항/,
      /비행장/,
      /에어포트/,
      /airport/i
    ],
    description: '여객 항공기 및 공항',
    legalBasis: '「항공안전법」 제2조 제1호, 「공항시설법」 제2조 제3호'
  },

  // 4. 교통시설 - 철도역사
  {
    category: '교통시설',
    subCategory: '철도역사',
    patterns: [
      /역$/,
      /역\s/,
      /철도역/,
      /기차역/,
      /KTX/,
      /SRT/,
      /지하철역/,
      /전철역/
    ],
    conditions: {
      area: 2000,
      dailyVisitors: 10000
    },
    requiresAllConditions: false,
    description: '철도역사 대합실',
    legalBasis: '시행령 제26조의5 - 연면적 2,000㎡ 이상 또는 일평균 이용객 10,000명 이상'
  },

  // 5. 교통시설 - 버스터미널
  {
    category: '교통시설',
    subCategory: '여객자동차터미널',
    patterns: [
      /버스.*터미널/,
      /고속.*터미널/,
      /시외.*터미널/,
      /종합.*터미널/,
      /여객.*터미널/
    ],
    conditions: {
      area: 2000,
      dailyVisitors: 3000
    },
    requiresAllConditions: false,
    description: '여객자동차터미널 대합실',
    legalBasis: '시행령 제26조의5 - 연면적 2,000㎡ 이상 또는 일평균 이용객 3,000명 이상'
  },

  // 6. 교통시설 - 항만
  {
    category: '교통시설',
    subCategory: '항만',
    patterns: [
      /항만/,
      /항구/,
      /여객.*터미널/,
      /국제.*터미널/,
      /연안.*터미널/
    ],
    conditions: {
      area: 2000,
      dailyVisitors: 1000
    },
    requiresAllConditions: false,
    description: '항만 대합실',
    legalBasis: '시행령 제26조의5 - 연면적 2,000㎡ 이상 또는 일평균 이용객 1,000명 이상'
  },

  // 7. 선박
  {
    category: '선박',
    patterns: [
      /여객선/,
      /크루즈/,
      /페리/,
      /카페리/,
      /화물선/,
      /어선/
    ],
    conditions: {
      tonnage: 20
    },
    description: '총톤수 20톤 이상 선박',
    legalBasis: '「선박법」 제1조의2 제1항'
  },

  // 8. 공동주택
  {
    category: '공동주택',
    patterns: [
      /아파트/,
      /주상복합/,
      /오피스텔/
    ],
    conditions: {
      households: 500,
      floors: 16
    },
    requiresAllConditions: false,
    description: '500세대 이상 또는 16층 이상 공동주택',
    legalBasis: '「건축법」 제2조 제2항 제2호'
  },

  // 9. 사업장
  {
    category: '사업장',
    patterns: [
      /공장/,
      /사업장/,
      /제조.*회사/,
      /물류.*센터/,
      /산업.*단지/
    ],
    conditions: {
      workers: 300
    },
    description: '상시근로자 300명 이상 사업장',
    legalBasis: '「산업안전보건법」 제18조'
  },

  // 10. 관광시설
  {
    category: '관광시설',
    patterns: [
      /관광지/,
      /관광단지/,
      /관광.*안내/,
      /관광.*센터/
    ],
    description: '관광지 및 관광단지',
    legalBasis: '「관광진흥법」 제52조'
  },

  // 11. 카지노
  {
    category: '오락시설',
    subCategory: '카지노',
    patterns: [
      /카지노/,
      /casino/i
    ],
    conditions: {
      area: 2000
    },
    description: '카지노 시설',
    legalBasis: '시행령 제26조의5 - 전용면적 2,000㎡ 이상'
  },

  // 12. 경마장
  {
    category: '오락시설',
    subCategory: '경마장',
    patterns: [
      /경마장/,
      /경마공원/,
      /마사회/
    ],
    description: '경마장',
    legalBasis: '「한국마사회법」 제4조'
  },

  // 13. 경륜·경정
  {
    category: '오락시설',
    subCategory: '경주장',
    patterns: [
      /경륜/,
      /경정/,
      /스피돔/,
      /경주장/
    ],
    description: '경륜·경정 경주장',
    legalBasis: '「경륜·경정법」 제5조 제1항'
  },

  // 14. 교정시설
  {
    category: '교정시설',
    patterns: [
      /교도소/,
      /구치소/,
      /소년원/,
      /소년교도소/,
      /외국인.*보호/,
      /보호소/
    ],
    description: '교정·보호시설',
    legalBasis: '관련 법령'
  },

  // 15. 체육시설
  {
    category: '체육시설',
    patterns: [
      /운동장/,
      /경기장/,
      /종합.*운동장/,
      /스타디움/,
      /아레나/,
      /체육관/,
      /야구장/,
      /축구장/
    ],
    conditions: {
      seats: 5000
    },
    description: '전문체육시설',
    legalBasis: '시행령 제26조의5 - 관람석 5,000석 이상'
  },

  // 16. 행정기관 - 중앙행정기관
  {
    category: '행정기관',
    subCategory: '중앙행정기관',
    patterns: [
      /정부.*청사/,
      /정부서울/,
      /정부과천/,
      /정부세종/,
      /정부대전/
    ],
    description: '중앙행정기관 청사',
    legalBasis: '보건복지부장관 지정'
  },

  // 17. 행정기관 - 시도청
  {
    category: '행정기관',
    subCategory: '시도청',
    patterns: [
      /서울.*시청/,
      /부산.*시청/,
      /대구.*시청/,
      /인천.*시청/,
      /광주.*시청/,
      /대전.*시청/,
      /울산.*시청/,
      /세종.*시청/,
      /경기.*도청/,
      /강원.*도청/,
      /충북.*도청/,
      /충남.*도청/,
      /전북.*도청/,
      /전남.*도청/,
      /경북.*도청/,
      /경남.*도청/,
      /제주.*도청/,
      /시청.*본관/,
      /도청.*본관/
    ],
    description: '시·도 청사',
    legalBasis: '보건복지부장관 지정'
  }
];

/**
 * 기관명을 기반으로 AED 설치 의무 대상 여부를 검증
 */
export function validateAEDRequirement(
  institutionName: string,
  additionalInfo?: {
    area?: number;
    dailyVisitors?: number;
    seats?: number;
    households?: number;
    floors?: number;
    workers?: number;
    tonnage?: number;
  }
): ValidationResult {
  if (!institutionName) {
    return { isMandatory: false };
  }

  const normalizedName = institutionName.toLowerCase().trim();

  for (const rule of AED_VALIDATION_RULES) {
    // 패턴 매칭 확인
    const matchesPattern = rule.patterns.some(pattern =>
      pattern.test(normalizedName)
    );

    if (!matchesPattern) {
      continue;
    }

    // 조건이 없으면 바로 의무 대상
    if (!rule.conditions) {
      return {
        isMandatory: true,
        category: rule.category,
        reason: rule.description,
        legalBasis: rule.legalBasis
      };
    }

    // 조건이 있는 경우
    const conditions: string[] = [];
    let meetsConditions = false;

    // 추가 정보가 제공된 경우 조건 확인
    if (additionalInfo) {
      const conditionsMet: boolean[] = [];

      if (rule.conditions.area !== undefined && additionalInfo.area !== undefined) {
        const meets = additionalInfo.area >= rule.conditions.area;
        conditionsMet.push(meets);
        conditions.push(`면적 ${rule.conditions.area}㎡ 이상 (현재: ${additionalInfo.area}㎡)`);
      }

      if (rule.conditions.dailyVisitors !== undefined && additionalInfo.dailyVisitors !== undefined) {
        const meets = additionalInfo.dailyVisitors >= rule.conditions.dailyVisitors;
        conditionsMet.push(meets);
        conditions.push(`일평균 이용객 ${rule.conditions.dailyVisitors.toLocaleString()}명 이상 (현재: ${additionalInfo.dailyVisitors.toLocaleString()}명)`);
      }

      if (rule.conditions.seats !== undefined && additionalInfo.seats !== undefined) {
        const meets = additionalInfo.seats >= rule.conditions.seats;
        conditionsMet.push(meets);
        conditions.push(`좌석 ${rule.conditions.seats.toLocaleString()}석 이상 (현재: ${additionalInfo.seats.toLocaleString()}석)`);
      }

      if (rule.conditions.households !== undefined && additionalInfo.households !== undefined) {
        const meets = additionalInfo.households >= rule.conditions.households;
        conditionsMet.push(meets);
        conditions.push(`${rule.conditions.households}세대 이상 (현재: ${additionalInfo.households}세대)`);
      }

      if (rule.conditions.floors !== undefined && additionalInfo.floors !== undefined) {
        const meets = additionalInfo.floors >= rule.conditions.floors;
        conditionsMet.push(meets);
        conditions.push(`${rule.conditions.floors}층 이상 (현재: ${additionalInfo.floors}층)`);
      }

      if (rule.conditions.workers !== undefined && additionalInfo.workers !== undefined) {
        const meets = additionalInfo.workers >= rule.conditions.workers;
        conditionsMet.push(meets);
        conditions.push(`상시근로자 ${rule.conditions.workers}명 이상 (현재: ${additionalInfo.workers}명)`);
      }

      if (rule.conditions.tonnage !== undefined && additionalInfo.tonnage !== undefined) {
        const meets = additionalInfo.tonnage >= rule.conditions.tonnage;
        conditionsMet.push(meets);
        conditions.push(`총톤수 ${rule.conditions.tonnage}톤 이상 (현재: ${additionalInfo.tonnage}톤)`);
      }

      // 조건 충족 여부 판단
      if (conditionsMet.length > 0) {
        meetsConditions = rule.requiresAllConditions
          ? conditionsMet.every(c => c)  // AND 조건
          : conditionsMet.some(c => c);   // OR 조건
      }
    }

    // 조건 정보가 없으면 확인 필요
    if (!additionalInfo || conditions.length === 0) {
      const conditionTexts: string[] = [];
      if (rule.conditions.area) conditionTexts.push(`면적 ${rule.conditions.area}㎡ 이상`);
      if (rule.conditions.dailyVisitors) conditionTexts.push(`일평균 이용객 ${rule.conditions.dailyVisitors.toLocaleString()}명 이상`);
      if (rule.conditions.seats) conditionTexts.push(`좌석 ${rule.conditions.seats.toLocaleString()}석 이상`);
      if (rule.conditions.households) conditionTexts.push(`${rule.conditions.households}세대 이상`);
      if (rule.conditions.floors) conditionTexts.push(`${rule.conditions.floors}층 이상`);
      if (rule.conditions.workers) conditionTexts.push(`상시근로자 ${rule.conditions.workers}명 이상`);
      if (rule.conditions.tonnage) conditionTexts.push(`총톤수 ${rule.conditions.tonnage}톤 이상`);

      return {
        isMandatory: false,
        category: rule.category,
        reason: `${rule.description} (조건부 의무)`,
        conditions: conditionTexts,
        needsVerification: true,
        legalBasis: rule.legalBasis
      };
    }

    return {
      isMandatory: meetsConditions,
      category: rule.category,
      reason: meetsConditions
        ? `${rule.description} (조건 충족)`
        : `${rule.description} (조건 미충족)`,
      conditions,
      legalBasis: rule.legalBasis
    };
  }

  // 매칭되는 규칙이 없음
  return {
    isMandatory: false,
    reason: '법령상 AED 설치 의무 대상이 아님'
  };
}

/**
 * 설치 의무 대상 카테고리 목록
 */
export const AED_MANDATORY_CATEGORIES = [
  '공공보건의료기관',
  '구급차',
  '교통시설',
  '선박',
  '공동주택',
  '사업장',
  '관광시설',
  '오락시설',
  '교정시설',
  '체육시설',
  '행정기관'
];