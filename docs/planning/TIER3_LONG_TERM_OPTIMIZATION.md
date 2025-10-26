# Tier 3: 장기 최적화 계획 (Long-term Optimization Roadmap)

> **작성일**: 2025-10-18
> **상태**: 계획 단계
> **예상 기간**: 4-6주
> **우선순위**: MEDIUM (프로덕션 안정화 후 진행)

---

## 📋 목차

1. [개요](#개요)
2. [현재 시스템 현황](#현재-시스템-현황)
3. [Tier 3-1: Database Partitioning](#tier-3-1-database-partitioning)
4. [Tier 3-2: Materialized Views](#tier-3-2-materialized-views)
5. [Tier 3-3: 고급 실시간 기능](#tier-3-3-고급-실시간-기능)
6. [Tier 3-4: 테스트 인프라 구축](#tier-3-4-테스트-인프라-구축)
7. [Tier 3-5: 에러 모니터링 통합](#tier-3-5-에러-모니터링-통합)
8. [우선순위 및 일정](#우선순위-및-일정)

---

## 개요

### 목표
프로덕션 환경에서 **대규모 트래픽 처리**, **데이터 확장성**, **장기 운영 안정성**을 확보하기 위한 고급 최적화 작업을 수행합니다.

### 핵심 성과 지표 (KPI)
- 📊 **DB 쿼리 성능**: P95 < 100ms
- 🚀 **API 응답 시간**: P95 < 500ms
- 💾 **데이터베이스 확장성**: 1M+ 레코드 지원
- 🔄 **실시간 업데이트**: < 3초 지연
- 🧪 **테스트 커버리지**: > 70%
- 📈 **에러율**: < 0.1%

---

## 현재 시스템 현황

### ✅ 완료된 최적화 (Tier 1 & 2)
- Vercel Analytics 통합
- Edge Caching (Timestamp API 98% 개선)
- Data Update Banner
- Skeleton UI
- Redis 캐싱 인프라
- Rate Limiting
- Error Boundaries (WCAG AA 준수)
- Performance Dashboard

### 📊 현재 성능 지표
- **AED 데이터 테이블**: ~100,000 레코드
- **DB 쿼리 평균**: ~200ms
- **Timestamp API**: ~112ms (Edge Cached)
- **메모리 사용량**: 36-47MB
- **CPU 사용량**: ~0%

### 🔍 현재 병목 구간
1. **대량 데이터 조회**: 전체 AED 데이터 쿼리 시 200-300ms
2. **복잡한 필터링**: 다중 필터 적용 시 성능 저하
3. **통계 계산**: 실시간 집계 연산 부하
4. **테스트 부재**: 자동화된 테스트 인프라 없음
5. **에러 모니터링**: 프로덕션 에러 추적 미흡

---

## Tier 3-1: Database Partitioning

### 목표
AED 데이터 테이블을 **지역 기반 파티셔닝**하여 쿼리 성능을 개선합니다.

### 기술 스택
- **PostgreSQL Table Partitioning**
- **Range Partitioning** by region_code
- **Automatic Partition Management**

### 구현 계획

#### 1.1 파티션 전략 설계 (2일)

**파티션 키**: `region_code` (17개 시도)

```sql
-- Parent Table
CREATE TABLE aed_data (
  id SERIAL,
  region_code VARCHAR(3) NOT NULL,
  equipment_serial VARCHAR(50),
  -- ... 기타 컬럼
  PRIMARY KEY (id, region_code)
) PARTITION BY LIST (region_code);

-- Child Partitions (예시)
CREATE TABLE aed_data_seoul PARTITION OF aed_data
  FOR VALUES IN ('SEO');

CREATE TABLE aed_data_busan PARTITION OF aed_data
  FOR VALUES IN ('BUS');

-- ... 17개 시도별 파티션 생성
```

#### 1.2 데이터 마이그레이션 (3일)

**마이그레이션 절차**:
1. 새 파티션 테이블 구조 생성
2. 기존 데이터를 파티션별로 복사
3. 인덱스 재생성
4. 애플리케이션 코드 업데이트 (없음 - 투명하게 동작)
5. 기존 테이블 백업 후 전환
6. 검증 및 롤백 준비

**다운타임**: 예상 < 5분 (읽기 전용 모드)

#### 1.3 성능 테스트 및 검증 (2일)

**벤치마크 시나리오**:
- 단일 지역 조회: 목표 < 50ms
- 다중 지역 조회: 목표 < 100ms
- 전체 조회: 목표 < 200ms

**예상 성능 개선**: 30-50%

#### 1.4 자동 파티션 관리 (1일)

**파티션 유지보수 자동화**:
- 새 지역 추가 시 자동 파티션 생성
- 파티션별 통계 수집
- 파티션 프루닝 모니터링

---

## Tier 3-2: Materialized Views

### 목표
자주 조회되는 **집계 데이터**를 Materialized View로 사전 계산하여 대시보드 성능을 극대화합니다.

### 기술 스택
- **PostgreSQL Materialized Views**
- **pg_cron** for 자동 갱신
- **CONCURRENTLY REFRESH** for 무중단 갱신

### 구현 계획

#### 2.1 Materialized View 설계 (2일)

**View 1: 지역별 통계** (`mv_aed_stats_by_region`)

```sql
CREATE MATERIALIZED VIEW mv_aed_stats_by_region AS
SELECT
  region_code,
  COUNT(*) as total_devices,
  COUNT(CASE WHEN last_inspection_date < NOW() - INTERVAL '1 year' THEN 1 END) as needs_inspection,
  COUNT(CASE WHEN pad_expiry_date < NOW() + INTERVAL '3 months' THEN 1 END) as expiring_soon,
  AVG(EXTRACT(EPOCH FROM (NOW() - last_inspection_date)) / 86400) as avg_days_since_inspection
FROM aed_data
GROUP BY region_code;

-- 인덱스
CREATE UNIQUE INDEX ON mv_aed_stats_by_region (region_code);
```

**View 2: 설치 기관별 통계** (`mv_aed_stats_by_institution`)

```sql
CREATE MATERIALIZED VIEW mv_aed_stats_by_institution AS
SELECT
  category_1,
  category_2,
  COUNT(*) as device_count,
  COUNT(CASE WHEN external_display = 'Y' THEN 1 END) as with_external_display
FROM aed_data
GROUP BY category_1, category_2;
```

**View 3: 일별 점검 현황** (`mv_daily_inspection_stats`)

```sql
CREATE MATERIALIZED VIEW mv_daily_inspection_stats AS
SELECT
  DATE(last_inspection_date) as inspection_date,
  COUNT(*) as inspections_count,
  region_code
FROM aed_data
WHERE last_inspection_date >= NOW() - INTERVAL '30 days'
GROUP BY DATE(last_inspection_date), region_code;
```

#### 2.2 자동 갱신 설정 (1일)

**pg_cron 스케줄링**:

```sql
-- 매일 새벽 2시에 갱신
SELECT cron.schedule('refresh-aed-stats', '0 2 * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_aed_stats_by_region'
);

-- 매시간 갱신 (일별 통계)
SELECT cron.schedule('refresh-daily-stats', '0 * * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_inspection_stats'
);
```

#### 2.3 API 통합 (2일)

**새 API 엔드포인트**:
- `GET /api/stats/regions` - 지역별 통계 (Materialized View 사용)
- `GET /api/stats/institutions` - 기관별 통계
- `GET /api/stats/daily-inspections` - 일별 점검 현황

**예상 성능 개선**: 70-90% (집계 쿼리 대비)

---

## Tier 3-3: 고급 실시간 기능

### 목표
**Supabase Realtime**을 활용한 협업 기능 및 실시간 알림 강화

### 기술 스택
- **Supabase Realtime (PostgreSQL Logical Replication)**
- **WebSocket**
- **React Query Optimistic Updates**

### 구현 계획

#### 3.1 실시간 협업 기능 (3일)

**기능 1: 실시간 점검 상태 동기화**

동일한 AED 장비를 여러 사용자가 동시에 점검하려 할 때:
- 다른 사용자가 점검 중인 장비 표시
- 점검 완료 시 즉시 UI 업데이트
- 충돌 방지 (낙관적 잠금)

**구현**:
```typescript
// Realtime Subscription
const subscription = supabase
  .channel('aed-inspections')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'inspections',
    filter: `equipment_serial=eq.${equipmentSerial}`
  }, (payload) => {
    // 실시간 UI 업데이트
    queryClient.invalidateQueries(['inspections', equipmentSerial]);
  })
  .subscribe();
```

**기능 2: 실시간 대시보드 업데이트**

관리자 대시보드에서 실시간으로:
- 신규 점검 등록 시 카운터 업데이트
- 승인 대기 알림 실시간 표시
- 긴급 알림 Push

#### 3.2 WebSocket 연결 최적화 (2일)

**최적화 항목**:
- Connection Pooling
- Automatic Reconnection
- Heartbeat Monitoring
- Subscription Cleanup

**구현**:
```typescript
// lib/realtime/connection-manager.ts
export class RealtimeConnectionManager {
  private static instance: RealtimeConnectionManager;
  private channels = new Map();

  // Singleton 패턴
  static getInstance() {
    if (!RealtimeConnectionManager.instance) {
      RealtimeConnectionManager.instance = new RealtimeConnectionManager();
    }
    return RealtimeConnectionManager.instance;
  }

  subscribe(channelName: string, callback: Function) {
    // 중복 구독 방지
    // 자동 재연결
    // 에러 처리
  }
}
```

#### 3.3 성능 모니터링 (1일)

**메트릭 수집**:
- WebSocket 연결 수
- 메시지 전송/수신 속도
- 재연결 빈도
- 에러율

---

## Tier 3-4: 테스트 인프라 구축

### 목표
**자동화된 테스트**를 통해 코드 품질 및 회귀 방지를 강화합니다.

### 기술 스택
- **Vitest** - 유닛 테스트
- **React Testing Library** - 컴포넌트 테스트
- **Playwright** - E2E 테스트
- **MSW** - API Mocking

### 구현 계획

#### 4.1 유닛 테스트 (1주)

**테스트 대상**:
- 유틸리티 함수 (`lib/utils/`, `lib/constants/`)
- 비즈니스 로직 (`lib/auth/`, `lib/aed/`)
- API Route Handlers (단위 테스트)

**목표 커버리지**: 60%

**예시**:
```typescript
// lib/cache/redis-cache.test.ts
import { describe, it, expect, vi } from 'vitest';
import { getCachedData, setCachedData } from './redis-cache';

describe('Redis Cache', () => {
  it('should return null when KV is not configured', async () => {
    const result = await getCachedData('test-key');
    expect(result).toBeNull();
  });

  it('should handle cache set gracefully on failure', async () => {
    await expect(
      setCachedData('test-key', { data: 'test' })
    ).resolves.not.toThrow();
  });
});
```

#### 4.2 컴포넌트 테스트 (1주)

**테스트 대상**:
- ErrorBoundary
- Skeleton UI 컴포넌트
- Form 컴포넌트

**목표 커버리지**: 50%

**예시**:
```typescript
// components/error/ErrorBoundary.test.tsx
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

const ThrowError = () => {
  throw new Error('Test error');
};

it('renders error UI when child throws', () => {
  render(
    <ErrorBoundary>
      <ThrowError />
    </ErrorBoundary>
  );

  expect(screen.getByText('문제가 발생했습니다')).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
});
```

#### 4.3 E2E 테스트 (1주)

**테스트 시나리오**:
1. 로그인 플로우
2. AED 데이터 조회 및 필터링
3. 점검 일정 등록
4. 관리자 승인 플로우

**목표**: 핵심 5개 시나리오 커버

**예시**:
```typescript
// e2e/aed-data-flow.spec.ts
import { test, expect } from '@playwright/test';

test('AED 데이터 조회 및 필터링', async ({ page }) => {
  await page.goto('/aed-data');

  // 로그인
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');

  // 필터 적용
  await page.selectOption('[name="region"]', 'SEO');

  // 데이터 로드 확인
  await expect(page.locator('.data-table')).toBeVisible();
  await expect(page.locator('tr[data-row]')).toHaveCount.greaterThan(0);
});
```

#### 4.4 CI/CD 통합 (2일)

**GitHub Actions 워크플로우**:

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  unit-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:unit

  e2e-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install
      - run: npm run test:e2e
```

---

## Tier 3-5: 에러 모니터링 통합

### 목표
프로덕션 환경에서 발생하는 **에러를 실시간 추적 및 분석**합니다.

### 기술 스택
- **Sentry** - 에러 모니터링
- **Vercel Log Drains** - 로그 수집
- **Slack/Email Alerts** - 알림

### 구현 계획

#### 5.1 Sentry 통합 (1일)

**설치 및 설정**:

```bash
npm install @sentry/nextjs
npx @sentry/wizard -i nextjs
```

**설정**:
```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1, // 10% 성능 추적

  beforeSend(event, hint) {
    // PII 필터링
    if (event.request) {
      delete event.request.cookies;
    }
    return event;
  },
});
```

**Error Boundary 통합**:
```typescript
// components/error/ErrorBoundary.tsx
componentDidCatch(error: Error, errorInfo: ErrorInfo) {
  // Sentry로 전송
  if (process.env.NODE_ENV === 'production') {
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
    });
  }
}
```

#### 5.2 알림 설정 (1일)

**Sentry Alerts**:
- 에러율 > 1% → Slack 알림
- 크리티컬 에러 발생 → Email 알림
- 새로운 에러 타입 발견 → Slack 알림

**Slack Webhook 통합**:
```typescript
// lib/monitoring/alerts.ts
export async function sendCriticalAlert(error: Error) {
  await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    body: JSON.stringify({
      text: `🚨 Critical Error: ${error.message}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Error*: ${error.message}\n*Stack*: \`\`\`${error.stack}\`\`\``,
          },
        },
      ],
    }),
  });
}
```

#### 5.3 로그 수집 및 분석 (2일)

**Vercel Log Drains**:
- Logs → Datadog/Logtail
- 구조화된 로깅
- 로그 레벨 관리

**구조화된 로깅**:
```typescript
// lib/logging/logger.ts
export const logger = {
  info: (message: string, meta?: object) => {
    console.log(JSON.stringify({
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    }));
  },
  error: (message: string, error: Error, meta?: object) => {
    console.error(JSON.stringify({
      level: 'error',
      message,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      timestamp: new Date().toISOString(),
      ...meta,
    }));
  },
};
```

---

## 우선순위 및 일정

### Phase 1: 기반 강화 (2주)
**우선순위**: HIGH

1. **Tier 3-4: 테스트 인프라 구축** (1주)
   - 유닛 테스트 60% 커버리지
   - CI/CD 통합
   - **이유**: 안정성 확보 최우선

2. **Tier 3-5: 에러 모니터링 통합** (3일)
   - Sentry 통합
   - Slack 알림
   - **이유**: 프로덕션 에러 추적 필수

3. **Tier 3-2: Materialized Views** (4일)
   - 대시보드 통계 최적화
   - **이유**: 사용자 체감 성능 개선

### Phase 2: 성능 최적화 (2주)
**우선순위**: MEDIUM

4. **Tier 3-1: Database Partitioning** (1주)
   - 지역별 파티셔닝
   - 마이그레이션
   - **이유**: 장기 확장성 확보

5. **Tier 3-3: 고급 실시간 기능** (1주)
   - 실시간 협업
   - WebSocket 최적화
   - **이유**: 사용자 경험 향상

### Phase 3: 안정화 및 모니터링 (1주)
**우선순위**: MEDIUM

6. **종합 성능 테스트** (3일)
7. **문서화 및 운영 가이드** (2일)
8. **팀 교육 및 인계** (2일)

---

## 예상 효과

### 성능 개선
- DB 쿼리: 200ms → 100ms (**50% 개선**)
- 대시보드 로딩: 1초 → 0.3초 (**70% 개선**)
- 실시간 업데이트: 5초 → 2초 (**60% 개선**)

### 안정성 향상
- 테스트 커버리지: 0% → 70%
- 에러 감지: 수동 → 실시간 자동
- 롤백 시간: 10분 → 2분

### 확장성 확보
- 데이터 용량: 100K → 1M+ 레코드 지원
- 동시 접속자: 100명 → 1000명 지원

---

## 리스크 및 대응 방안

### 리스크 1: Database 마이그레이션 실패
**영향도**: HIGH
**대응**:
- 철저한 백업 및 롤백 계획
- 스테이징 환경에서 사전 검증
- Blue-Green 배포 전략

### 리스크 2: 테스트 작성 지연
**영향도**: MEDIUM
**대응**:
- 핵심 기능 우선 테스트
- 점진적 커버리지 확대
- 페어 프로그래밍

### 리스크 3: Realtime 성능 저하
**영향도**: MEDIUM
**대응**:
- Connection Pool 크기 조정
- 구독 제한 정책
- 폴백 메커니즘 (Polling)

---

## 결론

Tier 3 최적화는 **프로덕션 안정화 후** 진행하며, **테스트 인프라 구축**과 **에러 모니터링**을 최우선으로 합니다.

점진적 배포를 통해 리스크를 최소화하고, 각 단계마다 **검증 및 롤백 계획**을 수립합니다.

**예상 총 소요 기간**: 4-6주
**예상 투입 인력**: 1-2명
**예상 비용**: Sentry Pro ($26/월), Vercel KV ($5/월)

---

**다음 단계**: Tier 3-4 (테스트 인프라 구축) 착수 승인 요청
