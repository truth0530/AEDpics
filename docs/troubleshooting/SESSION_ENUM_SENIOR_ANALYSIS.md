# session_status Enum 오류 - 시니어 개발자의 종합 분석

## Executive Summary

**문제**: PostgreSQL enum 타입 불일치로 점검 세션 API 전체 장애
**원인**: Prisma Schema 변경 후 데이터베이스 마이그레이션 미실행
**영향**: 2025-11-05 15:54 이후 /api/inspections/sessions 완전 불능
**해결**: 검증된 SQL 스크립트 + Prisma Migration 도입

## 근본 원인 분석 (Root Cause Analysis)

### 1. 직접 원인 (Immediate Cause)

```
Prisma Client 생성 쿼리:
WHERE status = 'active'::session_status

PostgreSQL 실제 칼럼 타입:
status TEXT (또는 VARCHAR)

결과:
operator does not exist: text = session_status
```

**타입 캐스팅 불일치** - Prisma는 enum이라고 생각하지만, DB는 TEXT 타입

### 2. 근본 원인 (Root Cause)

**Prisma의 두 가지 명령어를 혼동**

| 명령어 | 목적 | DB 변경 |
|--------|------|---------|
| `prisma generate` | TypeScript 클라이언트 코드 생성 | ❌ 없음 |
| `prisma migrate deploy` | 데이터베이스 스키마 변경 | ✅ 있음 |

주니어 개발자는 `prisma generate`만 계속 실행했으므로,
**데이터베이스는 한 번도 변경되지 않았습니다.**

### 3. 프로세스 문제

1. **마이그레이션 시스템 부재**
   - Prisma Migration을 사용하지 않음
   - 스키마 변경 이력 추적 불가
   - 수동 SQL 의존

2. **배포 프로세스 불완전**
   - `prisma migrate deploy` 누락
   - 스키마 변경 시 자동 적용 안 됨

3. **개발 문화 문제**
   - Schema 변경 후 DB 동기화 확인 부족
   - 프로덕션 DB 상태 검증 생략

## 주니어 개발자의 실책 분석

### 실책 1: 기본 개념 부족

**증상**: `prisma generate`를 반복 실행하며 DB가 변경될 것이라고 기대

**진단**:
- Prisma ORM의 작동 방식 이해 부족
- Schema → Migration → Database 흐름 불이해
- 클라이언트 코드 생성 vs DB 스키마 변경 구분 못함

**교훈**:
```bash
# ❌ 잘못된 생각
npx prisma generate
# → "이제 DB가 enum 타입으로 바뀌었겠지?"

# ✅ 올바른 이해
npx prisma generate
# → "TypeScript 타입만 생성됨. DB는 그대로."

npx prisma migrate deploy
# → "이제야 DB가 변경됨!"
```

### 실책 2: 진단 없이 해결 시도

**증상**: DB 상태를 확인하지 않고 여러 workflow 생성

**진단**:
- 문제의 실제 원인 파악 전에 해결책 시도
- "일단 해보자" 식 접근
- 데이터베이스에 직접 접속해서 확인하지 않음

**올바른 접근**:
```bash
# Step 1: 현재 상태 진단
psql -c "SELECT typname FROM pg_type WHERE typname = 'session_status'"
psql -c "SELECT data_type FROM information_schema.columns WHERE column_name = 'status'"

# Step 2: 문제 확인 (enum이 없거나 칼럼이 TEXT)

# Step 3: 해결책 설계

# Step 4: 검증된 스크립트로 수정

# Step 5: 검증
```

### 실책 3: 복잡한 해결책 선호

**증상**: 5개의 다른 workflow 생성 (대부분 실패)

**생성한 Workflow들**:
1. `fix-session-enum.yml` - DATABASE_URL 파싱 실패
2. `verify-and-fix-enum.yml` - GitHub API 캐시 문제
3. `emergency-fix-enum.yml` - GitHub API 캐시 문제
4. `emergency-fix.yml` (Step 7.5 추가) - 미실행
5. `full-rebuild.yml` (재시도) - 불필요

**문제점**:
- 간단한 문제에 복잡한 해결책
- 이전 시도의 실패 원인 분석 없이 새 시도
- 기존 workflow 개선보다 신규 생성 선호

**올바른 접근**:
```bash
# 한 번에 정확한 해결책
1. 진단 스크립트 작성 (diagnose-session-enum.sql)
2. 검증된 수정 스크립트 (fix-session-enum-verified.sql)
3. 하나의 workflow로 통합 (fix-database-enum.yml)
```

### 실책 4: Silent Failure 간과

**증상**: psql 실행이 출력 없이 조용히 실패

**코드**:
```yaml
PGPASSWORD="${DATABASE_URL##*:}" psql ...
# → 비밀번호 추출 실패
# → psql 인증 실패
# → 그러나 exit code 0 반환
# → workflow "성공" 표시
```

**진단**:
- 복잡한 bash parameter expansion 실패
- 에러 출력 확인 안 함
- Exit code만 믿음

**교훈**:
```yaml
# ❌ 나쁜 방법
PGPASSWORD="${DATABASE_URL##*:}" psql ...

# ✅ 좋은 방법
# 1. 정규식으로 정확히 파싱
if [[ $DB_URL =~ postgresql://([^:]+):([^@]+)@... ]]; then
  PGPASSWORD="${BASH_REMATCH[2]}"
fi

# 2. 연결 테스트
psql ... -c "SELECT version();" || exit 1

# 3. 실제 출력 확인
psql ... | tee output.log
```

### 실책 5: 검증 부족

**증상**: 각 시도 후 실제 결과 확인 안 함

**문제**:
- workflow "성공" 표시만 확인
- 실제 DB가 변경되었는지 검증 안 함
- 에러 로그 확인 안 함
- 재발 여부 확인 안 함

**올바른 검증**:
```bash
# 1. Workflow 결과 확인
gh run view <run-id> --log

# 2. DB 직접 확인
psql -c "SELECT typname FROM pg_type WHERE typname = 'session_status'"

# 3. 애플리케이션 로그 확인
pm2 logs aedpics --lines 50

# 4. 실제 API 테스트
curl https://aed.pics/api/inspections/sessions

# 5. 재발 모니터링 (5분 후 다시 확인)
```

## 올바른 해결 과정

### Phase 1: 진단 (5분)

```bash
# 1. 현재 DB 상태 확인
psql -f scripts/diagnose-session-enum.sql

# 결과 해석:
# - enum 없음 → CREATE TYPE 필요
# - 칼럼이 TEXT → ALTER COLUMN 필요
# - 데이터 유효 → 변환 가능
```

### Phase 2: 검증된 수정 스크립트 (10분)

```sql
-- fix-session-enum-verified.sql

BEGIN;  -- 트랜잭션 시작 (롤백 가능)

-- Step 1: 현재 상태 확인
-- Step 2: Enum 생성 (IF NOT EXISTS)
-- Step 3: 데이터 유효성 검증
-- Step 4: 칼럼 변환
-- Step 5: 기본값 설정
-- Step 6: 최종 검증

COMMIT;  -- 성공 시 커밋
```

**핵심 원칙**:
- 트랜잭션 사용 (안전성)
- IF NOT EXISTS (멱등성)
- RAISE NOTICE (가시성)
- 최종 검증 (신뢰성)

### Phase 3: GitHub Actions Workflow (10분)

```yaml
# fix-database-enum.yml

jobs:
  fix-enum:
    steps:
      - Parse DATABASE_URL (정규식)
      - Test connection (검증)
      - Diagnose or Fix (선택)
      - Regenerate Prisma (서버)
      - PM2 reload (무중단)
      - Verify (최종 확인)
```

**핵심 원칙**:
- 명확한 에러 메시지
- 각 단계 검증
- 실패 시 즉시 중단
- 최종 검증 필수

### Phase 4: Prisma Migration 도입 (30분)

```bash
# 1. Baseline 생성
npx prisma migrate dev --name init --create-only

# 2. 프로덕션 적용 기록
npx prisma migrate resolve --applied "init"

# 3. 배포 프로세스에 추가
# deploy-production.yml에 prisma migrate deploy 추가

# 4. 향후 변경 시
npx prisma migrate dev --name change_name
git push  # 자동 배포
```

## 시니어 vs 주니어 접근법 비교

| 측면 | 주니어 개발자 | 시니어 개발자 |
|------|--------------|--------------|
| **문제 진단** | 추측으로 시작 | DB 상태 직접 확인 |
| **해결 접근** | 여러 시도 반복 | 한 번에 정확한 해결책 |
| **스크립트** | 복잡한 heredoc | 별도 SQL 파일 (버전 관리) |
| **검증** | Workflow 성공 여부만 | 실제 DB 변경 및 로그 확인 |
| **문서화** | 사후 보고서 | 실행 가이드 + 교육 자료 |
| **장기 대책** | 없음 | Prisma Migration 도입 |

## 학습 포인트

### 1. 기본 개념 확실히 하기

**Prisma 명령어**:
- `generate`: 클라이언트 코드만
- `migrate dev`: 로컬 개발용 마이그레이션
- `migrate deploy`: 프로덕션 배포용
- `db push`: 프로토타입 전용 (마이그레이션 없음)

### 2. 문제 해결 순서

1. **진단** - 추측하지 말고 확인
2. **분석** - 근본 원인 파악
3. **설계** - 해결책 설계 (단순하게)
4. **구현** - 검증된 방법 사용
5. **검증** - 실제 결과 확인
6. **예방** - 재발 방지 대책

### 3. 복잡도 관리

- 간단한 문제는 간단하게 해결
- 이미 있는 도구 활용 (Prisma Migration)
- 새 도구 만들기 전에 기존 도구 확인
- 한 번에 하나씩 (여러 workflow 동시 생성 금지)

### 4. 검증 문화

```bash
# 모든 작업 후 3단계 검증
1. 로그 확인 - 에러 메시지
2. 상태 확인 - DB/서비스 상태
3. 기능 테스트 - 실제 API 호출
```

### 5. 문서화 습관

- **Before**: 현재 상태 기록
- **After**: 변경 사항 기록
- **How to**: 재현 방법 기록
- **Why**: 왜 이 방법을 선택했는지

## 팀 개선 제안

### 1. 개발 프로세스

- [ ] Prisma Migration 도입 (완료)
- [ ] 스키마 변경 체크리스트 작성
- [ ] 배포 전 마이그레이션 검증
- [ ] Staging 환경에서 테스트

### 2. 교육

- [ ] Prisma ORM 기본 교육
- [ ] Database Migration 개념 교육
- [ ] 문제 해결 방법론 교육
- [ ] 이 사례 스터디 공유

### 3. 도구

- [ ] DB 스키마 자동 검증 도구
- [ ] Migration 상태 대시보드
- [ ] 배포 체크리스트 자동화
- [ ] 롤백 프로세스 문서화

### 4. 모니터링

- [ ] API 에러율 알림
- [ ] PM2 재시작 알림
- [ ] DB 타입 불일치 감지
- [ ] 정기 헬스체크

## 결론

이 사건은 **기본 개념 부족**과 **체계적 접근 부재**로 발생했습니다.

**주니어 개발자가 배워야 할 것**:
1. ORM의 작동 방식 (generate vs migrate)
2. 문제 진단 능력 (추측 대신 확인)
3. 단순한 해결책 선호
4. 철저한 검증 습관
5. 재발 방지 대책

**팀이 개선해야 할 것**:
1. Migration 시스템 도입
2. 배포 프로세스 표준화
3. 개발자 교육 강화
4. 문서화 문화 정착

**긍정적 측면**:
- 상세한 보고서 작성 (비록 해결은 못했지만)
- 포기하지 않고 계속 시도
- 도움 요청 (시니어에게 보고)

---

**작성일**: 2025-11-05
**작성자**: Senior Developer
**목적**: 교육 자료 및 재발 방지
**공유**: 전체 개발팀

## 참고 자료

- [실행 가이드](./SESSION_ENUM_FIX_EXECUTION_GUIDE.md)
- [Prisma Migration 도입](../migration/PRISMA_MIGRATION_SETUP.md)
- [주니어 개발자 보고서](./INSPECTION_SESSIONS_ENUM_ERROR_2025-11-05.md)

## 다음 단계

1. **즉시**: GitHub Actions로 긴급 수정
2. **오늘**: Prisma Migration 초기화
3. **이번 주**: 팀 교육 및 프로세스 개선
4. **다음 주**: 유사 문제 예방 점검

## 피드백

이 분석에 대한 피드백이나 질문이 있으면:
- Slack: #engineering
- Email: senior-dev@nmc.or.kr
- 1:1 미팅 요청
