# 점검 기능 구현 최종 체크리스트

**작성일**: 2025-11-06
**상태**: ✅ v5.0 승인, 구현 전 최종 검증 문서
**목적**: v5.0 계획 구현 전 4가지 핵심 항목 검증

---

## 구현 직전 필수 검증 사항

### 1. aed_data null 케이스 현황 조사

**목표**: 실제 운영 데이터에서 aed_data가 없는 inspection 기록이 얼마나 있는지 파악

**검증 SQL**:
```sql
-- inspection 중 aed_data가 없는 경우
SELECT COUNT(*) as null_aed_data_count
FROM aedpics.inspections
WHERE aed_data_id IS NULL;

-- 비율 확인
SELECT
  COUNT(CASE WHEN aed_data_id IS NULL THEN 1 END) as null_count,
  COUNT(*) as total_count,
  ROUND(100.0 * COUNT(CASE WHEN aed_data_id IS NULL THEN 1 END) / COUNT(*), 2) as null_percentage
FROM aedpics.inspections;

-- 최근 점검 기록 샘플 조회
SELECT id, equipment_serial, aed_data_id, inspection_date
FROM aedpics.inspections
WHERE aed_data_id IS NULL
ORDER BY inspection_date DESC
LIMIT 10;
```

**처리 방법 결정**:
- **null 케이스 < 1%**: 400 Bad Request로 처리 (현재 계획 유지)
- **null 케이스 >= 1%**: 사용자 안내 메시지 추가
  ```
  "점검 기록은 존재하나 장비 정보가 삭제된 상태입니다.
   장비 정보가 복구될 때까지 이 기록은 수정할 수 없습니다."
  ```

**QA 체크리스트**:
- [ ] null aed_data인 inspection 조회
- [ ] 400 에러 메시지 확인
- [ ] 에러 로그 검증

---

### 2. Export 권한 플래그 초기값 점검

**목표**: regional_admin, local_admin 계정의 can_export_data 플래그 상태 확인

**검증 SQL**:
```sql
-- 역할별 can_export_data 현황
SELECT
  role,
  COUNT(*) as user_count,
  COUNT(CASE WHEN can_export_data = true THEN 1 END) as export_enabled,
  COUNT(CASE WHEN can_export_data = false THEN 1 END) as export_disabled
FROM aedpics.user_profiles
WHERE role IN ('regional_admin', 'local_admin')
GROUP BY role;

-- regional_admin 중 플래그가 false인 사용자
SELECT id, email, full_name, role, can_export_data
FROM aedpics.user_profiles
WHERE role = 'regional_admin' AND can_export_data = false;

-- local_admin 중 플래그가 false인 사용자
SELECT id, email, full_name, role, can_export_data
FROM aedpics.user_profiles
WHERE role = 'local_admin' AND can_export_data = false;
```

**처리 방법**:
- **모든 regional_admin/local_admin이 can_export_data=true인 경우**:
  - 계획 대로 진행 (플래그 체크만)

- **일부 또는 대부분이 false인 경우**:
  - **배포 전 QA 작업**: 권한 있어야 하는 계정에 플래그 세팅
  ```sql
  UPDATE aedpics.user_profiles
  SET can_export_data = true
  WHERE role IN ('regional_admin', 'local_admin');
  ```

**QA 체크리스트**:
- [ ] export 가능한 역할의 플래그 확인
- [ ] export 요청 테스트 (권한 있음)
- [ ] export 거부 테스트 (can_export_data=false)
- [ ] 적절한 403 응답 확인

---

### 3. 필드 매핑 일관성 검증 (snake_case)

**목표**: 클라이언트 전송 → API 처리 → DB 저장이 모두 snake_case로 일관되는지 확인

**검증 과정**:

#### Step 1: 클라이언트 전송 데이터 확인
```typescript
// lib/inspections/session-utils.ts:330
body: JSON.stringify(updates)

// 여기서 updates는 Partial<InspectionHistory>
// InspectionHistory (session-utils.ts:208-229)의 필드:
// - visual_status (snake_case)
// - battery_status (snake_case)
// - pad_status (snake_case)
// - operation_status (snake_case)
// - overall_status (snake_case)
// - notes (snake_case)
// - issues_found (snake_case)
```

✅ **결론**: 클라이언트는 snake_case 전송

#### Step 2: API 처리 확인
```typescript
// app/api/inspections/[id]/route.ts (수정 후)

const allowedFields = [
  'notes',
  'visual_status',       // ← snake_case (수정됨)
  'battery_status',
  'pad_status',
  'operation_status',
  'overall_status',
  'issues_found',
];

// fieldMapping 불필요 (이미 일치)
const updateData: any = { updated_at: new Date() };
Object.keys(updates).forEach((field) => {
  if (allowedFields.includes(field)) {
    updateData[field] = updates[field];  // ← 그대로 저장
  }
});
```

✅ **결론**: API는 snake_case 처리

#### Step 3: DB 저장 확인
```typescript
// Prisma.inspections.update()
await prisma.inspections.update({
  where: { id: inspectionId },
  data: updateData  // { visual_status, battery_status, ... }
});
```

✅ **결론**: 스키마도 snake_case (visual_status, battery_status, ...)

**QA 체크리스트**:
- [ ] 클라이언트 snake_case 전송 확인 (네트워크 탭)
- [ ] API allowedFields snake_case로 변경 확인
- [ ] DB 저장 값 snake_case 확인
  ```sql
  SELECT visual_status, battery_status, pad_status, operation_status, overall_status
  FROM aedpics.inspections
  WHERE id = 'test-inspection-id'
  LIMIT 1;
  ```

---

### 4. 지역 비교 로직 명확화 (가장 중요)

**문제 정의**:
- permissions.ts의 local_admin 로직: `userRegionCode === inspectionRegionCode` 비교
- **핵심**: 이 비교가 **시도 단위**인지 **시군구 단위**인지 확인 필요

**지역 코드 체계**:

| 항목 | 필드명 | 예시 | 형식 | 역할 |
|-----|--------|------|------|------|
| 시도 | organizations.region_code | 'DAE', 'INC' | 영문 코드 | user_profiles의 region_code |
| 시군구 | organizations.city_code | 'jung', 'seogwipo' | 영문 코드 | local_admin이 관할하는 지역 |
| 시도명 | aed_data.sido | '대구광역시', '인천광역시' | 한글 | 점검 위치 기준 |
| 시군구명 | aed_data.gugun | '중구', '서귀포시' | 한글 | 점검 위치 기준 |

**현재 계획 (v5.0)**:
```typescript
// PATCH 엔드포인트에서
const hasPermission = canEditInspection(
  profile.role,
  session.user.id,
  inspection.inspector_id,
  profile.organizations?.region_code,    // ← 시도 코드 ('DAE')
  inspection.aed_data.sido                // ← 시도명 ('대구광역시')
);
```

**문제**: region_code와 sido는 형식이 다름!

**검증 필요 사항**:

#### 검증 1: local_admin의 실제 권한 범위 파악
```sql
-- local_admin 계정의 실제 관할 지역 확인
SELECT
  up.id,
  up.email,
  up.full_name,
  org.region_code,
  org.city_code,
  org.name
FROM aedpics.user_profiles up
LEFT JOIN aedpics.organizations org ON up.organization_id = org.id
WHERE up.role = 'local_admin'
LIMIT 5;
```

**결과 해석**:
- **region_code만 있는 경우**: 시도 단위 관리자 (보기 드문 경우)
- **city_code도 있는 경우**: 시군구 단위 관리자 (일반적인 경우)

#### 검증 2: CITY_CODE_TO_GUGUN_MAP 확인
```typescript
// components/layout/RegionFilter.tsx (라인 38-78)
// 또는 lib/auth/access-control.ts

const CITY_CODE_TO_GUGUN_MAP: Record<string, string> = {
  'jeju': '제주시',
  'seogwipo': '서귀포시',
  'jung': '중구',
  // ...
}
```

**매핑 용도**: organizations.city_code → aed_data.gugun 변환

#### 검증 3: 올바른 비교 로직 결정

**경우 1: local_admin이 시도 단위 관할**
```typescript
// organizations.region_code와 aed_data.sido의 region_code 비교 필요
// → region_code를 sido에서 추출하거나 매핑 필요 (복잡)

// 또는 aed_data.region_code를 직접 로드하면 간단
const inspection = await prisma.inspections.findUnique({
  select: {
    // ...
    aed_data: { select: { sido: true, gugun: true } }  // 현재 계획
  }
});

// 현재 계획이 sido를 넘기므로:
// region_code ('DAE') vs sido ('대구광역시') → 형식 불일치!
```

**경우 2: local_admin이 시군구 단위 관할** (일반적)
```typescript
// organizations.city_code와 aed_data.gugun 비교 필요
// → CITY_CODE_TO_GUGUN_MAP으로 변환 후 비교

const inspection = await prisma.inspections.findUnique({
  select: {
    // ...
    aed_data: { select: { gugun: true } }  // gugun 필요
  }
});

// canEditInspection 호출 전에 매핑
import { CITY_CODE_TO_GUGUN_MAP } from '@/lib/constants/regions';
const mappedGugun = CITY_CODE_TO_GUGUN_MAP[profile.organizations?.city_code]
  || profile.organizations?.city_code;

const hasPermission = canEditInspection(
  profile.role,
  session.user.id,
  inspection.inspector_id,
  mappedGugun,                    // ← GUGUN으로 변환 ('서귀포시')
  inspection.aed_data.gugun       // ← aed_data의 GUGUN ('서귀포시')
);
```

**QA 체크리스트**:
- [ ] 실제 local_admin 계정이 관할하는 지역 범위 확인
- [ ] organizations.city_code 값 확인 (있는지/없는지)
- [ ] permissions.ts의 인자 이름 검증
  - userRegionCode: 사실은 "지역코드" (시도 또는 시군구)
  - inspectionRegionCode: 사실은 "지역코드" (시도 또는 시군구)
- [ ] CITY_CODE_TO_GUGUN_MAP이 필요한지 여부 판단

---

## 최종 결론 및 다음 단계

### v5.0 계획 상태
✅ **승인됨** - 다음 4가지만 검증하면 구현 시작 가능

### 구현 전 필수 검증 (우선순위)

| # | 항목 | 영향도 | 난이도 | 담당 |
|---|-----|--------|--------|------|
| 1 | 지역 비교 로직 명확화 | 🔴 높음 | 🟡 중간 | 개발/QA |
| 2 | 필드 매핑 일관성 | 🟡 중간 | 🟢 낮음 | 개발 |
| 3 | Export 플래그 초기값 | 🟡 중간 | 🟢 낮음 | QA |
| 4 | aed_data null 케이스 | 🟡 중간 | 🟢 낮음 | QA |

### 구현 흐름

```
검증 1: 지역 비교 로직
  ↓ (local_admin의 관할 범위 명확화)

검증 2-4: 나머지 항목들 (병렬 진행 가능)
  ↓

✅ 모든 검증 완료
  ↓

1-Stage 또는 2-Stage 구현 시작
```

---

## 참고 문서

- **v5.0 계획**: [docs/inspection_revised_implementation_plan_v5.md](inspection_revised_implementation_plan_v5.md)
- **권한 함수**: [lib/inspections/permissions.ts](../lib/inspections/permissions.ts)
- **지역 매핑**: [components/layout/RegionFilter.tsx](../components/layout/RegionFilter.tsx)
- **필드 타입**: [lib/inspections/session-utils.ts](../lib/inspections/session-utils.ts)

---

**상태**: ✅ 4가지 검증 완료 (2025-11-06)

**검증 결과**: [docs/VERIFICATION_RESULTS.md](VERIFICATION_RESULTS.md) 참조

**다음 단계**: v5.0 계획 업데이트 → 1-Stage 또는 2-Stage 구현 시작

---

## 검증 완료 내역 (2025-11-06)

### ✅ 검증 1: 지역 비교 로직
- **결과**: local_admin은 시군구(city_code) 단위 관할 - **경우 2 확정**
- **필수 수정**: CITY_CODE_TO_GUGUN_MAP 사용하여 city_code → gugun 매핑
- **영향 파일**: app/api/inspections/[id]/route.ts PATCH 엔드포인트

### ✅ 검증 2: aed_data null 케이스
- **결과**: 50% null 발생률 (14/28) - 1% 임계값 훨씬 초과
- **필수 수정**: 사용자 친화적 에러 메시지 추가 필수
- **처리**: 400 Bad Request + "장비 정보가 삭제된 상태" 메시지

### ✅ 검증 3: Export 권한 플래그
- **결과**: 9/10 local_admin이 can_export_data = false
- **필수 작업**: 배포 전 SQL로 플래그 업데이트 필수
- **영향 파일**: export 엔드포인트 구현 전 사전 작업

### ✅ 검증 4: 필드 매핑 일관성
- **결과**: allowedFields가 camelCase, Prisma는 snake_case 기대 - 불일치
- **추가 발견**: ministry_admin 권한, updated_at 필드명, aed_data 로드 누락
- **필수 수정**: allowedFields를 snake_case로 변경, 권한 함수 재사용
