# 하드코딩 제거 종합 계획서

**작성일**: 2025-11-09
**목적**: 지역명/구군명 중앙 관리 시스템 구축
**현황**: 계획 수립 완료, 실제 수정 대기 중

---

## 1. 문제 정의

### 현황
- 중앙 관리 시스템 존재: `lib/constants/regions.ts` (905줄)
- 그러나 7개 파일에서 **700+ 하드코딩된 지역명/구군명** 중복 정의
- 지역 관련 기능 전체에서 불일치 및 에러 발생

### 근본 원인
각 파일이 자체적으로 지역/구군 데이터를 하드코딩하여 중앙 시스템과 다음 형식으로 불일치:
- 지역명: '서울' vs '서울특별시' vs 'SEO'
- 구군: '중구' vs '중구보건소' vs 하드코딩 누락
- 응급의료지원센터: 명칭 불일치

---

## 2. 하드코딩 파일 목록 및 상세 분석

### 파일 1: `lib/data/organizations.ts` (400줄) 🔴 최우선

**목적**: 회원가입 시 지역별 조직(보건소) 드롭다운 표시

**현재 상태**:
```typescript
regionOrganizations: RegionOrganization[] = [
  {
    region: "중앙",
    organizations: ["보건복지부", "중앙응급의료센터"]
  },
  {
    region: "서울특별시",  // ❌ 형식: 정식명칭 (중앙시스템은 '서울' 사용)
    organizations: [
      "기타 (직접 입력)",
      "서울특별시",
      "서울응급의료지원센터",
      "서울특별시 중구 보건소",      // ❌ 25개 하드코딩
      "서울특별시 종로구 보건소",
      // ... 23개 더
    ]
  },
  // ... 총 17개 지역 × 평균 25개 보건소 = 약 500+개 하드코딩
]
```

**하드코딩 규모**:
- 17개 지역 명칭: 중복
- 구군 25-30개 × 17개 지역 = **425+개 보건소 하드코딩**

**영향받는 기능**:
- ✅ 회원가입 페이지 - 지역/조직 드롭다운
- ✅ 프로필 설정 - 조직 수정
- ✅ 모든 조직 선택 UI

**수정 전략**:

#### **지역 키 표준화 (필수 확정)**
- ✅ **Standard**: 지역 키는 **짧은 이름** 사용 (예: '서울', '부산', '대구')
  - 모든 regionOrganizations의 region 필드
  - 모든 HEALTH_CENTERS_BY_REGION의 region 필드
  - getOrganizationsByRegion('서울') 호출과의 호환성 유지
- ✅ **Why**: 기존 코드와의 호환성, 단순성
- ✅ **Add**: 필요시 fullRegionName 필드로 정식명칭 별도 제공

#### **공용 팩토리 함수** `lib/services/orgFactory.ts` 신규 생성:

```typescript
// lib/services/orgFactory.ts - 조직 생성 로직 중앙화
import { REGIONS, REGION_CODE_TO_GUGUNS, getFullRegionName, getEmergencyCenterName, generateHealthCenterName } from '@/lib/constants/regions';

// 팩토리 반환 타입 (gugun 메타데이터 포함)
export interface RegionOrgData {
  region: string;  // 짧은 이름: '서울', '부산' (KEY로 사용됨)
  regionCode: string;  // 'SEO', 'BUS' (코드)
  fullRegionName: string;  // '서울특별시', '부산광역시' (정식명칭)
  organizations: string[];  // 보건소 목록
  guguns: string[];  // 구군 목록 (seed에서 city_code 추출용)
}

export function generateRegionOrganizations(): RegionOrgData[] {
  return REGIONS.map(region => {
    const regionCode = region.code;
    const shortName = region.code === 'KR' ? '중앙' : region.label;
    const fullName = region.code === 'KR' ? '중앙' : getFullRegionName(region.code);
    const guguns = REGION_CODE_TO_GUGUNS[regionCode] || [];

    return {
      region: shortName,  // ✅ KEY: 짧은 이름
      regionCode: regionCode,  // SEO, BUS, ...
      fullRegionName: fullName,  // 서울특별시, 부산광역시, ...
      organizations: generateOrganizationsForRegion(regionCode),
      guguns: guguns  // 보건소 시드에서 직접 사용
    };
  });
}

function generateOrganizationsForRegion(regionCode: string): string[] {
  if (regionCode === 'KR') {
    return ['보건복지부', '중앙응급의료센터'];
  }

  const guguns = REGION_CODE_TO_GUGUNS[regionCode] || [];
  return [
    '기타 (직접 입력)',
    getFullRegionName(regionCode),
    getEmergencyCenterName(regionCode),
    ...guguns.map(gugun => generateHealthCenterName(regionCode, gugun))
  ];
}
```

#### **organizations.ts 수정**:
```typescript
// ✅ CORRECT
import { generateRegionOrganizations } from '@/lib/services/orgFactory';

export const regionOrganizations = generateRegionOrganizations().map(data => ({
  region: data.region,  // 짧은 이름 ('서울' 등)
  organizations: data.organizations
}));

// 기존 호출과의 호환성 유지
export const getOrganizationsByRegion = (region: string): string[] => {
  const regionData = regionOrganizations.find(r => r.region === region);
  return regionData?.organizations || [];
};
```

**개선 효과**:
- 코드 라인: 400줄 → 30줄 (92% 감소)
- 호환성: getOrganizationsByRegion('서울') 기존 호출 모두 정상
- 데이터: region 키는 짧은 이름, 정식명칭은 필요시 fullRegionName으로 접근
- 구군 메타데이터: guguns 필드로 seed 스크립트에서 직접 사용

---

### 파일 2: `lib/data/health-centers-master.ts` (500줄) 🔴 높음

**목적**: DB 다운 시 Fallback 데이터 제공

**현재 상태**:
```typescript
// ❌ WRONG - 자체 REGIONS 정의 (중앙 시스템과 중복)
export const REGIONS = [
  '중앙', '서울특별시', '부산광역시', ...  // 18개 하드코딩
];

// ❌ WRONG - 각 지역별 보건소 300+개 하드코딩
export const HEALTH_CENTERS_BY_REGION: HealthCenterData[] = [
  {
    region: '중앙',
    centers: ['보건복지부', '중앙응급의료센터']
  },
  {
    region: '서울특별시',
    centers: [
      '종로구보건소',  // ❌ 25개 하드코딩 (형식도 불일치)
      // ...
    ]
  }
];
```

**하드코딩 규모**:
- REGIONS 배열: 18개 문자열 하드코딩
- HEALTH_CENTERS_BY_REGION: **300+개 보건소 명칭**

**문제점**:
1. organizations.ts와 포맷 완전히 다름 (유지보수 악몽)
2. 자체 REGIONS 정의로 중복
3. 형식: "종로구보건소" (중앙 시스템 불일치)

**수정 전략**:

**health-centers-master.ts 수정**:
```typescript
// ✅ CORRECT - 동일한 팩토리 함수 사용
import { generateRegionOrganizations } from '@/lib/services/orgFactory';
import { REGIONS } from '@/lib/constants/regions';

// 자체 REGIONS 정의 제거 → 중앙 시스템에서 import

// 팩토리 함수로 생성
const regionOrgData = generateRegionOrganizations();

export const HEALTH_CENTERS_BY_REGION: HealthCenterData[] = regionOrgData
  .filter(item => item.region !== '중앙')  // ✅ FIX: 중앙은 DB에 실제 조직이 없으므로 제외 (item.region이 '중앙'일 때만 필터링 적용)
  .map(item => ({
    region: item.region,  // ✅ 짧은 이름 ('서울', '부산' 등) - organizations.ts와 동일 KEY 사용
    centers: item.organizations
      .filter(org => org !== '기타 (직접 입력)')  // ✅ organizations 배열 내에서 직접입력 항목 제외
      .filter(org =>
        org.includes('보건소') || org.includes('응급의료') || org.includes('보건복지')
      )
  }));

// ✅ 중요: getAvailableRegions()는 SHORT names 반환 (HEALTH_CENTERS_BY_REGION의 region 필드와 포맷 일치)
export const getAvailableRegions = () =>
  REGIONS.map(r => r.code === 'KR' ? '중앙' : r.label);  // r.label이 SHORT name ('서울', '부산')
```

**개선 효과**:
- 코드 라인: 500줄 → 20줄 (96% 감소)
- 동기화: organizations.ts와 완벽하게 일치
- 유지보수: organizations 수정 시 자동으로 health-centers-master도 갱신

---

### 파일 3: `app/api/admin/seed-organizations/route.ts` (200줄) 🔴 높음

**목적**: POST 요청으로 보건소 데이터를 DB에 초기화

**현재 상태**:
```typescript
// ❌ WRONG - 425+개 보건소 객체 하드코딩
const SEOUL_HEALTH_CENTERS = [
  { name: '서울특별시 강남구보건소', region: '서울', region_code: 'SEO', ... },
  { name: '서울특별시 강동구보건소', region: '서울', region_code: 'SEO', ... },
  // ... 23개 더
];
const BUSAN_HEALTH_CENTERS = [ /* ... 18개 */ ];
// ... 계속 17개 시도 모두
const allHealthCenters = [
  ...SEOUL_HEALTH_CENTERS,
  ...BUSAN_HEALTH_CENTERS,
  // ... 모두 merge
];
```

**문제점**:
1. 코드 너무 길고 관리 불가능
2. organizations.ts와 포맷 불일치

**수정 전략**:

**seed-organizations/route.ts 수정** (CORRECTED - 4가지 아키텍처 개선사항 적용):
```typescript
// ✅ CORRECT - 동일한 팩토리 함수 사용 + generateHealthCenterName() 헬퍼 활용
import { generateRegionOrganizations } from '@/lib/services/orgFactory';
import { getEmergencyCenterName, generateHealthCenterName } from '@/lib/constants/regions';  // ✅ FIX: 실제 사용하는 함수만 import

async function generateSeedOrganizations() {
  const regionOrgData = generateRegionOrganizations();
  const allOrganizations = [];

  for (const data of regionOrgData) {
    if (data.region === '중앙') continue;  // 중앙은 조직 구분용 코드만 (DB에 실제 AED 데이터 없음)

    // 시도청/시청
    allOrganizations.push({
      name: data.fullRegionName,
      region: data.region,  // ✅ SHORT name ('서울', '부산' 등)
      region_code: data.regionCode,  // 'SEO', 'BUS' 등
      city_code: null,
      type: 'provincial_government'
    });

    // 응급의료지원센터
    allOrganizations.push({
      name: getEmergencyCenterName(data.regionCode),
      region: data.region,  // ✅ SHORT name
      region_code: data.regionCode,
      city_code: null,
      type: 'emergency_center'
    });

    // 보건소들 - ✅ FIX: 팩토리에서 guguns 받아서 + generateHealthCenterName() 헬퍼로 명칭 생성
    // 이렇게 하면:
    // 1. 세종('세종시' 없음), 제주('제주시', '서귀포시') 등 엣지 케이스 자동 처리
    // 2. 명칭 생성 규칙이 한 곳에서 관리됨 (일관성 극대화)
    // 3. 명칭 규칙 변경 시 organizations.ts와 seed가 자동 동기화
    data.guguns.forEach(gugun => {
      allOrganizations.push({
        name: generateHealthCenterName(data.regionCode, gugun),  // ✅ 헬퍼 함수 사용 (lib/constants/regions.ts에서 관리)
        region: data.region,  // ✅ SHORT name
        region_code: data.regionCode,
        city_code: gugun,  // ✅ 팩토리의 guguns 배열에서 직접 사용 (문자열 파싱 불필요!)
        type: 'health_center'
      });
    });
  }

  return allOrganizations;
}

// API 핸들러에서 사용
const seedData = await generateSeedOrganizations();
```

**개선점 (사용자 피드백 반영)**:
1. ✅ **Region Key Consistency**: `r.region === region.label` 제거 → 팩토리 출력 직접 사용 (SHORT name 유지)
2. ✅ **String Parsing Fragility 해결**:
   - ❌ `const parts = org.split(' '); const cityCode = parts[parts.length - 2];`
   - ✅ `data.guguns.forEach(gugun => { city_code: gugun })`
   - 세종, 제주, 다문자 구군 모두 자동 처리!
3. ✅ **Helper Function 통합** (추가 개선):
   - ❌ `${data.fullRegionName} ${gugun} 보건소` 직접 조합 (중복, 불일치 위험)
   - ✅ `generateHealthCenterName(data.regionCode, gugun)` 사용
   - 명칭 규칙이 한 곳에서만 관리됨 → UI와 seed 간 완벽한 동기화

**개선 효과**:
- 코드 라인: 200줄 → 50줄 (75% 감소)
- 세 파일 동기화: 모두 동일한 팩토리 함수 기반

---

### 파일 4: `lib/utils/healthCenterMatcher.ts` (150줄) 🟠 중간

**목적**: 보건소 명칭 정규화 (검색, 매칭 등)

**현재 상태**:
```typescript
// ❌ WRONG - 지역명 suffix 하드코딩 (3곳)
.replace(/특별시|광역시|특별자치시|특별자치도|도/g, '')  // '도봉구'의 '도'도 제거됨!

// ❌ WRONG - 지역명 prefix 하드코딩
.replace(/^(서울|부산|대구|...|제주)/g, '')  // 17개 지역명 하드코딩
```

**문제점**:
1. 정규식 /도/g가 '도봉구', '도산대로'의 '도'까지 제거 (버그!)
2. 모든 지역명을 하드코딩 (유지보수 어려움)
3. 정규식이 3곳에 분산

**수정 전략**:

**healthCenterMatcher.ts 수정** (CORRECTED - SHORT name 제거 추가):
```typescript
// ✅ CORRECT - 중앙 시스템 + 경계 조건 처리 + SHORT/FULL name 모두 제거
import { REGION_FULL_NAMES, REGION_CODE_TO_LABEL } from '@/lib/constants/regions';

// suffix 패턴: 경계 조건 처리 (뒤에 공백이나 끝이 올 때만 제거)
const REGION_SUFFIXES = ['특별시', '광역시', '특별자치시', '특별자치도', '도'];
const suffixPattern = new RegExp(
  `(?:${REGION_SUFFIXES.join('|')})(?=\\s|$)`,  // ⚠️ 경계 조건: \s 또는 끝 (도봉구의 도는 제거 안 됨)
  'g'
);

// ✅ FIX: FULL names과 SHORT names 모두 prefixes로 제거
const FULL_NAMES = REGION_FULL_NAMES.map(r => r.label);  // ['서울특별시', '부산광역시', ...]
const SHORT_NAMES = Object.values(REGION_CODE_TO_LABEL);  // ['서울', '부산', '대구', ...]

export function normalizeHealthCenterName(name: string): string {
  let result = name;

  // 1. ✅ 정식 지역명 제거 (예: '서울특별시 강남구 보건소' → '강남구 보건소')
  for (const fullName of FULL_NAMES) {
    const regex = new RegExp(`^${fullName}\\s*`);
    result = result.replace(regex, '');
  }

  // 2. ✅ 짧은 이름도 제거 (예: '서울 강남구 보건소' → '강남구 보건소')
  // [FIX] 이전 코드에서는 이 단계가 없어서 '서울 강남구 보건소' 형식이 정규화되지 않음
  for (const shortName of SHORT_NAMES) {
    const regex = new RegExp(`^${shortName}\\s*`);
    result = result.replace(regex, '');
  }

  // 3. suffix 제거 (경계 조건 포함)
  // 예: '도봉구'의 '도'는 보존 (경계 조건 덕분)
  result = result.replace(suffixPattern, '');

  // 4. 공백 정리
  result = result.replace(/\\s+/g, '');

  // 5. 보건소/센터/청 제거
  result = result.replace(/(?:보건소|응급의료지원센터|응급의료센터|청)$/, '');

  return result;
}

// ✅ 테스트 케이스
const testCases = [
  { input: '서울특별시 강남구 보건소', expected: '강남구' },  // FULL name 제거
  { input: '서울 강남구 보건소', expected: '강남구' },  // SHORT name 제거 [FIX]
  { input: '부산광역시 중구 보건소', expected: '중구' },  // FULL name 제거
  { input: '부산 중구 보건소', expected: '중구' },  // SHORT name 제거 [FIX]
  { input: '도봉구 보건소', expected: '도봉구' },  // 도봉구의 '도'는 제거 안 됨 (경계 조건)
  { input: '강원도 강도동', expected: '강도동' },  // 강도동의 '도'는 제거 안 됨 (경계 조건)
];
```

**개선점 (사용자 피드백 반영)**:
1. ✅ **getRegionNamePatterns() 활용**: SHORT_NAMES 추가로 사용
2. ✅ **완전한 정규화**: 정식명칭 ('서울특별시')과 짧은 이름 ('서울') 모두 제거
3. ✅ **경계 조건 처리**: `도봉구`, `강도동` 등 '도'가 포함된 구군도 올바르게 처리

**개선 효과**:
- 정규식 버그 수정: '도봉구'의 '도'가 제거되지 않음
- 유지보수성: 중앙 시스템에서 자동으로 지역명 읽어옴
- 안전성: 문자열 기반 제거로 오류 가능성 감소

---

### 파일 5: `components/dashboard/AEDDashboard.tsx` 🟡 낮음

**목적**: AED 대시보드 Mock 데이터 (데모용)

**현재 상태**:
```typescript
// ❌ WRONG - 하드코딩된 지역명
const mockAEDs = [
  { id: '1', location: '서울특별시 강남구', ... },
  { id: '2', location: '부산광역시 중구', ... },
  { id: '3', location: '대구광역시 중구', ... },
  // ... 수십 개
];
```

**특성**: 데모/튜토리얼용 (운영 데이터 아님) → **고정 샘플 유지**

**수정 전략**:

**고정 샘플 방식** (권장):
```typescript
// ✅ CORRECT - 고정 샘플 + 중앙 상수에서 값만 읽기
import { REGION_CODE_TO_GUGUNS, getFullRegionName } from '@/lib/constants/regions';

const mockAEDs = [
  {
    id: '1',
    region_code: 'SEO',
    gugun: REGION_CODE_TO_GUGUNS['SEO']?.[0] || '강남구',  // 중앙에서 읽음
    location: `${getFullRegionName('SEO')} ${REGION_CODE_TO_GUGUNS['SEO']?.[0] || '강남구'}`,
    address: '...',
  },
  {
    id: '2',
    region_code: 'BUS',
    gugun: REGION_CODE_TO_GUGUNS['BUS']?.[0] || '중구',  // 중앙에서 읽음
    location: `${getFullRegionName('BUS')} ${REGION_CODE_TO_GUGUNS['BUS']?.[0] || '중구'}`,
    address: '...',
  },
  {
    id: '3',
    region_code: 'DAE',
    gugun: REGION_CODE_TO_GUGUNS['DAE']?.[0] || '중구',  // 중앙에서 읽음
    location: `${getFullRegionName('DAE')} ${REGION_CODE_TO_GUGUNS['DAE']?.[0] || '중구'}`,
    address: '...',
  },
  // ... 3-5개 샘플만 유지 (수십 개는 UI 렌더링 무겁게 만듦)
];
```

**왜 동적 생성이 아니라 고정 샘플?**
- ✅ 스토리텔링: 일관된 데모 시나리오 제시
- ✅ 테스트: 재현 가능한 고정된 데이터
- ✅ UI: 가볍고 빠른 로딩 (수십 개 동적 생성은 불필요)
- ✅ 문서화: "강남구 AED"처럼 구체적으로 설명 가능

**개선 효과**:
- 하드코딩 문제 해결: 구군이 추가/변경되면 중앙 상수에서 자동 반영
- 데모 안정성: 고정 샘플로 일관된 화면 제시
- 코드 간결: 동적 생성 로직 불필요

---

### 파일 6: `lib/data/tutorial-sample-data.ts` 🟡 낮음

**목적**: 튜토리얼 샘플 데이터 (교육/테스트용)

**현재 상태**:
```typescript
// ❌ WRONG - 하드코딩된 구군
const tutorialDevices = [
  {
    serial: 'TUTORIAL-001',
    location: {
      sido: '대구광역시',
      gugun: '중구',  // ❌ 하드코딩
      address: '...'
    }
  }
];
```

**특성**: 튜토리얼 교육용 (운영 데이터 아님) → **고정 샘플 유지**

**수정 전략**:

**고정 샘플 방식** (권장):
```typescript
// ✅ CORRECT - 고정 샘플 + 중앙 상수에서 값만 읽기
import { REGION_CODE_TO_GUGUNS, getFullRegionName } from '@/lib/constants/regions';

const tutorialDevices = [
  {
    serial: 'TUTORIAL-001',
    location: {
      region_code: 'DAE',
      sido: getFullRegionName('DAE'),  // '대구광역시' - 중앙에서 읽음
      gugun: REGION_CODE_TO_GUGUNS['DAE']?.[0] || '중구',  // 첫 번째 구군 고정
      address: `${getFullRegionName('DAE')} ${REGION_CODE_TO_GUGUNS['DAE']?.[0] || '중구'} 서문로 123`
    }
  },
  {
    serial: 'TUTORIAL-002',
    location: {
      region_code: 'SEO',
      sido: getFullRegionName('SEO'),  // '서울특별시'
      gugun: REGION_CODE_TO_GUGUNS['SEO']?.[0] || '강남구',  // 첫 번째 구군 고정
      address: `${getFullRegionName('SEO')} ${REGION_CODE_TO_GUGUNS['SEO']?.[0] || '강남구'} 테헤란로 123`
    }
  }
  // ... 2-3개 샘플만 유지
];
```

**왜 고정 샘플이 필요?**
- ✅ 튜토리얼 일관성: "대구 중구의 AED를 점검하세요" 같은 구체적 지시 가능
- ✅ 테스트 재현성: `Math.random()`은 테스트 불안정하게 만듦
- ✅ 문서화: "TUTORIAL-001은 대구 중구"라고 명시 가능
- ❌ 피해야 할 방식: `const gugun = guguns[Math.floor(Math.random() * guguns.length)]` (테스트 깨짐)

**개선 효과**:
- 하드코딩 문제 해결: 구군이 추가/변경되면 중앙 상수에서 자동 반영
- 튜토리얼 안정성: 고정 시드로 일관된 교육 제공
- 테스트 신뢰성: 항상 동일한 값으로 테스트 결과 재현 가능

---

## 3. 중앙 관리 시스템 현황 및 보강 필요 사항

### `lib/constants/regions.ts` 분석 및 강화 방안

**현재 포함 사항**:
- ✅ REGIONS 배열: 17개 지역 (code + label + type)
- ✅ REGION_CODE_TO_LABEL: 코드→라벨 매핑
- ✅ REGION_LABEL_TO_CODE: 라벨→코드 매핑
- ✅ REGION_LONG_LABELS: 긴 형태 명칭 매핑 (예: '서울특별시'→'SEO')
- ✅ REGION_FULL_NAMES: 정식 명칭 리스트
- ✅ REGION_CODE_TO_GUGUNS: 지역별 구군 목록

**필수 확인 사항** (실제 수정 전):
```
□ REGION_CODE_TO_GUGUNS 완전성 검증
  - 예상 구조:
    {
      'SEO': ['종로구', '중구', '용산구', ..., '강동구'],  // 25개
      'BUS': ['중구', '서구', '동구', ..., '기장군'],      // 18개
      'DAE': ['중구', '동구', '서구', ..., '군위군'],      // 8개
      // ... 계속
    }
  - ⚠️ 제주: '제주시', '서귀포시' (구/군 아님)
  - ⚠️ 세종: '세종시' (단일 시) 또는 [] (없음) 확인

□ 구군 형식 검증
  - OK: '중구', '강남구', '기장군'
  - ❌ NOT OK: '중구보건소', '중구청'

□ REGION_FULL_NAMES 활용 확인
  - REGION_FULL_NAMES에서 각 region.code의 정식명칭 조회 가능한지 확인
  - 예: REGION_FULL_NAMES.find(r => r.code === 'SEO')?.label → '서울특별시'
```

**신규 추가 필요 함수** (lib/constants/regions.ts에 추가):

```typescript
// 1. 구군 리스트 조회 (기존 함수 확인용)
export function getGugunListByRegionCode(regionCode: string): string[] {
  return REGION_CODE_TO_GUGUNS[regionCode] || [];
}

// 2. 정식 명칭 조회 (기존 REGION_FULL_NAMES 재사용)
export function getFullRegionName(regionCode: string): string {
  if (regionCode === 'KR') return '중앙';
  const fullName = REGION_FULL_NAMES.find(r => r.code === regionCode);
  return fullName?.label || '';
}

// 3. 응급의료지원센터 명칭 생성
// ⚠️ 주의: 실제 DB 데이터와 일치하는지 검증 필수
// 예상: 'SEO' → '서울응급의료지원센터' (NOT '서울특별시응급의료지원센터')
export function getEmergencyCenterName(regionCode: string): string {
  if (regionCode === 'KR') return '중앙응급의료센터';
  const shortLabel = REGION_CODE_TO_LABEL[regionCode];
  return `${shortLabel}응급의료지원센터`;
}

// 4. 보건소 명칭 생성 (조직/시드/마스터 파일에서 공용으로 사용)
export function generateHealthCenterName(regionCode: string, gugun: string): string {
  const fullRegionName = getFullRegionName(regionCode);
  if (!fullRegionName) return gugun;
  return `${fullRegionName} ${gugun} 보건소`;
}

// 5. 정규식용 지역명 패턴 생성 (healthCenterMatcher에서 사용)
// ⚠️ 경계 조건 처리: '도봉구'의 '도' 등이 제거되지 않도록 함
export function getRegionNamePatterns(): { full: string[]; short: string[] } {
  return {
    full: REGION_FULL_NAMES.map(r => r.label),
    short: Object.values(REGION_CODE_TO_LABEL)  // ✅ FIX: Record를 배열로 변환 (시그니처 string[] 일치)
  };
}
```

**⚠️ 중요: 응급의료지원센터 명칭 검증 필수**

현재 DB에서 실제 저장된 명칭 확인:
```sql
SELECT DISTINCT
  region_code,
  organization_name,
  type
FROM organizations
WHERE type = 'emergency_center'
ORDER BY region_code;
```

예상 결과:
```
SEO | 서울응급의료지원센터 | emergency_center
BUS | 부산응급의료지원센터 | emergency_center
...
```

만약 다른 형식이면 (예: '서울특별시 응급의료지원센터') 생성 로직 수정 필요

---

## 4. 파일 수정 순서 및 우선순위

### 권장 수정 순서

```
Phase 0 (사전 준비):
0️⃣ lib/constants/regions.ts (↑ 함수 추가)
   - 신규 함수 추가: getFullRegionName(), getEmergencyCenterName(), generateHealthCenterName(), getRegionNamePatterns()
   - 모든 파일이 이 함수들을 사용하므로 반드시 먼저
   - 난이도: 낮음

0️⃣-2 lib/services/orgFactory.ts (↑ 신규 생성)
   - 공용 팩토리 함수: generateRegionOrganizations()
   - 세 파일(organizations, health-centers-master, seed-organizations)이 공용으로 사용
   - 난이도: 중간

Phase 1 (의존성 낮음):
1️⃣ lib/utils/healthCenterMatcher.ts (↑ 정규식 개선)
   - 경계 조건 처리로 버그 수정
   - 다른 파일 수정에 영향 없음
   - 난이도: 낮음

2️⃣ lib/data/health-centers-master.ts (↑ 팩토리 함수 사용)
   - 팩토리 함수로 동적 생성
   - 자체 REGIONS 정의 제거
   - 난이도: 중간

Phase 2 (의존성 높음):
3️⃣ lib/data/organizations.ts (↑ 팩토리 함수 사용)
   - 팩토리 함수로 동적 생성 (30줄로 축소)
   - 회원가입 UI 영향 → 테스트 필수
   - 난이도: 낮음 (팩토리 함수 덕분)

4️⃣ app/api/admin/seed-organizations/route.ts (↑ 팩토리 함수 + 파싱)
   - 팩토리 함수로 생성된 데이터 파싱
   - DB seeding API 영향
   - 난이도: 낮음

Phase 3 (영향 최소):
5️⃣ components/dashboard/AEDDashboard.tsx (↑ 고정 샘플 수정)
   - 중앙 상수에서 값만 읽기 (동적 생성 안 함)
   - UI 영향 최소
   - 난이도: 낮음

6️⃣ lib/data/tutorial-sample-data.ts (↑ 고정 샘플 수정)
   - 중앙 상수에서 값만 읽기
   - 튜토리얼에만 영향
   - 난이도: 낮음

Phase 4 (최종 검증):
7️⃣ npm run tsc (TypeScript 컴파일)
8️⃣ npm run lint (ESLint)
9️⃣ npm run build (프로덕션 빌드)
🔟 브라우저 테스트 (회원가입, 프로필 설정, 대시보드)
```

### 각 Phase별 범위

**Phase 0**: 중앙 시스템 강화 + 공용 팩토리 생성
**Phase 1**: 정규식 개선 + health-centers-master 수정 (영향도 낮음)
**Phase 2**: organizations + seed-organizations 수정 (핵심 기능, 팩토리 함수 덕분에 간단함)
**Phase 3**: Mock/Test 데이터 수정 (영향 최소, 동적 생성 아님)
**Phase 4**: 최종 검증 및 테스트

---

## 5. 예상 수정 결과

### Before (현재)
```
lib/data/organizations.ts         400줄 (500+ 하드코딩)
lib/data/health-centers-master.ts 500줄 (300+ 하드코딩)
app/api/.../seed-organizations    200줄 (425+ 하드코딩)
lib/utils/healthCenterMatcher.ts  150줄 (22개 하드코딩)
components/.../AEDDashboard.tsx   ???줄 (지역명 하드코딩)
lib/data/tutorial-sample-data.ts  ???줄 (구군명 하드코딩)
─────────────────────────────────────────────────────
총 1,400+줄 약 1,500+개 요소 하드코딩
```

### After (수정 후)
```
lib/data/organizations.ts         120줄 (동적 생성, 70% 감소)
lib/data/health-centers-master.ts 100줄 (동적 생성, 80% 감소)
app/api/.../seed-organizations    60줄 (동적 생성, 70% 감소)
lib/utils/healthCenterMatcher.ts  100줄 (정규식 동적 생성, 33% 감소)
components/.../AEDDashboard.tsx   ???줄 (지역명 동적 생성)
lib/data/tutorial-sample-data.ts  ???줄 (구군명 동적 생성)
─────────────────────────────────────────────────────
총 500+줄 (중앙 시스템만 의존)
```

### 개선 효과
- 📊 코드 라인: 65% 감소 (1,400줄 → 500줄)
- 🔗 중앙 시스템 의존성: 100% (모든 파일이 중앙 시스템만 참조)
- 🛡️ 유지보수성: 극대화 (한 곳 수정 → 모든 곳 자동 반영)
- ✅ 일관성: 모든 파일에서 동일한 지역/구군 데이터

---

## 6. 구현 세부사항 및 주의사항

### 제주 특별 처리
```
일반 지역: 시도 → 구/군 → 보건소
예) 대구광역시 → 중구 → 중구 보건소

제주 특수:
- '제주시', '서귀포시'는 구/군이 아님
- REGION_CODE_TO_GUGUNS['JEJ'] = ['제주시', '서귀포시']로 처리
- 보건소 명칭: '제주특별자치도 제주시 보건소' (통상적 표기)
```

### 세종 특별 처리
```
일반 지역: 여러 구/군
세종 특수:
- REGION_CODE_TO_GUGUNS['SEJ'] = [] 또는 ['세종시'] 또는 ['세종']
- 보건소: '세종특별자치시 보건소' (1개만 존재)
```

### 응급의료지원센터 명칭 규칙
```
패턴: [지역명] + 응급의료지원센터
예:
- SEO → 서울응급의료지원센터 (X 서울특별시응급의료지원센터)
- BUS → 부산응급의료지원센터
- DAE → 대구응급의료지원센터
- 중앙 → 중앙응급의료센터

⚠️ 주의: 정식 명칭으로 변환하면 '서울특별시응급의료지원센터'가 되는데
실제 데이터는 '서울응급의료지원센터'일 가능성
→ 별도 매핑 테이블 필요 또는 데이터 검증 필요
```

---

## 7. 검증 계획

### 수정 후 필수 검증 (각 Phase마다)

**자동 검증**:
```bash
npm run tsc     # TypeScript 컴파일 에러 확인
npm run lint    # ESLint 규칙 확인
npm run build   # 프로덕션 빌드 성공 확인
```

**수동 검증** (Phase 2, 3 후):
```
□ 회원가입 페이지
  ├─ 지역 드롭다운: 17개 모두 표시
  ├─ 각 지역별 조직 드롭다운: 25-30개 정상 표시
  ├─ 구군이 정확하게 표시되는지 확인
  └─ 보건소명 형식 확인 (예: "대구광역시 중구 보건소")

□ 프로필 설정 페이지
  ├─ 조직 수정 드롭다운
  └─ 저장 후 정상 조회

□ API 엔드포인트 테스트
  ├─ POST /api/admin/seed-organizations (또는 해당 엔드포인트)
  ├─ 응답 데이터 형식 확인
  └─ DB에 정상 저장되는지 확인

□ 건강센터 검색/매칭
  ├─ healthCenterMatcher 함수 테스트
  ├─ "서울특별시 강남구" 정규화 결과 확인
  └─ 다양한 형식 입력 테스트

□ 대시보드/튜토리얼
  ├─ Mock 데이터 정상 표시
  ├─ 지역명/구군명 형식 확인
  └─ 브라우저 콘솔 에러 없는지 확인
```

---

## 8. 위험 요소 및 대응책

### 🔴 높은 위험

**위험 1**: 팩토리 함수 오류로 organizations 생성 실패
- **증상**: 회원가입 페이지 드롭다운이 안 나타남
- **원인**: `lib/services/orgFactory.ts`의 `generateRegionOrganizations()` 함수 오류
- **대응**:
  - Phase 0에서 팩토리 함수 완벽하게 테스트
  - 각 17개 지역 드롭다운이 정상 생성되는지 확인
  - 보건소 개수가 DB와 일치하는지 검증

**위험 2**: 중앙 상수의 데이터 오류 발견
- **증상**: 특정 지역의 구군이 표시 안 됨 또는 잘못된 구군 표시
- **원인**: `REGION_CODE_TO_GUGUNS`에 누락 또는 오류
- **대응**: Phase 0에서 중앙 상수 전체 검증 필수
  ```sql
  -- DB에서 실제 구군 목록 확인
  SELECT DISTINCT sido, gugun FROM aed_data WHERE sido = '서울특별시' ORDER BY gugun;
  ```

**위험 3**: 응급의료지원센터 명칭 생성 오류
- **증상**: "서울응급의료지원센터" vs "서울특별시 응급의료지원센터" 불일치
- **원인**: DB 실제 명칭과 생성 함수의 불일치
- **대응**: Phase 0에서 DB 검증 필수 (위의 SQL 참고)

---

### 🟠 중간 위험

**위험 1**: 정규식 패턴 버그 (healthCenterMatcher)
- **증상**: "도봉구"의 "도"가 제거되거나 "강도동"의 "도"가 제거됨
- **원인**: 경계 조건 미처리
- **대응**: Phase 1에서 다양한 구군명으로 테스트
  ```typescript
  // 테스트 케이스
  normalizeHealthCenterName('서울특별시 도봉구 보건소')  // → '도봉구'
  normalizeHealthCenterName('강원도 강도동')  // → '강도동'
  ```

**위험 2**: 팩토리 함수 변경이 세 파일에 미치는 영향
- **증상**: health-centers-master와 seed-organizations에서 데이터가 다름
- **원인**: 팩토리 함수의 일관성 문제
- **대응**: 팩토리 함수는 한 번만 만들고, 세 파일이 모두 같은 함수 사용 확인

---

### 🟡 낮은 위험

**위험 1**: Mock/Tutorial 데이터의 고정 샘플 오류
- **증상**: "TUTORIAL-001은 대구 중구라고 했는데 다른 구가 표시됨"
- **원인**: 고정 샘플에서 구군 코드를 중앙 상수에서 읽을 때의 오류
- **대응**: Phase 3에서 각 샘플의 region_code와 gugun 검증

**위험 2**: TypeScript 타입 오류
- **증상**: `npm run tsc` 실패
- **원인**: 팩토리 함수의 반환 타입 미정의
- **대응**: Phase 4에서 `npm run tsc` 먼저 실행, 오류 수정

---

## 9. 최종 체크리스트

### 수정 전 준비
- [ ] 이 계획 문서 검토 및 승인
- [ ] **Phase 0 - 중앙 시스템 검증**
  - [ ] REGION_CODE_TO_GUGUNS 전체 내용 확인 (17개 지역 모두)
  - [ ] DB에서 실제 구군 목록 추출하여 중앙 상수와 비교
    ```sql
    -- 각 지역별 구군 개수 확인
    SELECT sido, COUNT(DISTINCT gugun) as count
    FROM aed_data
    GROUP BY sido
    ORDER BY sido;
    ```
  - [ ] 응급의료지원센터 명칭 형식 확인 (DB vs 코드 불일치 확인)
  - [ ] Git 브랜치 생성 (예: `fix/hardcoding-removal`)

### 수정 중

**Phase 0: 중앙 시스템 강화**
- [ ] lib/constants/regions.ts에 함수 추가
  - [ ] `getFullRegionName(regionCode)` 함수
  - [ ] `getEmergencyCenterName(regionCode)` 함수
  - [ ] `generateHealthCenterName(regionCode, gugun)` 함수
  - [ ] `getRegionNamePatterns()` 함수 (선택)
  - [ ] 각 함수의 17개 지역 테스트

- [ ] lib/services/orgFactory.ts 신규 생성
  - [ ] `generateRegionOrganizations()` 함수 구현
  - [ ] TypeScript 타입 정의 완료 (RegionOrgData 인터페이스)
  - [ ] **RegionOrgData 단위 테스트** (Phase 0 검증용)
    ```typescript
    // 테스트 케이스: 팩토리가 정확한 메타데이터 반환하는지 검증
    const data = generateRegionOrganizations();

    // 1. 17개 지역이 모두 반환되는지 확인 (중앙 포함)
    assert(data.length === 17);

    // 2. 각 지역의 guguns 배열이 중앙 상수와 일치하는지 확인
    data.forEach(region => {
      if (region.regionCode !== 'KR') {
        const expectedGuguns = REGION_CODE_TO_GUGUNS[region.regionCode];
        assert(region.guguns.length === expectedGuguns?.length);
        assert(JSON.stringify(region.guguns) === JSON.stringify(expectedGuguns));
      }
    });

    // 3. region 필드가 항상 SHORT name인지 확인
    data.forEach(region => {
      if (region.regionCode === 'KR') {
        assert(region.region === '중앙');
      } else {
        const regionObj = REGIONS.find(r => r.code === region.regionCode);
        assert(region.region === regionObj?.label);  // SHORT name과 일치
      }
    });

    // 4. organizations 배열의 첫 항목이 '기타 (직접 입력)'인지 확인
    data.forEach(region => {
      if (region.region !== '중앙') {
        assert(region.organizations[0] === '기타 (직접 입력)');  // ✅ FIX: index 0이 첫 요소
      }
    });

    // 5. 보건소 개수가 guguns.length와 일치하는지 확인
    // (보건소 = 정식명칭 + 응급의료센터 + guguns 개수)
    data.forEach(region => {
      if (region.regionCode !== 'KR') {
        const expectedCenterCount = 1 + 1 + region.guguns.length;  // 시도청 + 응급센터 + 보건소들
        const actualCenterCount = region.organizations.length - 1;  // 기타 제외
        assert(actualCenterCount === expectedCenterCount);
      }
    });
    ```
  - [ ] 각 17개 지역 모두 테스트 케이스 통과 확인

**Phase 1: 의존성 낮은 파일들**
- [ ] lib/utils/healthCenterMatcher.ts 수정
  - [ ] 정규식 경계 조건 처리
  - [ ] "도봉구", "강도동" 등으로 테스트
- [ ] lib/data/health-centers-master.ts 수정
  - [ ] 팩토리 함수 import 및 사용
  - [ ] 자체 REGIONS 정의 제거

**Phase 2: 핵심 파일들**
- [ ] lib/data/organizations.ts 수정
  - [ ] 팩토리 함수 import 및 사용
  - [ ] regionOrganizations가 동적으로 생성되는지 확인
  - [ ] **회원가입 페이지에서 지역/조직 드롭다운 정상 작동 확인**
- [ ] app/api/admin/seed-organizations/route.ts 수정
  - [ ] 팩토리 함수에서 데이터 생성
  - [ ] city_code 추출 로직 테스트

**Phase 3: 영향 최소 파일들**
- [ ] components/dashboard/AEDDashboard.tsx 수정
  - [ ] 고정 샘플로 유지 (동적 생성 안 함)
  - [ ] 중앙 상수에서 값만 읽기
- [ ] lib/data/tutorial-sample-data.ts 수정
  - [ ] 고정 샘플로 유지 (Math.random() 제거)
  - [ ] 중앙 상수에서 값만 읽기

### 수정 후 검증

**Phase 4: 자동 검증**
- [ ] `npm run tsc` 통과 (타입 오류 없음)
- [ ] `npm run lint` 통과 (스타일 오류 없음)
- [ ] `npm run build` 통과 (빌드 성공)

**Phase 4: 수동 검증**
- [ ] 회원가입 페이지
  - [ ] 17개 지역 모두 드롭다운에 표시
  - [ ] 각 지역의 보건소 개수 확인
  - [ ] 보건소명 형식 확인 (예: "서울특별시 강남구 보건소")
- [ ] 프로필 설정 페이지
  - [ ] 조직 수정 드롭다운 정상
- [ ] healthCenterMatcher 테스트
  - [ ] 다양한 지역명으로 정규화 테스트
- [ ] 대시보드/튜토리얼
  - [ ] Mock 데이터가 정상 표시
  - [ ] 선택한 구군이 중앙 상수에서 읽은 값과 일치

### 최종 커밋
- [ ] 모든 파일 수정 완료
- [ ] 모든 검증 통과 (tsc, lint, build, 수동 테스트)
- [ ] Git commit 메시지 작성:
  ```
  fix: Remove hardcoding in region/district management

  - Central consolidation: lib/services/orgFactory.ts (new)
  - Removed hardcoding: organizations.ts, health-centers-master.ts, seed-organizations, healthCenterMatcher
  - Fixed regex: healthCenterMatcher with boundary conditions
  - Updated samples: AEDDashboard, tutorial-sample-data (fixed samples + central values)

  Impact: 1,400+ lines → 500 lines, 100% central system dependency
  ```
- [ ] GitHub에 Push

---

## 📌 추가 참고사항

### 현재 시스템 상황
- **점검 이력 조회 API**: 이미 중앙 시스템 사용 (`lib/constants/regions.ts` import)
- **회원가입 시 도메인 검증**: 이미 구현되어 있음
- **권한 체계**: CLAUDE.md에 정의된 대로 작동 중

### 이후 작업 (이 계획 이후)
1. **사진 스토리지 마이그레이션**: Supabase → NCP Object Storage
2. **점검 통계 대시보드**: 실제 데이터 기반 시각화
3. **PWA 오프라인 모드**: IndexedDB 동기화

---

**이 계획에 대한 검토 및 피드백을 기다리고 있습니다.**

작성자: Claude Code
작성일: 2025-11-09
