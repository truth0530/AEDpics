# Logger 마이그레이션 남은 작업

**문서 작성일**: 2025-11-01
**현재 상태**: 212개 완료, 735개 남음 (전체 947개 중 22% 완료)

## 작업 개요

프로젝트 전체의 `console.log/warn/error` 문을 구조화된 중앙 집중식 `logger` 유틸리티로 교체하는 작업입니다.

### 완료된 작업 (배치 1-21)

#### 핵심 인프라 및 우선순위 API (212개)
- ✅ Batch 1-9: 초기 핵심 파일들
- ✅ Batch 10-16: lib/ 디렉토리 전체 (118개)
  - 인증, 유틸리티, Realtime 시스템
- ✅ Batch 17-18: 핵심 API 라우트 (50개)
  - aed-data/route.ts (33개) - 가장 중요한 AED 조회 API
  - inspections/sessions/route.ts (17개) - 점검 세션 관리
- ✅ Batch 19: 관리자 사용자 API (11개) - 보안 중요
- ✅ Batch 20: 점검 관리 API (19개) - 핵심 비즈니스 로직
- ✅ Batch 21: 인증 및 알림 API (14개) - 인증 시스템

## 남은 작업 (735개)

### 1. app/api/ 디렉토리 (251개)

#### 1-1. 점검 관련 API (34개) - 우선순위: 중
```
app/api/inspections/stats/route.ts (1개)
app/api/inspections/[id]/route.ts (1개)
app/api/inspections/[id]/delete/route.ts (3개)
app/api/inspections/batch/route.ts (1개)
app/api/inspections/field/assigned/route.ts (2개)
app/api/inspections/history/route.ts (1개)
app/api/inspections/realtime/route.ts (1개)
app/api/inspections/completed/route.ts (1개)
app/api/inspections/sessions/[id]/cancel/route.ts (1개)
app/api/inspections/assignments/reassign/route.ts (2개)
app/api/inspections/assigned-devices/route.ts (1개)
```

**예상 작업 시간**: 1-2시간
**난이도**: 중간
**영향도**: 중간 (점검 기능의 부가적인 API)

#### 1-2. 알림 관련 API (11개) - 우선순위: 낮음
```
app/api/notifications/settings/route.ts (2개)
app/api/notifications/approval-result/route.ts (2개)
app/api/notifications/history/route.ts (3개)
app/api/notifications/mark-all-read/route.ts (2개)
```

**예상 작업 시간**: 30분
**난이도**: 쉬움
**영향도**: 낮음 (알림 부가 기능)

#### 1-3. 기타 API 라우트 (약 206개) - 우선순위: 낮음-중
- 조직 관리 API
- 사용자 프로필 API
- 통계 및 리포트 API
- 설정 관련 API
- 기타 유틸리티 API

**예상 작업 시간**: 4-6시간
**난이도**: 중간
**영향도**: 낮음-중간

### 2. app/ 페이지 컴포넌트 (47개) - 우선순위: 낮음

서버 컴포넌트 및 페이지 로딩 로직의 console 문들

**예상 작업 시간**: 1-2시간
**난이도**: 쉬움
**영향도**: 낮음 (대부분 개발 디버깅용)

### 3. components/ 디렉토리 (171개) - 우선순위: 중간

클라이언트 컴포넌트의 console 문들
- UI 컴포넌트 에러 핸들링
- 사용자 인터랙션 로깅
- 폼 검증 로깅

**예상 작업 시간**: 3-4시간
**난이도**: 중간
**영향도**: 중간 (사용자 경험에 영향)

### 4. scripts/ 디렉토리 (273개) - 우선순위: 매우 낮음

마이그레이션 스크립트 및 유틸리티 스크립트
- 일회성 데이터 마이그레이션
- 테스트 스크립트
- 개발 도구

**예상 작업 시간**: 5-6시간
**난이도**: 중간
**영향도**: 매우 낮음 (프로덕션에 영향 없음)

## 미완료 시 발생하는 문제점

### 1. 심각도: 높음 (현재는 완료됨)
✅ **해결됨**: 핵심 API 라우트는 모두 완료되어 더 이상 심각한 문제 없음

### 2. 심각도: 중간

#### 2-1. 로그 관리의 일관성 부족
- **문제**: 일부 코드는 logger, 일부는 console 사용
- **영향**: 로그 추적 및 디버깅 시 혼란
- **예시**:
  ```
  // logger 사용 (구조화됨)
  logger.error('API:method', 'Error', { userId, details })

  // console 사용 (비구조화)
  console.error('Error:', error)
  ```

#### 2-2. 민감 정보 노출 위험
- **문제**: console은 자동 마스킹 없음
- **영향**: 비밀번호, 토큰 등이 로그에 노출될 수 있음
- **logger의 자동 마스킹**: 15+ 패턴 (password, token, api_key 등)

#### 2-3. 프로덕션 로그 관리 어려움
- **문제**: console 로그는 PM2 로그에 혼재
- **영향**: 중요 로그 필터링 어려움
- **logger 장점**: 레벨별 필터링, 컨텍스트 기반 검색 가능

#### 2-4. 로그 회전 및 보관 문제
- **문제**: console 로그는 PM2 기본 설정에만 의존
- **영향**: 로그 파일 크기 관리 어려움
- **logger 장점**:
  - 10MB 자동 회전
  - 7개 파일 유지
  - gzip 압축

### 3. 심각도: 낮음

#### 3-1. 개발자 경험 저하
- **문제**: 디버깅 시 로그 포맷 불일치
- **영향**: 개발 속도 저하 (경미)

#### 3-2. 코드 품질 일관성
- **문제**: 코드베이스 전체의 일관성 부족
- **영향**: 코드 리뷰 및 유지보수성 저하 (경미)

#### 3-3. 모니터링 도구 연동 어려움
- **문제**: 향후 Datadog, CloudWatch 등 연동 시 비용 증가
- **영향**: 로그 파싱 로직 추가 필요

## 권장 작업 우선순위

### Phase 1: 중요도 중간 (추천)
**예상 시간**: 2-3시간

1. 점검 관련 API 완료 (34개)
2. 알림 관련 API 완료 (11개)

**이유**: 점검 및 알림은 핵심 비즈니스 로직이므로 일관성 유지 필요

### Phase 2: 사용자 경험 개선 (선택)
**예상 시간**: 3-4시간

3. components/ 디렉토리 (171개)

**이유**: 클라이언트 사이드 에러 로깅 개선으로 사용자 문제 디버깅 용이

### Phase 3: 완전성 (선택)
**예상 시간**: 6-8시간

4. app/ 페이지 컴포넌트 (47개)
5. 기타 API 라우트 (206개)

**이유**: 코드베이스 전체의 일관성 확보

### Phase 4: 낮은 우선순위 (보류)
**예상 시간**: 5-6시간

6. scripts/ 디렉토리 (273개)

**이유**: 프로덕션에 영향 없는 일회성 스크립트

## 작업하지 않아도 되는 경우

다음 조건을 **모두** 만족하면 현재 상태로 유지 가능:

1. ✅ 핵심 API 라우트 완료 (완료됨)
2. ✅ 인증 및 보안 관련 완료 (완료됨)
3. ⚠️ 로그 일관성이 중요하지 않은 경우
4. ⚠️ 향후 모니터링 도구 도입 계획이 없는 경우
5. ⚠️ 개발팀이 1-2명으로 소규모인 경우

## 현재 상태 평가

### 장점
- ✅ 가장 중요한 22% 완료 (핵심 API)
- ✅ 보안 및 인증 로직 보호
- ✅ 핵심 비즈니스 로직 구조화
- ✅ 프로덕션 안정성 확보

### 단점
- ⚠️ 코드베이스 일관성 부족 (78% 미완료)
- ⚠️ 클라이언트 사이드 로깅 미완료
- ⚠️ 개발 디버깅 경험 일부 저하

## 결론

**현재 상태로도 프로덕션 운영에는 문제 없습니다.**

하지만 다음 경우에는 추가 작업 권장:
1. 팀 규모가 커질 예정 (3명 이상)
2. 모니터링 도구 도입 예정
3. 코드 품질 일관성이 중요한 경우
4. 장기 유지보수를 고려하는 경우

## 작업 재개 시 참고사항

### 일관된 패턴 유지
```typescript
// 1. import 추가
import { logger } from '@/lib/logger';

// 2. 컨텍스트 명명 규칙
// API: 'APIName:HTTPMethod' (예: 'InspectionStats:GET')
// 컴포넌트: 'ComponentName:method' (예: 'PhotoCapture:upload')
// 스크립트: 'ScriptName:function' (예: 'DataMigration:import')

// 3. 에러 로깅
logger.error('Context:Method', 'Error description',
  error instanceof Error ? error : { error }
);

// 4. 정보 로깅
logger.info('Context:Method', 'Action description', {
  metadata
});

// 5. 경고 로깅
logger.warn('Context:Method', 'Warning description', {
  context
});
```

### 검증 단계
```bash
# 각 배치마다 실행
npx tsc --noEmit  # TypeScript 검사
npm run lint      # ESLint 검사
git add . && git commit -m "refactor: Apply logger to [파일명] (batch N)"
git push origin main
```

### 배치 크기 권장
- API 라우트: 3-5개 파일 또는 30-50개 console 문
- 컴포넌트: 5-10개 파일
- 스크립트: 2-3개 파일

## 관련 문서
- [lib/logger.ts](../../lib/logger.ts) - Logger 유틸리티 구현
- [CLAUDE.md](../../CLAUDE.md) - 프로젝트 가이드라인

---

**최종 권장사항**: Phase 1 (점검 및 알림 API, 2-3시간)만 추가로 완료하면 충분히 안정적입니다.
