# 의무기관매칭 2024/2025년 탭 구분 개선 계획

## 📋 프로젝트 개요

**작성일**: 2025-10-15
**목적**: 2024년 데이터 기반 매칭 시스템 구축 및 2025년 확장 준비
**배경**: 2025년 데이터 준비가 늦어지고 있어, 먼저 2024년 데이터로 시스템을 완성하고 그 노하우를 2025년에 적용

---

## 🎯 목표

### 1차 목표 (2024년 시스템 완성)
- ✅ **기존 구현 검토**: 이미 구현된 2024년 시스템 분석
- 🔄 **신뢰도 개선**: 기존 신뢰도 69.81점에서 개선
- 🎨 **UI/UX 개선**: 2024년 탭으로 명확히 구분
- 📊 **매칭 정확도 향상**: target_list_2024와 aed_data 매칭 알고리즘 개선

### 2차 목표 (2025년 확장)
- 📅 **2025년 탭 추가**: 2024년 시스템을 기반으로 2025년 탭 구현
- 🔀 **연도별 비교**: 2024년 vs 2025년 매칭 결과 비교 기능
- 📈 **자동 이관**: 2024년 확정 데이터 → 2025년 자동 제안

---

## 🗂️ 현재 시스템 분석

### 데이터베이스 테이블

#### 1. `target_list_2024` (구비의무기관 목록)
```sql
- target_key (PK): 고유 키 (sido_gugun_division_subdiv_instname)
- sido, gugun: 지역 정보
- division, sub_division: 시설 구분
- institution_name: 기관명
- target_keygroup: 그룹핑 키 (동일 기관 여러 시설)
- management_number: 관리번호 (nullable)
- data_year: 2024 (기본값)
- 총 건수: 26,724건
```

#### 2. `management_number_group_mapping` (관리번호 기반 그룹 매칭)
```sql
- management_number (PK, unique): AED 관리번호
- target_key_2024: 2024년 확정된 target_key
- auto_suggested_2024: 자동 추천 target_key
- auto_confidence_2024: 신뢰도 (0-100)
- auto_matching_reason_2024: 매칭 이유 (JSONB)
- confirmed_2024: 확정 여부
- confirmed_by_2024, confirmed_at_2024: 확정자/시간
- modified_by_2024, modified_at_2024: 수정자/시간
- modification_note_2024: 수정 사유
- target_key_2025, auto_suggested_2025, ... (2025년 컬럼들)
- 총 건수: 50,010건
- 특징: 1개 target_key → N개 management_numbers (그룹핑)
```

#### 3. `aed_target_mapping` (장비 기반 영속성 매핑)
```sql
- equipment_serial (unique): AED 장비 일련번호 (안정적 키)
- management_number: AED 관리번호
- target_key_2024, auto_suggested_2024, ... (2024년 컬럼들)
- target_key_2025, auto_suggested_2025, ... (2025년 컬럼들)
- 특징: 절대 삭제 금지, equipment_serial 기반 영속성 보장
```

#### 4. `aed_data` (AED 설치 데이터)
```sql
- equipment_serial (unique): 장비 일련번호
- management_number: 관리번호
- installation_institution: 설치기관명
- sido, gugun: 지역
- category_1: '구비의무기관' / '구비의무기관 외'
- 총 건수: 80,860대
```

### 현재 DB 함수

#### `get_target_matching_list_2024()`
```sql
CREATE OR REPLACE FUNCTION get_target_matching_list_2024(
  p_confidence_level VARCHAR DEFAULT 'all',  -- high/medium/low/all
  p_sido VARCHAR DEFAULT NULL,
  p_search VARCHAR DEFAULT NULL,
  p_confirmed_only BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  management_number VARCHAR,
  target_key_2024 VARCHAR,
  auto_suggested_2024 VARCHAR,
  auto_confidence_2024 NUMERIC,
  confirmed_2024 BOOLEAN,
  modified_by_2024 VARCHAR,
  modified_at_2024 TIMESTAMPTZ,
  aed_institution VARCHAR,
  target_institution VARCHAR,
  sido VARCHAR,
  gugun VARCHAR,
  aed_count BIGINT,
  matching_reason JSONB
)
```

**특징**:
- ✅ 신뢰도별 필터링 (≥90: high, 70-89: medium, <70: low)
- ✅ 지역별 필터링
- ✅ 검색 기능 (기관명, 관리번호)
- ✅ 확정 여부 필터링
- ⚠️ **2024년 하드코딩**: 함수명과 컬럼명에 2024 고정

### 현재 통계

```
총 매칭: 50,010건
총 AED: 80,860대
평균 신뢰도: 69.81점

신뢰도 분포:
- 고신뢰도 (≥90점): 10,630건 (21.3%)
- 중신뢰도 (70-89점): 8,810건 (17.6%)
- 저신뢰도 (<70점): 30,570건 (61.1%)
```

---

## 🔄 개선 계획

### Phase 1: 2024년 시스템 완성 (우선)

#### 1.1 UI 개선 - 2024년 탭 명시

**현재**:
```tsx
// 탭이 신뢰도별로만 구분 (high/medium/low/all)
<Tabs value={activeTab}>
  <TabsList>
    <TabsTrigger value="high">고신뢰도</TabsTrigger>
    <TabsTrigger value="medium">중신뢰도</TabsTrigger>
    <TabsTrigger value="low">저신뢰도</TabsTrigger>
    <TabsTrigger value="all">전체</TabsTrigger>
  </TabsList>
</Tabs>
```

**개선**:
```tsx
// 최상위에 연도 탭 추가
<Tabs value={selectedYear}>
  <TabsList>
    <TabsTrigger value="2024">2024년 기준</TabsTrigger>
    <TabsTrigger value="2025" disabled>2025년 기준 (준비중)</TabsTrigger>
  </TabsList>

  <TabsContent value="2024">
    {/* 기존 신뢰도별 탭 */}
    <Tabs value={activeTab}>
      <TabsList>
        <TabsTrigger value="high">고신뢰도 (10,630)</TabsTrigger>
        <TabsTrigger value="medium">중신뢰도 (8,810)</TabsTrigger>
        <TabsTrigger value="low">저신뢰도 (30,570)</TabsTrigger>
        <TabsTrigger value="all">전체 (50,010)</TabsTrigger>
      </TabsList>
    </Tabs>
  </TabsContent>
</Tabs>
```

#### 1.2 매칭 알고리즘 개선

**현재 매칭 로직** (Migration 42 참조):
```sql
-- sido 일치: +40점
-- gugun 일치: +30점
-- 기관명 유사도: +30점
-- 평균: 69.81점 (신뢰도 낮음)
```

**개선 방향**:
1. **가중치 조정**:
   ```sql
   -- sido 일치: +35점 (40→35)
   -- gugun 일치: +35점 (30→35)
   -- 기관명 유사도: +30점 (유지)
   -- category_1 일치 ('구비의무기관'): +10점 (추가)
   -- 시설구분(division) 일치: +5점 (추가)
   ```

2. **문자열 정규화 강화**:
   ```sql
   -- 공백 제거: REPLACE(name, ' ', '')
   -- 특수문자 제거: REGEXP_REPLACE(name, '[^가-힣a-zA-Z0-9]', '', 'g')
   -- 기관 유형 통일: '보건소'/'보건지소'/'보건진료소' → '보건'
   -- '시립'/'도립'/'구립' 제거
   ```

3. **유사도 알고리즘 개선**:
   ```sql
   -- 현재: similarity(name1, name2) (기본 trigram)
   -- 개선:
   --   1) 완전 일치: 100점
   --   2) LIKE '%핵심키워드%': 90점
   --   3) similarity() >= 0.8: 80점
   --   4) similarity() >= 0.6: 60점
   --   5) 이하: 0점
   ```

#### 1.3 신규 Migration 작성

**파일**: `supabase/migrations/67_improve_2024_matching.sql`

```sql
-- 1. 기존 매칭 삭제 (재실행용)
UPDATE management_number_group_mapping
SET
  auto_suggested_2024 = NULL,
  auto_confidence_2024 = NULL,
  auto_matching_reason_2024 = NULL
WHERE auto_confidence_2024 IS NOT NULL;

-- 2. 개선된 매칭 알고리즘 실행
-- (상세 SQL은 Phase 1 구현 시 작성)

-- 3. 통계 확인
SELECT
  CASE
    WHEN auto_confidence_2024 >= 90 THEN 'high'
    WHEN auto_confidence_2024 >= 70 THEN 'medium'
    ELSE 'low'
  END as level,
  COUNT(*) as count,
  ROUND(AVG(auto_confidence_2024), 2) as avg_confidence
FROM management_number_group_mapping
GROUP BY level
ORDER BY level;
```

#### 1.4 통계 API 개선

**파일**: `app/api/target-matching/stats/route.ts`

**현재**:
```typescript
// 2024년 데이터만 하드코딩
const { data: stats } = await supabase.rpc('get_matching_stats_2024');
```

**개선**:
```typescript
// GET /api/target-matching/stats?year=2024
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year') || '2024';

  if (year === '2024') {
    // 2024년 통계
    const { data } = await supabase.rpc('get_matching_stats_2024');
    return Response.json(data);
  } else if (year === '2025') {
    // 2025년 통계 (준비중)
    return Response.json({
      error: '2025년 데이터는 준비 중입니다'
    }, { status: 404 });
  }
}
```

#### 1.5 UI 컴포넌트 수정

**파일**: `app/(authenticated)/admin/target-matching/TargetMatchingClient.tsx`

**주요 변경사항**:
```typescript
// 1. 연도 상태 추가
const [selectedYear, setSelectedYear] = useState<'2024' | '2025'>('2024');

// 2. 인터페이스 수정 (연도 동적)
interface TargetMatching {
  management_number: string;
  target_key: string | null;  // target_key_2024 → target_key (동적)
  auto_suggested: string | null;
  auto_confidence: number | null;
  confirmed: boolean;
  // ... 기타 필드
}

// 3. API 호출 수정
const { data: statsData } = useQuery({
  queryKey: ['target-matching-stats', selectedYear],
  queryFn: async () => {
    const res = await fetch(`/api/target-matching/stats?year=${selectedYear}`);
    return res.json();
  },
});

// 4. 탭 UI 추가
<div className="space-y-4">
  {/* 연도 탭 */}
  <div className="flex gap-2">
    <Button
      variant={selectedYear === '2024' ? 'default' : 'outline'}
      onClick={() => setSelectedYear('2024')}
    >
      2024년 기준
    </Button>
    <Button
      variant={selectedYear === '2025' ? 'default' : 'outline'}
      onClick={() => setSelectedYear('2025')}
      disabled
    >
      2025년 기준 (준비중)
    </Button>
  </div>

  {/* 기존 신뢰도 탭 */}
  <Tabs value={activeTab}>...</Tabs>
</div>
```

---

### Phase 2: 2025년 확장 (2024년 완성 후)

#### 2.1 데이터 준비

**파일**: `supabase/migrations/68_target_list_2025.sql`

```sql
-- 1. target_list_2025 테이블 생성
CREATE TABLE IF NOT EXISTS target_list_2025 (
  target_key VARCHAR PRIMARY KEY,
  no INTEGER,
  sido VARCHAR NOT NULL,
  gugun VARCHAR NOT NULL,
  division VARCHAR,
  sub_division VARCHAR,
  institution_name VARCHAR NOT NULL,
  target_keygroup VARCHAR NOT NULL,
  management_number VARCHAR,
  data_year INTEGER DEFAULT 2025,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 인덱스 생성
CREATE INDEX idx_target_list_2025_sido_gugun ON target_list_2025(sido, gugun);
CREATE INDEX idx_target_list_2025_institution ON target_list_2025(institution_name);
CREATE INDEX idx_target_list_2025_keygroup ON target_list_2025(target_keygroup);

-- 3. 2024년 데이터 복사 (기본값)
INSERT INTO target_list_2025 (
  target_key, no, sido, gugun, division, sub_division,
  institution_name, target_keygroup, management_number, data_year
)
SELECT
  REPLACE(target_key, '2024', '2025') as target_key,
  no, sido, gugun, division, sub_division,
  institution_name, target_keygroup, management_number,
  2025 as data_year
FROM target_list_2024;

COMMENT ON TABLE target_list_2025 IS '2025년 구비의무기관 목록 (2024 기반 자동 생성)';
```

#### 2.2 자동 매칭 실행

**파일**: `supabase/migrations/69_auto_matching_2025.sql`

```sql
-- 1. 2024년 확정 데이터 → 2025년 자동 제안
UPDATE management_number_group_mapping m
SET
  auto_suggested_2025 = m.target_key_2024,
  auto_confidence_2025 = 95,  -- 전년도 확정이므로 95점
  auto_matching_reason_2025 = jsonb_build_object(
    'source', 'previous_year_confirmed',
    'year', 2024,
    'confidence', 95,
    'note', '2024년 확정 데이터 기반 자동 제안'
  )
WHERE m.confirmed_2024 = TRUE
  AND m.target_key_2024 IS NOT NULL;

-- 2. 미확정 데이터 → 개선된 알고리즘 재매칭
-- (2024년 개선 알고리즘 적용)
UPDATE management_number_group_mapping m
SET
  auto_suggested_2025 = (
    -- 개선된 매칭 알고리즘 쿼리
    -- (Phase 1에서 검증된 로직 사용)
  ),
  auto_confidence_2025 = (calculated_confidence),
  auto_matching_reason_2025 = (matching_reason_json)
WHERE m.confirmed_2024 = FALSE OR m.target_key_2024 IS NULL;

-- 3. 통계 확인
SELECT
  'confirmed_from_2024' as source,
  COUNT(*) as count,
  AVG(auto_confidence_2025) as avg_confidence
FROM management_number_group_mapping
WHERE auto_matching_reason_2025->>'source' = 'previous_year_confirmed'
UNION ALL
SELECT
  'new_matching' as source,
  COUNT(*) as count,
  AVG(auto_confidence_2025) as avg_confidence
FROM management_number_group_mapping
WHERE auto_matching_reason_2025->>'source' != 'previous_year_confirmed'
  OR auto_matching_reason_2025->>'source' IS NULL;
```

#### 2.3 DB 함수 추가

**파일**: `supabase/migrations/70_target_matching_2025_functions.sql`

```sql
-- 1. 2025년용 목록 조회 함수
CREATE OR REPLACE FUNCTION get_target_matching_list_2025(
  p_confidence_level VARCHAR DEFAULT 'all',
  p_sido VARCHAR DEFAULT NULL,
  p_search VARCHAR DEFAULT NULL,
  p_confirmed_only BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  management_number VARCHAR,
  target_key_2025 VARCHAR,
  auto_suggested_2025 VARCHAR,
  auto_confidence_2025 NUMERIC,
  confirmed_2025 BOOLEAN,
  modified_by_2025 VARCHAR,
  modified_at_2025 TIMESTAMPTZ,
  aed_institution VARCHAR,
  target_institution VARCHAR,
  sido VARCHAR,
  gugun VARCHAR,
  aed_count BIGINT,
  matching_reason JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH aed_summary AS (
    SELECT
      a.management_number::VARCHAR,
      MAX(a.installation_institution)::VARCHAR as aed_institution,
      MAX(a.sido)::VARCHAR as sido,
      MAX(a.gugun)::VARCHAR as gugun,
      COUNT(*) as aed_count
    FROM aed_data a
    WHERE a.management_number IS NOT NULL
    GROUP BY a.management_number
  )
  SELECT
    m.management_number::VARCHAR,
    m.target_key_2025::VARCHAR,
    m.auto_suggested_2025::VARCHAR,
    m.auto_confidence_2025,
    m.confirmed_2025,
    m.modified_by_2025::VARCHAR,
    m.modified_at_2025,
    a.aed_institution::VARCHAR,
    t.institution_name::VARCHAR as target_institution,
    a.sido::VARCHAR,
    a.gugun::VARCHAR,
    a.aed_count,
    m.auto_matching_reason_2025 as matching_reason
  FROM management_number_group_mapping m
  LEFT JOIN aed_summary a ON a.management_number = m.management_number
  LEFT JOIN target_list_2025 t ON t.target_key = COALESCE(m.target_key_2025, m.auto_suggested_2025)
  WHERE
    (
      p_confidence_level = 'all' OR
      (p_confidence_level = 'high' AND m.auto_confidence_2025 >= 90) OR
      (p_confidence_level = 'medium' AND m.auto_confidence_2025 >= 70 AND m.auto_confidence_2025 < 90) OR
      (p_confidence_level = 'low' AND m.auto_confidence_2025 < 70)
    )
    AND (p_sido IS NULL OR a.sido = p_sido)
    AND (
      p_search IS NULL OR
      a.aed_institution ILIKE '%' || p_search || '%' OR
      t.institution_name ILIKE '%' || p_search || '%' OR
      m.management_number ILIKE '%' || p_search || '%'
    )
    AND (NOT p_confirmed_only OR m.confirmed_2025 = TRUE)
  ORDER BY
    m.auto_confidence_2025 DESC NULLS LAST,
    a.aed_count DESC,
    m.management_number;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_target_matching_list_2025 TO authenticated;

-- 2. 통합 함수 (연도 파라미터)
CREATE OR REPLACE FUNCTION get_target_matching_list(
  p_year INTEGER,
  p_confidence_level VARCHAR DEFAULT 'all',
  p_sido VARCHAR DEFAULT NULL,
  p_search VARCHAR DEFAULT NULL,
  p_confirmed_only BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  management_number VARCHAR,
  target_key VARCHAR,
  auto_suggested VARCHAR,
  auto_confidence NUMERIC,
  confirmed BOOLEAN,
  modified_by VARCHAR,
  modified_at TIMESTAMPTZ,
  aed_institution VARCHAR,
  target_institution VARCHAR,
  sido VARCHAR,
  gugun VARCHAR,
  aed_count BIGINT,
  matching_reason JSONB
) AS $$
BEGIN
  IF p_year = 2024 THEN
    RETURN QUERY
    SELECT * FROM get_target_matching_list_2024(
      p_confidence_level, p_sido, p_search, p_confirmed_only
    );
  ELSIF p_year = 2025 THEN
    RETURN QUERY
    SELECT * FROM get_target_matching_list_2025(
      p_confidence_level, p_sido, p_search, p_confirmed_only
    );
  ELSE
    RAISE EXCEPTION 'Invalid year: %. Must be 2024 or 2025', p_year;
  END IF;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_target_matching_list TO authenticated;
```

#### 2.4 API 라우트 수정

**파일**: `app/api/target-matching/route.ts`

```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year') || '2024';
  const confidenceLevel = searchParams.get('confidence_level') || 'all';
  const sido = searchParams.get('sido');
  const search = searchParams.get('search');
  const confirmedOnly = searchParams.get('confirmed_only') === 'true';

  const supabase = createClient();

  // 통합 함수 호출
  const { data, error } = await supabase.rpc(
    'get_target_matching_list',
    {
      p_year: parseInt(year),
      p_confidence_level: confidenceLevel,
      p_sido: sido,
      p_search: search,
      p_confirmed_only: confirmedOnly,
    }
  );

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    mappings: data || [],
    total: data?.length || 0,
    year: parseInt(year),
  });
}
```

#### 2.5 UI 최종 완성

**파일**: `app/(authenticated)/admin/target-matching/TargetMatchingClient.tsx`

```typescript
export function TargetMatchingClient() {
  const [selectedYear, setSelectedYear] = useState<2024 | 2025>(2024);
  const [activeTab, setActiveTab] = useState<'high' | 'medium' | 'low' | 'all'>('high');

  // 연도별 통계 조회
  const { data: statsData } = useQuery({
    queryKey: ['target-matching-stats', selectedYear],
    queryFn: async () => {
      const res = await fetch(`/api/target-matching/stats?year=${selectedYear}`);
      return res.json();
    },
  });

  // 연도별 매칭 목록 조회
  const { data: matchingsData } = useQuery({
    queryKey: ['target-matchings', selectedYear, activeTab, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('year', selectedYear.toString());
      params.append('confidence_level', activeTab);
      if (filters.search) params.append('search', filters.search);
      if (filters.confirmedOnly) params.append('confirmed_only', 'true');

      const res = await fetch(`/api/target-matching?${params.toString()}`);
      return res.json();
    },
  });

  return (
    <div className="flex h-full flex-col bg-gray-950">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800">
        <h1 className="text-2xl font-bold text-white">구비의무기관 매칭 관리</h1>
        <p className="text-sm text-gray-400 mt-1">
          연도별 구비의무기관 자동 매칭 검토 및 확정
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
        {/* 연도 선택 탭 */}
        <div className="flex gap-2">
          <Button
            variant={selectedYear === 2024 ? 'default' : 'outline'}
            onClick={() => setSelectedYear(2024)}
            className="h-10"
          >
            📅 2024년 기준
          </Button>
          <Button
            variant={selectedYear === 2025 ? 'default' : 'outline'}
            onClick={() => setSelectedYear(2025)}
            className="h-10"
          >
            📅 2025년 기준
          </Button>

          {/* 연도별 정보 표시 */}
          <div className="ml-auto text-sm text-gray-400">
            {selectedYear === 2024 && (
              <span>✅ 2024년 데이터 완성 (평균 신뢰도: {statsData?.avg_confidence?.toFixed(2)}점)</span>
            )}
            {selectedYear === 2025 && statsData && (
              <span>🔄 2024년 확정 데이터 기반 자동 제안</span>
            )}
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {/* ... 통계 카드들 */}
        </div>

        {/* 신뢰도별 탭 */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList>
            <TabsTrigger value="high">
              고신뢰도 ({statsData?.high_confidence_count || 0})
            </TabsTrigger>
            <TabsTrigger value="medium">
              중신뢰도 ({statsData?.medium_confidence_count || 0})
            </TabsTrigger>
            <TabsTrigger value="low">
              저신뢰도 ({statsData?.low_confidence_count || 0})
            </TabsTrigger>
            <TabsTrigger value="all">
              전체 ({statsData?.total_mappings || 0})
            </TabsTrigger>
          </TabsList>

          {/* 테이블 내용 */}
          <TabsContent value={activeTab}>
            {/* ... 매칭 목록 테이블 */}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
```

---

## 📊 예상 결과

### Phase 1 완료 후 (2024년)
```
✅ 평균 신뢰도: 69.81점 → 80점 이상 (목표)
✅ 고신뢰도 비율: 21.3% → 40% 이상 (목표)
✅ UI: 2024년 탭 명시
✅ 매칭 알고리즘: 개선 완료
✅ 노하우 축적: 2025년 적용 준비
```

### Phase 2 완료 후 (2025년)
```
✅ 2024년 확정 데이터 → 2025년 자동 제안 (신뢰도 95점)
✅ 2025년 탭 활성화
✅ 연도별 비교 기능
✅ 자동 이관 시스템
```

---

## 🗓️ 일정

### Week 1-2: Phase 1 (2024년 완성)
- [ ] Day 1-2: 매칭 알고리즘 개선 및 테스트
- [ ] Day 3-4: Migration 67 작성 및 실행
- [ ] Day 5-6: UI 수정 (연도 탭 추가)
- [ ] Day 7: 테스트 및 문서화

### Week 3-4: Phase 2 (2025년 확장)
- [ ] Day 1-2: target_list_2025 테이블 준비
- [ ] Day 3-4: 자동 매칭 실행 및 검증
- [ ] Day 5-6: DB 함수 및 API 수정
- [ ] Day 7: 최종 테스트 및 배포

---

## 📁 파일 구조

```
aed-check-system/
├── supabase/
│   └── migrations/
│       ├── 41_target_list_2024.sql (✅ 완료)
│       ├── 42_target_key_generation.sql (✅ 완료)
│       ├── 43_aed_target_mapping.sql (✅ 완료)
│       ├── 47_target_matching_ui_functions.sql (✅ 완료)
│       ├── 67_improve_2024_matching.sql (🔄 작성 예정)
│       ├── 68_target_list_2025.sql (📅 Phase 2)
│       ├── 69_auto_matching_2025.sql (📅 Phase 2)
│       └── 70_target_matching_2025_functions.sql (📅 Phase 2)
│
├── app/
│   ├── api/
│   │   └── target-matching/
│   │       ├── route.ts (🔄 수정 예정)
│   │       ├── stats/route.ts (🔄 수정 예정)
│   │       ├── confirm/route.ts (🔄 수정 예정)
│   │       └── bulk-confirm/route.ts (🔄 수정 예정)
│   │
│   └── (authenticated)/
│       └── admin/
│           └── target-matching/
│               ├── page.tsx (✅ 완료)
│               └── TargetMatchingClient.tsx (🔄 수정 예정)
│
└── docs/
    └── reports/
        ├── TARGET_MATCHING_TEST_GUIDE.md (✅ 완료)
        ├── 2025-10-05-target-matching.md (✅ 완료)
        └── TARGET_MATCHING_2024_2025_PLAN.md (✅ 작성 완료)
```

---

## 🔍 검증 체크리스트

### Phase 1 검증
- [ ] 평균 신뢰도 80점 이상 달성
- [ ] 고신뢰도 비율 40% 이상 달성
- [ ] UI에서 "2024년 기준" 탭 표시 확인
- [ ] 신뢰도별 필터링 정상 작동
- [ ] 확정 기능 정상 작동
- [ ] 문서화 완료

### Phase 2 검증
- [ ] target_list_2025 테이블 생성 확인
- [ ] 2024년 확정 데이터 자동 제안 확인 (신뢰도 95점)
- [ ] 2025년 탭 활성화 및 정상 작동
- [ ] 연도 전환 시 통계 정확성 확인
- [ ] API 응답 시간 < 2초 유지
- [ ] 문서화 완료

---

## 📝 참고 문서

1. [TARGET_MATCHING_TEST_GUIDE.md](../supabase/TARGET_MATCHING_TEST_GUIDE.md) - 기존 시스템 테스트 가이드
2. [2025-10-05-target-matching.md](./2025-10-05-target-matching.md) - 시스템 완성 보고서
3. [Migration 47](../../supabase/migrations/47_target_matching_ui_functions.sql) - DB 함수 정의

---

**작성자**: Claude
**작성일**: 2025-10-15
**버전**: 1.0
**상태**: 📋 계획 수립 완료 → 🔄 Phase 1 구현 대기
