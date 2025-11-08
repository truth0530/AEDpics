# Hardcoding Detection Skill

## Purpose
자동으로 새로운 파일에서 하드코딩 위반을 감지하고 중앙 관리 시스템 사용을 강제합니다.

## 핵심 규칙

### 절대 금지 사항
- 지역명 하드코딩: `'서울'`, `'부산'` 등 직접 문자열 사용
- City code 하드코딩: `city_code: 'gimhae'`, `gugun: '강남구'`
- 구군명 배열 하드코딩: `const GUGUN_MAP = { '서울': [...] }`
- 시도 검사: `if (sido === '서울')` 조건부 하드코딩
- 지역 코드 매핑: `const REGION_CODES = { SEO: '서울', ... }`

### 올바른 사용법
```typescript
// ✅ 올바른 예시

// 1. regions.ts에서 import
import {
  REGIONS,
  REGION_CODE_TO_GUGUNS,
  mapCityCodeToGugun,
  getFullRegionName,
  getRegionNamePatterns,
  generateHealthCenterName
} from '@/lib/constants/regions';

// 2. orgFactory에서 동적 데이터 생성
import { generateRegionOrganizations } from '@/lib/services/orgFactory';
const regionOrgData = generateRegionOrganizations();

// 3. 필요한 데이터 조회
const gugunList = REGION_CODE_TO_GUGUNS['SEO']; // 서울의 구군 배열
const fullName = getFullRegionName('SEO'); // '서울특별시'
const healthCenterName = generateHealthCenterName('SEO', '강남구'); // '서울특별시 강남구 보건소'
```

## 검사 항목

### 1. Import 검증
- [ ] `regions.ts` 또는 `orgFactory.ts`에서 올바르게 import하는가?
- [ ] 하드코딩 대신 import한 상수/함수를 사용하는가?

### 2. 지역명 검사
검색할 패턴들:
```
'서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종'
'경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'
'중앙'
```

- [ ] 직접 문자열로 지역명이 하드코딩되어 있는가?
- [ ] 조건부 검사에서 지역명이 나타나는가? (`if (region === '서울')`는 허용되지만, 배열/맵 정의는 금지)

### 3. City Code 검사
검색할 패턴들:
```
city_code: '강남구'
gugun: 'gimhae'
const GUGUN_MAP = { ... }
const CITY_CODES = { ... }
```

- [ ] City code/구군명이 직접 문자열로 지정되어 있는가?
- [ ] 매핑 테이블이 하드코딩되어 있는가?

### 4. Region Code 검사
- [ ] Region 코드가 제대로 사용되는가? (SEO, BUS, DAE 등)
- [ ] `REGION_CODE_TO_GUGUNS` 상수를 사용하는가?

## 실행 순서

### 1단계: 최근 커밋 확인
```bash
git log --oneline -5
git diff HEAD~1
```
마지막 커밋에서 어떤 파일이 변경되었는지 확인

### 2단계: 수정된 파일 검사
각 TypeScript/TSX 파일에 대해:

```bash
grep -n "'서울'\|'부산'\|'대구'" app/api/new-file.ts
grep -n "city_code:\|gugun:" app/api/new-file.ts
grep -n "const.*GUGUN\|const.*CITY_CODE" app/api/new-file.ts
```

### 3단계: Import 문 검증
```typescript
// 파일의 상단 import 섹션 확인
import { /* regions.ts에서 필요한 항목 */ } from '@/lib/constants/regions';
import { generateRegionOrganizations } from '@/lib/services/orgFactory';
```

### 4단계: 코드 로직 검증
- 지역 관련 로직이 있다면, import한 상수/함수를 사용하는가?
- 동적 지역 처리가 필요하면 `orgFactory.ts`를 사용하는가?

## 검사 결과 형식

### 위반 발견 시 (Failure)
```
HARDCODING VIOLATION DETECTED

파일: app/api/new-endpoint.ts
줄: 42

위반 사항:
- Direct region hardcoding: '서울'
- Missing import from regions.ts

필요한 수정:
1. import { REGIONS } from '@/lib/constants/regions'
2. REGIONS.find(r => r.label === userSelectedRegion)

참고: lib/REGION_MANAGEMENT_RULES.md
```

### 통과 시 (Success)
```
HARDCODING CHECK PASSED

검사 항목:
- Import 구문: ✅ regions.ts에서 올바르게 import
- 하드코딩: ✅ 발견되지 않음
- 지역 코드 사용: ✅ REGION_CODE_TO_GUGUNS 사용
- orgFactory 활용: ✅ generateRegionOrganizations() 호출

결론: 중앙 관리 시스템을 준수합니다.
```

## 참고 문서
- [REGION_MANAGEMENT_RULES.md](docs/REGION_MANAGEMENT_RULES.md) - 지역명 관리 철칙
- [lib/constants/regions.ts](lib/constants/regions.ts) - 중앙 관리 시스템
- [lib/services/orgFactory.ts](lib/services/orgFactory.ts) - 동적 데이터 생성 팩토리
