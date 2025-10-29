# AED 점검 시스템 성능 최적화 가이드

## 문제 진단 및 개선 방안

### 1. Critical Issue: PrismaClient 메모리 누수 (🔴 긴급)

#### 현재 문제
- 20개 이상의 API 라우트에서 매 요청마다 새 PrismaClient 인스턴스 생성
- 데이터베이스 연결 풀 고갈 및 메모리 누수 발생
- 응답 시간 지연 및 서버 다운 위험

#### 해결 방안
```bash
# 1. PrismaClient 싱글톤 적용
npm install glob  # 필요한 경우
node scripts/update-prisma-imports.js

# 2. TypeScript 검증
npm run tsc

# 3. 프로덕션 빌드
npm run build

# 4. 커밋 및 배포
git add -A
git commit -m "refactor: Apply PrismaClient singleton pattern for performance"
git push origin main
```

**예상 효과**: 응답속도 50-70% 개선, 메모리 80% 절감

### 2. 데이터베이스 인덱스 최적화 (🟠 중요)

#### 현재 문제
- Full Table Scan으로 인한 느린 쿼리
- 81,331개 AED 레코드 조회 시 성능 저하

#### 해결 방안
```sql
-- NCP PostgreSQL에 직접 실행
psql -h pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com -U aedpics_admin -d aedpics_production

-- 인덱스 SQL 실행
\i prisma/migrations/add_performance_indexes.sql
```

**예상 효과**: 쿼리 속도 60-80% 개선

### 3. 캐싱 전략 구현 (🟡 권장)

#### Redis 캐시 레이어 추가
```typescript
// lib/cache/redis-cache.ts
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: 6379,
  retryStrategy: (times) => Math.min(times * 50, 2000)
});

export const cacheManager = {
  async get<T>(key: string): Promise<T | null> {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  },

  async set(key: string, value: any, ttl = 300) {
    await redis.setex(key, ttl, JSON.stringify(value));
  },

  async invalidate(pattern: string) {
    const keys = await redis.keys(pattern);
    if (keys.length) await redis.del(...keys);
  }
};
```

#### 적용 대상
- 지역 코드 매핑 (TTL: 24시간)
- 통계 데이터 (TTL: 5분)
- 자주 조회되는 AED 목록 (TTL: 1분)

**예상 효과**: 반복 조회 90% 속도 개선

### 4. 쿼리 최적화 (🟢 점진적 개선)

#### N+1 문제 해결
```typescript
// 현재 (비효율적)
const assignments = await prisma.inspection_assignments.findMany();
const aedData = await prisma.aed_data.findMany({
  where: { equipment_serial: { in: serials }}
});

// 개선안 (JOIN 사용)
const result = await prisma.inspection_assignments.findMany({
  include: {
    aed_data: true  // Prisma relation 활용
  }
});
```

#### 병렬 쿼리 처리
```typescript
// 현재 (순차 실행)
const data = await getAEDData();
const stats = await getStatistics();

// 개선안 (병렬 실행)
const [data, stats] = await Promise.all([
  getAEDData(),
  getStatistics()
]);
```

**예상 효과**: API 응답시간 30-50% 단축

### 5. 프론트엔드 최적화

#### 가상 스크롤링 구현
```typescript
// 대량 데이터 렌더링 최적화
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={81331}
  itemSize={50}
  width='100%'
>
  {Row}
</FixedSizeList>
```

#### 페이지네이션 기본값 조정
- 현재: 30개/페이지
- 권장: 20개/페이지 (모바일 최적화)

### 6. 모니터링 및 알림

#### APM 도구 적용
```bash
# PM2 모니터링 활성화
pm2 install pm2-logrotate
pm2 install pm2-auto-pull
pm2 set pm2-logrotate:max_size 10M
```

#### 성능 메트릭 수집
```typescript
// lib/monitoring/performance.ts
export function measureAPIPerformance(routeName: string) {
  return async (req: Request, handler: Function) => {
    const start = performance.now();
    try {
      const result = await handler(req);
      const duration = performance.now() - start;

      if (duration > 1000) { // 1초 이상
        console.warn(`Slow API: ${routeName} took ${duration}ms`);
      }

      return result;
    } catch (error) {
      // 에러 로깅
      throw error;
    }
  };
}
```

## 성능 목표 및 KPI

| 메트릭 | 현재 | 목표 | 측정 방법 |
|--------|------|------|----------|
| API 응답시간 (P95) | 2-3초 | < 500ms | PM2 metrics |
| 메모리 사용량 | 증가 추세 | 안정적 | Process memory |
| DB 연결 수 | 무제한 | < 20 | pg_stat_activity |
| 캐시 히트율 | 0% | > 80% | Redis stats |
| 동시 접속자 | 50명 | 250명+ | Nginx logs |

## 구현 우선순위

### Phase 1 (즉시 실행) - 1일
1. ✅ PrismaClient 싱글톤 패턴 적용
2. ✅ 데이터베이스 인덱스 생성
3. ⬜ 메모리 누수 모니터링

### Phase 2 (단기) - 1주
1. ⬜ Redis 캐시 구현
2. ⬜ 병렬 쿼리 처리
3. ⬜ APM 도구 설정

### Phase 3 (중기) - 2주
1. ⬜ 가상 스크롤링 구현
2. ⬜ 쿼리 최적화 (JOIN)
3. ⬜ CDN 적용

## 성능 테스트

### 부하 테스트
```bash
# Apache Bench 사용
ab -n 1000 -c 50 https://aed.pics/api/aed-data

# 또는 k6 사용
k6 run --vus 50 --duration 30s performance-test.js
```

### 메모리 프로파일링
```bash
# Node.js 메모리 스냅샷
node --inspect app.js
# Chrome DevTools로 연결하여 Heap Snapshot 분석
```

## 롤백 계획

문제 발생 시:
1. PM2로 이전 버전 롤백
   ```bash
   pm2 reload aedpics --update-env
   ```

2. 데이터베이스 인덱스 제거
   ```sql
   DROP INDEX IF EXISTS idx_aed_sido_gugun;
   -- 기타 인덱스들...
   ```

3. Git 이전 커밋으로 복원
   ```bash
   git revert HEAD
   git push origin main
   ```

## 참고 자료

- [Prisma Performance Guide](https://www.prisma.io/docs/guides/performance-and-optimization)
- [Next.js Optimization](https://nextjs.org/docs/app/building-your-application/optimizing)
- [PostgreSQL Index Types](https://www.postgresql.org/docs/current/indexes-types.html)

---

**작성일**: 2025-10-29
**작성자**: AED 점검 시스템 개발팀