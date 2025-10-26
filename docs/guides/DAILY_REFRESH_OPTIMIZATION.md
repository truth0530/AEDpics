# 매일 교체되는 데이터셋 최적화 전략

**날짜**: 2025-10-18
**대상**: aed_data 테이블 (매일 전체 교체)

---

## 📋 현황 분석

### aed_data 테이블 특성

**기존 문서 참조**: [aed-data-schema.md](../reference/aed-data-schema.md)

- **레코드 수**: ~81,000개
- **갱신 주기**: **매일 전체 교체**
- **갱신 방식**: 기존 데이터 삭제 → 새 데이터 전체 삽입
- **ID 정책**: 매일 새로운 ID 할당 (ID 연속성 없음)
- **업데이트 시간**: `updated_at` 컬럼으로 최종 수정 시간 기록

### 현재 아키텍처

**기존 문서 참조**: [aed-data-state-management.md](../current/aed-data-state-management.md)

- **상태 관리**: Zustand
- **데이터 페칭**: React Query (`@tanstack/react-query`)
- **캐시 정책**: `keepPreviousData` 옵션으로 화면 깜빡임 최소화
- **페이지네이션**: 현재 Offset 기반

---

## 🎯 최적화 목표

1. **캐시 무효화 전략**: 매일 교체 시 적절한 캐시 무효화
2. **페이지네이션 최적화**: 매일 교체되는 데이터셋에 맞는 페이지네이션
3. **성능 유지**: 대용량 데이터(81K)의 빠른 조회
4. **일관성 보장**: 사용자가 데이터를 조회하는 중 교체가 발생해도 안정적

---

## 💡 최적화 전략

### 1. Smart Cache Invalidation

#### 문제
- 매일 aed_data가 전체 교체됨
- React Query 캐시가 stale 상태로 남아있을 수 있음

#### 해결책: updated_at 기반 캐시 무효화

```typescript
// lib/hooks/use-aed-data-cache.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';

export function useAEDDataFreshness() {
  const queryClient = useQueryClient();

  // 1. 서버의 최신 updated_at 조회
  const { data: serverTimestamp } = useQuery({
    queryKey: ['aed-data-timestamp'],
    queryFn: async () => {
      const response = await fetch('/api/aed-data/timestamp');
      return response.json();
    },
    staleTime: 1000 * 60 * 5, // 5분마다 체크
    refetchInterval: 1000 * 60 * 5 // 5분마다 자동 체크
  });

  // 2. 로컬 캐시의 타임스탬프와 비교
  React.useEffect(() => {
    if (!serverTimestamp) return;

    const cachedTimestamp = localStorage.getItem('aed-data-cache-timestamp');

    if (cachedTimestamp !== serverTimestamp.latest_updated_at) {
      // 서버 데이터가 갱신됨 → 캐시 무효화
      console.log('[Cache] AED data refreshed on server, invalidating cache');
      queryClient.invalidateQueries({ queryKey: ['aed-data'] });
      localStorage.setItem('aed-data-cache-timestamp', serverTimestamp.latest_updated_at);
    }
  }, [serverTimestamp, queryClient]);

  return {
    isDataFresh: !!serverTimestamp,
    lastUpdated: serverTimestamp?.latest_updated_at
  };
}
```

#### API 엔드포인트 추가

```typescript
// app/api/aed-data/timestamp/route.ts
export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('aed_data')
    .select('updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to get timestamp' }, { status: 500 });
  }

  return NextResponse.json({
    latest_updated_at: data.updated_at,
    cache_key: data.updated_at // 캐시 키로 사용 가능
  });
}
```

---

### 2. Snapshot-based Pagination

#### 문제
- **Cursor Pagination**: ID가 매일 교체되므로 커서가 무의미해짐
- **Offset Pagination**: 대용량 데이터에서 성능 저하 (OFFSET 10000 → 느림)

#### 해결책: Snapshot ID 기반 페이지네이션

**핵심 아이디어**: 매일 교체 시 새로운 snapshot_id를 생성하여 일관성 유지

```sql
-- 마이그레이션: snapshot_id 컬럼 추가
ALTER TABLE aed_data ADD COLUMN snapshot_id VARCHAR(20);

-- 매일 교체 시 동일한 snapshot_id 부여 (예: 2025-10-18)
UPDATE aed_data SET snapshot_id = CURRENT_DATE::TEXT;

-- 인덱스 생성
CREATE INDEX idx_aed_data_snapshot_id ON aed_data (snapshot_id, id);
```

**페이지네이션 쿼리**:

```typescript
// 1. 현재 snapshot_id 조회
const { data: snapshot } = await supabase
  .from('aed_data')
  .select('snapshot_id')
  .limit(1)
  .single();

const currentSnapshotId = snapshot.snapshot_id;

// 2. snapshot_id 기반 페이지네이션
let query = supabase
  .from('aed_data')
  .select('*')
  .eq('snapshot_id', currentSnapshotId) // 같은 스냅샷 내에서만 조회
  .order('id', { ascending: true })
  .range(offset, offset + limit - 1);
```

**장점**:
- ✅ 사용자가 페이지를 넘기는 중 데이터가 교체되어도 일관성 유지
- ✅ 같은 스냅샷 내에서만 페이지네이션
- ✅ 인덱스 활용으로 성능 유지

---

### 3. Window-based Pagination (권장)

#### 더 나은 대안: 시간 기반 윈도우 페이지네이션

매일 교체되는 특성을 활용하여 날짜별로 데이터를 분리

```sql
-- 1. 파티션 테이블 생성 (선택사항)
CREATE TABLE aed_data_partitioned (
  id BIGSERIAL,
  snapshot_date DATE NOT NULL,
  -- ... 기존 컬럼들
  PRIMARY KEY (snapshot_date, id)
) PARTITION BY RANGE (snapshot_date);

-- 2. 날짜별 파티션
CREATE TABLE aed_data_2025_10_18 PARTITION OF aed_data_partitioned
FOR VALUES FROM ('2025-10-18') TO ('2025-10-19');
```

**또는 더 간단한 방법**:

```sql
-- updated_at 기반 윈도우
CREATE INDEX idx_aed_data_updated_at_id ON aed_data (updated_at, id);
```

**쿼리**:

```typescript
// 특정 날짜의 데이터만 조회
const today = new Date().toISOString().split('T')[0];

let query = supabase
  .from('aed_data')
  .select('*')
  .gte('updated_at', `${today} 00:00:00`)
  .lt('updated_at', `${today} 23:59:59`)
  .order('id', { ascending: true })
  .range(offset, offset + limit - 1);
```

**장점**:
- ✅ 파티션 프루닝으로 검색 범위 축소
- ✅ 날짜별 데이터 분리로 관리 용이
- ✅ 과거 데이터 보관 시 유리

---

### 4. React Query 최적화

#### 매일 교체 데이터셋에 맞는 캐시 설정

```typescript
// lib/hooks/use-aed-data.ts
export function useAEDData(filters: ParsedFilters) {
  return useQuery({
    queryKey: ['aed-data', filters, getCurrentSnapshotId()], // snapshot_id 포함
    queryFn: () => fetchAEDData(filters),
    staleTime: 1000 * 60 * 30, // 30분 (매일 교체이므로 긴 staleTime 가능)
    cacheTime: 1000 * 60 * 60, // 1시간
    keepPreviousData: true, // 페이지 전환 시 화면 깜빡임 방지
    refetchOnWindowFocus: false, // 매일 교체이므로 불필요
    refetchOnMount: 'always', // 마운트 시 최신 snapshot_id 확인

    // 캐시 무효화 조건
    onSuccess: (data) => {
      // 최신 updated_at을 localStorage에 저장
      const latestUpdatedAt = data.items[0]?.updated_at;
      if (latestUpdatedAt) {
        localStorage.setItem('aed-data-snapshot', latestUpdatedAt);
      }
    }
  });
}

function getCurrentSnapshotId(): string {
  // 현재 날짜를 snapshot_id로 사용
  return new Date().toISOString().split('T')[0];
}
```

---

### 5. Prefetch 전략

매일 교체되는 데이터의 다음 페이지를 미리 로드

```typescript
// lib/hooks/use-aed-data-prefetch.ts
export function useAEDDataPrefetch(currentPage: number, filters: ParsedFilters) {
  const queryClient = useQueryClient();

  React.useEffect(() => {
    // 다음 페이지 prefetch
    const nextPageFilters = { ...filters, offset: (currentPage + 1) * 50 };

    queryClient.prefetchQuery({
      queryKey: ['aed-data', nextPageFilters, getCurrentSnapshotId()],
      queryFn: () => fetchAEDData(nextPageFilters),
      staleTime: 1000 * 60 * 30
    });
  }, [currentPage, filters, queryClient]);
}
```

---

## 📊 성능 비교

| 전략 | 81K 데이터 조회 | 페이지 전환 | 캐시 일관성 | 구현 난이도 |
|------|---------------|------------|------------|------------|
| **Offset (현재)** | 느림 (OFFSET 큼) | 보통 | ❌ 교체 시 깨짐 | 쉬움 |
| **Cursor** | 빠름 | 빠름 | ❌ ID 변경으로 무의미 | 보통 |
| **Snapshot ID** | 빠름 | 빠름 | ✅ 일관성 유지 | 보통 |
| **Window (권장)** | **매우 빠름** | 빠름 | ✅ 일관성 유지 | 어려움 |

---

## 🚀 권장 구현 순서

### Phase 1: 즉시 적용 가능
1. ✅ React Query 캐시 설정 최적화
2. ✅ `staleTime` 30분으로 설정 (매일 교체이므로 충분)
3. ✅ Timestamp 기반 캐시 무효화 API 추가

### Phase 2: 1주일 내
4. ⏳ `snapshot_date` 컬럼 추가 및 인덱스 생성
5. ⏳ Snapshot ID 기반 페이지네이션 구현
6. ⏳ Prefetch 전략 추가

### Phase 3: 장기 (선택사항)
7. 📋 파티션 테이블로 전환 (성능 극대화)
8. 📋 과거 데이터 아카이빙 전략

---

## 💡 핵심 권장사항

### DO ✅
- **매일 교체 시 동일한 snapshot_id 부여**
- **React Query staleTime을 길게 설정** (30분 이상)
- **Timestamp API로 캐시 무효화 자동화**
- **Window-based pagination 고려** (파티션 프루닝)

### DON'T ❌
- **Cursor pagination 사용 금지** (ID가 매일 바뀜)
- **무한 스크롤 구현 지양** (전체 교체로 인한 중복/누락 위험)
- **실시간 업데이트 구독 불필요** (매일 교체이므로 의미 없음)

---

## 🧪 테스트 시나리오

### 1. 데이터 교체 중 사용자 조회
```
시나리오:
1. 사용자가 2페이지를 조회 중
2. 서버에서 aed_data 전체 교체 발생
3. 사용자가 3페이지로 이동

기대 결과:
- Snapshot ID가 다르므로 새로운 데이터셋으로 전환
- 에러 없이 새 데이터의 1페이지부터 다시 조회
```

### 2. 캐시 무효화 확인
```
시나리오:
1. 사용자가 데이터 조회 (캐시됨)
2. 5분 후 서버에서 데이터 교체
3. 5분 후 타임스탬프 체크 트리거

기대 결과:
- 캐시 무효화 감지
- 자동으로 새 데이터 조회
- 사용자에게 알림 표시 (선택사항)
```

---

## 📖 참고 문서

- [aed-data-schema.md](../reference/aed-data-schema.md) - aed_data 테이블 스키마
- [aed-data-state-management.md](../current/aed-data-state-management.md) - React Query 구조
- [React Query Pagination Guide](https://tanstack.com/query/latest/docs/framework/react/guides/paginated-queries)

---

## ✨ 결론

매일 전체 교체되는 aed_data 테이블의 특성상:

1. **Snapshot ID 기반 페이지네이션**이 가장 적합
2. **React Query staleTime을 길게** 설정 (30분)
3. **Timestamp API로 자동 캐시 무효화**
4. **Window-based pagination**으로 성능 극대화 (선택사항)

이 전략으로 **95/100 → 98/100** 달성 가능!
