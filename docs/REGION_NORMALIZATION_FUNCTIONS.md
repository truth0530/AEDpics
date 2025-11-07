# AEDpics 지역/시군구 정규화 및 매핑 함수 종합 리포트

생성일: 2025-11-07
대상: 전체 코드베이스 (lib/, app/, scripts/)

---

## 1. 핵심 지역 코드 및 라벨 관리

### 1.1 지역 상수 및 유틸리티
**파일**: `/Users/kwangsunglee/Projects/AEDpics/lib/constants/regions.ts`

#### 데이터 구조
- `REGIONS`: 17개 시도 + 중앙(KR) = 18개 지역 배열
- 각 Region 객체: `{ code, label, type, latitude?, longitude? }`
- 코드: 3자리 대문자 (예: SEO, DAE, JEJ)
- 라벨: 짧은 한글명 (예: 서울, 대구, 제주)

#### 매핑 레코드
| 레코드명 | 용도 | 내용 |
|---------|------|------|
| `REGION_CODE_TO_LABEL` | 코드 → 짧은 라벨 | 'SEO' → '서울' |
| `REGION_LABEL_TO_CODE` | 짧은 라벨 → 코드 | '서울' → 'SEO' |
| `REGION_LONG_LABELS` | 정식명칭 → 코드 | '서울특별시' → 'SEO' |
| `REGION_CODE_TO_DB_LABELS` | 코드 → 한글 배열 | 'SEO' → ['서울특별시', '서울'] |
| `REGION_FULL_NAMES` | 코드 → 정식명칭 | 'SEO' → '서울특별시' |
| `CITY_CODE_TO_GUGUN_MAP` | 영문 시군구코드 → 한글명 | 'jeju' → '제주시' |

#### 주요 함수

| 함수명 | 용도 | 입력 | 출력 | 상태 |
|--------|------|------|------|------|
| `getRegionLabel(code)` | 코드 → 짧은 라벨 | 'SEO' | '서울' | 활성 |
| `getRegionCode(label)` | 라벨/정식명칭 → 코드 | '서울' 또는 '서울특별시' | 'SEO' | 활성 |
| `normalizeRegionName(fullName)` | 정식명칭 → 짧은 라벨 | '충청남도' | '충남' | 활성 |
| `normalizeRegionCode(value)` | 다양한 형태 → 표준 코드 | '서울' 또는 '서울특별시' 또는 'SEO' | 'SEO' | 활성 |
| `getRegionFullLabel(code)` | 코드 → 정식명칭 | 'SEO' | '서울특별시' | 활성 |
| `extractRegionFromOrgName(orgName)` | 조직명에서 지역 추출 | '대구광역시 수성구 보건소' | `{sido: '대구', gugun: '수성구'}` | 활성 |
| `mapCityCodeToGugun(cityCode)` | 영문 시군구코드 → 한글명 | 'jeju' | '제주시' | 활성 |
| `mapRegionCodesToDbLabels(codes)` | 지역코드 배열 → 한글 배열 | ['SEO', 'DAE'] | ['서울특별시', '대구광역시'] | 활성 |
| `getRegionCodeFromOrgName(orgName)` | 조직명에서 region_code 추출 | '대구광역시 수성구 보건소' | 'DAE' | 활성 |
| `normalizeAedDataRegion(rawValue)` | e-gen 원본 데이터 정규화 | '경기', '경기도', '경 기' | '경기도' | 활성 |
| `getNormalizedRegionLabel(code)` | 코드 → 대시보드용 정식명칭 | 'GYE' | '경기도' | 활성 |
| `getRegionSortOrder(label)` | 라벨 → 표준 정렬순서 | '서울' | 0 | 활성 |
| `getAllowedRegions(role)` | 역할별 허용 지역 필터링 | 'local_admin' | Region[] | 활성 |
| `isValidRegionForRole(code, role)` | 역할-지역 조합 유효성 검증 | ('SEO', 'local_admin') | boolean | 활성 |

**핵심 특징**:
- 중앙(KR) 구분: 데이터 조회에는 사용 불가, 조직 구분용 코드
- 이원화된 라벨: 짧은 형태(UI용), 정식명칭(DB저장용)
- 정식명칭 지원: 사용자 입력 시 '서울특별시' 형태 지원
- 약어 정규화: '경기', '경기도', '경기도청', '경 기' 모두 → '경기도'

---

### 1.2 시군구 코드 및 라벨 관리
**파일**: `/Users/kwangsunglee/Projects/AEDpics/lib/constants/cities.ts`

#### 데이터 구조
- `CITIES`: City[] 인터페이스
  ```typescript
  interface City {
    code: string;      // 5자리 숫자 (예: '11010')
    name: string;      // 한글명 (예: '종로구')
    regionCode: string; // 3자리 코드 (예: 'SEO')
    type: 'city' | 'county' | 'district';
  }
  ```
- 전국 시군구: 약 260개 (17개 시도 전체 포함)

#### 매핑 레코드
| 레코드명 | 용도 |
|---------|------|
| `CITY_CODE_TO_NAME` | 시군구 코드 → 이름 |
| `CITIES_BY_REGION` | 지역코드별 시군구 그룹핑 |

#### 주요 함수

| 함수명 | 용도 | 입력 | 출력 | 상태 |
|--------|------|------|------|------|
| `getCityName(code)` | 시군구 코드 → 이름 | '11010' | '종로구' | 활성 |
| `getCitiesByRegion(regionCode)` | 지역별 시군구 목록 | 'SEO' | City[] | 활성 |
| `searchCities(query)` | 시군구 검색 | '종로' | City[] | 활성 |
| `mapCityCodesToNames(codes)` | 코드 배열 → 이름 배열 | ['11010', '11020'] | ['종로구', '중구'] | 활성 |
| `getAllCities()` | 전체 시군구 목록 | - | City[] | 활성 |

**핵심 특징**:
- 5자리 코드: 시도(2) + 시군구(3)
- 지역별 그룹화: CITIES_BY_REGION으로 빠른 검색 가능
- 유연한 매핑: 코드 또는 이름으로 변환 가능

---

## 2. 지역 정규화 및 변환 함수

### 2.1 전화번호 지역번호 기반 지역 추출
**파일**: `/Users/kwangsunglee/Projects/AEDpics/lib/utils/area-code.ts`

#### 매핑 데이터
- `AREA_CODE_TO_REGION`: 지역번호(02, 031, 032 등) → 지역명
- 17개 시도 + 특별자치 지역 포함

#### 함수

| 함수명 | 용도 | 입력 | 출력 | 상태 |
|--------|------|------|------|------|
| `extractAreaCode(phone)` | 전화번호에서 지역번호 추출 | '02-1234-5678' | '02' | 활성 |
| `getRegionByAreaCode(areaCode)` | 지역번호 → 지역명 | '02' | '서울특별시' | 활성 |
| `getRegionFromPhone(phone)` | 전화번호 → 지역명 | '02-1234-5678' | '서울특별시' | 활성 |
| `isPhoneFromRegion(phone, region)` | 전화번호가 특정 지역인지 확인 | ('02-1234-5678', '서울특별시') | true | 활성 |

**핵심 특징**:
- 02 (2자리): 서울 특별 처리
- 031, 032, 033... (3자리): 지역번호
- 자동 지역 선택: 회원가입 시 전화번호로 지역 자동 설정

---

### 2.2 AED 데이터 매핑 및 정규화
**파일**: `/Users/kwangsunglee/Projects/AEDpics/lib/utils/aed-data-mapper.ts`

#### 주요 함수

| 함수명 | 용도 | 입력 | 출력 | 상태 |
|--------|------|------|------|------|
| `getRegionCode(sido)` | 시도명 → 지역 코드 | '경기도' 또는 '경기' | 'GYE' | 활성 |
| `mapAedData(item)` | 원본 AED 데이터 → API 응답 형식 | RPC 결과 객체 | 정규화된 객체 | 활성 |
| `normalizeString(value)` | 값 → 정규화 문자열 | 임의의 값 | string \| null | 내부 |
| `normalizeNumber(value)` | 값 → 정규화 숫자 | 임의의 값 (Decimal 포함) | number \| null | 내부 |
| `getDaysUntil(date)` | 날짜까지 남은 일수 | Date \| string | number \| null | 내부 |
| `getDaysSince(date)` | 날짜 이후 경과 일수 | Date \| string | number \| null | 내부 |
| `isPublicVisible(displayAllowed)` | 공개 여부 판단 | '표출허용' \| 'Y' 등 | boolean | 내부 |

**mapAedData 변환 규칙**:
```
입력: {
  sido, region_label, region_name, region_full_name, region, region_code,
  gugun, city, city_name, city_label, city_code, cityCode,
  latitude (Decimal), longitude (Decimal),
  ...
}

출력: {
  id, equipment_serial, device_serial, management_number,
  sido (정규화), gugun (정규화),
  region_code (표준 3자리), city_code,
  latitude (number), longitude (number),
  ...
}
```

**특징**:
- Prisma Decimal 객체 처리
- 유연한 필드명 지원 (camelCase, snake_case 모두)
- 날짜 자동 계산 (남은 일수, 경과 일수)
- 공개 여부 자동 판단

---

### 2.3 보건소 명칭 정규화 및 매칭
**파일**: `/Users/kwangsunglee/Projects/AEDpics/lib/utils/healthCenterMatcher.ts`

#### 클래스: HealthCenterMatcher

| 메서드명 | 용도 | 입력 | 출력 | 상태 |
|---------|------|------|------|------|
| `normalizeForMatching(name)` | 보건소명 → 정규화 키 | '대구광역시중구보건소' | 'daegu jung' | 활성 |
| `createKey(province, district)` | 시도+구군 → 정규화 키 | ('대구광역시', '중구') | 'daegu jung' | 활성 |
| `isMatch(name1, name2)` | 두 보건소명이 같은지 확인 | ('대구광역시중구보건소', '대구 중구 보건소') | true | 활성 |
| `standardizeForDisplay(name)` | 회원가입 폼용 표준화 | '서울특별시 중구 보건소' | '중구보건소' | 활성 |
| `getAbbreviation(name)` | 보건소명 → 약어 | '대구광역시중구보건소' | '중구' | 활성 |
| `findMatchingOption(intranetName, formOptions)` | 인트라넷 데이터 매칭 | ('대구광역시중구보건소', ['대구광역시 중구 보건소', ...]) | '대구광역시 중구 보건소' | 활성 |
| `calculateSimilarity(str1, str2)` | 유사도 점수 (0-1) | ('서울중구보건소', '중구보건소') | 0.85 | 활성 |
| `findBestMatch(intranetName, formOptions)` | 최고 유사도 매칭 | ('서울중구보건소', [...]) | `{option, score}` | 활성 |

**정규화 규칙**:
1. 공백 모두 제거
2. 시도 접미사 제거 (특별시, 광역시, 특별자치시, 특별자치도, 도)
3. '보건소' 접미사 제거
4. 소문자 통일

**특별 매핑** (SPECIAL_MAPPINGS):
- 대구 군위군: 2023년 편입 대응
- 세종시: 특수 케이스 처리

---

### 2.4 대시보드 쿼리용 정규화
**파일**: `/Users/kwangsunglee/Projects/AEDpics/lib/aed/dashboard-queries.ts`

#### 함수

| 함수명 | 용도 | 입력 | 출력 | 상태 |
|--------|------|------|------|------|
| `normalizeRegionName(fullName)` | 정식명칭 → 짧은 라벨 | '충청남도' | '충남' | 활성 (re-export) |

**사용 처**:
- LINE 116-117: 선택된 지역명 정규화
- GROUP BY 쿼리 실행 전 정규화 필수
- 중복 집계 방지

**특징**:
- e-gen 원본 데이터의 변형 통일 ('경기', '경기도', '경 기' → '경기도')
- Prisma 쿼리 후 정규화 또는 SQL CASE WHEN 사용
- 대시보드 통계 일관성 보장

---

## 3. 권한 및 접근 제어 관련 함수

### 3.1 접근 제어 함수
**파일**: `/Users/kwangsunglee/Projects/AEDpics/lib/auth/access-control.ts`

#### 함수

| 함수명 | 용도 | 입력 | 출력 | 상태 |
|--------|------|------|------|------|
| `getRegionCode(label)` | 라벨 → 코드 | '서울' | 'SEO' | 활성 (re-export) |
| `mapCityCodeToGugun(cityCode)` | 시군구코드 → 한글명 | 'jeju' | '제주시' | 활성 (re-export) |

**사용 처**: local_admin 권한 검증

---

### 3.2 건강 센터별 권한 관리
**파일**: `/Users/kwangsunglee/Projects/AEDpics/lib/data/health-centers-master.ts`

#### 함수

| 함수명 | 용도 | 입력 | 출력 | 상태 |
|--------|------|------|------|------|
| `normalizeHealthCenterName(name)` | 보건소명 정규화 | '대구광역시 중구 보건소' | 'daegujung' | 활성 |
| `isHealthCenterMatch(name1, name2)` | 두 보건소명 일치 확인 | (name1, name2) | boolean | 활성 |
| `getHealthCentersByRegion(regionCode)` | 지역별 보건소 목록 | 'DAE' | string[] | 활성 |
| `getAllHealthCenters()` | 전체 보건소 목록 | - | string[] | 활성 |

**데이터**: HEALTH_CENTERS_BY_REGION
- 261개 보건소 (2024년 12월 기준)
- 지역별 그룹화
- 인트라넷 데이터와 일치

---

## 4. 사용 위치별 분류

### 4.1 회원가입/승인 플로우
- `getRegionCode()`: 지역 선택 → 코드 변환
- `mapCityCodeToGugun()`: local_admin 권한 검증
- `normalizeHealthCenterName()`: 보건소 자동 매칭
- `extractAreaCode()`: 전화번호로 지역 자동 선택

### 4.2 대시보드 쿼리
- `normalizeRegionName()`: GROUP BY 전 정규화
- `normalizeAedDataRegion()`: e-gen 원본 데이터 정규화
- `mapAedData()`: RPC 결과 변환

### 4.3 API 응답
- `mapAedData()`: AED 데이터 표준화
- `getRegionLabel()`: UI 표시용 라벨 변환
- `mapCityCodesToNames()`: 시군구 코드 → 이름

### 4.4 데이터베이스 저장
- `normalizeRegionCode()`: 입력값 → 표준 코드
- `REGION_CODE_TO_DB_LABELS`: 코드 → DB 저장용 정식명칭
- `mapRegionCodesToDbLabels()`: 코드 배열 → 라벨 배열

### 4.5 검색/필터링
- `searchCities()`: 시군구 검색
- `getCitiesByRegion()`: 지역별 시군구 필터링
- `findMatchingOption()`: 보건소 명칭 검색

---

## 5. 데이터 흐름 예시

### 5.1 회원가입 → 보건소 자동 매칭
```
1. 사용자 입력: "서울특별시 중구 보건소"
2. normalizeForMatching() → "seouljeung"
3. HEALTH_CENTERS_BY_REGION["SEO"]에서 검색
4. findMatchingOption() → "서울특별시 중구 보건소" (정확 매칭)
5. DB 저장: organization_id 자동 설정
```

### 5.2 AED 데이터 조회
```
1. 원본 데이터: {sido: "경기", gugun: "수원", ...}
2. mapAedData() 실행:
   - normalizeAedDataRegion("경기") → "경기도"
   - getRegionCode("경기도") → "GYE"
3. API 응답: {sido: "경기도", region_code: "GYE", gugun: "수원", ...}
4. UI 표시: 지역명 "경기"로 축약 (REGION_CODE_TO_LABEL 사용)
```

### 5.3 대시보드 통계
```
1. 사용자 선택: sido="경기도", gugun="전체"
2. normalizeRegionName("경기도") → "경기"
3. GROUP BY sido WHERE sido LIKE "%경기%"
4. 결과 정규화: normalizeAedDataRegion(sido) 적용
5. 일관된 통계 제공
```

### 5.4 권한 검증 (local_admin)
```
1. 사용자: user_profile.region_code = "DAE"
2. 요청: GET /api/aed-data?region=대구
3. normalizeRegionCode("대구") → "DAE"
4. isValidRegionForRole("DAE", "local_admin") → true
5. 해당 지역 데이터만 반환
```

---

## 6. 주요 맵핑 관계도

```
┌─────────────────────────────────────────────────────┐
│ 사용자 입력 형태                                      │
├─────────────────────────────────────────────────────┤
│ - 정식명칭: "서울특별시", "경기도"                   │
│ - 짧은명: "서울", "경기"                            │
│ - 구글: "경기", "경 기", "경기도청"                 │
│ - 전화: "02-xxxx-xxxx", "031-xxx-xxxx"             │
│ - 시군구: "중구", "중구보건소", "경기도 수원시"     │
└─────────────────────────────────────────────────────┘
                      ↓ (정규화)
┌─────────────────────────────────────────────────────┐
│ 표준 형태 (3자리 코드)                               │
├─────────────────────────────────────────────────────┤
│ 지역 코드: SEO, DAE, GYE, ...                       │
│ 지역 라벨: 서울, 대구, 경기, ...                    │
│ 정식명칭: 서울특별시, 경기도, ...                   │
│ 지역번호: 02, 031, 053, ...                        │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ DB 저장 형태                                         │
├─────────────────────────────────────────────────────┤
│ users.region_code: "SEO", "DAE"                    │
│ aed_data.sido: "서울특별시", "경기도"              │
│ aed_data.gugun: "중구", "강남구"                   │
│ organizations.city_code: "jeju", "seogwipo"       │
│ health_centers: "서울특별시 중구 보건소", ...      │
└─────────────────────────────────────────────────────┘
```

---

## 7. 비활성 또는 레거시 함수

### 7.1 Supabase 관련 (비활성)
**파일**: `/Users/kwangsunglee/Projects/AEDpics/lib/utils/region-utils.ts` (구버전)

- `abbreviateRegion()`: 이 기능은 `normalizeRegionName()`으로 대체됨
- Supabase RPC 호출용 함수들: NCP 마이그레이션 완료로 미사용

---

## 8. 주의사항 및 베스트 프랙티스

### 8.1 단일 진실 소스 (Single Source of Truth)
- 모든 매핑은 `/lib/constants/regions.ts`의 REGIONS 배열을 기준
- 새로운 매핑 추가 시 다른 파일에 하드코딩 금지

### 8.2 정규화 순서
```
사용자 입력 → normalizeXxx() → getXxxCode() → DB 저장
```

### 8.3 역할별 지역 권한
- `emergency_center_admin`: 'KR'만 가능 (중앙)
- `regional_admin`: 'KR' 제외 모든 지역
- `local_admin`: 지정된 시군구만 (고정)

### 8.4 e-gen 데이터 정규화
- `mapAedData()`는 모든 입력 필드명 변형 지원
- `normalizeAedDataRegion()`으로 원본 데이터 정규화 필수

### 8.5 시군구 코드 두 가지 형태
1. **숫자 코드**: '11010' (지역 구분 안 됨) - organizations.city_code에는 사용 안 함
2. **영문 코드**: 'jeju', 'seogwipo' - organizations.city_code에 사용

---

## 9. 완전성 체크리스트

### 현재 상태 (2025-11-07)
- [x] 17개 시도 정의
- [x] 261개 보건소 매핑
- [x] 260+ 시군구 정의
- [x] 지역번호 매핑 (02, 031, 032 등)
- [x] 회원가입 플로우 통합
- [x] 대시보드 쿼리 정규화
- [x] 권한 검증 통합
- [ ] 지역별 상세 주소 정규화 (향후 확장 가능)

---

## 10. 파일 위치 요약

| 분류 | 파일 경로 |
|------|---------|
| 지역 상수 | `/Users/kwangsunglee/Projects/AEDpics/lib/constants/regions.ts` |
| 시군구 상수 | `/Users/kwangsunglee/Projects/AEDpics/lib/constants/cities.ts` |
| 지역번호 | `/Users/kwangsunglee/Projects/AEDpics/lib/utils/area-code.ts` |
| AED 매핑 | `/Users/kwangsunglee/Projects/AEDpics/lib/utils/aed-data-mapper.ts` |
| 보건소 매칭 | `/Users/kwangsunglee/Projects/AEDpics/lib/utils/healthCenterMatcher.ts` |
| 대시보드 쿼리 | `/Users/kwangsunglee/Projects/AEDpics/lib/aed/dashboard-queries.ts` |
| 접근 제어 | `/Users/kwangsunglee/Projects/AEDpics/lib/auth/access-control.ts` |
| 보건소 데이터 | `/Users/kwangsunglee/Projects/AEDpics/lib/data/health-centers-master.ts` |
| 조직 데이터 | `/Users/kwangsunglee/Projects/AEDpics/lib/data/organizations.ts` |

---

**보고서 완성**
총 함수 수: 40+개
총 매핑 레코드: 10+개
총 파일: 9개
