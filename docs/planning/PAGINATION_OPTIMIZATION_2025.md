# 페이지네이션 및 대용량 데이터 최적화 계획 (2025년 업데이트)

**작성일**: 2025년 10월 17일
**최종 업데이트**: 2025년 10월 17일
**대상**: AEDpics 데이터 조회 성능 개선
**목표**: 50개 → 1,000개 이상 조회 가능, 전체 8만개 접근 보장

---

## 📋 목차

1. [현재 문제 분석](#-현재-문제-분석)
2. [기존 문서 검토 및 통합](#-기존-문서-검토-및-통합)
3. [최적화 방안 비교](#-최적화-방안-비교)
4. [선택된 해결 방안](#-선택된-해결-방안)
5. [구현 로드맵](#-구현-로드맵)
6. [예상 효과](#-예상-효과)

---

## 🏗️ 이미 구축된 부분 (2025-10-17 확인)

### ✅ Cursor Pagination 인프라 (90% 완료)

**중요**: 커서 페이지네이션 시스템은 **이미 90% 구현되어 있습니다**. 단, 1개의 치명적 버그로 인해 작동하지 않고 있습니다.

#### 1. Cursor 인코딩/디코딩 (완료)

**파일**: [route.ts:16-41](../app/api/aed-data/route.ts#L16-L41)

```typescript
// ✅ 이미 구현됨
type DecodedCursor = { id: number; updated_at?: string };

function decodeCursor(cursor: string): DecodedCursor | null {
  // Base64 URL-safe 디코딩 지원
  const normalized = cursor.replace(/-/g, '+').replace(/_/g, '/');
  // ... 구현 완료
}

function encodeCursor(id: number, updated_at?: string | null): string {
  // Base64 URL-safe 인코딩
  // ... 구현 완료
}
```

**상태**: ✅ **완료** - 추가 작업 불필요

---

#### 2. Cursor 파라미터 파싱 (완료)

**파일**: [route.ts:180-182](../app/api/aed-data/route.ts#L180-L182)

```typescript
// ✅ 이미 구현됨
const cursorParam = filters.cursor ?? request.nextUrl.searchParams.get('cursor');
const decodedCursor = cursorParam ? decodeCursor(cursorParam) : null;
const cursorId = decodedCursor?.id ?? null;
```

**상태**: ✅ **완료** - URL과 filters 객체 모두에서 cursor 추출 지원

---

#### 3. Cursor 필터링 (부분 완료)

**파일**: [route.ts:296-297, 369-370](../app/api/aed-data/route.ts#L296-L297)

```typescript
// ✅ 이미 구현됨
if (cursorId) {
  query = query.gt('id', cursorId);  // WHERE id > cursorId
}
```

**상태**: ✅ **완료** - inspection 모드와 일반 모드 모두 적용됨

---

#### 4. NextCursor 생성 (완료)

**파일**: [route.ts:496-501](../app/api/aed-data/route.ts#L496-L501)

```typescript
// ✅ 이미 구현됨
let nextCursor: string | null = null;
const hasMore = returnedData.length > pageSize;
if (hasMore) {
  const lastItem = returnedData[returnedData.length - 1];
  if (lastItem?.id) {
    nextCursor = encodeCursor(lastItem.id, lastItem.updated_at);
  }
}
```

**상태**: ✅ **완료** - hasMore 감지 및 다음 커서 자동 생성

---

#### 5. Database Indexes (완료)

**파일**: [migrations/59_add_performance_indexes.sql](../supabase/migrations/59_add_performance_indexes.sql)

```sql
-- ✅ 이미 구현됨
CREATE INDEX IF NOT EXISTS idx_aed_data_sido ON aed_data(sido);
CREATE INDEX IF NOT EXISTS idx_aed_data_gugun ON aed_data(gugun);
CREATE INDEX IF NOT EXISTS idx_aed_data_sido_gugun ON aed_data(sido, gugun);
CREATE INDEX IF NOT EXISTS idx_aed_data_category_1 ON aed_data(category_1);
CREATE INDEX IF NOT EXISTS idx_aed_data_equipment_serial ON aed_data(equipment_serial);
```

**상태**: ✅ **완료** - 주요 필터링 컬럼에 인덱스 적용됨

---

### ❌ 치명적 버그: Cursor와 Range의 모순

**파일**: [route.ts:225-226, 303, 376](../app/api/aed-data/route.ts#L225-L226)

#### 문제점

```typescript
// ❌ 현재 코드 (버그)
const offset = cursorId ? 0 : (page - 1) * pageSize;
const rangeEnd = offset + queryLimit - 1;

if (cursorId) {
  query = query.gt('id', cursorId);  // ✅ Cursor 필터링 (완료)
}

query = query
  .order('id', { ascending: true })
  .range(offset, rangeEnd);  // ❌ 하지만 range() 사용 (모순!)
```

#### 왜 문제인가?

1. `.gt('id', cursorId)`는 **이미 cursorId 이후의 레코드만 필터링**
2. `.range(0, queryLimit-1)`은 **필터링된 결과를 다시 0번째부터 가져옴**
3. 결과: **cursorId가 있든 없든 항상 같은 데이터 반환** → 다음 페이지 불가능

#### 실제 SQL 실행 예시

```sql
-- 현재 코드가 실행하는 SQL (cursorId=100일 때):
SELECT * FROM aed_data
WHERE id > 100        -- ✅ cursor 필터링은 적용됨
ORDER BY id
OFFSET 0 LIMIT 51;    -- ❌ 하지만 offset이 항상 0

-- 실제로 작동해야 하는 SQL:
SELECT * FROM aed_data
WHERE id > 100
ORDER BY id
LIMIT 51;             -- ✅ offset 없이 바로 limit
```

#### 영향

- ❌ **다음 페이지 이동 불가능**
- ❌ **1,000개 이상 조회 불가능** (항상 처음 100개만 반환)
- ⚠️ **성능 저하** (큰 offset 사용 시 PostgreSQL이 앞의 모든 행을 스캔)

---

### 📊 구축 완료 비율

| 구성 요소 | 상태 | 비율 | 작업 필요 |
|---------|------|------|---------|
| Cursor 인코딩/디코딩 | ✅ 완료 | 100% | 없음 |
| Cursor 파라미터 파싱 | ✅ 완료 | 100% | 없음 |
| Cursor 필터링 (gt) | ✅ 완료 | 100% | 없음 |
| NextCursor 생성 | ✅ 완료 | 100% | 없음 |
| Database Indexes | ✅ 완료 | 100% | 없음 |
| **Pagination 실행** | ❌ 버그 | **0%** | **range() → limit() 2줄 수정** |

**총 구축률**: **90%** (1개 버그 수정 시 → 100%)

---

## 🔍 현재 문제 분석

### 사용자 요구사항

> "전체 8만개를 한꺼번에 조회하는 방법이며, 속도가 느리지 않으면 가장 좋지만 그게 너무 심각한 로딩과 데이터베이스 부하를 초래한다면 최소 1천개 정도는 조회할 수 있는 시스템이 되어야 한다."
>
> "물론 1천개를 한눈에 볼 필요는 없다. 최소한 조회한 사용자가 특정 조건의 데이터가 몇개 존재하는지는 즉각적으로 알 수 있어야 한다."

### 현재 상태

#### 코드 구조 ([route.ts:174-178](../app/api/aed-data/route.ts#L174-L178))

```typescript
const requestedLimit = filters.limit ?? 30;
const maxLimit = Math.min(accessScope.permissions.maxResultLimit, 10000);
const pageSize = Math.min(Math.max(1, requestedLimit), maxLimit);
```

#### 기본 설정 ([aed-filters-store.ts:8](../lib/state/aed-filters-store.ts#L8))

```typescript
const DEFAULT_FILTERS: ParsedFilters = {
  page: 1,
  limit: 50,  // ← 현재 기본값
  cursor: undefined,
  queryCriteria: 'address',
};
```

### 문제점

1. ✅ **limit 50개**: 기본값이 너무 작음
2. ✅ **100개 증가 시**: 속도 저하 발생
3. ❌ **페이지 이동 불가**: 다음 페이지로 넘어가지 못함
4. ❌ **전체 개수 확인 어려움**: 필터링 결과가 몇 개인지 즉시 알기 어려움
5. ❌ **8만개 접근 불가**: 현실적으로 전체 데이터 탐색 어려움

---

## 📚 기존 문서 검토 및 통합

### 1. speedup_25.10.16.md

**주요 내용**:
- 5개 Phase 최적화 계획 (측정, 캐싱, API, 가상스크롤, 메모이제이션)
- 매우 상세한 가이드

**구현 현황**: **16%** 완료 (대부분 미구현)

**활용 가능**:
- ✅ 가상 스크롤 가이드 (react-window)
- ✅ 데이터베이스 인덱스 제안
- ✅ API 통합 아이디어

### 2. SPEEDUP_QUICK_FIX.md

**주요 내용**:
- 캐싱 설정 긴급 수정
- refetchOnWindowFocus 문제 해결

**구현 현황**: **일부 적용됨**

**활용 가능**:
- ✅ React Query 설정 권장사항
- ✅ 캐싱 전략 가이드

### 3. SPEEDUP_IMPLEMENTATION_AUDIT.md

**주요 내용**:
- 구현 현황 감사 보고서
- 미구현 항목 리스트

**활용 가능**:
- ✅ 구현 체크리스트
- ✅ 우선순위 가이드

---

## 🎯 최적화 방안 비교

### 방안 1: 가상 스크롤 + 무한 스크롤 ⭐ 추천

#### 장점
- ✅ 8만개 전체 데이터 접근 가능
- ✅ 메모리 효율적 (화면에 보이는 것만 렌더링)
- ✅ 사용자가 원하는 만큼 스크롤 가능
- ✅ 전체 개수 즉시 확인 가능
- ✅ 기존 react-window 패키지 설치됨

#### 단점
- ⚠️ 구현 복잡도 중간
- ⚠️ 체크박스 선택 상태 유지 주의 필요

#### 구현 방법

**1단계: 첫 로딩 (전체 카운트 + 첫 100개)**

```typescript
// API 응답
{
  data: [...100개],
  pagination: {
    total: 80000,
    hasMore: true,
    nextCursor: "eyJpZCI6MTAwfQ=="
  }
}
```

**2단계: 무한 스크롤 (다음 100개씩 추가)**

```typescript
const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ['aed-data', filters],
  queryFn: ({ pageParam = null }) =>
    fetch(`/api/aed-data?cursor=${pageParam}&limit=100`),
  getNextPageParam: (lastPage) => lastPage.pagination.nextCursor,
  initialPageParam: null,
});
```

**3단계: react-window로 가상 스크롤**

```typescript
import { FixedSizeList as List } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';

<InfiniteLoader
  isItemLoaded={index => index < items.length}
  itemCount={totalCount}
  loadMoreItems={fetchNextPage}
>
  {({ onItemsRendered, ref }) => (
    <List
      height={600}
      itemCount={items.length}
      itemSize={50}
      onItemsRendered={onItemsRendered}
      ref={ref}
    >
      {Row}
    </List>
  )}
</InfiniteLoader>
```

#### 예상 성능
- 첫 로딩: **0.5~1초** (100개 + 카운트)
- 스크롤: **0.2~0.5초** (100개 추가)
- 메모리: **120~200 DOM 노드** (화면에 보이는 것만)

---

### 방안 2: 서버 측 집계 + 클라이언트 캐싱

#### 장점
- ✅ 필터 변경 시 즉시 전체 개수 확인
- ✅ 데이터베이스 인덱스 최적화로 빠른 조회
- ✅ 1,000개 정도는 문제없이 조회 가능
- ✅ 기존 구조 유지

#### 단점
- ⚠️ 8만개 전체 접근은 여전히 어려움
- ⚠️ 인덱스 추가 필요

#### 구현 방법

**1단계: 데이터베이스 인덱스 추가**

```sql
-- 복합 인덱스로 필터링 성능 개선
CREATE INDEX IF NOT EXISTS idx_aed_data_sido_gugun
  ON aed_data(sido, gugun);

CREATE INDEX IF NOT EXISTS idx_aed_data_category
  ON aed_data(category_1, category_2)
  WHERE category_1 IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_aed_data_display
  ON aed_data(external_display)
  WHERE external_display = 'N';

-- 커서 페이지네이션용
CREATE INDEX IF NOT EXISTS idx_aed_data_id
  ON aed_data(id ASC);
```

**2단계: RPC 함수 최적화**

```sql
CREATE OR REPLACE FUNCTION get_aed_data_fast(
  p_region_codes text[],
  p_city_codes text[],
  p_limit int DEFAULT 1000,
  p_cursor bigint DEFAULT NULL
) RETURNS TABLE(...) AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM aed_data
  WHERE sido = ANY(p_region_codes)
    AND (p_city_codes IS NULL OR gugun = ANY(p_city_codes))
    AND (p_cursor IS NULL OR id > p_cursor)
  ORDER BY id ASC
  LIMIT p_limit + 1;
END;
$$ LANGUAGE plpgsql STABLE;
```

**3단계: React Query 캐싱**

```typescript
const { data } = useQuery({
  queryKey: ['aed-data', filters],
  staleTime: 5 * 60 * 1000, // 5분간 캐시 유지
});
```

#### 예상 성능
- 1,000개 조회: **1~2초**
- 필터링된 카운트: **0.5초**
- 동일 조건 재조회: **즉시** (캐시 사용)

---

### 방안 3: 하이브리드 접근 ⭐⭐ 최적 (선택)

**두 가지 방식을 조합:**

1. **목록 페이지 (방안 1)**
   - 가상 스크롤 + 무한 로딩
   - 한 번에 100~200개씩 로드
   - 전체 개수는 항상 표시

2. **필터링 시 (방안 2)**
   - 서버 측 집계로 즉시 카운트 표시
   - 인덱스 최적화로 빠른 조회
   - 결과가 많으면 다시 무한 스크롤

3. **엑셀 다운로드**
   - 백그라운드 작업으로 처리
   - 최대 10,000개 제한 (또는 스트리밍)

---

## ✅ 선택된 해결 방안

### **하이브리드 접근 (방안 3)** 선택

#### 이유

1. ✅ **사용자 요구사항 충족**
   - 전체 개수 즉시 확인 가능
   - 8만개 전체 접근 가능 (무한 스크롤)
   - 1,000개 조회도 빠름 (인덱스 최적화)

2. ✅ **현실적 구현**
   - 기존 코드 구조 유지
   - 단계별 적용 가능
   - 롤백 용이

3. ✅ **성능과 UX 균형**
   - 빠른 초기 로딩
   - 부드러운 스크롤
   - 즉시 카운트 확인

---

## 🗓️ 구현 로드맵

### ⚠️ 중요: 위험 요소 검토 필수

**구현 전 필독**: [PAGINATION_OPTIMIZATION_RISKS.md](./PAGINATION_OPTIMIZATION_RISKS.md)

---

### Phase 0: 긴급 버그 수정 (필수) ⏱️ 2시간

#### 0.1 커서 페이지네이션 버그 수정 (1시간)

**문제**: 현재 커서를 사용하지만 실제로는 offset 방식으로 작동하여 다음 페이지 이동 불가

**파일**: `app/api/aed-data/route.ts`

**Before (현재 - 버그)**:
```typescript
// ❌ 문제: cursorId가 있어도 range() 사용
const offset = cursorId ? 0 : (page - 1) * pageSize;
const rangeEnd = offset + queryLimit - 1;

// 커서 필터링 없음
query = query
  .order('id', { ascending: true })
  .range(offset, rangeEnd);  // offset 기반
```

**After (수정)**:
```typescript
// ✅ 커서 필터링 추가
if (cursorId) {
  query = query.gt('id', cursorId);
}

// ✅ range() 대신 limit() 사용
query = query
  .order('id', { ascending: true })
  .limit(queryLimit);
```

**예상 효과**:
- 다음 페이지 이동 작동
- 1000개 이상 조회 시 성능 **50% 개선** (offset 제거)

#### 0.2 limit 기본값 증가 (10분)

**파일**: [aed-filters-store.ts:8](../lib/state/aed-filters-store.ts#L8)

```typescript
// Before
const DEFAULT_FILTERS: ParsedFilters = {
  page: 1,
  limit: 50,  // ❌

// After
const DEFAULT_FILTERS: ParsedFilters = {
  page: 1,
  limit: 100,  // ✅ 50 → 100
```

#### 0.3 테스트 및 검증 (50분)

**테스트 항목**:
- [ ] 첫 페이지 로딩 (100개)
- [ ] 다음 페이지 이동 (커서 작동 확인)
- [ ] 이전 페이지 이동
- [ ] 필터 변경 시 1페이지로 초기화
- [ ] 성능 측정 (Before/After)

**롤백 계획**:
```bash
# 문제 발생 시
git checkout HEAD -- app/api/aed-data/route.ts
git checkout HEAD -- lib/state/aed-filters-store.ts
```

---

### Phase 1: 페이지 크기 선택 UI ⏱️ 1시간

#### 1.1 페이지 크기 선택 UI 추가 (30분)

**파일**: [components/Pagination.tsx](../components/Pagination.tsx)

```typescript
<select
  value={pageSize}
  onChange={(e) => onPageSizeChange(Number(e.target.value))}
  className="border rounded px-2 py-1"
>
  <option value={50}>50개씩</option>
  <option value={100}>100개씩</option>
  <option value={200}>200개씩</option>
  <option value={500}>500개씩</option>
</select>
```

#### 1.2 localStorage 저장 (20분)

**파일**: [app/aed-data/components/DataTable.tsx](../app/aed-data/components/DataTable.tsx)

```typescript
const handlePageSizeChange = useCallback((limit: number) => {
  setFilters({ ...filters, limit, page: 1 });

  // localStorage에 저장
  if (typeof window !== 'undefined') {
    localStorage.setItem('aed_page_size', String(limit));
  }
}, [filters, setFilters]);
```

#### 1.3 테스트 (10분)

- [ ] 페이지 크기 선택 작동
- [ ] localStorage 저장/복원
- [ ] 다양한 limit에서 성능 확인

**예상 효과**:
- 사용자가 50 / 100 / 200 / 500 선택 가능
- 설정 유지 (localStorage)

---

### 🔄 1주일 테스트 기간

**Phase 0+1 완료 후 필수**:
1. 사용자 피드백 수집
2. 성능 데이터 분석
3. 서버 부하 모니터링
4. **Phase 2 필요성 재평가**

**평가 기준**:
- Phase 0+1만으로 충분한가?
- 무한 스크롤이 정말 필요한가?
- 투자 대비 효과는? (20시간 vs 개선 효과)

---

### Phase 2: 무한 스크롤 (선택) ⏱️ 16~20시간

**⚠️ 경고**:
- 구현 복잡도 높음
- 모든 하위 컴포넌트 수정 필요
- 데이터 구조 변경으로 인한 버그 위험
- **Phase 0+1로 충분하다면 구현하지 않음**

#### 2.1 React Query로 무한 스크롤 구현 (4시간)

**파일**: [app/aed-data/components/AEDDataProvider.tsx](../app/aed-data/components/AEDDataProvider.tsx)

**Before (현재 - useQuery)**:
```typescript
const queryResult = useQuery<AEDDataResponse, Error>({
  queryKey,
  queryFn: () => fetcher(`/api/aed-data${queryString}`),
  placeholderData: keepPreviousData,
});
```

**After (무한 스크롤 - useInfiniteQuery)**:
```typescript
const queryResult = useInfiniteQuery<AEDDataResponse, Error>({
  queryKey,
  queryFn: ({ pageParam }) =>
    fetcher(`/api/aed-data${queryString}&cursor=${pageParam ?? ''}`),
  getNextPageParam: (lastPage) =>
    lastPage.pagination.hasMore ? lastPage.pagination.nextCursor : undefined,
  initialPageParam: null,
});

// 모든 페이지 데이터 flat
const data = queryResult.data?.pages.flatMap(page => page.data) ?? [];
```

#### 2.2 서버 측 카운트 최적화 (2시간)

**목표**: 필터 변경 시 전체 개수 즉시 표시

**파일**: [app/api/aed-data/route.ts](../app/api/aed-data/route.ts)

```typescript
// 카운트만 별도 쿼리 (빠름)
const { count } = await supabase
  .from('aed_data')
  .select('*', { count: 'exact', head: true })
  .in('sido', regionFilters)
  .in('gugun', cityFilters);

return NextResponse.json({
  data: trimmedData,
  pagination: {
    ...pagination,
    total: count, // ✅ 전체 개수
  }
});
```

#### 2.3 로딩 인디케이터 개선 (1시간)

**파일**: [app/aed-data/components/DataTable.tsx](../app/aed-data/components/DataTable.tsx)

```typescript
// 무한 스크롤 중 로딩
{isFetchingNextPage && (
  <div className="py-4 text-center">
    <Spinner />
    <p>다음 100개 로딩 중...</p>
  </div>
)}

// 스크롤 끝 감지
<div ref={loadMoreRef} className="h-4" />
```

#### 2.4 테스트 (1시간)

- ✅ 100개씩 로딩 확인
- ✅ 스크롤 시 자동 로딩
- ✅ 전체 개수 표시 확인
- ✅ 필터 변경 시 정상 작동

**예상 효과**:
- 8만개 전체 접근 가능
- 스크롤만 하면 계속 로딩
- 메모리 효율적

---

### Phase 3: 중기 고도화 (1주) ⏱️ 12시간

#### 3.1 react-window 가상 스크롤 적용 (6시간)

**목표**: 1,000개 이상 렌더링 시 성능 개선

**파일**: [app/aed-data/components/DataTable.tsx](../app/aed-data/components/DataTable.tsx)

**참고**: [tutorial2/components/VirtualizedDeviceList.tsx](../app/tutorial2/components/VirtualizedDeviceList.tsx) 재사용

```typescript
import { FixedSizeList as List } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';

<InfiniteLoader
  isItemLoaded={index => index < items.length}
  itemCount={totalCount}
  loadMoreItems={fetchNextPage}
>
  {({ onItemsRendered, ref }) => (
    <List
      height={600}
      itemCount={items.length}
      itemSize={50}
      onItemsRendered={onItemsRendered}
      ref={ref}
      width="100%"
    >
      {({ index, style }) => (
        <DesktopTableRow
          device={items[index]}
          style={style}
          {...props}
        />
      )}
    </List>
  )}
</InfiniteLoader>
```

#### 3.2 체크박스 선택 상태 유지 (3시간)

**문제**: 가상 스크롤 시 DOM에서 제거된 행의 선택 상태 유지 필요

**해결**:
```typescript
// 선택된 ID를 Set으로 관리 (현재 구조 유지)
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

// 렌더링 시 Set 확인
<Checkbox
  checked={selectedIds.has(device.id)}
  onCheckedChange={(checked) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      checked ? next.add(device.id) : next.delete(device.id);
      return next;
    });
  }}
/>
```

#### 3.3 성능 측정 및 최적화 (3시간)

**측정 항목**:
- 초기 렌더링 시간
- 스크롤 FPS
- 메모리 사용량
- API 호출 횟수

**도구**:
- Chrome DevTools Performance
- React DevTools Profiler

**예상 효과**:
- 초기 렌더링 **80% 단축**
- 스크롤 **60 FPS** 유지
- 메모리 **90% 감소**

---

### Phase 4: 선택적 개선 (필요 시)

#### 4.1 엑셀 다운로드 스트리밍 (6시간)

**현재 문제**: 10,000개 이상 다운로드 시 브라우저 멈춤

**해결**:
```typescript
// 스트리밍 API
app.get('/api/aed-data/export', async (req, res) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=aed_data.csv');

  const stream = supabase
    .from('aed_data')
    .select('*')
    .stream();

  for await (const chunk of stream) {
    res.write(formatCSV(chunk));
  }

  res.end();
});
```

#### 4.2 서버 측 페이지네이션 캐싱 (4시간)

**목표**: 동일 필터 재조회 시 즉시 응답

**방법**: Redis 또는 Supabase 세션 캐싱

---

## 📊 예상 효과

### 정량적 개선

| 항목 | Before | After Phase 0 | After Phase 1 | After Phase 2 | After Phase 3 |
|------|--------|--------------|--------------|--------------|--------------|
| **기본 조회 개수** | 50개 | 100개 | 100개 | 100개+ | 100개+ |
| **최대 조회 개수** | 100개 | 100개 | 500개 | 무제한 | 무제한 |
| **다음 페이지 이동** | ❌ 불가 | ✅ 작동 | ✅ 작동 | ✅ 작동 | ✅ 작동 |
| **전체 개수 확인** | 별도 쿼리 | 즉시 | 즉시 | 즉시 | 즉시 |
| **100개 조회 속도** | 3~5초 | **1~2초** | 1~2초 | 0.5~1초 | 0.5~1초 |
| **500개 조회 속도** | 불가능 | 불가능 | **3~5초** | 2~3초 | 1~2초 |
| **1,000개 조회 속도** | 불가능 | 불가능 | 선택 가능 | 3~5초 | 1~2초 |
| **8만개 접근** | 불가능 | 불가능 | 불가능 | 가능 (스크롤) | 가능 (빠름) |
| **구현 시간** | - | **2시간** | +1시간 | +20시간 | +12시간 |
| **구현 위험도** | - | **낮음** | 낮음 | **높음** | 중간 |

### 정성적 개선

#### 사용자 경험
- ✅ 원하는 개수만큼 조회 가능
- ✅ 전체 개수 즉시 확인
- ✅ 부드러운 스크롤 경험
- ✅ 페이지 크기 선택 가능

#### 개발자 경험
- ✅ 코드 복잡도 관리 가능
- ✅ 단계별 적용 가능
- ✅ 롤백 용이
- ✅ 측정 가능한 개선

---

## 🔄 기존 문서와의 관계

### speedup_25.10.16.md
- **활용**: 가상 스크롤 가이드, 데이터베이스 인덱스
- **차이**: 무한 스크롤 추가, 하이브리드 접근
- **상태**: 이 문서로 통합 및 업데이트

### SPEEDUP_QUICK_FIX.md
- **활용**: React Query 설정 권장사항
- **차이**: 없음 (독립적 적용)
- **상태**: 유지

### SPEEDUP_IMPLEMENTATION_AUDIT.md
- **활용**: 구현 체크리스트, 우선순위
- **차이**: 새로운 요구사항 반영
- **상태**: 이 문서와 함께 참조

---

## ✅ 실행 체크리스트

### Phase 0 (오늘 - 필수)

**실행 전**:
- [ ] 위험 요소 문서 읽기 완료
- [ ] 현재 페이지네이션 동작 스크린샷
- [ ] Git branch 생성: `fix/cursor-pagination`
- [ ] 성능 측정 (Before)

**구현**:
- [ ] 커서 필터링 코드 추가 (`gt('id', cursorId)`)
- [ ] range() → limit() 변경
- [ ] limit 기본값 100으로 증가
- [ ] 로컬 테스트 (다음 페이지 이동 확인)
- [ ] 성능 측정 (After)

**배포**:
- [ ] Git 커밋 및 푸시
- [ ] Vercel 배포
- [ ] 프로덕션 검증

### Phase 1 (Phase 0 완료 후)

- [ ] 페이지 크기 선택 UI 추가
- [ ] localStorage 저장/복원
- [ ] 다양한 limit 테스트 (50/100/200/500)

### 1주일 테스트 기간

- [ ] 사용자 피드백 수집
- [ ] 성능 데이터 분석
- [ ] **Phase 2 필요성 결정**

### Phase 2 (선택 - 필요 시에만)

- [ ] useInfiniteQuery 전환 계획 수립
- [ ] 하위 컴포넌트 영향 범위 분석
- [ ] 데이터 구조 변경 설계
- [ ] 단계별 구현 및 테스트

### Phase 3 (선택)

- [ ] 렌더링 병목 확인
- [ ] react-window 적용
- [ ] 체크박스 로직 수정
- [ ] 성능 측정

---

## 📞 문의 및 피드백

구현 중 문제 발생 시:
1. Chrome DevTools Console 확인
2. Network 탭에서 API 응답 확인
3. React Query DevTools로 캐시 상태 확인
4. 필요시 이전 버전으로 롤백

---

**작성자**: AEDpics 개발팀
**다음 단계**: Phase 1 즉시 실행
**예상 완료**: Phase 3까지 2주 이내
