# 수동 마이그레이션 가이드 (Manual Migration Guide)

## 🚨 긴급 수정: 복합 필터 버그 (Compound Filter Bug Fix)

### 문제 상황
**버그**: 배터리 만료 + 1년 미점검 복합 필터 시 집계 오류
```
조건: battery_expiry='expired' + last_inspection_date='over1year'
결과: 대구 전체 18건 (잘못됨!)
예상: 21건 (중구 12 + 북구 2 + 수성구 4 + 달성군 3)
```

**원인**: `get_aed_data_summary` RPC 함수가 `last_inspection_date` 파라미터를 지원하지 않음

---

## 📋 마이그레이션 단계

### Step 1: Supabase Dashboard에서 SQL 실행

1. **Supabase Dashboard 접속**
   - URL: https://supabase.com/dashboard/project/aieltmidsagiobpuebvv
   - SQL Editor로 이동

2. **SQL 파일 복사**
   - 파일 위치: `/supabase/add_last_inspection_to_summary.sql`
   - 전체 내용을 복사하여 SQL Editor에 붙여넣기

3. **실행**
   - "Run" 버튼 클릭
   - 성공 메시지 확인

### Step 2: 변경 사항 검증

**검증 쿼리 1: 함수 시그니처 확인**
```sql
SELECT
  proname AS function_name,
  pg_get_function_arguments(oid) AS arguments
FROM pg_proc
WHERE proname = 'get_aed_data_summary';
```

**예상 결과**:
```
function_name           | arguments
------------------------|--------------------------------------------
get_aed_data_summary    | p_user_role text DEFAULT NULL::text,
                        | p_region_codes text[] DEFAULT NULL::text[],
                        | p_city_codes text[] DEFAULT NULL::text[],
                        | p_expiry_filter text DEFAULT NULL::text,
                        | p_status_filters text[] DEFAULT NULL::text[],
                        | p_category_filter text DEFAULT NULL::text,
                        | p_query_criteria text DEFAULT 'address'::text,
                        | p_last_inspection_filter text DEFAULT NULL::text  ✅
```

**검증 쿼리 2: 복합 필터 테스트**
```sql
-- 대구 전체: 배터리 만료 + 1년 미점검
SELECT * FROM get_aed_data_summary(
  p_user_role := 'master',
  p_region_codes := ARRAY['27'],
  p_city_codes := NULL,
  p_expiry_filter := 'expired',
  p_status_filters := NULL,
  p_category_filter := NULL,
  p_query_criteria := 'address',
  p_last_inspection_filter := 'over1year'
);
```

**예상 결과**:
```
total_count | expired_count | expiring_soon_count | hidden_count | with_sensitive_data_count
------------|---------------|---------------------|--------------|---------------------------
21          | ?             | ?                   | ?            | ?
```

**검증 쿼리 3: 구군별 검증**
```sql
-- 중구
SELECT COUNT(*) FROM aed_data
WHERE region_code = '27'
  AND city_code = '140'
  AND (battery_expiry_date < CURRENT_DATE OR patch_expiry_date < CURRENT_DATE)
  AND (last_inspection_date < CURRENT_DATE - INTERVAL '1 year' OR last_inspection_date IS NULL);
-- 예상: 12건

-- 북구
SELECT COUNT(*) FROM aed_data
WHERE region_code = '27'
  AND city_code = '200'
  AND (battery_expiry_date < CURRENT_DATE OR patch_expiry_date < CURRENT_DATE)
  AND (last_inspection_date < CURRENT_DATE - INTERVAL '1 year' OR last_inspection_date IS NULL);
-- 예상: 2건

-- 수성구
SELECT COUNT(*) FROM aed_data
WHERE region_code = '27'
  AND city_code = '260'
  AND (battery_expiry_date < CURRENT_DATE OR patch_expiry_date < CURRENT_DATE)
  AND (last_inspection_date < CURRENT_DATE - INTERVAL '1 year' OR last_inspection_date IS NULL);
-- 예상: 4건

-- 달성군
SELECT COUNT(*) FROM aed_data
WHERE region_code = '27'
  AND city_code = '710'
  AND (battery_expiry_date < CURRENT_DATE OR patch_expiry_date < CURRENT_DATE)
  AND (last_inspection_date < CURRENT_DATE - INTERVAL '1 year' OR last_inspection_date IS NULL);
-- 예상: 3건
```

### Step 3: API 코드 업데이트 확인

**파일**: `/app/api/aed-data/route.ts`

**변경 내용**:
```typescript
const { data: summaryData } = await supabase.rpc('get_aed_data_summary', {
  p_user_role: userProfile.role,
  p_region_codes: regionFiltersForQuery,
  p_city_codes: finalCityCodes,
  p_expiry_filter: expiryFilter,
  p_status_filters: filters.status || null,
  p_category_filter: filters.category_1 || null,
  p_query_criteria: filters.queryCriteria || 'address',
  p_last_inspection_filter: filters.last_inspection_date || null  // ✅ NEW
});
```

**상태**: ✅ 이미 적용됨

### Step 4: 메모리 필터링 제거 (Optional - RPC 업데이트 후)

**현재 상태**: 메모리 필터링 유지 (백업용)
```typescript
// Line 520-524
if (filters.last_inspection_date) {
  filteredData = filteredData.filter((device: AEDDevice) =>
    matchesInspectionFilter(filters.last_inspection_date as ExpiryFilter, device.days_since_last_inspection)
  );
}
```

**RPC 업데이트 검증 완료 후**:
```typescript
// 이 블록 전체 제거 또는 주석 처리
```

---

## 🧪 테스트 시나리오

### Test 1: 단일 필터 (배터리 만료)
**조건**:
- 시도: 대구
- 구군: 전체
- 필터: 배터리 만료

**검증**:
- 대구 전체 건수 = 구군별 합계

### Test 2: 단일 필터 (1년 미점검)
**조건**:
- 시도: 대구
- 구군: 전체
- 필터: 1년 이상 미점검

**검증**:
- 대구 전체 건수 = 구군별 합계

### Test 3: 복합 필터 (Critical)
**조건**:
- 시도: 대구
- 구군: 전체
- 필터: 배터리 만료 + 1년 미점검

**검증**:
```
대구 전체: 21건
중구: 12건
북구: 2건
수성구: 4건
달성군: 3건
합계: 21건 ✅
```

### Test 4: 다른 복합 필터
**조건**:
- 시도: 서울
- 구군: 전체
- 필터: 30일 내 만료 + 6개월 미점검

**검증**:
- 서울 전체 = 구별 합계

---

## 🔄 롤백 절차 (Rollback)

### 긴급 롤백이 필요한 경우

**Step 1: 이전 함수 버전 복원**
```sql
-- 이전 버전 (7개 파라미터)
DROP FUNCTION IF EXISTS get_aed_data_summary(TEXT, TEXT[], TEXT[], TEXT, TEXT[], TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION get_aed_data_summary(
    p_user_role TEXT DEFAULT NULL,
    p_region_codes TEXT[] DEFAULT NULL,
    p_city_codes TEXT[] DEFAULT NULL,
    p_expiry_filter TEXT DEFAULT NULL,
    p_status_filters TEXT[] DEFAULT NULL,
    p_category_filter TEXT DEFAULT NULL,
    p_query_criteria TEXT DEFAULT 'address'
    -- p_last_inspection_filter 제거
)
RETURNS TABLE(...)
...
```

**Step 2: API 코드 롤백**
```typescript
const { data: summaryData } = await supabase.rpc('get_aed_data_summary', {
  p_user_role: userProfile.role,
  p_region_codes: regionFiltersForQuery,
  p_city_codes: finalCityCodes,
  p_expiry_filter: expiryFilter,
  p_status_filters: filters.status || null,
  p_category_filter: filters.category_1 || null,
  p_query_criteria: filters.queryCriteria || 'address'
  // p_last_inspection_filter 제거
});
```

**Step 3: Git 롤백**
```bash
git checkout HEAD~1 -- app/api/aed-data/route.ts
git commit -m "Rollback: RPC function update (복합 필터 버그)"
```

---

## 📊 모니터링 체크리스트

### 배포 후 30분 이내
- [ ] 서버 에러 로그 확인 (500 에러 없음)
- [ ] 응답 시간 정상 (< 1초)
- [ ] 복합 필터 테스트 통과

### 배포 후 24시간 이내
- [ ] 사용자 피드백 수집
- [ ] 집계 정확도 검증 (랜덤 샘플링 10건)
- [ ] 성능 메트릭 확인

### 배포 후 1주일 이내
- [ ] 메모리 필터링 제거 (Step 4)
- [ ] 최종 성능 테스트
- [ ] 문서 업데이트 (COMPLETE 문서 생성)

---

## 📁 관련 파일

| 파일 | 경로 | 상태 |
|------|------|------|
| SQL 마이그레이션 | `/supabase/add_last_inspection_to_summary.sql` | ✅ 준비 완료 |
| API Route | `/app/api/aed-data/route.ts` | ✅ 업데이트 완료 |
| 마이그레이션 계획 | `/docs/planning/DB_FILTERING_MIGRATION_PLAN.md` | 📝 업데이트 필요 |

---

## 🤝 담당자 및 승인

| 역할 | 이름 | 승인 여부 |
|------|------|-----------|
| 개발자 | Claude | ✅ 구현 완료 |
| 검증자 | - | ⏳ 대기 중 |
| 배포자 | 사용자 | ⏳ 수동 배포 필요 |

---

## 📝 변경 이력

| 날짜 | 작업 | 상태 |
|------|------|------|
| 2025-10-18 | SQL 마이그레이션 파일 생성 | ✅ |
| 2025-10-18 | API Route 업데이트 | ✅ |
| 2025-10-18 | 수동 마이그레이션 가이드 작성 | ✅ |
| - | SQL 실행 (Dashboard) | ⏳ 대기 |
| - | 검증 테스트 | ⏳ 대기 |
| - | 메모리 필터링 제거 | ⏳ 대기 |

---

**최종 업데이트**: 2025년 10월 18일
**다음 단계**: Supabase Dashboard에서 SQL 실행
