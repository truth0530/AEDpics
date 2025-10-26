# 진보적 개선사항 제안

**일자**: 2025-10-18
**대상**: 일정 추가 및 검점 점검 플로우
**현재 점수**: 70/100 → **목표 점수**: 90/100

---

## 🎯 개선 완료 사항 (2025-10-18)

### 1. ✅ Inspection Mode 메모리 필터링 퇴보 복구

**문제**: DB-side join 후 모든 필터를 JavaScript 메모리에서 처리하여 성능 개선 목적 상실

**해결책**: 모든 단순 필터를 DB 레벨로 이동
- `sido`, `gugun` 지역 필터 → `query.in('aed_data.sido', ...)`
- `category_1`, `category_2`, `category_3` → DB 레벨 필터링
- `operation_status` → DB 레벨 필터링
- `external_display` (Y/N) → DB 레벨 필터링
- `search` (검색어) → `query.or()` with `ilike` 사용

**메모리 필터링 유지**: 복잡한 로직만 메모리에서 처리
- `external_display: 'blocked'` (복잡한 조건식)
- 날짜 필터 (battery_expiry_date, patch_expiry_date 등)

**성능 개선 효과**:
- BEFORE: 1000+ 레코드 fetch → 10-50개로 메모리 필터링
- AFTER: DB 레벨 필터링으로 10-50개만 fetch

**파일**: `app/api/aed-data/route.ts:266-302`

---

### 2. ✅ Bulk Insert 트랜잭션 보장

**문제**: 병렬 청크 삽입으로 부분 성공 가능성 존재 (500개 성공, 500개 실패)

**해결책**: PostgreSQL RPC 함수로 원자적 트랜잭션 처리

**마이그레이션**: `supabase/migrations/20251018_bulk_create_assignments.sql`

```sql
CREATE OR REPLACE FUNCTION bulk_create_assignments(
  p_equipment_serials TEXT[],
  p_assigned_to UUID,
  p_assigned_by UUID,
  ...
) RETURNS JSON
```

**특징**:
- 원자적 트랜잭션: All-or-nothing 보장
- DB 레벨 중복 체크: `ON CONFLICT DO NOTHING`
- 단일 네트워크 왕복: N번 → 1번 요청
- 자세한 통계 반환: `{created, skipped, total}`

**성능 개선**:
- BEFORE: 1000개 장비 → 20번 청크 요청 (50개씩)
- AFTER: 1000개 장비 → 1번 RPC 요청

**파일**: `app/api/inspections/assignments/route.ts:79-124`

---

### 3. ✅ 프로덕션 로깅 최적화

**문제**: 모든 요청마다 디버그 로그 출력

**해결책**: 환경 변수 기반 로깅 가드

```typescript
if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
  console.log('[inspection mode] Querying with DB-side join');
}
```

**적용 위치**:
- `app/api/aed-data/route.ts:249, 317, 324`

**프로덕션 설정**:
```bash
NEXT_PUBLIC_DEBUG=false  # 프로덕션
NEXT_PUBLIC_DEBUG=true   # 개발/디버깅
```

---

## 🚀 추가 진보적 개선 제안

### 4. 📊 페이지네이션 표준화 및 성능 개선

**현재 문제**:
- Cursor 페이지네이션과 Offset 페이지네이션 혼용
- Priority API에 페이지네이션 미적용
- Assignments API에 페이지네이션 미적용

**제안 1: Cursor 페이지네이션 표준화**

**장점**:
- 대규모 데이터셋에서 성능 우수 (OFFSET 스캔 불필요)
- 실시간 데이터 변경에 안정적
- 인덱스 활용 최적화

**구현**:

```typescript
// Priority API 페이지네이션 추가
export async function GET(request: NextRequest) {
  const searchParams = request.URL.searchParams;
  const cursorId = searchParams.get('cursor');
  const limit = parseInt(searchParams.get('limit') || '50');

  let query = supabase
    .from('inspection_assignments')
    .select('*')
    .in('status', ['pending', 'in_progress'])
    .order('id', { ascending: true })
    .limit(limit);

  if (cursorId) {
    query = query.gt('id', cursorId);
  }

  const { data, error } = await query;

  return NextResponse.json({
    data,
    pagination: {
      nextCursor: data.length === limit ? data[data.length - 1].id : null,
      hasMore: data.length === limit
    }
  });
}
```

**제안 2: Keyset 페이지네이션 (날짜 기반)**

검점 일정은 주로 날짜순으로 정렬하므로 날짜 기반 keyset 페이지네이션 고려:

```typescript
// 날짜 + ID 복합 커서
const cursor = {
  scheduled_date: '2025-10-18',
  id: 12345
};

query = query
  .or(`scheduled_date.gt.${cursor.scheduled_date},and(scheduled_date.eq.${cursor.scheduled_date},id.gt.${cursor.id})`)
  .order('scheduled_date', { ascending: true })
  .order('id', { ascending: true });
```

**예상 효과**:
- 10만개 데이터에서 OFFSET 10000 → 50ms 에서 5ms로 개선
- 무한 스크롤 구현 시 안정적

---

### 5. 🔍 Inspection Mode 날짜 필터 DB 레벨 이동

**현재**: 배터리/패치 만료일 필터를 메모리에서 처리

**문제**:
- 1000개 fetch → 100개로 필터링
- 복잡한 조건이지만 SQL로 표현 가능

**개선안**:

```sql
-- PostgreSQL RPC 함수로 복잡한 날짜 필터 처리
CREATE OR REPLACE FUNCTION filter_by_expiry(
  p_date_field TEXT,
  p_filter_type TEXT,  -- 'expired', 'expiring_soon', 'normal'
  p_today DATE
) RETURNS BOOLEAN AS $$
BEGIN
  CASE p_filter_type
    WHEN 'expired' THEN
      RETURN p_date_field < p_today;
    WHEN 'expiring_soon' THEN
      RETURN p_date_field >= p_today AND p_date_field <= p_today + INTERVAL '30 days';
    WHEN 'normal' THEN
      RETURN p_date_field > p_today + INTERVAL '30 days';
    ELSE
      RETURN TRUE;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

**쿼리 적용**:

```typescript
// DB 레벨 날짜 필터
if (filters.battery_expiry_date === 'expired') {
  query = query.lt('aed_data.battery_expiry_date', today);
} else if (filters.battery_expiry_date === 'expiring_soon') {
  query = query.gte('aed_data.battery_expiry_date', today)
               .lte('aed_data.battery_expiry_date', thirtyDaysLater);
}
```

**예상 효과**:
- 네트워크 전송량 90% 감소 (1000개 → 100개)
- 메모리 사용량 감소

---

### 6. 📈 인덱스 최적화

**현재 상태 확인 필요**:
```sql
-- 현재 인덱스 확인
SELECT * FROM pg_indexes WHERE tablename IN ('inspection_assignments', 'aed_data');
```

**제안 인덱스**:

```sql
-- 1. Inspection 모드 조회 최적화
CREATE INDEX CONCURRENTLY idx_assignments_user_status_id
ON inspection_assignments (assigned_to, status, id)
WHERE status IN ('pending', 'in_progress');

-- 2. Equipment join 최적화
CREATE INDEX CONCURRENTLY idx_aed_data_serial
ON aed_data (equipment_serial);

-- 3. 복합 필터 최적화 (sido + gugun)
CREATE INDEX CONCURRENTLY idx_aed_data_region
ON aed_data (sido, gugun)
INCLUDE (category_1, category_2, operation_status);

-- 4. 날짜 필터 최적화
CREATE INDEX CONCURRENTLY idx_aed_data_expiry_dates
ON aed_data (battery_expiry_date, patch_expiry_date)
WHERE battery_expiry_date IS NOT NULL OR patch_expiry_date IS NOT NULL;

-- 5. 검색 최적화 (GIN index for full-text search)
CREATE INDEX CONCURRENTLY idx_aed_data_search
ON aed_data USING gin(
  to_tsvector('simple',
    COALESCE(management_number, '') || ' ' ||
    COALESCE(equipment_serial, '') || ' ' ||
    COALESCE(installation_institution, '') || ' ' ||
    COALESCE(installation_address, '')
  )
);
```

**주의사항**:
- `CONCURRENTLY` 사용으로 서비스 중단 없이 인덱스 생성
- 프로덕션 적용 전 스테이징에서 성능 테스트 필수
- 인덱스 크기 모니터링 (대용량 테이블 시 주의)

**예상 효과**:
- 조회 성능 5-10배 개선
- Inspection mode 초기 로딩 시간 1초 → 0.1초

---

### 7. 🧪 Response Time Monitoring

**목적**: API 성능 저하 실시간 감지

**구현**:

```typescript
// middleware.ts 또는 API route wrapper
export function withPerformanceMonitoring(handler: Function) {
  return async (req: NextRequest) => {
    const start = Date.now();
    const response = await handler(req);
    const duration = Date.now() - start;

    // 성능 로그 (선택적)
    if (duration > 1000) {  // 1초 이상 걸린 요청만
      console.warn(`[SLOW API] ${req.url} took ${duration}ms`);
    }

    // Response header에 duration 추가
    response.headers.set('X-Response-Time', `${duration}ms`);

    return response;
  };
}
```

**Supabase 내장 함수 활용**:

```typescript
// Query 성능 측정
const startTime = performance.now();
const { data, error } = await supabase.from('...').select();
const queryTime = performance.now() - startTime;

if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
  console.log(`[Query Performance] ${queryTime.toFixed(2)}ms`);
}
```

---

### 8. 🔄 Real-time Subscription 활용 (선택적)

**사용 사례**: 일정 추가 시 실시간 업데이트

**장점**:
- 여러 사용자가 동시 작업 시 충돌 방지
- 할당된 일정을 실시간으로 반영
- 폴링 불필요 → 서버 부하 감소

**구현**:

```typescript
// Client-side subscription
const supabase = createClient();

useEffect(() => {
  const channel = supabase
    .channel('inspection_assignments')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'inspection_assignments',
        filter: `assigned_to=eq.${userId}`
      },
      (payload) => {
        console.log('New assignment:', payload.new);
        // UI 업데이트
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [userId]);
```

**주의사항**:
- Row Level Security (RLS) 정책 확인 필수
- 연결 수 제한 고려 (Supabase 플랜별 제한)

---

### 9. 🎨 Progressive Enhancement

**Optimistic UI Updates**:

```typescript
// 일정 추가 버튼 클릭 시
async function handleScheduleAdd(equipmentSerials: string[]) {
  // 1. 즉시 UI 업데이트 (낙관적 업데이트)
  setAssignments(prev => [
    ...prev,
    ...equipmentSerials.map(serial => ({
      equipment_serial: serial,
      status: 'pending',
      _optimistic: true  // 임시 표시
    }))
  ]);

  try {
    // 2. 실제 API 호출
    const result = await fetch('/api/inspections/assignments', {
      method: 'POST',
      body: JSON.stringify({ equipmentSerials })
    });

    // 3. 성공 시 실제 데이터로 교체
    const data = await result.json();
    setAssignments(prev => prev.filter(a => !a._optimistic).concat(data));

  } catch (error) {
    // 4. 실패 시 롤백
    setAssignments(prev => prev.filter(a => !a._optimistic));
    toast.error('일정 추가 실패');
  }
}
```

**예상 UX 개선**:
- 즉각적인 피드백
- 네트워크 지연 체감 감소
- 실패 시 명확한 롤백

---

### 10. 📦 Batch API Endpoint

**현재**: 단일 일정 추가 + 대량 일정 추가 분리

**개선**: Batch API로 통합

```typescript
// POST /api/inspections/assignments/batch
{
  "operations": [
    {
      "type": "create",
      "equipmentSerial": "ABC123",
      "assignedTo": "user-1"
    },
    {
      "type": "update",
      "assignmentId": 456,
      "status": "completed"
    },
    {
      "type": "delete",
      "assignmentId": 789
    }
  ]
}
```

**장점**:
- 여러 작업을 하나의 트랜잭션으로 처리
- 네트워크 왕복 최소화
- 복잡한 워크플로우 지원

---

## 📊 성능 목표 및 측정 지표

### 현재 성능 (추정)

| API | 응답 시간 | 데이터량 |
|-----|----------|---------|
| GET /api/aed-data (inspection mode) | 800ms | 1000개 fetch → 50개 반환 |
| POST /api/inspections/assignments (bulk) | 3000ms | 1000개 청크 20번 |
| GET /api/aed-data/priority | 500ms | 전체 테이블 스캔 |

### 목표 성능

| API | 목표 응답 시간 | 개선율 |
|-----|--------------|--------|
| GET /api/aed-data (inspection mode) | **200ms** | 75% ↓ |
| POST /api/inspections/assignments (bulk) | **500ms** | 83% ↓ |
| GET /api/aed-data/priority | **100ms** | 80% ↓ |

### 측정 방법

```bash
# Apache Bench를 통한 부하 테스트
ab -n 100 -c 10 http://localhost:3000/api/aed-data?mode=inspection

# 또는 k6 사용
k6 run load-test.js
```

---

## 🎯 우선순위 및 로드맵

### Phase 1 (즉시 적용 - 완료됨)
- ✅ Inspection mode DB 필터링
- ✅ Bulk insert RPC 함수
- ✅ 로깅 최적화

### Phase 2 (1주일 내)
- 📊 인덱스 최적화 (제안 6)
- 📈 Response Time Monitoring (제안 7)
- 🔍 날짜 필터 DB 이동 (제안 5)

### Phase 3 (2주일 내)
- 📊 페이지네이션 표준화 (제안 4)
- 🎨 Optimistic UI Updates (제안 9)

### Phase 4 (장기)
- 🔄 Real-time Subscription (제안 8)
- 📦 Batch API (제안 10)

---

## 🔧 테스트 체크리스트

마이그레이션 적용 전 테스트:

```bash
# 1. 마이그레이션 적용
npx supabase db push

# 2. RPC 함수 테스트
curl -X POST http://localhost:3000/api/inspections/assignments \
  -H "Content-Type: application/json" \
  -d '{"equipmentSerials": ["TEST001", "TEST002"]}'

# 3. Inspection mode 성능 테스트
curl "http://localhost:3000/api/aed-data?mode=inspection&sido=서울"

# 4. 롤백 준비
# 마이그레이션 실패 시 롤백 스크립트 준비
```

---

## 💡 결론

이번 개선으로 **70/100 → 90/100** 달성 가능:

- **성능**: 50 → 90점 (DB 필터링 + 인덱스)
- **안정성**: 60 → 95점 (트랜잭션 보장)
- **유지보수성**: 70 → 85점 (표준화 + 모니터링)

**다음 단계**: Phase 2 인덱스 최적화 및 성능 모니터링 구현
