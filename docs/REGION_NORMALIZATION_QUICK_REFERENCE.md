# 지역/시군구 정규화 함수 빠른 참조 가이드

## 자주 사용하는 함수 TOP 10

### 1. 지역 코드로 라벨 가져오기
```typescript
import { getRegionLabel } from '@/lib/constants/regions';

const label = getRegionLabel('SEO'); // '서울'
```

### 2. 지역명/정식명칭으로 코드 가져오기
```typescript
import { getRegionCode } from '@/lib/constants/regions';

const code1 = getRegionCode('서울'); // 'SEO'
const code2 = getRegionCode('서울특별시'); // 'SEO'
```

### 3. e-gen 원본 데이터 정규화
```typescript
import { normalizeAedDataRegion } from '@/lib/constants/regions';

const normalized = normalizeAedDataRegion('경기도');    // '경기도'
const normalized2 = normalizeAedDataRegion('경기');     // '경기도'
const normalized3 = normalizeAedDataRegion('경 기');    // '경기도'
```

### 4. AED 데이터 매핑
```typescript
import { mapAedData } from '@/lib/utils/aed-data-mapper';

const mapped = mapAedData({
  sido: '경기',
  gugun: '수원',
  latitude: 37.2656,
  // ... 기타 필드
});
// {
//   sido: '경기도',
//   gugun: '수원',
//   region_code: 'GYE',
//   latitude: 37.2656,
//   ...
// }
```

### 5. 전화번호로 지역 추출
```typescript
import { getRegionFromPhone } from '@/lib/utils/area-code';

const region = getRegionFromPhone('02-1234-5678');   // '서울특별시'
const region2 = getRegionFromPhone('031-123-4567');  // '경기도'
```

### 6. 보건소명 자동 매칭
```typescript
import { HealthCenterMatcher } from '@/lib/utils/healthCenterMatcher';

const matched = HealthCenterMatcher.findMatchingOption(
  '대구광역시중구보건소',
  ['대구광역시 중구 보건소', '대구광역시 동구 보건소']
);
// '대구광역시 중구 보건소'
```

### 7. 시군구 이름으로 조회
```typescript
import { getCityName } from '@/lib/constants/cities';

const name = getCityName('11010'); // '종로구'
```

### 8. 지역별 시군구 목록
```typescript
import { getCitiesByRegion } from '@/lib/constants/cities';

const cities = getCitiesByRegion('SEO');
// [
//   { code: '11010', name: '종로구', regionCode: 'SEO', type: 'district' },
//   { code: '11020', name: '중구', regionCode: 'SEO', type: 'district' },
//   ...
// ]
```

### 9. 영문 시군구코드 → 한글명
```typescript
import { mapCityCodeToGugun } from '@/lib/constants/regions';

const gugun1 = mapCityCodeToGugun('jeju');       // '제주시'
const gugun2 = mapCityCodeToGugun('seogwipo');   // '서귀포시'
```

### 10. 조직명에서 지역 코드 추출
```typescript
import { getRegionCodeFromOrgName } from '@/lib/constants/regions';

const code = getRegionCodeFromOrgName('대구광역시 수성구 보건소'); // 'DAE'
```

---

## 사용 시나리오별 함수 선택

### 회원가입 플로우
```typescript
// 1. 전화번호로 지역 자동 선택
import { getRegionFromPhone } from '@/lib/utils/area-code';
const region = getRegionFromPhone(userPhone);

// 2. 지역명으로 코드 변환
import { getRegionCode } from '@/lib/constants/regions';
const regionCode = getRegionCode(region);

// 3. 보건소명 자동 매칭
import { HealthCenterMatcher } from '@/lib/utils/healthCenterMatcher';
const matched = HealthCenterMatcher.findMatchingOption(
  userHealthCenterName,
  availableOptions
);
```

### 대시보드 쿼리
```typescript
// 1. 사용자 입력 정규화
import { normalizeRegionName } from '@/lib/constants/regions';
const normalized = normalizeRegionName(userSelectedRegion);

// 2. 데이터베이스 쿼리 실행
const data = await prisma.aed_data.findMany({
  where: { sido: normalized }
});

// 3. 결과 정규화
import { normalizeAedDataRegion } from '@/lib/constants/regions';
const results = data.map(d => ({
  ...d,
  sido: normalizeAedDataRegion(d.sido)
}));
```

### API 응답 생성
```typescript
// 1. 데이터 매핑
import { mapAedData } from '@/lib/utils/aed-data-mapper';
const mapped = mapAedData(rawData);

// 2. UI 표시용 라벨 변환
import { getRegionLabel } from '@/lib/constants/regions';
const response = {
  ...mapped,
  region_display: getRegionLabel(mapped.region_code)
};
```

### 권한 검증
```typescript
// 1. local_admin 권한 확인
import { mapCityCodeToGugun } from '@/lib/constants/regions';
const userGugun = mapCityCodeToGugun(userProfile.city_code);

// 2. 요청 지역이 권한 범위 내인지 확인
if (requestedGugun !== userGugun) {
  throw new Error('권한 없음');
}
```

---

## 매핑 구조 한눈에 보기

### 지역 (17개 시도 + 중앙)
```
코드(3자리)  ↔ 짧은라벨    ↔ 정식명칭
SEO          ↔ 서울        ↔ 서울특별시
DAE          ↔ 대구        ↔ 대구광역시
GYE          ↔ 경기        ↔ 경기도
KR           ↔ 중앙        ↔ (데이터 없음)
```

### 시군구
```
5자리코드 ↔ 한글명      ↔ 지역코드
11010    ↔ 종로구      ↔ SEO
22010    ↔ 중구        ↔ DAE
39010    ↔ 제주시      ↔ JEJ
```

### 영문시군구코드 (organizations.city_code)
```
jeju       → 제주시
seogwipo   → 서귀포시
gimhae     → 김해시
cheongju   → 청주시
```

### 지역번호 (area code)
```
02   → 서울특별시
031  → 경기도
032  → 인천광역시
053  → 대구광역시
...
```

---

## 흔한 실수와 해결책

### 실수 1: 정규화 없이 GROUP BY
```typescript
// 잘못됨
const results = await prisma.$queryRaw`
  SELECT sido, COUNT(*) as count
  FROM aed_data
  GROUP BY sido
`;
// 결과: sido='경기', '경기도', '경 기' 등이 별도로 집계됨

// 올바름
import { normalizeAedDataRegion } from '@/lib/constants/regions';
const results = await prisma.aed_data.findMany();
const grouped = {};
results.forEach(item => {
  const normalizedSido = normalizeAedDataRegion(item.sido);
  grouped[normalizedSido] = (grouped[normalizedSido] || 0) + 1;
});
```

### 실수 2: 정식명칭과 짧은라벨 혼동
```typescript
// 잘못됨
const code = 'SEO';
const display = REGION_CODE_TO_DB_LABELS[code]; // ['서울특별시', '서울']
// 사용자에게 배열을 그대로 표시하면 안 됨

// 올바름
const display = getRegionLabel(code); // '서울'
```

### 실수 3: 영문 시군구코드와 숫자코드 혼동
```typescript
// 잘못됨
mapCityCodeToGugun('11010'); // 지역 구분 불가

// 올바름
mapCityCodeToGugun('jeju');  // '제주시'
```

### 실수 4: 케이스 민감도 무시
```typescript
// 잘못됨
getRegionCode('SEO');  // null 반환 (코드를 라벨로 간주)

// 올바름
getRegionLabel('SEO'); // '서울'
```

---

## 성능 최적화 팁

### 1. 반복적인 조회 최소화
```typescript
// 나쁨: 루프 내에서 매번 함수 호출
const results = data.map(item => ({
  ...item,
  regionLabel: getRegionLabel(item.region_code) // 18번 호출 가능
}));

// 좋음: 미리 매핑 생성
const regionLabels = REGION_CODE_TO_LABEL; // 상수 참조
const results = data.map(item => ({
  ...item,
  regionLabel: regionLabels[item.region_code]
}));
```

### 2. 배열 필터링 최적화
```typescript
// 나쁨: 매번 배열 검색
const getCitiesForRegion = (code) => CITIES.filter(c => c.regionCode === code);

// 좋음: 미리 구성된 매핑 사용
import { CITIES_BY_REGION } from '@/lib/constants/cities';
const cities = CITIES_BY_REGION[code]; // O(1)
```

### 3. 정규화 캐싱
```typescript
// 나쁨: 매번 정규화
const normalized = normalizeAedDataRegion(data.sido);
const normalized2 = normalizeAedDataRegion(data.sido);

// 좋음: 한 번만 정규화
const normalized = normalizeAedDataRegion(data.sido);
// 재사용
```

---

## 파일 임포트 가이드

### 지역 함수
```typescript
import {
  getRegionLabel,
  getRegionCode,
  normalizeRegionName,
  normalizeRegionCode,
  normalizeAedDataRegion,
  extractRegionFromOrgName,
  mapCityCodeToGugun,
} from '@/lib/constants/regions';
```

### 시군구 함수
```typescript
import {
  getCityName,
  getCitiesByRegion,
  searchCities,
  mapCityCodesToNames,
} from '@/lib/constants/cities';
```

### 지역번호
```typescript
import {
  extractAreaCode,
  getRegionFromPhone,
} from '@/lib/utils/area-code';
```

### AED 데이터
```typescript
import { mapAedData } from '@/lib/utils/aed-data-mapper';
```

### 보건소 매칭
```typescript
import { HealthCenterMatcher } from '@/lib/utils/healthCenterMatcher';
```

---

## 타입 정의

### Region
```typescript
interface Region {
  code: string;      // 'SEO', 'DAE', ...
  label: string;     // '서울', '대구', ...
  type: 'central' | 'metropolitan' | 'province' | 'special';
  latitude?: number;
  longitude?: number;
}
```

### City
```typescript
interface City {
  code: string;      // '11010', '11020', ...
  name: string;      // '종로구', '중구', ...
  regionCode: string; // 'SEO', 'DAE', ...
  type: 'city' | 'county' | 'district';
}
```

---

## 최신 업데이트 (2025-11-07)

- 40+ 함수 문서화 완료
- 10+ 매핑 레코드 정리
- 사용 시나리오별 가이드 추가
- 성능 최적화 팁 추가

---

**마지막 검증**: 모든 함수는 활성 상태이며, 레거시 Supabase 관련 함수는 제거됨.
**권장**: 새로운 함수 추가 시 이 가이드를 함께 업데이트하세요.
