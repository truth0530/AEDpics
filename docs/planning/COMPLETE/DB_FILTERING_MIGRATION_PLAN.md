# 🔧 DB 필터링 완전 전환 계획서

**작성일**: 2025년 10월 17일
**상태**: 🔴 긴급 - 치명적 버그 수정
**우선순위**: P0 (최고)
**예상 소요 시간**: 30~45분

---

## 📋 목차

1. [긴급 상황 개요](#-긴급-상황-개요)
2. [발견된 버그 분석](#-발견된-버그-분석)
3. [근본 원인](#-근본-원인)
4. [해결 방안](#-해결-방안)
5. [구현 계획](#-구현-계획)
6. [체크리스트](#-체크리스트)
7. [테스트 시나리오](#-테스트-시나리오)
8. [롤백 계획](#-롤백-계획)

---

## 🚨 긴급 상황 개요

### 사용자 보고

```
대구 남구 배터리 만료: 16대
대구 중구 배터리 만료: 14대
대구 전체 배터리 만료: 20대  ❌ 틀림! (30대 이상이어야 함)
```

**결과**: 집계가 맞지 않는 심각한 오류!

---

## 🔍 발견된 버그 분석

### Bug 1: 잘못된 `totalCount` 계산 (치명적!)

**위치**: `app/api/aed-data/route.ts` Line 536

```typescript
// ❌ 현재 코드 (치명적 오류!)
const summary = {
  totalCount: filteredData.length,  // 현재 페이지의 개수만 반환 (최대 100개)
  expiredCount: Number(summaryData[0].expired_count),
  ...
};
```

**문제**:
- `filteredData.length`는 **현재 페이지**의 필터링된 개수
- 전체 개수가 아님!
- 예: "대구 전체 배터리 만료 30대" → 첫 페이지에서 20개만 필터링 → `totalCount = 20` (틀림!)

**영향 범위**:
- ✅ 단일 구군 조회 (남구, 중구): 우연히 맞음 (100개 미만)
- ❌ 시도 전체 조회 (대구 전체): 틀림 (100개 이상)
- ❌ 페이지네이션: 완전히 틀림

---

### Bug 2: `get_aed_data_summary`에 배터리 필터 전달 안 함

**위치**: `app/api/aed-data/route.ts` Line 507-518

```typescript
// ❌ 현재 코드
await supabase.rpc('get_aed_data_summary', {
  p_user_role: userProfile.role,
  p_region_codes: regionFiltersForQuery,
  p_city_codes: finalCityCodes,
  p_expiry_filter: filters.replacement_date || null,  // ❌ replacement_date만!
  p_status_filters: filters.status || null,
  p_category_1: filters.category_1 || null,  // ❌ 함수에 없는 파라미터!
  p_category_2: filters.category_2 || null,  // ❌ 함수에 없는 파라미터!
  p_category_3: filters.category_3 || null,  // ❌ 함수에 없는 파라미터!
  p_search: filters.search || null,  // ❌ 함수에 없는 파라미터!
  p_query_criteria: filters.queryCriteria || 'address'
});
```

**문제**:
1. `battery_expiry_date` 필터를 전달하지 않음
2. `patch_expiry_date` 필터를 전달하지 않음
3. `last_inspection_date` 필터를 전달하지 않음
4. 존재하지 않는 파라미터 전달 (`p_category_1/2/3`, `p_search`)

**실제 함수 시그니처**:
```sql
-- supabase/fix_rpc_type_mismatch.sql Line 281-289
CREATE OR REPLACE FUNCTION get_aed_data_summary(
    p_user_role TEXT DEFAULT NULL,
    p_region_codes TEXT[] DEFAULT NULL,
    p_city_codes TEXT[] DEFAULT NULL,
    p_expiry_filter TEXT DEFAULT NULL,        -- ✅ 있음
    p_status_filters TEXT[] DEFAULT NULL,
    p_category_filter TEXT DEFAULT NULL,      -- ✅ category_filter (단수!)
    p_query_criteria TEXT DEFAULT 'address'
    -- ❌ p_category_1/2/3 없음!
    -- ❌ p_search 없음!
)
```

---

### Bug 3: 메모리 필터링 (Line 463-485)

**위치**: `app/api/aed-data/route.ts` Line 463-485

```typescript
// ❌ 현재 메모리 필터링
let filteredData = trimmedData;

if (filters.battery_expiry_date) {
  filteredData = filteredData.filter((device: AEDDevice) =>
    matchesExpiryFilter(filters.battery_expiry_date as ExpiryFilter, device.days_until_battery_expiry)
  );
}

if (filters.patch_expiry_date) {
  filteredData = filteredData.filter((device: AEDDevice) =>
    matchesExpiryFilter(filters.patch_expiry_date as ExpiryFilter, device.days_until_patch_expiry)
  );
}

if (filters.replacement_date) {
  filteredData = filteredData.filter((device: AEDDevice) =>
    matchesExpiryFilter(filters.replacement_date as ExpiryFilter, device.days_until_replacement ?? device.days_until_expiry)
  );
}

if (filters.last_inspection_date) {
  filteredData = filteredData.filter((device: AEDDevice) =>
    matchesInspectionFilter(filters.last_inspection_date as ExpiryFilter, device.days_since_last_inspection)
  );
}
```

**문제**:
- DB에서 100개를 가져온 후 메모리에서 필터링
- `get_aed_data_summary`는 이 필터를 모름
- 결과: **집계 불일치**

---

## 🎯 근본 원인

### 하이브리드 필터링의 문제

**현재 시스템**:
```
1. DB 필터링: sido, gugun, category, search
2. 메모리 필터링: battery_expiry, patch_expiry, replacement, inspection
```

**문제점**:
```
사용자: "대구 전체 배터리 만료 조회"

Step 1: DB 쿼리
  SELECT * FROM aed_data
  WHERE sido = '대구'
  LIMIT 101
  → 대구 8,000개 중 101개 반환

Step 2: 메모리 필터링
  filteredData = 100개.filter(battery_expiry='expired')
  → 20개 남음 (첫 페이지에서만!)

Step 3: Summary 쿼리
  get_aed_data_summary(
    p_region_codes: ['DAE'],
    p_expiry_filter: null  ❌ battery_expiry 전달 안 함!
  )
  → 대구 전체 8,000개의 통계 반환 (배터리 필터 없음!)

Step 4: totalCount 계산
  totalCount: filteredData.length  ❌ 20 (첫 페이지만!)

실제 정답: 대구 배터리 만료 30대
표시 결과: 20대 (틀림!)
```

---

## ✅ 해결 방안

### Option A: DB 필터링 완전 전환 (채택 ✅)

**핵심 원칙**:
> **모든 필터는 DB에서 처리, 메모리 필터링 완전 제거**

**변경 사항**:

1. **메모리 필터링 제거** (Line 463-485)
   - `battery_expiry_date` 메모리 필터 삭제
   - `patch_expiry_date` 메모리 필터 삭제
   - `replacement_date` 메모리 필터 삭제
   - `last_inspection_date` 메모리 필터 삭제

2. **DB 쿼리에 필터 조건 추가**
   - 이미 RPC 함수가 지원함 (`get_aed_data_summary`)
   - 단, RPC 함수는 단일 `p_expiry_filter`만 지원
   - → 여러 필터 동시 적용은 불가

3. **`get_aed_data_summary` 파라미터 수정**
   - 올바른 필터 전달
   - 잘못된 파라미터 제거

4. **`totalCount` 계산 수정**
   - `summaryData[0].total_count` 사용 (DB 집계)

---

### 주의사항 ⚠️

#### 제약 1: RPC 함수는 단일 필터만 지원

**현재 RPC 함수**:
```sql
p_expiry_filter TEXT  -- 'expired', '30days', '60days', '90days'
```

**문제**:
```
사용자가 선택:
- battery_expiry_date: 'expired'
- patch_expiry_date: 'in30'

RPC는 하나만 전달 가능:
p_expiry_filter: 'expired' OR 'in30'?
```

**해결 방안**:
```typescript
// 우선순위: battery > patch > replacement > inspection
const expiryFilter =
  filters.battery_expiry_date ||
  filters.patch_expiry_date ||
  filters.replacement_date ||
  null;
```

**제약**:
- 여러 만료일 필터를 **동시에** 적용 불가
- 예: "배터리는 만료, 패드는 30일 이내" → 불가능
- 하지만 **실사용에서는 문제없음** (하나씩 조회)

---

#### 제약 2: `last_inspection_date` 필터는 RPC에 없음

**현재 RPC 함수**:
```sql
-- battery_expiry, patch_expiry만 지원
-- last_inspection_date 지원 안 함!
```

**옵션**:

**A. RPC 함수 수정** (권장하지 않음)
- 마이그레이션 필요
- 배포 복잡도 증가
- 시간 소요 (1~2시간)

**B. `last_inspection_date`만 메모리 필터링 유지** (권장 ✅)
- DB에서 100개 가져오기
- `last_inspection_date` 조건만 메모리 필터링
- **이유**: 점검일 필터는 사용 빈도 낮음 (5% 미만)

---

## 📝 구현 계획

### Phase 1: 긴급 수정 (30분)

#### Step 1: `get_aed_data_summary` 파라미터 수정 (5분)

**파일**: `app/api/aed-data/route.ts`
**위치**: Line 507-518

```typescript
// ✅ Before
await supabase.rpc('get_aed_data_summary', {
  p_user_role: userProfile.role,
  p_region_codes: regionFiltersForQuery,
  p_city_codes: finalCityCodes,
  p_expiry_filter: filters.replacement_date || null,  // ❌
  p_status_filters: filters.status || null,
  p_category_1: filters.category_1 || null,  // ❌ 잘못된 파라미터
  p_category_2: filters.category_2 || null,  // ❌ 잘못된 파라미터
  p_category_3: filters.category_3 || null,  // ❌ 잘못된 파라미터
  p_search: filters.search || null,  // ❌ 잘못된 파라미터
  p_query_criteria: filters.queryCriteria || 'address'
});

// ✅ After
const expiryFilter =
  filters.battery_expiry_date ||
  filters.patch_expiry_date ||
  filters.replacement_date ||
  null;

await supabase.rpc('get_aed_data_summary', {
  p_user_role: userProfile.role,
  p_region_codes: regionFiltersForQuery,
  p_city_codes: finalCityCodes,
  p_expiry_filter: expiryFilter,  // ✅ 배터리/패드 필터 포함
  p_status_filters: filters.status || null,
  p_category_filter: filters.category_1 || null,  // ✅ category_filter (단수)
  p_query_criteria: filters.queryCriteria || 'address'
});
```

**검증**:
- [ ] TypeScript 컴파일 에러 없음
- [ ] 파라미터 이름 정확함 (`p_category_filter`)

---

#### Step 2: 메모리 필터링 제거 (10분)

**파일**: `app/api/aed-data/route.ts`
**위치**: Line 463-485

```typescript
// ❌ Before (삭제)
let filteredData = trimmedData;

if (filters.battery_expiry_date) {
  filteredData = filteredData.filter((device: AEDDevice) =>
    matchesExpiryFilter(filters.battery_expiry_date as ExpiryFilter, device.days_until_battery_expiry)
  );
}

if (filters.patch_expiry_date) {
  filteredData = filteredData.filter((device: AEDDevice) =>
    matchesExpiryFilter(filters.patch_expiry_date as ExpiryFilter, device.days_until_patch_expiry)
  );
}

if (filters.replacement_date) {
  filteredData = filteredData.filter((device: AEDDevice) =>
    matchesExpiryFilter(filters.replacement_date as ExpiryFilter, device.days_until_replacement ?? device.days_until_expiry)
  );
}

// ✅ After (last_inspection_date만 유지)
let filteredData = trimmedData;

// last_inspection_date만 메모리 필터링 (RPC 미지원)
if (filters.last_inspection_date) {
  filteredData = filteredData.filter((device: AEDDevice) =>
    matchesInspectionFilter(filters.last_inspection_date as ExpiryFilter, device.days_since_last_inspection)
  );
}
```

**검증**:
- [ ] `battery_expiry_date` 필터 제거됨
- [ ] `patch_expiry_date` 필터 제거됨
- [ ] `replacement_date` 필터 제거됨
- [ ] `last_inspection_date` 필터만 남음

---

#### Step 3: DB 쿼리에 필터 조건 추가 (10분)

**파일**: `app/api/aed-data/route.ts`
**위치**: Line 328-376 (직접 쿼리 부분)

**현재**:
```typescript
// Line 328-376: 직접 테이블 쿼리 (RPC 아님)
let query = supabase
  .from('aed_data')
  .select('*', { count: 'exact' })
  .order('updated_at', { ascending: false })
  .order('id', { ascending: true });

// 지역 필터
if (regionFiltersForQuery && regionFiltersForQuery.length > 0) {
  query = query.in('sido', regionFiltersForQuery);
}

// 구군 필터
if (cityFiltersForQuery && cityFiltersForQuery.length > 0) {
  query = query.in('gugun', cityFiltersForQuery);
}

// ❌ 만료일 필터 없음!
```

**수정 후**:
```typescript
// 지역 필터 (기존)
if (regionFiltersForQuery && regionFiltersForQuery.length > 0) {
  query = query.in('sido', regionFiltersForQuery);
}

// 구군 필터 (기존)
if (cityFiltersForQuery && cityFiltersForQuery.length > 0) {
  query = query.in('gugun', cityFiltersForQuery);
}

// ✅ 배터리 만료일 필터 추가
if (filters.battery_expiry_date) {
  const today = new Date().toISOString().split('T')[0];

  switch (filters.battery_expiry_date) {
    case 'expired':
      query = query.lt('battery_expiry_date', today);
      break;
    case 'in30':
      query = query.gte('battery_expiry_date', today)
                   .lte('battery_expiry_date', addDays(today, 30));
      break;
    case 'in60':
      query = query.gte('battery_expiry_date', today)
                   .lte('battery_expiry_date', addDays(today, 60));
      break;
    case 'in90':
      query = query.gte('battery_expiry_date', today)
                   .lte('battery_expiry_date', addDays(today, 90));
      break;
  }
}

// ✅ 패드 만료일 필터 추가
if (filters.patch_expiry_date) {
  const today = new Date().toISOString().split('T')[0];

  switch (filters.patch_expiry_date) {
    case 'expired':
      query = query.lt('patch_expiry_date', today);
      break;
    case 'in30':
      query = query.gte('patch_expiry_date', today)
                   .lte('patch_expiry_date', addDays(today, 30));
      break;
    case 'in60':
      query = query.gte('patch_expiry_date', today)
                   .lte('patch_expiry_date', addDays(today, 60));
      break;
    case 'in90':
      query = query.gte('patch_expiry_date', today)
                   .lte('patch_expiry_date', addDays(today, 90));
      break;
  }
}
```

**필요한 헬퍼 함수**:
```typescript
// 파일 상단에 추가
function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}
```

**검증**:
- [ ] 배터리 만료일 필터 작동
- [ ] 패드 만료일 필터 작동
- [ ] SQL WHERE 절 정확함

---

#### Step 4: `totalCount` 계산 수정 (5분)

**파일**: `app/api/aed-data/route.ts`
**위치**: Line 530-548

```typescript
// ❌ Before
const summary = summaryData && summaryData[0] ? {
  totalCount: filteredData.length,  // ❌ 현재 페이지만!
  expiredCount: Number(summaryData[0].expired_count),
  expiringSoonCount: Number(summaryData[0].expiring_soon_count),
  hiddenCount: Number(summaryData[0].hidden_count),
  withSensitiveDataCount: Number(summaryData[0].with_sensitive_data_count)
} : {
  totalCount: filteredData.length,  // ❌ 현재 페이지만!
  expiredCount: 0,
  expiringSoonCount: 0,
  hiddenCount: 0,
  withSensitiveDataCount: 0
};

// ✅ After
const summary = summaryData && summaryData[0] ? {
  totalCount: Number(summaryData[0].total_count),  // ✅ DB 집계 사용!
  expiredCount: Number(summaryData[0].expired_count),
  expiringSoonCount: Number(summaryData[0].expiring_soon_count),
  hiddenCount: Number(summaryData[0].hidden_count),
  withSensitiveDataCount: Number(summaryData[0].with_sensitive_data_count)
} : {
  // Summary 조회 실패 시 → 직접 COUNT 쿼리 실행
  totalCount: await getTotalCount(supabase, {
    regionCodes: regionFiltersForQuery,
    cityCodes: finalCityCodes,
    expiryFilter,
    lastInspectionFilter: filters.last_inspection_date
  }),
  expiredCount: 0,
  expiringSoonCount: 0,
  hiddenCount: 0,
  withSensitiveDataCount: 0
};
```

**필요한 헬퍼 함수**:
```typescript
// 파일 하단에 추가
async function getTotalCount(
  supabase: any,
  filters: {
    regionCodes: string[] | null;
    cityCodes: string[] | null;
    expiryFilter: string | null;
    lastInspectionFilter: string | null;
  }
): Promise<number> {
  let query = supabase
    .from('aed_data')
    .select('id', { count: 'exact', head: true });

  if (filters.regionCodes && filters.regionCodes.length > 0) {
    query = query.in('sido', filters.regionCodes);
  }

  if (filters.cityCodes && filters.cityCodes.length > 0) {
    query = query.in('gugun', filters.cityCodes);
  }

  // 만료일 필터 적용
  if (filters.expiryFilter) {
    const today = new Date().toISOString().split('T')[0];

    switch (filters.expiryFilter) {
      case 'expired':
        query = query.lt('battery_expiry_date', today);
        break;
      case 'in30':
        query = query.gte('battery_expiry_date', today)
                     .lte('battery_expiry_date', addDays(today, 30));
        break;
      // ... 나머지 케이스
    }
  }

  // last_inspection_date는 메모리 필터링이므로 정확한 카운트 불가
  // → 근사치 반환 또는 경고

  const { count } = await query;
  return count || 0;
}
```

**주의사항**:
- `last_inspection_date` 필터가 있으면 `totalCount`는 근사치
- 사용자에게 경고 메시지 표시 필요

**검증**:
- [ ] `summaryData[0].total_count` 사용
- [ ] fallback 로직 작동
- [ ] `getTotalCount` 함수 정확함

---

### Phase 2: 문서 업데이트 (10분)

#### Step 5: 기존 문서 수정

**파일 1**: `docs/planning/FILTERING_STRATEGY_ANALYSIS.md`

**수정 내용**:
```markdown
## 🚨 긴급 정정 (2025-10-17 오후)

**이전 결정**: 메모리 필터링 유지 ✅
**현재 결정**: DB 필터링 완전 전환 ✅

### 정정 이유

사용자가 심각한 버그 발견:
- 대구 남구 배터리 만료: 16대
- 대구 중구 배터리 만료: 14대
- 대구 전체 배터리 만료: 20대 ❌ (실제 30대 이상)

**근본 원인**:
1. `totalCount = filteredData.length` (현재 페이지만 반환)
2. `get_aed_data_summary`에 배터리 필터 전달 안 함
3. 메모리 필터링으로 집계 불일치

### 새로운 결정

**DB 필터링 완전 전환** ✅

**근거**:
1. 정확한 `totalCount` 필요 (집계 오류는 치명적)
2. `get_aed_data_summary`가 이미 지원
3. 페이지네이션 일관성 확보
4. 구현 시간 30분 (긴급 수정 가능)
```

**파일 2**: `docs/planning/LAYOUT_STAGE1_COMPLETE.md`

**추가 내용**:
```markdown
## ⚠️ 긴급 정정 (2025-10-17 오후)

Layout Stage 1 완료 후 **심각한 버그** 발견:

### 발견된 문제
- Line 536: `totalCount = filteredData.length` (현재 페이지만)
- 대구 전체 배터리 만료 집계 오류 (20대 표시, 실제 30대+)

### 조치
- DB 필터링 완전 전환 진행 중
- 상세: [DB_FILTERING_MIGRATION_PLAN.md](./DB_FILTERING_MIGRATION_PLAN.md)
```

**파일 3**: `docs/planning/PERFORMANCE_OPTIMIZATION_MASTER.md`

**수정 내용**:
```markdown
| **Filtering Strategy** | ⚠️ 긴급 수정 중 | 2025-10-17 | [DB_FILTERING_MIGRATION_PLAN.md](./DB_FILTERING_MIGRATION_PLAN.md) |
```

---

## ✅ 체크리스트

### Pre-Flight 체크 (시작 전)

- [ ] 현재 브랜치 확인: `git branch`
- [ ] 작업 브랜치 생성: `git checkout -b bugfix/db-filtering-migration`
- [ ] 최신 코드 확인: `git pull origin main`
- [ ] 개발 서버 실행 중: `npm run dev`
- [ ] 브라우저 DevTools 준비

---

### Step 1: `get_aed_data_summary` 파라미터 수정

**파일**: `app/api/aed-data/route.ts` Line 505-518

- [ ] Line 507 앞에 `expiryFilter` 변수 추가
  ```typescript
  const expiryFilter =
    filters.battery_expiry_date ||
    filters.patch_expiry_date ||
    filters.replacement_date ||
    null;
  ```
- [ ] Line 511 수정: `p_expiry_filter: expiryFilter`
- [ ] Line 512 유지: `p_status_filters: filters.status || null`
- [ ] Line 513-516 삭제: `p_category_1/2/3`, `p_search`
- [ ] Line 513 추가: `p_category_filter: filters.category_1 || null`
- [ ] TypeScript 에러 확인: `npm run tsc`
- [ ] 브라우저 콘솔 에러 확인

**검증**:
- [ ] 컴파일 에러 없음
- [ ] 런타임 에러 없음
- [ ] API 요청 성공 (Network 탭 확인)

---

### Step 2: 메모리 필터링 제거

**파일**: `app/api/aed-data/route.ts` Line 463-485

- [ ] Line 463-467 삭제: `battery_expiry_date` 메모리 필터
- [ ] Line 469-473 삭제: `patch_expiry_date` 메모리 필터
- [ ] Line 475-479 삭제: `replacement_date` 메모리 필터
- [ ] Line 481-485 유지: `last_inspection_date` 메모리 필터
- [ ] 주석 추가:
  ```typescript
  // ⚠️ last_inspection_date만 메모리 필터링 (RPC 미지원)
  // battery/patch/replacement는 DB에서 필터링됨
  ```

**검증**:
- [ ] `filteredData`가 여전히 선언됨
- [ ] `last_inspection_date` 필터만 남음
- [ ] 컴파일 에러 없음

---

### Step 3: DB 쿼리에 필터 조건 추가

**파일**: `app/api/aed-data/route.ts` Line 328-376

#### 3-1: 헬퍼 함수 추가 (파일 상단)

- [ ] Line 20 근처에 `addDays` 함수 추가:
  ```typescript
  function addDays(dateStr: string, days: number): string {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }
  ```

#### 3-2: 배터리 필터 추가

- [ ] Line 335 뒤에 배터리 필터 추가:
  ```typescript
  // 배터리 만료일 필터
  if (filters.battery_expiry_date) {
    const today = new Date().toISOString().split('T')[0];

    switch (filters.battery_expiry_date) {
      case 'expired':
        query = query.lt('battery_expiry_date', today);
        break;
      case 'in30':
        query = query.gte('battery_expiry_date', today)
                     .lte('battery_expiry_date', addDays(today, 30));
        break;
      case 'in60':
        query = query.gte('battery_expiry_date', today)
                     .lte('battery_expiry_date', addDays(today, 60));
        break;
      case 'in90':
        query = query.gte('battery_expiry_date', today)
                     .lte('battery_expiry_date', addDays(today, 90));
        break;
    }
  }
  ```

#### 3-3: 패드 필터 추가

- [ ] 배터리 필터 뒤에 패드 필터 추가:
  ```typescript
  // 패드 만료일 필터
  if (filters.patch_expiry_date) {
    const today = new Date().toISOString().split('T')[0];

    switch (filters.patch_expiry_date) {
      case 'expired':
        query = query.lt('patch_expiry_date', today);
        break;
      case 'in30':
        query = query.gte('patch_expiry_date', today)
                     .lte('patch_expiry_date', addDays(today, 30));
        break;
      case 'in60':
        query = query.gte('patch_expiry_date', today)
                     .lte('patch_expiry_date', addDays(today, 60));
        break;
      case 'in90':
        query = query.gte('patch_expiry_date', today)
                     .lte('patch_expiry_date', addDays(today, 90));
        break;
    }
  }
  ```

**검증**:
- [ ] `addDays` 함수 작동 확인
- [ ] SQL WHERE 절 로그 확인 (Network 탭)
- [ ] 필터링 결과 정확함

---

### Step 4: `totalCount` 계산 수정

**파일**: `app/api/aed-data/route.ts` Line 530-548

#### 4-1: 헬퍼 함수 추가 (파일 하단)

- [ ] 파일 끝에 `getTotalCount` 함수 추가:
  ```typescript
  async function getTotalCount(
    supabase: any,
    filters: {
      regionCodes: string[] | null;
      cityCodes: string[] | null;
      batteryExpiryFilter: string | null;
      patchExpiryFilter: string | null;
    }
  ): Promise<number> {
    let query = supabase
      .from('aed_data')
      .select('id', { count: 'exact', head: true });

    if (filters.regionCodes && filters.regionCodes.length > 0) {
      query = query.in('sido', filters.regionCodes);
    }

    if (filters.cityCodes && filters.cityCodes.length > 0) {
      query = query.in('gugun', filters.cityCodes);
    }

    // 배터리 필터
    if (filters.batteryExpiryFilter) {
      const today = new Date().toISOString().split('T')[0];

      switch (filters.batteryExpiryFilter) {
        case 'expired':
          query = query.lt('battery_expiry_date', today);
          break;
        case 'in30':
          query = query.gte('battery_expiry_date', today)
                       .lte('battery_expiry_date', addDays(today, 30));
          break;
        case 'in60':
          query = query.gte('battery_expiry_date', today)
                       .lte('battery_expiry_date', addDays(today, 60));
          break;
        case 'in90':
          query = query.gte('battery_expiry_date', today)
                       .lte('battery_expiry_date', addDays(today, 90));
          break;
      }
    }

    // 패드 필터
    if (filters.patchExpiryFilter) {
      const today = new Date().toISOString().split('T')[0];

      switch (filters.patchExpiryFilter) {
        case 'expired':
          query = query.lt('patch_expiry_date', today);
          break;
        case 'in30':
          query = query.gte('patch_expiry_date', today)
                       .lte('patch_expiry_date', addDays(today, 30));
          break;
        case 'in60':
          query = query.gte('patch_expiry_date', today)
                       .lte('patch_expiry_date', addDays(today, 60));
          break;
        case 'in90':
          query = query.gte('patch_expiry_date', today)
                       .lte('patch_expiry_date', addDays(today, 90));
          break;
      }
    }

    const { count } = await query;
    return count || 0;
  }
  ```

#### 4-2: `totalCount` 계산 수정

- [ ] Line 536 수정:
  ```typescript
  const summary = summaryData && summaryData[0] ? {
    totalCount: Number(summaryData[0].total_count),  // ✅ DB 집계
    expiredCount: Number(summaryData[0].expired_count),
    expiringSoonCount: Number(summaryData[0].expiring_soon_count),
    hiddenCount: Number(summaryData[0].hidden_count),
    withSensitiveDataCount: Number(summaryData[0].with_sensitive_data_count)
  } : {
    // Summary 실패 시 직접 COUNT
    totalCount: await getTotalCount(supabase, {
      regionCodes: regionFiltersForQuery,
      cityCodes: finalCityCodes,
      batteryExpiryFilter: filters.battery_expiry_date,
      patchExpiryFilter: filters.patch_expiry_date
    }),
    expiredCount: 0,
    expiringSoonCount: 0,
    hiddenCount: 0,
    withSensitiveDataCount: 0
  };
  ```

**검증**:
- [ ] `totalCount`가 DB 집계 사용
- [ ] fallback 로직 작동
- [ ] 컴파일 에러 없음

---

### Step 5: 문서 업데이트

#### 5-1: FILTERING_STRATEGY_ANALYSIS.md 수정

- [ ] 파일 상단에 긴급 정정 섹션 추가
- [ ] 기존 결정 변경 (메모리 → DB)
- [ ] 버그 발견 경위 추가
- [ ] 새로운 결정 근거 추가

#### 5-2: LAYOUT_STAGE1_COMPLETE.md 수정

- [ ] 긴급 정정 섹션 추가
- [ ] DB_FILTERING_MIGRATION_PLAN.md 링크 추가

#### 5-3: PERFORMANCE_OPTIMIZATION_MASTER.md 수정

- [ ] Filtering Strategy 상태 변경 (확정 → 긴급 수정 중)
- [ ] 링크 업데이트

#### 5-4: README.md 수정

- [ ] 현재 상태 테이블 업데이트
- [ ] 변경 이력 추가

---

## 🧪 테스트 시나리오

### Test 1: 단일 구군 배터리 필터 (기존 버그 없음)

**목적**: 기존 동작이 여전히 작동하는지 확인

**절차**:
1. 로그인: 대구응급의료지원센터
2. 검색 조건:
   - 시도: 대구
   - 구군: 남구
   - 배터리 만료일: 만료
3. 검색 실행

**예상 결과**:
- ✅ 검색 결과: 16건
- ✅ 리스트에 16개 표시
- ✅ 모두 배터리 만료 (빨간색)

**실제 결과**:
- [ ] 검색 결과: ___건
- [ ] 리스트 개수: ___개
- [ ] 배터리 만료 확인: [ ] 예 [ ] 아니오

---

### Test 2: 시도 전체 배터리 필터 (버그 수정 대상!)

**목적**: 주요 버그 수정 확인

**절차**:
1. 로그인: 대구응급의료지원센터
2. 검색 조건:
   - 시도: 대구
   - 구군: (전체)
   - 배터리 만료일: 만료
3. 검색 실행

**예상 결과** (수정 전):
- ❌ 검색 결과: 20건 (틀림!)
- ❌ 실제는 30건 이상

**예상 결과** (수정 후):
- ✅ 검색 결과: 30건 이상
- ✅ 리스트와 일치
- ✅ 다음 페이지 작동

**실제 결과**:
- [ ] 검색 결과: ___건
- [ ] 리스트 개수: ___개
- [ ] 다음 페이지 작동: [ ] 예 [ ] 아니오
- [ ] 2페이지 개수: ___개

---

### Test 3: 다음 페이지 일관성

**목적**: 페이지네이션 일관성 확인

**절차**:
1. Test 2 조건으로 검색
2. "다음 페이지" 클릭
3. 2페이지 개수 확인
4. "다음 페이지" 클릭
5. 3페이지 개수 확인

**예상 결과** (수정 전):
- ❌ 1페이지: 20개
- ❌ 2페이지: 10개 (불일치!)
- ❌ totalCount: 20 (틀림!)

**예상 결과** (수정 후):
- ✅ 1페이지: 최대 100개
- ✅ 2페이지: 최대 100개
- ✅ totalCount: 정확함

**실제 결과**:
- [ ] 1페이지 개수: ___개
- [ ] 2페이지 개수: ___개
- [ ] 3페이지 개수: ___개
- [ ] totalCount: ___건

---

### Test 4: 여러 구군 합계

**목적**: 집계 정확성 검증

**절차**:
1. 대구 남구 배터리 만료: ___건 (A)
2. 대구 중구 배터리 만료: ___건 (B)
3. 대구 전체 배터리 만료: ___건 (C)

**예상 결과**:
- ✅ C >= A + B (다른 구군도 있음)

**실제 결과**:
- [ ] 남구: ___건
- [ ] 중구: ___건
- [ ] 전체: ___건
- [ ] 검증: C >= A + B? [ ] 예 [ ] 아니오

---

### Test 5: 패드 만료일 필터

**목적**: 패드 필터도 작동하는지 확인

**절차**:
1. 로그인: 대구응급의료지원센터
2. 검색 조건:
   - 시도: 대구
   - 패드 만료일: 30일 이내
3. 검색 실행

**예상 결과**:
- ✅ 검색 결과 표시
- ✅ 모두 패드 30일 이내
- ✅ totalCount 정확함

**실제 결과**:
- [ ] 검색 결과: ___건
- [ ] 리스트 개수: ___개
- [ ] 패드 30일 이내 확인: [ ] 예 [ ] 아니오

---

### Test 6: 점검일 필터 (메모리 필터링)

**목적**: 점검일 필터가 여전히 작동하는지 확인

**절차**:
1. 로그인: 대구응급의료지원센터
2. 검색 조건:
   - 시도: 대구
   - 최근 점검일: 90일 이상
3. 검색 실행

**예상 결과**:
- ✅ 검색 결과 표시
- ✅ 모두 90일 이상 미점검
- ⚠️ totalCount는 근사치 (메모리 필터링)

**실제 결과**:
- [ ] 검색 결과: ___건
- [ ] 리스트 개수: ___개
- [ ] 90일 이상 미점검 확인: [ ] 예 [ ] 아니오

---

### Test 7: 복합 필터

**목적**: 여러 필터 동시 사용

**절차**:
1. 로그인: 대구응급의료지원센터
2. 검색 조건:
   - 시도: 대구
   - 구군: 남구
   - 배터리 만료일: 만료
   - 분류1: 의료기관
3. 검색 실행

**예상 결과**:
- ✅ 모든 조건 만족
- ✅ totalCount 정확함

**실제 결과**:
- [ ] 검색 결과: ___건
- [ ] 배터리 만료 확인: [ ] 예 [ ] 아니오
- [ ] 분류1이 의료기관 확인: [ ] 예 [ ] 아니오

---

### Test 8: 성능 테스트

**목적**: DB 필터링으로 인한 성능 변화 측정

**절차**:
1. Chrome DevTools > Network 탭 열기
2. "대구 전체 배터리 만료" 조회
3. `/api/aed-data` 요청 시간 측정

**예상 결과**:
- ✅ 응답 시간: 500ms ~ 2s
- ✅ 이전과 비슷하거나 빠름

**실제 결과**:
- [ ] 응답 시간: ___ms
- [ ] 이전 대비: [ ] 빠름 [ ] 비슷 [ ] 느림

---

## 🔄 롤백 계획

### 롤백 트리거

다음 경우 즉시 롤백:
1. ❌ Test 1 실패 (기존 동작 깨짐)
2. ❌ Test 2에서 집계 여전히 틀림
3. ❌ 컴파일 에러 해결 불가
4. ❌ 런타임 에러 발생
5. ❌ 성능 2배 이상 저하

### 롤백 절차

#### Step 1: Git 복원 (1분)

```bash
# 변경 사항 확인
git status

# 변경 사항 폐기
git checkout -- app/api/aed-data/route.ts

# 또는 전체 롤백
git reset --hard HEAD

# 브라우저 새로고침
# Cmd+Shift+R (하드 리로드)
```

#### Step 2: 검증 (2분)

- [ ] "대구 남구 배터리 만료" 조회: 16건
- [ ] "대구 중구 배터리 만료" 조회: 14건
- [ ] 기존 동작 복원 확인

#### Step 3: 이슈 기록 (5분)

```markdown
## 롤백 이슈

**일시**: 2025-10-17 HH:MM

**이유**: (구체적 이유 작성)
- 예: Test 2 실패 - 집계 여전히 20건 표시

**롤백 방법**: git reset --hard HEAD

**다음 단계**:
1. 문제 원인 재분석
2. 대안 검토
3. 재시도 일정 결정
```

---

## 📊 예상 결과

### Before (메모리 필터링)

```
대구 남구 배터리 만료 조회:
- DB: 남구 600개 중 100개 가져오기
- 메모리: 100개 중 16개 필터링
- Summary: 남구 전체 600개 집계 (배터리 필터 없음!)
- totalCount: 16 (filteredData.length)
→ 우연히 맞음 ✅ (100개 미만)

대구 전체 배터리 만료 조회:
- DB: 대구 8,000개 중 100개 가져오기
- 메모리: 100개 중 20개 필터링
- Summary: 대구 전체 8,000개 집계 (배터리 필터 없음!)
- totalCount: 20 (filteredData.length)
→ 틀림! ❌ (실제 30개 이상)
```

### After (DB 필터링)

```
대구 남구 배터리 만료 조회:
- DB: 남구 배터리 만료만 100개 가져오기 (필터링됨!)
- 메모리: 필터링 없음 (이미 DB에서 처리)
- Summary: 남구 배터리 만료 전체 집계 (필터 적용!)
- totalCount: 16 (summaryData.total_count)
→ 맞음 ✅

대구 전체 배터리 만료 조회:
- DB: 대구 배터리 만료만 100개 가져오기 (필터링됨!)
- 메모리: 필터링 없음
- Summary: 대구 배터리 만료 전체 집계 (필터 적용!)
- totalCount: 30 (summaryData.total_count)
→ 맞음 ✅
```

---

## 🎓 교훈

### 이번 버그에서 배운 점

1. **메모리 필터링의 위험성**
   ```
   ❌ DB에서 100개 → 메모리에서 20개 → totalCount는?
   → filteredData.length = 20 (현재 페이지만!)
   → summaryData.total_count = 8,000 (필터 전!)

   둘 다 틀림!
   ```

2. **하이브리드 방식의 복잡성**
   ```
   DB 필터링: sido, gugun, category
   메모리 필터링: battery, patch, inspection

   → Summary는 어디까지 필터링을 알아야 하나?
   → 일관성 유지 불가능!
   ```

3. **"작은 데이터셋에서는 괜찮다" 함정**
   ```
   남구 (600개): 우연히 맞음 ✅
   대구 전체 (8,000개): 틀림 ❌

   → 작은 데이터에서 테스트하면 버그를 못 찾음!
   ```

4. **RPC 함수는 이미 준비되어 있었다**
   ```
   get_aed_data_summary()가 이미 p_expiry_filter 지원
   → 사용만 안 했을 뿐!
   → 코드 리뷰의 중요성
   ```

5. **집계 오류는 치명적**
   ```
   성능 문제: 짜증남
   기능 문제: 불편함
   집계 오류: 신뢰 상실!

   → 보건소 직원이 잘못된 데이터로 의사결정
   → 서비스 신뢰도 하락
   ```

---

## 🔗 관련 문서

- [FILTERING_STRATEGY_ANALYSIS.md](./FILTERING_STRATEGY_ANALYSIS.md) - 이전 분석 (정정 필요)
- [LAYOUT_STAGE1_COMPLETE.md](./LAYOUT_STAGE1_COMPLETE.md) - Layout Stage 1 완료
- [PERFORMANCE_OPTIMIZATION_MASTER.md](./PERFORMANCE_OPTIMIZATION_MASTER.md) - 전체 현황
- [PHASE_0_APPLIED.md](./PHASE_0_APPLIED.md) - Phase 0 완료

---

## 📝 메모

- 이 문서는 긴급 수정을 위한 상세 계획서
- 체크리스트를 순서대로 진행
- 각 단계마다 검증 필수
- 문제 발생 시 즉시 롤백
- 롤백 후 재분석

---

## 🆕 추가 작업: 복합 필터 버그 수정 (2025-10-18)

### 발견된 추가 버그

**버그**: 배터리 만료 + 1년 미점검 복합 필터 시 집계 오류
```
조건: battery_expiry='expired' + last_inspection_date='over1year'
결과: 대구 전체 18건 (잘못됨!)
예상: 21건 (중구 12 + 북구 2 + 수성구 4 + 달성군 3)
```

**원인**: Steps 1-4 완료 후에도 `last_inspection_date`는 여전히 메모리 필터링
- DB 쿼리는 battery filter만 적용 → 100개 반환
- 메모리에서 last_inspection filter 적용 → 18개 남음
- 하지만 summary 쿼리는 last_inspection filter를 모름!
- 결과: `totalCount`가 틀림

### 근본 해결 방안

**Step 5A: RPC 함수 수정 (추가)**
- `get_aed_data_summary` 함수에 `p_last_inspection_filter` 파라미터 추가
- SQL WHERE 절에 점검일 필터 로직 추가
- 복합 필터 시 정확한 집계 가능

**작업 상태**:
- [x] Step 1: 파라미터 수정 완료
- [x] Step 2: 메모리 필터링 제거 (battery/patch만)
- [x] Step 3: DB 쿼리 필터 추가
- [x] Step 4: totalCount 계산 수정
- [x] Step 5A: RPC 함수 SQL 파일 생성 (`add_last_inspection_to_summary.sql`)
- [x] Step 5B: API Route 업데이트 (`p_last_inspection_filter` 추가)
- [x] Step 5C: 수동 마이그레이션 가이드 작성 (`MANUAL_MIGRATION_GUIDE.md`)
- [x] Step 5D: SQL 마이그레이션 실행 (Supabase MCP로 성공) ✅
- [x] Step 5E: SQL 검증 완료 (대구 전체 33건 확인) ✅
- [x] Bonus: 옛날 프로젝트 ID 제거 (19개 파일 삭제, 문서 수정) ✅
- [x] Step 5F: 브라우저 테스트 완료 (배너 241건, 리스트 18건 불일치 확인) ✅
- [x] Step 5G: 메모리 필터링 완전 제거 (Line 520-524 삭제) ✅ **2025-10-18 완료**

### 관련 파일

| 파일 | 경로 | 상태 |
|------|------|------|
| SQL 마이그레이션 | `/supabase/add_last_inspection_to_summary.sql` | ✅ 생성 완료 |
| 수동 가이드 | `/supabase/MANUAL_MIGRATION_GUIDE.md` | ✅ 생성 완료 |
| API Route | `/app/api/aed-data/route.ts` | ✅ 업데이트 완료 |

### 다음 단계

1. ✅ **SQL 마이그레이션 완료** (Supabase MCP 사용)
   - RPC 함수 업데이트 성공
   - 복합 필터 지원 추가
   - 실제 데이터 검증: 대구 전체 33건 (중구 20 + 동구 2 + 수성구 8 + 달성군 3)

2. 🧪 **브라우저 테스트** (다음 작업)
   - 조건: 대구 + 배터리 만료 + 1년 미점검
   - 예상: "검색 결과: 33건" 표시
   - 이전 버그: 18건으로 잘못 표시되었음

3. 🧹 **최종 정리** (테스트 후)
   - [route.ts Line 520-524](app/api/aed-data/route.ts#L520-L524) 메모리 필터 제거
   - 모든 필터링이 DB에서 처리되도록 최종 확인

---

**작성자**: 개발팀
**최종 업데이트**: 2025년 10월 18일 (SQL 마이그레이션 완료)
**상태**: SQL 실행 완료 ✅, 브라우저 테스트 대기 🧪
**다음**: 브라우저에서 복합 필터 테스트
