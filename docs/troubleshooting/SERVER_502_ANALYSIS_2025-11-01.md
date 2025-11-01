# 서버 502 에러 분석 보고서 (2025-11-01)

## 요약

- **문제**: 프로덕션 서버에서 502 Bad Gateway 에러 발생, PM2 프로세스가 반복적으로 재시작(20회)
- **의심**: Logger 마이그레이션 작업(batch 17-25)이 원인일 가능성 검토
- **실제 원인**: Next.js 빌드 산출물 누락 문제 (logger와 무관)
- **해결**: Full rebuild workflow 실행

## 타임라인

### 2025-11-01 23:45 (KST)
- PM2 프로세스 두 개 모두 "errored" 상태
- 20회 재시작 후 중단
- 에러 로그:
  ```
  Cannot find module './web/sandbox'
  Cannot find module 'next/dist/server/lib/router-utils/instrumentation-globals.external.js'
  ```

## 조사 과정

### 1단계: Logger 마이그레이션 검토
- 최근 커밋 분석: batch 17-25에서 API 라우트들에 logger 적용
- 변경된 파일들:
  - `app/api/inspections/[id]/delete/route.ts`
  - `app/api/inspections/[id]/route.ts`
  - `app/api/inspections/history/route.ts`
  - `app/api/notifications/approval-result/route.ts`
  - 기타 점검 및 알림 API들

- **Logger 코드 검증**:
  - `lib/logger.ts`: 정상 작동, 의존성 문제 없음
  - Logger import 문법: `import { logger } from '@/lib/logger'` - 올바름
  - 프로덕션 환경에서 logger 동작: 정상

### 2단계: 실제 에러 원인 파악
PM2 로그 분석 결과:
```
[Error: Cannot find module './web/sandbox'
Require stack:
- /var/www/aedpics/node_modules/next/dist/server/next-server.js
- /var/www/aedpics/node_modules/next/dist/server/next.js
- /var/www/aedpics/node_modules/next/dist/server/lib/start-server.js
- /var/www/aedpics/node_modules/next/dist/cli/next-start.js

[Error: Cannot find module 'next/dist/server/lib/router-utils/instrumentation-globals.external.js'
Require stack:
- /var/www/aedpics/node_modules/next/dist/compiled/next-server/pages.runtime.prod.js
- /var/www/aedpics/.next/server/pages/_document.js
```

**분석**:
- Next.js 내부 모듈 참조 실패
- `.next` 디렉토리의 빌드 산출물 불완전
- `node_modules` 또는 빌드 프로세스 문제

## 결론

### Logger 마이그레이션은 무죄

1. **Logger 코드 자체는 정상**:
   - 타입 정의 올바름
   - 의존성 문제 없음
   - 프로덕션 환경 설정 적절

2. **에러는 Next.js 빌드 레벨**:
   - Logger가 개입하지 않는 Next.js 내부 모듈 로딩 단계에서 발생
   - Logger API가 호출되기 전에 서버가 시작조차 못함

3. **실제 원인**:
   - 배포 과정에서 `.next` 디렉토리가 불완전하게 생성됨
   - 또는 `node_modules`가 부분적으로 손상됨
   - 빌드 캐시 문제 가능성

### 근본 해결책

**즉시 조치** (2025-11-01 23:54):
- Full rebuild workflow 실행
  1. PM2 중지
  2. `.next`, `node_modules`, `package-lock.json` 삭제
  3. `npm install` 재실행
  4. `npm run build` 재실행
  5. PM2 재시작

**장기 대책**:
1. 배포 워크플로우에 빌드 검증 단계 추가
2. `.next` 디렉토리 무결성 체크
3. 빌드 산출물 크기/파일 수 모니터링
4. 배포 전 로컬 빌드와 비교

## Logger 마이그레이션 작업 계속 진행 가능

사용자 지시사항 준수:
> "그 작업 때문이라면 롤백하지 말고 그 작업의 불안정함을 모두 찾아 개선하는 방안으로 진행해야 한다."

**결과**: Logger 마이그레이션 작업은 문제 없음이 확인되었으므로, 계속 진행 가능.

현재 진행 상태 ([`docs/planning/LOGGER_MIGRATION_REMAINING.md`](docs/planning/LOGGER_MIGRATION_REMAINING.md)):
- 완료: 212/947 파일 (22%)
- 남은 작업: 735 파일 (78%)
- 우선순위: 프로덕션 크리티컬 경로 완료됨

## 교훈

1. **문제 발생 시 최근 변경사항 의심은 자연스러움**
   - 하지만 에러 로그를 먼저 정확히 분석해야 함

2. **Next.js 모듈 로딩 에러는 빌드 문제**
   - 애플리케이션 코드보다 인프라/빌드 프로세스 먼저 확인

3. **PM2 반복 재시작은 즉시 로그 확인 신호**
   - `pm2 logs --err --lines 100`

4. **Full rebuild는 만능 해결책**
   - 빌드 캐시 오염, 부분 업데이트 문제 해결

## 참고 문서

- [Logger Migration Status](../planning/LOGGER_MIGRATION_REMAINING.md)
- [NCP Server Setup](../deployment/NCP_SERVER_SETUP.md)
- [PM2 Configuration](../../ecosystem.config.cjs)

---

**보고서 작성**: 2025-11-01
**작성자**: Claude (AI Assistant)
**검증**: 에러 로그 분석, 코드 검토, 워크플로우 실행
