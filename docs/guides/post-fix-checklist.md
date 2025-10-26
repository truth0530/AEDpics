# 안정화 후속 작업 체크리스트

## 즉시 해결 완료 (2025-09-25)
- [x] API 500 에러 수정: 커서 기반 함수 제거, 기존 함수 직접 사용
- [x] 코드 간소화: 불필요한 폴백 로직 제거
- [x] 클라이언트 null 체크 확인

## 추가 필요 작업

### 1. Supabase RPC 함수 복구 (장기 성능 개선)
**파일**: `/supabase/create_cursor_based_aed_functions.sql`
- 커서 기반 함수가 이미 작성되어 있음
- Supabase SQL Editor에서 실행 필요
- 함수 목록:
  - `get_aed_data_filtered_cursor`
  - `get_aed_data_by_jurisdiction_cursor`

**장점**:
- 대용량 데이터 처리 시 offset보다 빠름
- 페이지 이동 중 데이터 변경에도 안정적

### 2. API 호출 지점 모니터링
**확인된 호출 지점**:
- `/app/aed-data/components/AEDDataProvider.tsx`
- `/app/aed-data/components/AEDFilterBar.tsx`

### 3. 에러 로깅 강화 방안

#### Option 1: Sentry 통합
```typescript
// lib/monitoring/sentry.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});
```

#### Option 2: Custom Error Logger
```typescript
// lib/monitoring/error-logger.ts
export async function logError(error: Error, context: any) {
  // Supabase 에러 로그 테이블에 저장
  await supabase.from('error_logs').insert({
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date()
  });

  // 프로덕션에서만 외부 서비스로 전송
  if (process.env.NODE_ENV === 'production') {
    // Slack, Discord 등 알림
  }
}
```

### 4. 프로덕션 검증 절차

#### 배포 후 체크리스트
- [ ] `/aed-data` 페이지 로드 확인
- [ ] 검색 필터 동작 확인
- [ ] 페이지네이션 동작 확인
- [ ] 콘솔 에러 없음 확인
- [ ] 네트워크 탭에서 200 응답 확인

#### 자동화 테스트 (추천)
```bash
# 간단한 헬스체크 스크립트
curl -s https://www.aed.pics/api/aed-data?criteria=address \
  -H "Cookie: $AUTH_COOKIE" \
  | jq '.error // "OK"'
```

### 5. 성능 모니터링

#### Vercel Analytics 활용
- Web Vitals 모니터링
- API 응답 시간 추적
- 에러율 모니터링

#### Custom Metrics
```typescript
// lib/monitoring/performance.ts
export function trackAPICall(endpoint: string, duration: number) {
  // Vercel Analytics or custom solution
  analytics.track('api_call', {
    endpoint,
    duration,
    timestamp: Date.now()
  });
}
```

## 우선순위

1. **높음**: 프로덕션 검증 (즉시)
2. **중간**: 에러 로깅 강화 (1주 내)
3. **낮음**: 커서 기반 함수 복구 (데이터 증가 시)

## 참고사항

- 현재 offset/limit 방식도 충분히 동작
- 데이터가 10만건 이상일 때 커서 방식 고려
- 모니터링 도구는 팀 선호도에 따라 선택