# queryCriteria='jurisdiction' 구현 방안 분석
**작성일**: 2025-10-18
**목적**: queryCriteria='jurisdiction' 지원을 위한 최적 구현 방안 선정

---

## 1. 문제 정의

### 1.1 현재 상황
- **RPC Summary**: `get_aed_data_summary()` 함수가 `queryCriteria='jurisdiction'`을 지원하지만 **공백 정규화 없이 JOIN 실패**
- **Data Query**: API route에서 실제 데이터를 가져올 때는 항상 주소 기준(`sido`/`gugun`)으로만 쿼리
- **결과**: Summary 집계는 관할보건소 기준, 실제 데이터는 주소 기준 → **데이터 불일치 발생**

### 1.2 핵심 기술 문제
**공백 불일치**:
```sql
-- aed_data.jurisdiction_health_center (공백 없음)
"대구광역시달서구보건소", "서울특별시종로구보건소"

-- organizations.name (공백 있음)
"대구광역시 달서구 보건소", "서울특별시 종로구 보건소"

-- 결과: 단순 JOIN 실패
LEFT JOIN organizations o ON a.jurisdiction_health_center = o.name
-- ❌ 모든 행에서 NULL 반환
```

**해결책**: 공백 제거 정규화
```sql
-- ✅ 작동하는 JOIN
INNER JOIN organizations o
  ON REPLACE(a.jurisdiction_health_center, ' ', '') = REPLACE(o.name, ' ', '')
WHERE o.type = 'health_center'
```

### 1.3 성능 테스트 결과
```sql
-- 주소 기준 쿼리 (기존)
WHERE a.region_code = 'DAE' AND a.city_code = 'DALSEOG'
-- 실행 시간: 0.36ms (indexed)

-- 관할보건소 기준 쿼리 (새로운 방식)
INNER JOIN organizations o
  ON REPLACE(a.jurisdiction_health_center, ' ', '') = REPLACE(o.name, ' ', '')
WHERE o.type = 'health_center' AND o.region_code = 'DAE'
-- 실행 시간: 29.769ms (JOIN + REPLACE)
-- 결과: 3,329건 (대구)
```

**결론**: ~80배 느리지만 29ms는 여전히 허용 가능한 수준 (< 100ms)

---

## 2. 기존 유틸리티 분석

### 2.1 HealthCenterMatcher 유틸리티
**위치**: `/utils/healthCenterMatcher.ts`

**기능**:
```typescript
export class HealthCenterMatcher {
  /**
   * 보건소 명칭을 정규화하여 매칭 키 생성
   * 예: "대구광역시 중구보건소" → "대구중구"
   */
  static normalizeForMatching(name: string): string {
    if (!name) return '';

    return name
      .replace(/\s+/g, '')                    // 1. 모든 공백 제거
      .replace(/특별시|광역시|특별자치시|특별자치도|도/g, '') // 2. 시도 접미사 제거
      .replace(/보건소$/g, '')                // 3. '보건소' 접미사 제거
      .toLowerCase();                         // 4. 소문자로 통일
  }

  static isMatch(name1: string, name2: string): boolean {
    const normalized1 = this.normalizeForMatching(name1);
    const normalized2 = this.normalizeForMatching(name2);
    return normalized1 === normalized2;
  }
}
```

**용도**:
- 중앙관리시스템에서 보건소 매칭에 사용
- 공백 뿐만 아니라 "광역시", "보건소" 등의 접미사도 제거
- 더 관대한 매칭 로직

### 2.2 SQL과의 차이점
| 기능 | HealthCenterMatcher | SQL REPLACE |
|------|---------------------|-------------|
| 공백 제거 | ✅ `replace(/\s+/g, '')` | ✅ `REPLACE(name, ' ', '')` |
| 접미사 제거 | ✅ "광역시", "보건소" 제거 | ❌ 없음 |
| 대소문자 통일 | ✅ `toLowerCase()` | ❌ 없음 |
| 용도 | 관대한 매칭 | 정확한 JOIN |

**결론**:
- HealthCenterMatcher는 **다양한 표기 방식을 허용**하는 관대한 매칭용
- SQL JOIN에서는 **정확한 1:1 매칭**이 필요하므로 단순 공백 제거만 사용

---

## 3. 구현 방안 비교

### 방안 1: RPC 함수 수정 (권장 ⭐⭐⭐⭐⭐)

#### 3.1.1 개요
- 기존 `get_aed_data_summary()` 함수의 JOIN 수정
- 새로운 `get_aed_data_by_jurisdiction()` RPC 함수 생성

#### 3.1.2 구현 내용
**Step 1**: RPC Summary 함수 수정
```sql
-- 파일: /supabase/fix_jurisdiction_join.sql

-- 기존 문제 (Line 52-54)
(p_region_codes IS NULL OR EXISTS (
    SELECT 1 FROM organizations o
    WHERE o.name = a.jurisdiction_health_center  -- ❌ 공백 불일치
    AND o.type = 'health_center'
    AND o.region_code = ANY(p_region_codes)
))

-- 수정 후
(p_region_codes IS NULL OR EXISTS (
    SELECT 1 FROM organizations o
    WHERE REPLACE(o.name, ' ', '') = REPLACE(a.jurisdiction_health_center, ' ', '')  -- ✅ 공백 정규화
    AND o.type = 'health_center'
    AND o.region_code = ANY(p_region_codes)
))
```

**Step 2**: 새 RPC 함수 생성 (데이터 쿼리용)
```sql
-- 파일: /supabase/create_jurisdiction_data_query.sql

CREATE OR REPLACE FUNCTION get_aed_data_by_jurisdiction(
    p_region_codes TEXT[] DEFAULT NULL,
    p_city_codes TEXT[] DEFAULT NULL,
    p_battery_expiry TEXT DEFAULT NULL,
    p_patch_expiry TEXT DEFAULT NULL,
    p_replacement_date TEXT DEFAULT NULL,
    p_last_inspection_date TEXT DEFAULT NULL,
    p_status_filters TEXT[] DEFAULT NULL,
    p_category_1 TEXT[] DEFAULT NULL,
    p_category_2 TEXT[] DEFAULT NULL,
    p_category_3 TEXT[] DEFAULT NULL,
    p_external_display TEXT DEFAULT NULL,
    p_limit INT DEFAULT 100,
    p_offset INT DEFAULT 0
)
RETURNS TABLE(LIKE aed_data)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT a.*
    FROM aed_data a
    INNER JOIN organizations o
      ON REPLACE(a.jurisdiction_health_center, ' ', '') = REPLACE(o.name, ' ', '')
    WHERE o.type = 'health_center'
      AND (p_region_codes IS NULL OR o.region_code = ANY(p_region_codes))
      AND (p_city_codes IS NULL OR o.city_code = ANY(p_city_codes))
      -- 배터리 만료일 필터
      AND (p_battery_expiry IS NULL OR
          CASE p_battery_expiry
              WHEN 'expired' THEN a.battery_expiry_date < CURRENT_DATE
              WHEN 'in30' THEN a.battery_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
              WHEN 'in60' THEN a.battery_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
              WHEN 'in90' THEN a.battery_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
              WHEN 'in180' THEN a.battery_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '180 days'
              WHEN 'in365' THEN a.battery_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '365 days'
              WHEN 'no_expiry' THEN a.battery_expiry_date IS NULL
              WHEN 'never' THEN a.battery_expiry_date IS NULL
              ELSE TRUE
          END
      )
      -- 패드 만료일 필터
      AND (p_patch_expiry IS NULL OR
          CASE p_patch_expiry
              WHEN 'expired' THEN a.patch_expiry_date < CURRENT_DATE
              WHEN 'in30' THEN a.patch_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
              WHEN 'in60' THEN a.patch_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
              WHEN 'in90' THEN a.patch_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
              WHEN 'in180' THEN a.patch_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '180 days'
              WHEN 'in365' THEN a.patch_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '365 days'
              WHEN 'no_expiry' THEN a.patch_expiry_date IS NULL
              WHEN 'never' THEN a.patch_expiry_date IS NULL
              ELSE TRUE
          END
      )
      -- 교체예정일 필터
      AND (p_replacement_date IS NULL OR
          CASE p_replacement_date
              WHEN 'expired' THEN a.replacement_date < CURRENT_DATE
              WHEN 'in30' THEN a.replacement_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
              WHEN 'in60' THEN a.replacement_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
              WHEN 'in90' THEN a.replacement_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
              WHEN 'in180' THEN a.replacement_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '180 days'
              WHEN 'in365' THEN a.replacement_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '365 days'
              WHEN 'no_expiry' THEN a.replacement_date IS NULL
              WHEN 'never' THEN a.replacement_date IS NULL
              ELSE TRUE
          END
      )
      -- 점검일 필터
      AND (p_last_inspection_date IS NULL OR
          CASE p_last_inspection_date
              WHEN 'expired' THEN a.last_inspection_date < CURRENT_DATE - INTERVAL '1 year'
              WHEN 'in30' THEN a.last_inspection_date >= CURRENT_DATE - INTERVAL '30 days'
              WHEN 'in60' THEN a.last_inspection_date >= CURRENT_DATE - INTERVAL '60 days'
              WHEN 'in90' THEN a.last_inspection_date >= CURRENT_DATE - INTERVAL '90 days'
              WHEN 'in180' THEN a.last_inspection_date >= CURRENT_DATE - INTERVAL '180 days'
              WHEN 'in365' THEN a.last_inspection_date >= CURRENT_DATE - INTERVAL '365 days'
              WHEN 'no_expiry' THEN a.last_inspection_date IS NULL
              WHEN 'never' THEN a.last_inspection_date IS NULL
              ELSE TRUE
          END
      )
      -- 상태 필터
      AND (p_status_filters IS NULL OR a.operation_status = ANY(p_status_filters))
      -- 카테고리 필터
      AND (p_category_1 IS NULL OR a.category_1 = ANY(p_category_1))
      AND (p_category_2 IS NULL OR a.category_2 = ANY(p_category_2))
      AND (p_category_3 IS NULL OR a.category_3 = ANY(p_category_3))
      -- 외부표출 필터
      AND (p_external_display IS NULL OR
          CASE p_external_display
              WHEN 'Y' THEN a.external_display = 'Y'
              WHEN 'N' THEN a.external_display = 'N'
              WHEN 'blocked' THEN
                  a.external_display = 'N'
                  AND a.external_non_display_reason IS NOT NULL
                  AND a.external_non_display_reason NOT LIKE '%구비의무기관%'
              ELSE TRUE
          END
      )
    ORDER BY a.id
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION get_aed_data_by_jurisdiction TO authenticated;
```

**Step 3**: API Route 수정
```typescript
// 파일: /app/api/aed-data/route.ts (Line 447-472 수정)

if (filters.queryCriteria === 'jurisdiction') {
  console.log('[API] Using jurisdiction-based query with RPC function');

  // RPC 함수 호출
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'get_aed_data_by_jurisdiction',
    {
      p_region_codes: regionCodesForRPC,
      p_city_codes: cityCodesForRPC,
      p_battery_expiry: filters.battery_expiry_date,
      p_patch_expiry: filters.patch_expiry_date,
      p_replacement_date: filters.replacement_date,
      p_last_inspection_date: filters.last_inspection_date,
      p_status_filters: filters.status,
      p_category_1: filters.category_1,
      p_category_2: filters.category_2,
      p_category_3: filters.category_3,
      p_external_display: filters.external_display,
      p_limit: limit,
      p_offset: offset
    }
  );

  if (rpcError) {
    console.error('[API] RPC jurisdiction query failed:', rpcError);
    return NextResponse.json({ error: 'Failed to fetch jurisdiction data' }, { status: 500 });
  }

  allData = rpcData || [];
  queryError = null;
} else {
  // 기존 주소 기준 쿼리 로직...
}
```

#### 3.1.3 장점 ✅
1. **성능 최적화**: SQL 레벨에서 필터링, 최소한의 데이터만 전송
2. **중앙 집중식 로직**: 모든 필터 로직이 SQL에 집중, 유지보수 용이
3. **타입 안정성**: Supabase RPC는 TypeScript 타입 생성 지원
4. **일관성 보장**: Summary와 Data Query가 동일한 JOIN 로직 사용
5. **확장성**: 향후 복잡한 집계 쿼리 추가 가능
6. **보안**: SECURITY DEFINER로 RLS 우회 가능

#### 3.1.4 단점 ❌
1. **SQL 마이그레이션 필요**: Supabase에 SQL 파일 배포 필요
2. **디버깅 복잡도**: SQL 내부 로직 디버깅 어려움
3. **초기 구현 시간**: 새 RPC 함수 작성 및 테스트 필요

#### 3.1.5 잠재적 문제
- **필터 누락 위험**: 모든 필터를 RPC 파라미터로 추가해야 함 (현재 8개)
- **RPC 파라미터 제한**: PostgreSQL 함수 파라미터 수 제한 (보통 100개까지는 안전)
- **테스트 커버리지**: 모든 필터 조합을 SQL로 테스트해야 함

---

### 방안 2: Supabase Query Builder + Computed Column (비권장)

#### 3.2.1 개요
- Supabase Client에서 `select('*, organizations!inner(*)')` JOIN 사용
- Computed Column으로 공백 제거

#### 3.2.2 구현 내용
```typescript
// 파일: /app/api/aed-data/route.ts

if (filters.queryCriteria === 'jurisdiction') {
  // Computed column 생성 (공백 제거)
  const { data, error } = await supabase
    .rpc('create_normalized_join_view'); // 임시 뷰 생성

  let query = supabase
    .from('aed_data')
    .select(`
      *,
      organizations!inner(
        name,
        region_code,
        city_code,
        type
      )
    `);

  // JOIN 조건은 뷰에서 처리
  // 필터는 기존 로직 재사용
  if (regionFiltersForQuery && regionFiltersForQuery.length > 0) {
    query = query.in('organizations.region_code', regionCodesForRPC);
  }

  // 나머지 필터...
}
```

#### 3.2.3 장점 ✅
1. **TypeScript 기반**: 클라이언트 코드에서 모두 처리, 디버깅 용이
2. **기존 필터 재사용**: 현재 API route의 필터 로직 재사용 가능

#### 3.2.4 단점 ❌
1. **성능 문제**: 모든 데이터를 JOIN 후 클라이언트로 전송
2. **복잡한 Computed Column**: Supabase에서 동적 컬럼 생성이 어려움
3. **N+1 쿼리 위험**: Nested select 시 내부적으로 여러 쿼리 발생 가능
4. **타입 복잡도**: JOIN 결과의 TypeScript 타입 정의 복잡

#### 3.2.5 잠재적 문제
- **공백 정규화 불가**: Supabase Query Builder는 `REPLACE()` 함수를 JOIN 조건에 사용 불가
- **뷰 의존성**: 별도의 SQL 뷰 또는 인덱스가 필요하여 방안 1과 동일한 SQL 마이그레이션 필요

**결론**: **구현 불가능** ⛔
Supabase Query Builder는 JOIN 조건에서 함수 사용을 지원하지 않음

---

### 방안 3: Hybrid Approach (중간 타협)

#### 3.3.1 개요
- Summary는 RPC 사용 (수정된 `get_aed_data_summary`)
- Data는 Subquery를 활용한 Direct Query 사용

#### 3.3.2 구현 내용
```typescript
// 파일: /app/api/aed-data/route.ts

if (filters.queryCriteria === 'jurisdiction') {
  // Step 1: 관할보건소에 해당하는 organization IDs 조회
  const { data: orgData, error: orgError } = await supabase
    .from('organizations')
    .select('name')
    .eq('type', 'health_center')
    .in('region_code', regionCodesForRPC);

  if (orgError || !orgData) {
    return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 });
  }

  // Step 2: 공백 정규화하여 매칭 (TypeScript에서 처리)
  const normalizedOrgNames = orgData.map(org =>
    HealthCenterMatcher.normalizeForMatching(org.name)
  );

  // Step 3: aed_data에서 매칭되는 데이터 조회
  const { data: aedData, error: aedError } = await supabase
    .from('aed_data')
    .select('*')
    .filter('jurisdiction_health_center', 'in', `(${normalizedOrgNames.join(',')})`); // ❌ 정규화된 값이 DB와 맞지 않음

  // 필터 적용은 기존 로직 재사용
}
```

#### 3.3.3 장점 ✅
1. **부분적 SQL 의존**: Summary만 RPC 사용, Data는 TypeScript
2. **HealthCenterMatcher 통합**: 기존 유틸리티 재사용 가능

#### 3.3.4 단점 ❌
1. **2단계 쿼리 필요**: Organizations → AED Data (N+1 문제)
2. **정규화 불일치**: TypeScript와 DB 간 정규화 결과가 다름
   - HealthCenterMatcher: "대구중구" (접미사 제거)
   - DB: "대구광역시달서구보건소" (원본)
3. **성능 저하**: 2번의 네트워크 라운드트립
4. **복잡한 필터 적용**: 모든 필터를 클라이언트에서 다시 적용해야 함

#### 3.3.5 잠재적 문제
- **정규화 로직 불일치**: HealthCenterMatcher는 "광역시", "보건소"를 제거하지만 DB 원본은 유지
- **IN 쿼리 한계**: PostgreSQL IN 절은 최대 1,000개 항목 (보건소 수는 253개로 안전)

**결론**: **구현 가능하지만 비효율적** ⚠️

---

## 4. 최종 권장 사항

### 4.1 선택: 방안 1 (RPC 함수 수정) ⭐⭐⭐⭐⭐

**이유**:
1. **성능**: SQL 레벨 필터링으로 최소 데이터 전송
2. **일관성**: Summary와 Data Query가 동일한 JOIN 로직 사용
3. **확장성**: 향후 복잡한 집계 쿼리 추가 용이
4. **보안**: SECURITY DEFINER로 권한 제어 가능
5. **유지보수**: 중앙 집중식 SQL 로직으로 변경 사항 추적 용이

**단점 해결 방안**:
- **SQL 마이그레이션**:
  - 2개의 SQL 파일만 작성 (`fix_jurisdiction_join.sql`, `create_jurisdiction_data_query.sql`)
  - Supabase Migration 도구로 버전 관리
- **디버깅 복잡도**:
  - SQL 주석 추가로 로직 명확화
  - PostgreSQL EXPLAIN ANALYZE로 성능 분석
  - 테스트 쿼리 문서화

### 4.2 구현 단계

#### Phase 1: RPC Summary 함수 수정 (30분)
1. `fix_jurisdiction_join.sql` 파일 작성
2. Supabase Studio에서 실행
3. Summary 정확성 검증 (SQL 쿼리로 확인)

#### Phase 2: 새 RPC 함수 생성 (1시간)
1. `create_jurisdiction_data_query.sql` 파일 작성
2. 모든 필터 로직 포함 (8개 필터)
3. Supabase Studio에서 실행
4. TypeScript 타입 생성 (`supabase gen types`)

#### Phase 3: API Route 수정 (30분)
1. `/app/api/aed-data/route.ts` 수정
2. `queryCriteria='jurisdiction'` 분기에서 새 RPC 호출
3. 기존 경고 메시지 제거

#### Phase 4: 테스트 (1시간)
1. **단위 테스트**: 각 필터 조합별 SQL 쿼리 검증
2. **통합 테스트**: API route에서 Summary와 Data 일치 확인
3. **성능 테스트**: 대용량 데이터 (10,000건) 쿼리 시간 측정
4. **UI 테스트**: 프론트엔드에서 필터 동작 확인

### 4.3 HealthCenterMatcher 통합 방안

**현재 상황**:
- HealthCenterMatcher는 **관대한 매칭**용 (접미사 제거, 대소문자 통일)
- SQL JOIN은 **정확한 1:1 매칭**용 (공백 제거만)

**통합 전략**:
```typescript
// 파일: /utils/healthCenterMatcher.ts (새 함수 추가)

export class HealthCenterMatcher {
  // 기존 함수 (관대한 매칭용)
  static normalizeForMatching(name: string): string { ... }

  // 새 함수 (SQL JOIN용 - 공백 제거만)
  static normalizeForSqlJoin(name: string): string {
    if (!name) return '';
    return name.replace(/\s+/g, '');
  }

  // SQL 쿼리 생성 헬퍼
  static getSqlJoinCondition(): string {
    return `REPLACE(a.jurisdiction_health_center, ' ', '') = REPLACE(o.name, ' ', '')`;
  }
}
```

**사용 예시**:
```typescript
// 테스트 파일에서 SQL과 TypeScript 정규화 결과 비교
const orgName = "대구광역시 달서구 보건소";
const aedJurisdiction = "대구광역시달서구보건소";

// SQL 정규화 결과
const sqlNormalized = HealthCenterMatcher.normalizeForSqlJoin(orgName);
// "대구광역시달서구보건소"

// 매칭 확인
console.log(sqlNormalized === aedJurisdiction); // true ✅
```

---

## 5. 잠재적 문제 및 해결 방안

### 5.1 데이터 정합성 문제
**문제**: `jurisdiction_health_center` 필드에 오타 또는 잘못된 값이 있을 경우 JOIN 실패

**해결 방안**:
1. **Data Quality Check**: 주기적으로 매칭 실패 데이터 조회
```sql
SELECT
  a.id,
  a.jurisdiction_health_center,
  COUNT(*) OVER () as unmatched_count
FROM aed_data a
LEFT JOIN organizations o
  ON REPLACE(a.jurisdiction_health_center, ' ', '') = REPLACE(o.name, ' ', '')
  AND o.type = 'health_center'
WHERE o.id IS NULL
LIMIT 100;
```

2. **Fallback 로직**: JOIN 실패 시 주소 기준으로 폴백
```sql
COALESCE(
  -- 1순위: 관할보건소 JOIN
  (SELECT region_code FROM organizations o
   WHERE REPLACE(o.name, ' ', '') = REPLACE(a.jurisdiction_health_center, ' ', '')
   AND o.type = 'health_center'
   LIMIT 1),
  -- 2순위: 주소 기반 region_code
  a.region_code
) as effective_region_code
```

### 5.2 성능 저하 위험
**문제**: REPLACE() 함수로 인한 인덱스 미사용, 성능 저하 가능

**해결 방안**:
1. **Generated Column 추가** (중장기 개선):
```sql
-- aed_data 테이블에 정규화된 컬럼 추가
ALTER TABLE aed_data
ADD COLUMN jurisdiction_health_center_normalized TEXT
GENERATED ALWAYS AS (REPLACE(jurisdiction_health_center, ' ', '')) STORED;

-- organizations 테이블에도 추가
ALTER TABLE organizations
ADD COLUMN name_normalized TEXT
GENERATED ALWAYS AS (REPLACE(name, ' ', '')) STORED;

-- 인덱스 생성
CREATE INDEX idx_aed_data_jurisdiction_normalized
ON aed_data(jurisdiction_health_center_normalized);

CREATE INDEX idx_organizations_name_normalized
ON organizations(name_normalized, type, region_code);

-- JOIN 쿼리 개선
INNER JOIN organizations o
  ON a.jurisdiction_health_center_normalized = o.name_normalized
WHERE o.type = 'health_center';
```

2. **성능 모니터링**: 쿼리 실행 시간 로깅
```typescript
const startTime = Date.now();
const { data, error } = await supabase.rpc('get_aed_data_by_jurisdiction', ...);
const elapsed = Date.now() - startTime;

if (elapsed > 100) {
  console.warn(`[PERFORMANCE] Jurisdiction query took ${elapsed}ms`);
}
```

### 5.3 필터 파라미터 과다
**문제**: RPC 함수에 파라미터 12개 이상 추가 시 관리 복잡도 증가

**해결 방안**:
1. **JSON 파라미터 사용** (향후 리팩토링):
```sql
CREATE OR REPLACE FUNCTION get_aed_data_by_jurisdiction(
    p_filters JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(LIKE aed_data)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT a.*
    FROM aed_data a
    INNER JOIN organizations o ...
    WHERE
      (p_filters->>'region_codes' IS NULL OR
       o.region_code = ANY((p_filters->>'region_codes')::text[]))
      AND ...
END;
$$;
```

---

## 6. 테스트 계획

### 6.1 SQL 레벨 테스트
```sql
-- Test 1: JOIN 정확성 검증
SELECT
  a.id,
  a.jurisdiction_health_center,
  o.name as matched_org_name,
  o.region_code
FROM aed_data a
INNER JOIN organizations o
  ON REPLACE(a.jurisdiction_health_center, ' ', '') = REPLACE(o.name, ' ', '')
WHERE o.type = 'health_center'
  AND o.region_code = 'DAE'
LIMIT 10;
-- 예상 결과: 10건, 모두 대구 데이터

-- Test 2: 필터 조합 테스트
SELECT COUNT(*)
FROM get_aed_data_by_jurisdiction(
  p_region_codes := ARRAY['DAE'],
  p_battery_expiry := 'expired',
  p_status_filters := ARRAY['active']
);
-- 예상 결과: > 0 (배터리 만료 + 정상 상태인 대구 AED)

-- Test 3: Summary vs Data 일치 검증
WITH summary AS (
  SELECT total_count FROM get_aed_data_summary(
    p_query_criteria := 'jurisdiction',
    p_region_codes := ARRAY['DAE']
  )
),
data_count AS (
  SELECT COUNT(*) as cnt FROM get_aed_data_by_jurisdiction(
    p_region_codes := ARRAY['DAE'],
    p_limit := 999999
  )
)
SELECT
  s.total_count as summary_count,
  d.cnt as data_count,
  s.total_count = d.cnt as is_match
FROM summary s, data_count d;
-- 예상 결과: is_match = true
```

### 6.2 API 레벨 테스트
```typescript
// Test 1: Summary와 Data 일치
const response = await fetch('/api/aed-data?queryCriteria=jurisdiction&regions=대구');
const { summary, data } = await response.json();

console.assert(
  summary.total === data.length,
  `Summary mismatch: ${summary.total} !== ${data.length}`
);

// Test 2: 필터 조합
const response2 = await fetch(
  '/api/aed-data?queryCriteria=jurisdiction&regions=대구&battery_expiry_date=expired'
);
const { data: expiredData } = await response2.json();

console.assert(
  expiredData.every(device =>
    new Date(device.battery_expiry_date) < new Date()
  ),
  'Some devices have non-expired batteries'
);
```

### 6.3 성능 테스트
```bash
# Apache Bench로 부하 테스트
ab -n 100 -c 10 "http://localhost:3000/api/aed-data?queryCriteria=jurisdiction&regions=대구"

# 예상 결과:
# - 평균 응답 시간: < 100ms
# - 95% 백분위: < 200ms
# - 에러율: 0%
```

---

## 7. 마이그레이션 체크리스트

### Phase 1: SQL 마이그레이션
- [ ] `fix_jurisdiction_join.sql` 파일 작성
- [ ] Supabase Studio에서 실행
- [ ] 기존 RPC 함수가 정상 동작하는지 확인
- [ ] Summary 집계 정확성 검증 (SQL 쿼리)

### Phase 2: 새 RPC 함수 생성
- [ ] `create_jurisdiction_data_query.sql` 파일 작성
- [ ] 모든 필터 로직 포함 (8개 필터)
- [ ] Supabase Studio에서 실행
- [ ] TypeScript 타입 생성 (`supabase gen types`)
- [ ] 함수 권한 확인 (`GRANT EXECUTE`)

### Phase 3: API Route 수정
- [ ] `/app/api/aed-data/route.ts` 수정
- [ ] `queryCriteria='jurisdiction'` 분기에서 새 RPC 호출
- [ ] 기존 경고 메시지 제거
- [ ] 에러 핸들링 추가

### Phase 4: 테스트
- [ ] SQL 레벨 테스트 (Section 6.1)
- [ ] API 레벨 테스트 (Section 6.2)
- [ ] 성능 테스트 (Section 6.3)
- [ ] UI 테스트 (프론트엔드에서 필터 동작 확인)

### Phase 5: 문서화
- [ ] API 문서 업데이트
- [ ] SQL 주석 추가
- [ ] CHANGELOG 작성
- [ ] 커밋 메시지 작성

---

## 8. 결론

**최종 선택**: 방안 1 (RPC 함수 수정) ⭐⭐⭐⭐⭐

**핵심 이유**:
1. **성능**: SQL 레벨 필터링으로 29ms 응답 시간 (허용 가능)
2. **일관성**: Summary와 Data Query가 동일한 공백 정규화 로직 사용
3. **확장성**: 향후 복잡한 집계 및 필터 추가 용이
4. **유지보수**: 중앙 집중식 SQL 로직으로 변경 사항 추적 용이

**구현 시간 예상**: 3시간 (SQL 작성 1.5h + API 수정 0.5h + 테스트 1h)

**잠재적 위험**:
- 데이터 정합성 문제 (Section 5.1 참조)
- 성능 저하 위험 (Section 5.2 참조)

**완화 전략**:
- Data Quality Check 주기적 실행
- 성능 모니터링 로깅 추가
- Generated Column으로 중장기 성능 개선

**다음 단계**: Phase 1부터 순차적으로 구현 시작
