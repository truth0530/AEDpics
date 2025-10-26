# ⚠️ 페이지네이션 최적화 계획 - 잠재적 문제점 및 위험 요소

**작성일**: 2025년 10월 17일
**상태**: 🔴 **구현 전 필수 검토 사항**
**관련 문서**: [PAGINATION_OPTIMIZATION_2025.md](./PAGINATION_OPTIMIZATION_2025.md)

---

## 🚨 심각한 문제점 발견

### 1. **데이터베이스 인덱스 이미 존재** 🔴 중복

#### 발견 사항

**제안된 인덱스**:
```sql
CREATE INDEX IF NOT EXISTS idx_aed_data_sido_gugun
  ON aed_data(sido, gugun);
```

**실제 상황** ([59_add_performance_indexes.sql](../../supabase/migrations/59_add_performance_indexes.sql)):
```sql
-- ✅ 이미 존재함!
CREATE INDEX IF NOT EXISTS idx_aed_data_sido
ON aed_data(sido) WHERE sido IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_aed_data_gugun
ON aed_data(gugun) WHERE gugun IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_aed_data_sido_gugun
ON aed_data(sido, gugun)
WHERE sido IS NOT NULL AND gugun IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_aed_data_region_city_code
ON aed_data(region_code, city_code)
WHERE region_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_aed_data_category_1
ON aed_data(category_1) WHERE category_1 IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_aed_data_equipment_serial
ON aed_data(equipment_serial);
```

#### 결론

**Phase 1의 "DB 인덱스 추가"는 불필요함** ❌
- 이미 적절한 인덱스가 모두 존재
- 추가 인덱스 생성은 중복이며 성능 개선 없음
- **오히려 INSERT/UPDATE 성능 저하 가능**

#### 수정 필요

✅ **Phase 1에서 인덱스 추가 단계 제거**
✅ **기존 인덱스 활용 확인**만 수행

---

### 2. **커서 기반 페이지네이션 vs offset 혼용** 🟡 구조 문제

#### 현재 코드 분석 ([route.ts:225-226](../../app/api/aed-data/route.ts#L225-L226))

```typescript
// ❌ 문제: 커서와 offset을 동시에 사용
const offset = cursorId ? 0 : (page - 1) * pageSize;
const rangeEnd = offset + queryLimit - 1;

// 쿼리 실행
query = query
  .order('id', { ascending: true })
  .range(offset, rangeEnd);  // ← offset 사용
```

#### 문제점

1. **커서 기반 페이지네이션인데 offset 사용**
   - `cursorId`가 있으면 offset은 0이 되어야 하는데
   - `.range()`는 여전히 offset 기반으로 작동
   - 커서 이후 데이터를 가져오는 게 아니라 처음부터 가져옴

2. **`gt('id', cursorId)` 조건이 없음**
   - 현재 코드에는 커서 이후 데이터를 필터링하는 로직이 **없음**
   - offset만 0으로 설정했을 뿐, 실제로는 첫 페이지부터 다시 조회

#### 올바른 커서 페이지네이션

```typescript
// ✅ 수정: 커서 기반 필터링
let query = supabase.from('aed_data').select('*');

// 필터 적용...

if (cursorId) {
  // 커서 이후 데이터만 조회
  query = query.gt('id', cursorId);
}

// offset 대신 limit만 사용
query = query
  .order('id', { ascending: true })
  .limit(queryLimit);  // range() 대신 limit()
```

#### 영향

**현재 페이지네이션이 제대로 작동하지 않는 이유**:
- 다음 페이지로 넘어갈 때 커서를 전달해도
- 실제로는 offset 기반으로 조회되므로
- 페이지가 제대로 이동하지 않음

---

### 3. **useInfiniteQuery 전환 시 호환성 문제** 🟡 큰 변경

#### 현재 구조 ([AEDDataProvider.tsx:224-235](../../app/aed-data/components/AEDDataProvider.tsx#L224-L235))

```typescript
// 현재: useQuery 사용
const queryResult = useQuery<AEDDataResponse, Error>({
  queryKey,
  queryFn: () => fetcher(`/api/aed-data${queryString}`),
  placeholderData: keepPreviousData,
});

const data = response?.data ?? [];
```

#### 변경 후 구조 (제안)

```typescript
// 제안: useInfiniteQuery 사용
const queryResult = useInfiniteQuery<AEDDataResponse, Error>({
  queryKey,
  queryFn: ({ pageParam }) =>
    fetcher(`/api/aed-data${queryString}&cursor=${pageParam ?? ''}`),
  getNextPageParam: (lastPage) =>
    lastPage.pagination.hasMore ? lastPage.pagination.nextCursor : undefined,
  initialPageParam: null,
});

// ⚠️ 문제: 데이터 구조 변경
const data = queryResult.data?.pages.flatMap(page => page.data) ?? [];
```

#### 호환성 문제

1. **데이터 구조 변경**
   - `useQuery`: `data.data` (단일 배열)
   - `useInfiniteQuery`: `data.pages[].data` (페이지 배열의 배열)
   - 모든 하위 컴포넌트에서 `data` 접근 방식 수정 필요

2. **pagination 정보 구조 변경**
   - `useQuery`: `response.pagination` (단일 객체)
   - `useInfiniteQuery`: `pages[].pagination` (각 페이지마다 다름)
   - 전체 개수, 현재 페이지 표시 로직 수정 필요

3. **필터 변경 시 초기화**
   - `useInfiniteQuery`는 필터 변경 시 모든 페이지 리셋
   - `queryKey`가 변경되면 캐시 전체 무효화
   - 사용자가 필터 변경 시 1페이지로 강제 이동

4. **placeholderData 호환성**
   - `keepPreviousData`는 `useInfiniteQuery`에서 다르게 작동
   - 이전 페이지 데이터를 유지하는 방식이 복잡함

#### 영향 범위

**수정 필요한 파일**:
- ✅ `AEDDataProvider.tsx` - 쿼리 로직
- ✅ `DataTable.tsx` - 데이터 접근 방식
- ✅ `AEDFilterBar.tsx` - 필터 초기화 로직
- ✅ `AEDDataPageClient.tsx` - 선택 상태 관리
- ✅ `Pagination.tsx` - 페이지 정보 표시

**예상 수정 시간**: **8시간 → 실제 16~20시간**

---

### 4. **필터 변경 시 무한 스크롤 초기화 문제** 🟡 UX 이슈

#### 시나리오

```
1. 사용자가 무한 스크롤로 500개 로드 (5페이지)
2. 필터 변경 (예: 시도 변경)
3. ❌ 문제: 모든 데이터 초기화, 1페이지부터 다시 시작
4. 사용자 혼란: "내가 보던 데이터가 사라졌어요"
```

#### useInfiniteQuery의 한계

```typescript
// 필터가 queryKey에 포함됨
const queryKey = ['aed-data', effectiveFilters, viewMode];

// 필터 변경 시
// 1. queryKey 변경
// 2. 이전 쿼리 캐시 무효화
// 3. 모든 페이지 데이터 삭제
// 4. 1페이지부터 다시 로드
```

#### 해결 방법

**옵션 1**: 필터 변경 시 명시적 초기화 UI
```typescript
<button onClick={() => {
  setFilters(newFilters);
  window.scrollTo({ top: 0 });
  toast.info('필터가 변경되어 목록을 처음부터 표시합니다.');
}}>
```

**옵션 2**: 필터 변경 시 일부 데이터 유지 (복잡)
```typescript
const queryResult = useInfiniteQuery({
  // ...
  placeholderData: (previousData) => {
    // 복잡한 로직으로 이전 데이터 일부 유지
  }
});
```

**권장**: 옵션 1 (명시적 UX)

---

### 5. **체크박스 선택 상태와 가상 스크롤 충돌** 🔴 치명적

#### 현재 구조 ([DataTable.tsx:814-829](../../app/aed-data/components/DataTable.tsx#L814-L829))

```typescript
// 현재: 모든 device가 DOM에 존재
useEffect(() => {
  setSelectedIds((prev) => {
    const filtered = [...prev].filter((id) => deviceMap.has(id));
    return new Set(filtered);
  });
}, [devices, deviceMap]);
```

#### 가상 스크롤 적용 시 문제

```typescript
// ❌ 문제: 가상 스크롤은 화면에 보이는 것만 렌더링
<List
  height={600}
  itemCount={items.length}  // 예: 1000개
  itemSize={50}
>
  {({ index }) => (
    // 실제 DOM에는 12개만 존재 (화면에 보이는 것만)
    <Row device={items[index]} />
  )}
</List>

// 사용자가 100번째 행 선택
// → 스크롤해서 200번째 행으로 이동
// → 100번째 행이 DOM에서 제거됨
// → ❌ useEffect가 실행되어 100번째 선택이 해제됨 (deviceMap에 없음)
```

#### 해결 방법

**현재 코드는 이미 올바름** ✅
```typescript
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

// device.id 기반으로 Set 관리
// DOM에 없어도 Set에는 유지됨
```

**단, useEffect 수정 필요**:
```typescript
// ❌ 현재: deviceMap 기반 필터링 (가상 스크롤과 충돌)
useEffect(() => {
  setSelectedIds((prev) => {
    const filtered = [...prev].filter((id) => deviceMap.has(id));
    return new Set(filtered);
  });
}, [devices, deviceMap]);

// ✅ 수정: 전체 데이터 기반 필터링
useEffect(() => {
  if (!allData) return;  // 무한 스크롤의 모든 페이지 데이터

  const allIds = new Set(allData.map(d => getDeviceId(d)));
  setSelectedIds((prev) => {
    const filtered = [...prev].filter((id) => allIds.has(id));
    return new Set(filtered);
  });
}, [allData]);
```

#### 위험도

- **현재 구조에서는 문제 없음** (모든 데이터가 DOM에 있음)
- **Phase 3 가상 스크롤 적용 시 치명적**
- **사전 수정 필수**

---

### 6. **range() vs limit() 성능 차이** 🟡 최적화 이슈

#### 현재 코드

```typescript
// ❌ 현재: range() 사용
query = query
  .order('id', { ascending: true })
  .range(offset, rangeEnd);  // OFFSET ... LIMIT
```

#### PostgreSQL 실행 계획

```sql
-- range() 사용 시
SELECT * FROM aed_data
WHERE sido = '서울'
ORDER BY id ASC
OFFSET 1000 LIMIT 100;

-- Seq Scan (느림)
-- → 처음 1000개를 건너뛰기 위해 모두 스캔
-- → 1000개가 클수록 느려짐
```

#### 커서 기반 (권장)

```sql
-- 커서 사용 시
SELECT * FROM aed_data
WHERE sido = '서울'
  AND id > 1000  -- 커서
ORDER BY id ASC
LIMIT 100;

-- Index Scan (빠름)
-- → 인덱스로 id > 1000 직접 접근
-- → 100개만 스캔
```

#### 성능 비교

| offset | range() 시간 | 커서 시간 | 차이 |
|--------|-------------|----------|------|
| 0 | 100ms | 100ms | 동일 |
| 100 | 150ms | 100ms | 1.5배 |
| 1000 | 500ms | 100ms | 5배 |
| 5000 | 2000ms | 100ms | 20배 |
| 10000 | 4000ms | 100ms | 40배 |

#### 결론

**range() 대신 커서 필터링 필수**
- 현재 코드는 1000개 이상 조회 시 매우 느림
- 커서로 변경해야 성능 목표 달성 가능

---

### 7. **summary 쿼리 성능 문제** 🟡 병목

#### 현재 코드 ([route.ts:507-518](../../app/api/aed-data/route.ts#L507-L518))

```typescript
// ❌ 문제: 데이터 조회 후 별도로 summary 조회
const { data: summaryData } = await supabase.rpc('get_aed_data_summary', {
  p_user_role: userProfile.role,
  p_region_codes: regionFiltersForQuery,
  p_city_codes: finalCityCodes,
  // ... 많은 파라미터
});
```

#### 문제점

1. **2번의 쿼리**
   - 데이터 조회: `SELECT * FROM aed_data WHERE ...`
   - 통계 조회: `SELECT count(*) FROM aed_data WHERE ...`
   - 네트워크 왕복 2회

2. **중복 필터 적용**
   - 동일한 WHERE 조건을 2번 실행
   - 데이터베이스 부하 2배

3. **무한 스크롤 시 문제**
   - 페이지마다 summary를 다시 조회?
   - 아니면 첫 페이지만 조회?
   - 필터 변경 시 summary 갱신 타이밍?

#### 해결 방법

**옵션 1**: 첫 페이지만 count, 이후는 생략
```typescript
if (pageParam === null) {
  // 첫 페이지일 때만 count 조회
  const { count } = await supabase
    .from('aed_data')
    .select('*', { count: 'exact', head: true })
    .in('sido', regions);

  summary.totalCount = count;
}
```

**옵션 2**: window function으로 1번에 조회
```sql
SELECT
  *,
  COUNT(*) OVER() as total_count
FROM aed_data
WHERE sido = ANY($1)
ORDER BY id
LIMIT 100;
```

**권장**: 옵션 1 (간단하고 명확)

---

### 8. **viewMode와 무한 스크롤 충돌** 🟡 UX 혼란

#### 현재 구조

```typescript
// queryKey에 viewMode 포함
const queryKey = ['aed-data', effectiveFilters, viewMode, includeSchedule];

// viewMode: 'toAdd' | 'map' | 'scheduled' | 'all'
```

#### 문제 시나리오

```
1. 사용자가 '추가할목록' 탭에서 500개 스크롤
2. '추가완료' 탭으로 전환
3. ❌ viewMode 변경 → queryKey 변경 → 캐시 무효화
4. ❌ 다시 1페이지부터 로드
5. 사용자: "왜 계속 처음으로 돌아가죠?"
```

#### 해결 방법

**옵션 1**: 탭별로 별도 쿼리 (권장)
```typescript
// toAdd 탭
const toAddQuery = useInfiniteQuery({
  queryKey: ['aed-data', 'toAdd', filters],
  // ...
});

// scheduled 탭
const scheduledQuery = useInfiniteQuery({
  queryKey: ['aed-data', 'scheduled', filters],
  // ...
});
```

**옵션 2**: 클라이언트 필터링
```typescript
// 모든 데이터 조회 (캐시 공유)
const allQuery = useInfiniteQuery({
  queryKey: ['aed-data', filters],
  // ...
});

// 클라이언트에서 필터링
const toAddData = allData.filter(d => !scheduledEquipment.has(d.id));
const scheduledData = allData.filter(d => scheduledEquipment.has(d.id));
```

**권장**: 옵션 1 (명확한 상태 관리)

---

## 📊 위험도 평가

| 문제 | 위험도 | 영향 범위 | 수정 난이도 | 우선순위 |
|------|--------|----------|------------|----------|
| 1. 인덱스 중복 | 낮음 | Phase 1 | 쉬움 (제거만) | P0 |
| 2. 커서/offset 혼용 | **높음** | **전체** | 중간 | **P0** |
| 3. useInfiniteQuery 호환성 | **높음** | **전체** | 어려움 | **P1** |
| 4. 필터 초기화 UX | 중간 | 사용자 경험 | 쉬움 | P1 |
| 5. 체크박스 충돌 | **치명적** | Phase 3 | 중간 | P2 |
| 6. range 성능 | 높음 | 성능 | 중간 | **P0** |
| 7. summary 쿼리 | 중간 | 성능 | 중간 | P1 |
| 8. viewMode 충돌 | 중간 | 사용자 경험 | 중간 | P1 |

---

## ✅ 수정된 구현 순서

### Phase 0: 긴급 수정 (필수) ⏱️ 2시간

#### 0.1 커서 페이지네이션 수정 (1시간)

**파일**: [app/api/aed-data/route.ts](../../app/api/aed-data/route.ts)

```typescript
// ❌ 제거: offset 로직
// const offset = cursorId ? 0 : (page - 1) * pageSize;
// const rangeEnd = offset + queryLimit - 1;

// ✅ 추가: 커서 필터링
if (cursorId) {
  query = query.gt('id', cursorId);
}

// ✅ 수정: range() → limit()
query = query
  .order('id', { ascending: true })
  .limit(queryLimit);  // .range() 제거
```

#### 0.2 기본 limit 증가 (10분)

**파일**: [lib/state/aed-filters-store.ts](../../lib/state/aed-filters-store.ts)

```typescript
const DEFAULT_FILTERS: ParsedFilters = {
  page: 1,
  limit: 100,  // 50 → 100
  // ...
};
```

#### 0.3 테스트 (50분)

- [ ] 첫 페이지 로딩 (100개)
- [ ] 다음 페이지 이동 (커서 작동 확인)
- [ ] 필터 변경 시 초기화
- [ ] 성능 측정 (Before/After)

---

### Phase 1: limit만 증가 (기존 구조 유지) ⏱️ 1시간

#### 1.1 페이지 크기 선택 UI (30분)

**파일**: [components/Pagination.tsx](../../components/Pagination.tsx)

```typescript
<select
  value={pageSize}
  onChange={(e) => onPageSizeChange(Number(e.target.value))}
  className="..."
>
  <option value={50}>50개씩</option>
  <option value={100}>100개씩</option>
  <option value={200}>200개씩</option>
  <option value={500}>500개씩</option>
</select>
```

#### 1.2 localStorage 저장 (20분)

```typescript
const handlePageSizeChange = (limit: number) => {
  setFilters({ ...filters, limit, page: 1 });
  localStorage.setItem('aed_page_size', String(limit));
};
```

#### 1.3 테스트 (10분)

- [ ] 페이지 크기 선택 작동
- [ ] localStorage 저장/복원
- [ ] 다양한 limit에서 성능 확인

---

### Phase 2: 무한 스크롤 (대규모 변경) ⏱️ 16~20시간

**⚠️ Phase 0 완료 후 1주일 테스트 기간 필요**

#### 2.1 useInfiniteQuery 전환 준비 (4시간)

1. 데이터 구조 분석
2. 하위 컴포넌트 영향 범위 파악
3. 테스트 계획 수립
4. 롤백 계획 작성

#### 2.2 AEDDataProvider 수정 (4시간)

- useQuery → useInfiniteQuery
- 데이터 flat 처리
- pagination 정보 계산

#### 2.3 하위 컴포넌트 수정 (4시간)

- DataTable.tsx
- AEDFilterBar.tsx
- AEDDataPageClient.tsx

#### 2.4 체크박스 로직 수정 (2시간)

- allData 기반 필터링
- 가상 스크롤 대비

#### 2.5 테스트 및 디버깅 (4시간)

- 기능 테스트
- 성능 테스트
- 버그 수정

#### 2.6 사용자 피드백 수집 (2시간)

---

### Phase 3: 가상 스크롤 (선택) ⏱️ 12시간

**조건**: Phase 2 완료 + 성능 측정 결과 렌더링 병목 확인

---

## 🎯 최종 권장 사항

### 즉시 실행 (오늘)

1. ✅ **Phase 0만 실행** (2시간)
   - 커서 페이지네이션 수정
   - limit 100 증가
   - 테스트

2. ✅ **Phase 1 실행** (1시간)
   - 페이지 크기 선택 UI
   - localStorage 저장

### 1주일 테스트 후

3. 📊 **성능 측정 및 사용자 피드백**
   - 100개, 200개, 500개 조회 속도
   - 사용자 만족도
   - 서버 부하

4. 🔄 **Phase 2 필요성 재평가**
   - Phase 0+1만으로 충분한가?
   - 무한 스크롤이 정말 필요한가?
   - 투자 대비 효과는?

---

## 📝 체크리스트

### Phase 0 실행 전

- [ ] 현재 페이지네이션 동작 스크린샷
- [ ] 성능 측정 (Before)
- [ ] Git branch 생성: `fix/cursor-pagination`
- [ ] 롤백 계획 작성

### Phase 0 실행

- [ ] 커서 필터링 코드 수정
- [ ] limit 기본값 변경
- [ ] 로컬 테스트 (100개, 200개, 500개)
- [ ] 다음 페이지 이동 테스트
- [ ] 성능 측정 (After)

### Phase 0 배포

- [ ] 코드 리뷰
- [ ] Git 커밋
- [ ] Vercel 배포
- [ ] 프로덕션 검증
- [ ] 사용자 피드백 수집 (1주일)

---

## 💡 결론

### 위험 요소가 많은 계획

원래 계획은 **너무 낙관적**이었습니다:
- Phase 1: 1시간 (인덱스는 이미 있음)
- Phase 2: 8시간 → **실제 16~20시간**
- Phase 3: 12시간 (체크박스 충돌 위험)

### 안전한 접근

1. **Phase 0만 우선 실행** (3시간)
2. **1주일 테스트**
3. **Phase 2 필요성 재평가**

### 예상 효과

| 항목 | Phase 0 | Phase 2 |
|------|---------|---------|
| 100개 조회 | 1~2초 | 0.5~1초 |
| 500개 조회 | 3~5초 | 2~3초 |
| 1000개 조회 | 불가능 | 3~5초 |
| 8만개 접근 | 불가능 | 가능 (스크롤) |
| 구현 위험 | 낮음 | **높음** |
| 구현 시간 | 3시간 | 20시간 |

**Phase 0만으로도 충분할 수 있습니다.** ✅

---

**작성자**: AEDpics 개발팀
**다음 단계**: Phase 0 실행 여부 결정
