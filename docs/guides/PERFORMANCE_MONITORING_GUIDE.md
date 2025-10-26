# Performance Monitoring Guide

## 개요

성능 모니터링 유틸리티를 사용하여 API 응답 시간과 쿼리 성능을 추적하는 방법입니다.

## 설치 완료

- ✅ `lib/performance-monitor.ts` - 성능 모니터링 유틸리티
- ✅ `app/api/aed-data/route.ts` - 메인 AED 데이터 API에 성능 추적 추가됨

## 사용 방법

### 1. 기본 타이머 사용

```typescript
import { createTimer } from '@/lib/performance-monitor';

export async function GET(request: NextRequest) {
  const timer = createTimer();

  // 작업 수행
  const result = await doSomething();

  // 경과 시간 로깅
  timer.log('doSomething completed');
  // [Timer] doSomething completed: 123.45ms

  return NextResponse.json(result);
}
```

### 2. 쿼리 성능 추적

```typescript
import { QueryPerformanceTracker } from '@/lib/performance-monitor';

export async function GET(request: NextRequest) {
  const tracker = new QueryPerformanceTracker();

  // 각 쿼리를 추적
  const user = await tracker.trackQuery('get_user', async () => {
    return await supabase.auth.getUser();
  });

  const profile = await tracker.trackQuery('get_profile', async () => {
    return await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.data.user.id)
      .single();
  });

  const aedData = await tracker.trackQuery('get_aed_data', async () => {
    return await supabase
      .from('aed_data')
      .select('*')
      .limit(100);
  });

  // 성능 통계 로깅
  tracker.logMetrics('/api/aed-data');
  // [Performance Summary] /api/aed-data: {
  //   queries: 3,
  //   total: '456.78ms',
  //   average: '152.26ms',
  //   breakdown: ['get_user: 45.12ms', 'get_profile: 67.34ms', 'get_aed_data: 344.32ms']
  // }

  return NextResponse.json(aedData);
}
```

### 3. 응답 헤더에 성능 메트릭 추가

```typescript
import { addPerformanceHeaders, createTimer, QueryPerformanceTracker } from '@/lib/performance-monitor';

export async function GET(request: NextRequest) {
  const timer = createTimer();
  const tracker = new QueryPerformanceTracker();

  // 작업 수행
  const data = await tracker.trackQuery('main_query', async () => {
    return await getData();
  });

  const metrics = tracker.getMetrics();
  const response = NextResponse.json({ data });

  // 성능 헤더 추가
  return addPerformanceHeaders(response, {
    total: timer.elapsed(),
    queries: metrics.queryCount,
    queryTime: metrics.totalDuration
  });
}
```

## 응답 헤더 확인

브라우저 개발자 도구 또는 curl로 확인:

```bash
curl -v http://localhost:3000/api/aed-data

# 응답 헤더:
# X-Response-Time: 234.56ms
# X-Query-Count: 3
# X-Query-Time: 189.34ms
# X-Server-Timing: total;dur=234.56,db;dur=189.34
```

Chrome DevTools에서:
1. Network 탭 열기
2. 요청 선택
3. Headers 탭에서 Response Headers 확인
4. Timing 탭에서 Server Timing 확인

## 환경 변수 설정

`.env.local` 파일:

```bash
# 개발 환경: 모든 요청 로깅
NEXT_PUBLIC_DEBUG=true

# 프로덕션 환경: 느린 요청만 로깅 (1초 이상)
NEXT_PUBLIC_DEBUG=false
```

## 느린 요청 알림

1초 이상 걸리는 요청은 자동으로 경고 로그 출력:

```
[SLOW API] GET /api/aed-data took 1234.56ms (status: 200)
[SLOW Query] get_aed_data took 1123.45ms
```

## 실제 적용 예제

### app/api/inspections/assignments/route.ts

```typescript
import { QueryPerformanceTracker, createTimer } from '@/lib/performance-monitor';

async function handleBulkAssignment(equipmentSerials: string[], params: any) {
  const timer = createTimer();
  const tracker = new QueryPerformanceTracker();

  try {
    const supabase = await createClient();

    const user = await tracker.trackQuery('auth', async () => {
      return await supabase.auth.getUser();
    });

    const profile = await tracker.trackQuery('profile', async () => {
      return await supabase
        .from('user_profiles')
        .select('role, organization_id')
        .eq('id', user.data.user.id)
        .single();
    });

    const result = await tracker.trackQuery('bulk_insert_rpc', async () => {
      return await supabase.rpc('bulk_create_assignments', {
        p_equipment_serials: equipmentSerials,
        p_assigned_to: params.assignedTo,
        p_assigned_by: user.data.user.id,
        ...params
      });
    });

    // 성능 통계 로깅
    tracker.logMetrics('/api/inspections/assignments [bulk]');

    return NextResponse.json({
      success: true,
      ...result.data
    });

  } finally {
    console.log(`[Total Time] Bulk assignment: ${timer.elapsed().toFixed(2)}ms`);
  }
}
```

## 성능 목표

| API | 목표 | 현재 상태 |
|-----|------|----------|
| GET /api/aed-data (inspection mode) | < 200ms | ✅ DB 필터링 적용 |
| POST /api/inspections/assignments (bulk) | < 500ms | ✅ RPC 함수 적용 |
| GET /api/aed-data/priority | < 100ms | ✅ 인덱스 최적화 |

## 모니터링 대시보드 (선택사항)

프로덕션 환경에서는 다음과 같은 모니터링 도구 사용 권장:

1. **Vercel Analytics**: 자동 통합
2. **Sentry**: 에러 추적 + 성능 모니터링
3. **New Relic**: APM (Application Performance Monitoring)
4. **Custom Dashboard**: Supabase + Grafana

### Custom Logging to Database

```typescript
// lib/performance-monitor.ts에 추가 가능

export async function logPerformanceMetric(metrics: PerformanceMetrics) {
  if (process.env.NODE_ENV === 'production') {
    try {
      await supabase.from('performance_logs').insert({
        endpoint: metrics.endpoint,
        method: metrics.method,
        duration: metrics.duration,
        status: metrics.status,
        timestamp: metrics.timestamp
      });
    } catch (error) {
      // 로깅 실패해도 요청은 성공
      console.error('Failed to log performance metric:', error);
    }
  }
}
```

## 문제 해결

### Q: 성능 헤더가 표시되지 않음
A: CORS 설정 확인:

```typescript
// middleware.ts
const response = NextResponse.next();
response.headers.set('Access-Control-Expose-Headers', 'X-Response-Time, X-Query-Count, X-Server-Timing');
```

### Q: 프로덕션에서 로그가 너무 많음
A: `NEXT_PUBLIC_DEBUG=false` 설정 확인

### Q: 쿼리 성능이 느림
A: 인덱스 확인:

```sql
EXPLAIN ANALYZE
SELECT * FROM inspection_assignments
WHERE assigned_to = 'user-id'
  AND status IN ('pending', 'in_progress')
ORDER BY id
LIMIT 50;
```

인덱스 사용 여부 확인:
- `Index Scan` ✅ 좋음
- `Seq Scan` ❌ 인덱스 필요

## 다음 단계

1. ✅ Phase 2 완료: 인덱스 최적화 + 성능 모니터링
2. 📊 Phase 3: 실제 프로덕션 데이터로 성능 측정
3. 🚀 Phase 4: 추가 최적화 (Real-time Subscription, Batch API)
