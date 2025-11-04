# 캐시 전략 분석 및 권장사항

**작성일**: 2025-11-04
**작성자**: Claude Code
**목적**: 대시보드와 점검효과 페이지의 캐싱 전략 불일치 분석 및 해결 방안 제시

## 현재 캐시 전략

### 1. 대시보드 (Dashboard)

**파일**: [lib/aed/dashboard-queries.ts](../lib/aed/dashboard-queries.ts)

**캐시 방식**: React `cache()` 함수
```typescript
import { cache } from 'react';

export const getCachedDashboardData = cache(async (...) => {
  // 대시보드 데이터 조회
});

export const getCachedHourlyInspections = cache(async (...) => {
  // 시간별 점검 통계
});

export const getCachedDailyInspections = cache(async (...) => {
  // 일별 점검 통계
});
```

**특징**:
- **캐시 범위**: React 요청 단위 (Request-level deduplication)
- **캐시 지속시간**: 이론상 요청 내에서만 유지, 실제로는 서버 재시작까지 유지됨
- **만료 정책**: 없음 (서버 재시작 또는 배포 시에만 클리어)
- **장점**:
  - 동일 요청 내 중복 쿼리 방지
  - 빠른 SSR (Server-Side Rendering)
- **단점**:
  - 프로덕션에서 데이터가 오래된 상태로 유지될 수 있음
  - 새로운 점검 데이터가 반영되지 않음
  - 사용자가 최신 데이터를 보려면 서버 재시작 필요

### 2. 점검효과 (Inspection Effect)

**파일**: [app/api/inspections/improvement-reports/route.ts](../app/api/inspections/improvement-reports/route.ts)

**캐시 방식**: LRUCache (Least Recently Used Cache)
```typescript
import { LRUCache } from 'lru-cache';

const reportCache = new LRUCache<string, any>({
  max: 100,          // 최대 100개 항목
  ttl: 1000 * 60 * 5 // 5분 TTL
});
```

**특징**:
- **캐시 범위**: 서버 전역 (모든 요청에서 공유)
- **캐시 지속시간**: 5분 (TTL)
- **만료 정책**:
  - 5분 후 자동 만료
  - 100개 초과 시 LRU 알고리즘으로 가장 오래된 항목 제거
- **장점**:
  - 정기적으로 데이터 갱신 (5분마다)
  - 최신 데이터 보장
  - 메모리 사용량 제한 (max 100개)
- **단점**:
  - 5분마다 DB 쿼리 발생 (부하)
  - 캐시 미스 시 응답 지연

## 문제점

### 1. 사용자 경험 불일치

**시나리오**:
1. 사용자가 대시보드에서 점검 현황 확인 → 10개 점검 완료로 표시
2. 현장점검 5개 추가 수행
3. 점검효과 페이지 확인 → 15개 점검 완료로 표시 (5분 내 갱신)
4. 대시보드로 돌아감 → 여전히 10개로 표시 (캐시 미갱신)

**결과**: 같은 시스템 내에서 서로 다른 수치를 보여주어 신뢰도 하락

### 2. React cache() 오용

**React cache()의 본래 목적**:
- SSR 중 동일한 요청 내에서 중복 호출 방지
- 예: 여러 컴포넌트가 같은 데이터를 필요로 할 때 한 번만 fetch

**현재 사용 방식**:
- 서버 수준의 영구 캐시처럼 동작 (의도하지 않은 부작용)
- Next.js 프로덕션 모드에서 모듈이 재사용되면서 캐시가 유지됨

**문제**:
- 개발 환경과 프로덕션 환경에서 동작이 다를 수 있음
- 캐시 무효화 방법이 없음 (서버 재시작만 가능)

### 3. 데이터 신선도 차이

| 항목 | 대시보드 | 점검효과 |
|------|---------|---------|
| 캐시 만료 | 없음 | 5분 |
| 최신 데이터 보장 | ❌ | ✅ |
| 서버 재시작 필요 | ✅ | ❌ |

## 해결 방안

### 옵션 1: 통일 - LRUCache 사용 (권장)

**변경 사항**:
```typescript
// lib/aed/dashboard-queries.ts
import { LRUCache } from 'lru-cache';

// 대시보드용 캐시 (1분 TTL - 더 자주 갱신)
const dashboardCache = new LRUCache<string, any>({
  max: 50,
  ttl: 1000 * 60 * 1  // 1분
});

export async function getCachedDashboardData(...params) {
  const cacheKey = `dashboard:${JSON.stringify(params)}`;
  const cached = dashboardCache.get(cacheKey);
  if (cached) return cached;

  const data = await fetchDashboardData(...params);
  dashboardCache.set(cacheKey, data);
  return data;
}
```

**장점**:
- ✅ 일관된 캐싱 전략
- ✅ 최신 데이터 보장 (1분 간격)
- ✅ 명시적 캐시 제어
- ✅ 메모리 사용량 제한

**단점**:
- ❌ TTL 경과 후 첫 요청 시 지연 발생 가능
- ❌ 추가 구현 작업 필요

**권장 TTL**:
- 대시보드: 1분 (실시간성 중요)
- 점검효과: 5분 (현재 유지)

### 옵션 2: React cache() 유지 - 문서화

**변경 사항**: 코드 변경 없음, 주석 추가
```typescript
// lib/aed/dashboard-queries.ts

/**
 * 대시보드 데이터 조회 (캐시됨)
 *
 * 주의: React cache()는 요청 단위 캐싱만 보장합니다.
 * 프로덕션에서는 서버 재시작까지 캐시가 유지될 수 있습니다.
 * 최신 데이터가 필요한 경우 점검효과 페이지를 참조하세요.
 */
export const getCachedDashboardData = cache(async (...) => {
  // ...
});
```

**장점**:
- ✅ 코드 변경 없음
- ✅ SSR 성능 유지
- ✅ 빠른 적용

**단점**:
- ❌ 근본적 문제 미해결
- ❌ 사용자 혼란 지속
- ❌ 데이터 불일치 유지

### 옵션 3: 하이브리드 - Next.js unstable_cache

**변경 사항**:
```typescript
// lib/aed/dashboard-queries.ts
import { unstable_cache } from 'next/cache';

export const getCachedDashboardData = unstable_cache(
  async (...params) => {
    // 데이터 조회 로직
  },
  ['dashboard-data'],  // 캐시 키
  {
    revalidate: 60,      // 60초마다 재검증
    tags: ['dashboard']  // 태그 기반 무효화 가능
  }
);
```

**장점**:
- ✅ Next.js 네이티브 솔루션
- ✅ 태그 기반 캐시 무효화 가능
- ✅ ISR (Incremental Static Regeneration) 활용

**단점**:
- ❌ unstable API (버전 업데이트 시 변경 가능)
- ❌ 점검효과 API와 다른 방식 (여전히 불일치)

## 권장 사항

### 1단계: 즉시 적용 (옵션 1 - LRUCache 통일)

**이유**:
- 명확한 캐시 동작 보장
- 일관된 사용자 경험
- 최신 데이터 제공

**구현 계획**:
1. `lib/aed/dashboard-queries.ts` 리팩토링
   - React `cache()` → LRUCache로 변경
   - TTL: 1분 (대시보드), 5분 (점검효과) 유지
2. 캐시 키 생성 로직 통일
3. 테스트: 1분 경과 후 데이터 갱신 확인

**예상 효과**:
- 대시보드: 최대 1분 지연 데이터 (현재: 무한대)
- 점검효과: 최대 5분 지연 데이터 (현재와 동일)
- 일관성: ✅ 개선됨

### 2단계: 장기 개선 (선택)

**캐시 무효화 API 추가**:
```typescript
// app/api/cache/invalidate/route.ts
export async function POST(request: NextRequest) {
  const { tags } = await request.json();

  // 특정 태그의 캐시 무효화
  dashboardCache.clear();
  reportCache.clear();

  return NextResponse.json({ success: true });
}
```

**트리거**:
- 새로운 점검 데이터 입력 시 자동 호출
- 관리자가 수동 캐시 클리어 버튼 클릭

**예상 효과**:
- 실시간 데이터 반영
- TTL 없이도 최신 상태 유지

## 결론

**현재 상태**:
- 대시보드는 오래된 데이터 표시 가능
- 점검효과는 5분마다 갱신
- 사용자 혼란 가능성 높음

**권장 조치**:
1. **즉시**: 대시보드를 LRUCache (1분 TTL)로 변경
2. **문서화**: 각 페이지의 데이터 갱신 주기 명시
3. **장기**: 캐시 무효화 API 구축

**구현 우선순위**: 높음
**예상 작업 시간**: 1-2시간
**리스크**: 낮음 (기존 로직 유지, 캐싱만 변경)
