# AEDpics 점검 데이터 분석 보고서

**작성일**: 2025-11-06
**분석 대상**: 점검 이력 데이터 혼재 및 권한별 조회 차이

---

## 1. 최근점검일 칼럼 혼재 문제

### 발견된 데이터 소스 불일치

#### A. 스키마 분석
```
aed_data 테이블:
  - last_inspection_date (DateTime): e-gen 원본의 최근점검일 (어느 시스템에서든 마지막 점검한 날짜)

inspections 테이블:
  - inspection_date (DateTime): AEDpics 시스템에서 실제로 점검한 날짜
  - original_data (JSON): 점검 당시 e-gen에서의 원본 데이터
  - inspected_data (JSON): 시스템에서 기록한 점검 데이터
```

#### B. 데이터 혼재 시나리오

**원인**: `aed_data.last_inspection_date`는 e-gen과 AEDpics의 공통 데이터이므로:

1. **e-gen 시스템에서만 점검됨**: aed_data.last_inspection_date가 update되지만,
   AEDpics의 inspections 테이블에는 기록 없음

2. **AEDpics에서만 점검됨**: inspections.inspection_date에 기록되지만,
   aed_data.last_inspection_date는 동기화되지 않음

3. **둘 다 점검됨**: 날짜가 다를 수 있음 (불일치 케이스 발생)

### 현재 구조의 문제점

```
UI 화면에서 "최근점검일" 표시 시:
- aed_data.last_inspection_date를 사용 → e-gen 원본 날짜 표시
- inspections.inspection_date를 사용 → AEDpics 점검 날짜 표시
- 둘 중 어느 것을 사용할지 명확하지 않음
```

### 권장 개선사항

```typescript
// inspections 모델에 추가 필드 필요:
model inspections {
  // 기존 필드
  inspection_date: DateTime  // 시스템 점검일

  // 추가 필드 (권장)
  source: "e-gen" | "aedpics" | "sync"  // 데이터 출처
  e_gen_inspection_date: DateTime?      // e-gen의 점검일
  is_synced_from_e_gen: Boolean         // e-gen 동기화 여부
}
```

---

## 2. 응급의료지원센터 vs 보건소 데이터 차이 원인

### 현재 권한 시스템 분석

#### A. 점검 이력 조회 API (inspections/history/route.ts)

**응급의료지원센터 계정의 권한**:
```typescript
// Line 125-132: regional_admin 역할 처리
else if (userProfile.role === 'regional_admin' ||
         userProfile.email?.endsWith('@nmc.or.kr')) {
  // 전국 권한: 모든 데이터 조회 가능
  // 추가 필터 없음
}
```
**결과**: 해당 시도의 모든 점검 데이터 조회 가능

**대구 중구 보건소 계정의 권한**:
```typescript
// Line 65-124: local_admin 역할 처리
if (userProfile.role === 'local_admin' && userProfile.organizations) {
  // 주소 기준(physical address) 필터링만 구현
  const aedFilter = {
    sido: "대구광역시",      // aed_data.sido
    gugun: "중구"            // aed_data.gugun
  }
  where.aed_data = aedFilter
}
```
**결과**: 물리적 위치가 대구 중구인 AED만 조회

### 데이터 차이가 발생하는 이유

```
대구 중구 보건소가 관리하는 AED와
물리적으로 대구 중구에 설치된 AED가 다른 경우:

예시:
┌─────────────────────────────────────────────────┐
│ Equipment Serial: AED-12345                      │
├─────────────────────────────────────────────────┤
│ 물리적 위치 (aed_data.sido, aed_data.gugun)    │
│ └─ 서울특별시 강서구                             │
├─────────────────────────────────────────────────┤
│ 관할 보건소 (aed_data.jurisdiction_health_center)│
│ └─ 대구광역시 중구 보건소                        │
└─────────────────────────────────────────────────┘

조회 결과:
1. 응급의료지원센터 (regional_admin):
   - 시도 단위 전국 권한 → 모든 점검 데이터 조회
   - 서울 강서구의 AED 점검 이력도 포함됨

2. 대구 중구 보건소 (local_admin):
   - 물리적 주소 기준 필터링
   - 서울 강서구 AED는 제외됨
   - → 데이터 불일치!
```

### 누락된 기능: jurisdiction_health_center 기반 조회

**현재 상태**: jurisdiction_health_center를 활용하지 않음
```typescript
// 문제: jurisdiction_health_center 기반 필터링 없음
// 보건소가 "관할 기준" 조회 옵션을 선택해도 작동하지 않음
```

**필요한 구현**:
```typescript
// 보건소 권한에 두 가지 조회 옵션 추가
const queryMode = searchParams.get('mode'); // 'address' | 'jurisdiction'

if (queryMode === 'jurisdiction') {
  // 관할보건소 기준 필터링
  const healthCenterName = userProfile.organizations.name;
  where.aed_data = {
    jurisdiction_health_center: healthCenterName
  }
} else {
  // 기본: 주소 기준 필터링 (현재 구현)
  const aedFilter = {
    sido: "대구광역시",
    gugun: "중구"
  }
  where.aed_data = aedFilter
}
```

---

## 3. 영향도 분석

### A. 최근점검일 혼재가 영향미치는 부분

| 기능 | 현재 동작 | 문제점 |
|------|---------|--------|
| 점검 이력 조회 | inspections.inspection_date 사용 | 시스템 점검일만 표시 (e-gen 점검일 미포함) |
| AED 목록 조회 | aed_data.last_inspection_date 사용 | e-gen 원본 날짜만 표시 (AEDpics 점검일 미포함) |
| 통계 리포트 | 혼용 (API마다 다름) | 데이터 불일치로 인한 신뢰도 저하 |
| 개선 알림 | inspection_date 기반 | e-gen 점검은 추적 안 됨 |

### B. 권한별 조회 차이가 영향미치는 부분

| 역할 | 조회 범위 | 가능한 데이터 차이 |
|------|---------|------------------|
| master | 전국 | 없음 (전체 조회) |
| regional_admin | 시도 전체 (주소 기준) | 관할 외 지역 AED도 조회됨 |
| local_admin | 시군구 (주소 기준 고정) | 관할보건소 AED 중 다른 지역 AED는 제외됨 |
| 응급센터 | 시도 전체 | 주소와 관할보건소 기준 섞임 |

---

## 4. 개선 로드맵

### Phase 1: 긴급 패치 (1-2주)
- [ ] API 문서에 "주소 기준 조회"임을 명시
- [ ] UI에서 데이터 출처 표시 (e-gen vs AEDpics)
- [ ] 점검 이력 조회에서 두 가지 날짜 모두 반환

### Phase 2: 기능 구현 (2-4주)
- [ ] [inspections/history/route.ts:108-124] jurisdiction_health_center 기반 필터링 추가
- [ ] inspections 테이블에 source, e_gen_inspection_date 필드 추가
- [ ] 사용자가 조회 기준 선택 가능하도록 UI 개선

### Phase 3: 데이터 정합성 (4-8주)
- [ ] e-gen과 AEDpics 간 inspection_date 동기화 로직
- [ ] 정기적인 데이터 검증 스크립트 추가
- [ ] 모니터링 대시보드 구축

---

## 5. 관련 파일 참조

| 파일 | 라인 | 내용 |
|------|-----|------|
| [app/api/inspections/history/route.ts](../app/api/inspections/history/route.ts) | 65-124 | local_admin 필터링 로직 |
| [app/api/inspections/history/route.ts](../app/api/inspections/history/route.ts) | 125-132 | regional_admin 필터링 로직 |
| [prisma/schema.prisma](../prisma/schema.prisma) | 60 | aed_data.last_inspection_date |
| [prisma/schema.prisma](../prisma/schema.prisma) | 256-286 | inspections 모델 |
| [prisma/schema.prisma](../prisma/schema.prisma) | 43 | aed_data.jurisdiction_health_center |

---

## 결론

### 1. 최근점검일 혼재 문제
✅ **원인 확인**: aed_data.last_inspection_date (e-gen)와 inspections.inspection_date (AEDpics)의 출처 불명확

**즉시 해결**:
- API 응답에 두 날짜 모두 포함
- UI에서 출처 표시

### 2. 응급의료지원센터 vs 보건소 데이터 차이
✅ **원인 확인**:
- 응급의료지원센터: 시도 단위 전국 권한 (주소 기준)
- 보건소: 물리적 주소(sido, gugun) 기준만 필터링
- jurisdiction_health_center 기반 조회 옵션 없음

**즉시 해결**:
- 조회 기준 명시 (API 문서 및 UI)
- jurisdiction_health_center 필터링 추가

### 3. 권장 조치 우선순위
1. **P0 (즉시)**: API 응답에 데이터 출처 및 두 날짜 모두 포함
2. **P1 (1-2주)**: 사용자 정의 조회 기준 옵션 (주소 vs 관할보건소)
3. **P2 (2-4주)**: 데이터 동기화 자동화
4. **P3 (4-8주)**: 데이터 정합성 검증 및 정리

---

**작성자**: Claude Code
**최종 검토**: 2025-11-06
