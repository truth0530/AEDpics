# 지역/시군구 정규화 및 매핑 함수 - 문서 색인

작성일: 2025-11-07
최종 검증: 모든 함수 활성 상태 확인 완료

---

## 문서 구성

### 1. REGION_NORMALIZATION_FUNCTIONS.md (종합 레퍼런스)
**대상**: 신규 개발자, 코드 리뷰어, 아키텍처 검토

**내용**:
- 9개 핵심 파일 상세 분석
- 40+ 함수 및 10+ 매핑 레코드 문서화
- 각 함수의 목적, 입력, 출력, 상태
- 5가지 데이터 흐름 예시
- 매핑 관계도
- 비활성/레거시 함수 목록
- 베스트 프랙티스 8가지
- 완전성 체크리스트

**파일 크기**: 18KB (419줄)

**추천 읽기 순서**:
1. 섹션 1-3: 핵심 매핑 구조 이해
2. 섹션 4-5: 실제 사용 패턴 학습
3. 섹션 6: 전체 아키텍처 이해
4. 섹션 8: 주의사항 숙지

---

### 2. REGION_NORMALIZATION_QUICK_REFERENCE.md (실무 가이드)
**대상**: 활발히 개발 중인 개발자, 디버깅 중인 엔지니어

**내용**:
- 자주 사용하는 함수 TOP 10
- 4가지 주요 시나리오별 함수 선택 가이드
- 매핑 구조 한눈에 보기
- 흔한 실수 4가지와 해결책
- 성능 최적화 팁 3가지
- 임포트 가이드
- 타입 정의

**파일 크기**: 9KB (382줄)

**추천 사용**:
- 개발 중 빠른 함수 검색
- 코드 리뷰 시 패턴 확인
- 성능 최적화 검토
- 신규 기능 구현 시 레퍼런스

---

## 핵심 파일 위치

### 정규화 함수 모음
```
lib/
├── constants/
│   ├── regions.ts           (14개 함수, 주요 매핑)
│   └── cities.ts            (5개 함수, 시군구 관리)
├── utils/
│   ├── area-code.ts         (4개 함수, 전화 지역번호)
│   ├── aed-data-mapper.ts   (7개 함수, AED 데이터 변환)
│   └── healthCenterMatcher.ts (8개 클래스 메서드, 보건소 매칭)
├── data/
│   ├── health-centers-master.ts (2개 함수, 보건소 관리)
│   └── organizations.ts      (조직 데이터 참조)
├── aed/
│   └── dashboard-queries.ts  (1개 함수, 대시보드 정규화)
└── auth/
    └── access-control.ts     (2개 re-export, 권한 검증)
```

---

## 빠른 검색 가이드

### 기능별 함수 찾기

#### 지역 코드 변환
- `getRegionLabel()`: 코드 → 짧은 라벨
- `getRegionCode()`: 라벨/정식명칭 → 코드
- `getRegionFullLabel()`: 코드 → 정식명칭
- `normalizeRegionCode()`: 다양한 형태 → 표준 코드

#### 지역명 정규화
- `normalizeRegionName()`: 정식명칭 → 짧은 라벨
- `normalizeAedDataRegion()`: e-gen 원본 → 정식명칭
- `normalizeRegionName()`: 카카오맵 역지오코딩용

#### 시군구 관리
- `getCityName()`: 코드 → 이름
- `getCitiesByRegion()`: 지역별 시군구
- `searchCities()`: 시군구 검색
- `mapCityCodeToGugun()`: 영문코드 → 한글명

#### 전화번호 기반 지역
- `extractAreaCode()`: 전화번호 → 지역번호
- `getRegionFromPhone()`: 전화번호 → 지역명
- `getRegionByAreaCode()`: 지역번호 → 지역명

#### 조직명에서 정보 추출
- `extractRegionFromOrgName()`: 조직명 → {sido, gugun}
- `getRegionCodeFromOrgName()`: 조직명 → 지역코드

#### 보건소 매칭
- `HealthCenterMatcher.normalizeForMatching()`: 보건소명 정규화
- `HealthCenterMatcher.findMatchingOption()`: 인트라넷 데이터 매칭
- `HealthCenterMatcher.findBestMatch()`: 유사도 기반 매칭

#### AED 데이터 변환
- `mapAedData()`: RPC 결과 → API 응답 형식

---

## 매핑 관계도 (한눈에 보기)

```
사용자 입력
  ↓
[정규화]
  ↓
표준 형태 (3자리 코드 또는 정식명칭)
  ↓
[코드 변환]
  ↓
데이터베이스 저장/조회
  ↓
[역변환]
  ↓
UI 표시 (짧은 라벨 또는 정식명칭)
```

---

## 사용 사례별 추천 문서

### 신규 개발자 온보딩
1. REGION_NORMALIZATION_FUNCTIONS.md 섹션 1-3
2. REGION_NORMALIZATION_QUICK_REFERENCE.md 상단부
3. 실제 코드 검토: `/app/api/aed-data/route.ts`

### 회원가입 플로우 개발
- Quick Reference: "사용 시나리오별 함수 선택" 섹션
- Comprehensive: 섹션 5.1 "회원가입 → 보건소 자동 매칭"

### 대시보드 쿼리 개선
- Quick Reference: "흔한 실수와 해결책" 섹션
- Comprehensive: 섹션 2.4 "대시보드 쿼리용 정규화"

### 성능 최적화
- Quick Reference: "성능 최적화 팁" 섹션
- Comprehensive: 섹션 8.1 "단일 진실 소스"

### 권한 검증 구현
- Quick Reference: 임포트 가이드의 "접근 제어" 섹션
- Comprehensive: 섹션 3 "권한 및 접근 제어"

---

## 검색 팁

### Ctrl+F (문서 내 검색)로 찾기

#### 함수명 검색
```
정규화 함수: normalize, map
변환 함수: get, extract, convert
매칭 함수: match, find, search
```

#### 개념 검색
```
시도, 지역, 지역코드, region_code
시군구, 구군, 도시, city_code, gugun
보건소, 조직, organization
전화, 지역번호, area_code, phone
```

#### 예시 검색
```
"예시", "예:", "@example"
특정 지역: "서울", "대구", "경기"
```

---

## 주요 변경 이력

### 2025-11-07 (현재)
- 전체 40+ 함수 문서화 완료
- 10+ 매핑 레코드 정리
- 2개 추가 문서 작성 (총 2개)
- 모든 함수 활성 상태 확인
- 중복 함수 발견 및 기록

### 향후 계획
- 중복 제거: `getRegionCode()` 통합
- 추가 함수: 지역별 상세 주소 정규화
- 성능 측정: 대시보드 쿼리 최적화

---

## 문제 해결 (Troubleshooting)

### "함수를 찾을 수 없음" 에러
1. Quick Reference의 "파일 임포트 가이드" 확인
2. 파일 경로가 정확한지 확인
3. TypeScript 타입 정의 확인

### "결과가 예상과 다름"
1. Comprehensive 문서의 "흔한 실수" 섹션 확인
2. 정규화 순서 확인
3. 입력값이 예상 형식인지 확인

### "성능 저하"
1. Quick Reference의 "성능 최적화 팁" 확인
2. 불필요한 정규화 반복 제거
3. 매핑 레코드 직접 참조 고려

---

## 기여 가이드

새로운 정규화 함수 추가 시:

1. `/lib/constants/regions.ts` 또는 관련 파일에 추가
2. 매핑 레코드도 함께 추가
3. 주석으로 용도 설명
4. 이 인덱스 문서 업데이트
5. Quick Reference에 사용 예시 추가

---

## 참고 문서

### 프로젝트 관련
- [CLAUDE.md](CLAUDE.md) - 프로젝트 개발 가이드라인
- [MIGRATION_STATUS.md](migration/MIGRATION_STATUS.md) - NCP 마이그레이션 상태
- [aed-data-schema.md](reference/aed-data-schema.md) - AED 데이터 스키마

### 코드 레퍼런스
- `lib/constants/regions.ts` - 메인 매핑 파일
- `lib/constants/cities.ts` - 시군구 데이터
- `lib/utils/aed-data-mapper.ts` - RPC 결과 변환

---

## 지원 및 문의

개발 중 질문이 있으면:
1. 먼저 이 인덱스의 "빠른 검색 가이드" 확인
2. 해당 Comprehensive 문서의 섹션 참조
3. 코드에 포함된 주석 확인
4. 기존 테스트 코드 검토

---

**문서 관리자**: AI Assistant
**최종 검증**: 2025-11-07
**상태**: Production Ready

모든 문서는 코드 변경과 함께 업데이트됩니다.
