# Prisma Migration 시스템 도입 가이드

## 왜 Prisma Migration이 필요한가?

### 현재 문제점
- Schema 변경 시 수동 SQL 스크립트 작성 필요
- 데이터베이스와 코드 간 동기화 보장 어려움
- 배포 시 스키마 변경 누락 위험
- 변경 이력 추적 불가능

### Prisma Migration의 장점
- Schema 변경 자동 추적
- 버전 관리된 마이그레이션 파일
- 개발/프로덕션 환경 일관성 보장
- 롤백 가능

## 초기 설정 단계

### 1. 현재 데이터베이스 상태 기록 (Baseline)

```bash
# 프로덕션 DB의 현재 스키마를 기준으로 초기 마이그레이션 생성
npx prisma migrate dev --name init --create-only

# 생성된 마이그레이션 파일 확인
ls -la prisma/migrations/
# → prisma/migrations/20251105_init/
#    └── migration.sql
```

**중요**: `--create-only` 플래그로 파일만 생성하고 실행하지 않음

### 2. 초기 마이그레이션 파일 수정

생성된 `migration.sql`을 프로덕션 DB의 실제 상태와 일치시킵니다:

```sql
-- 이미 존재하는 테이블은 CREATE 문 제거
-- 대신 주석으로 표시
-- Tables already exist in production:
-- - users
-- - organizations
-- - aed_devices
-- etc.

-- 현재 프로덕션에 없는 것만 추가
-- (현재는 모든 테이블이 이미 존재함)
```

### 3. Baseline 마이그레이션 표시

프로덕션 DB에 마이그레이션 기록만 추가 (실제 변경은 하지 않음):

```bash
# 로컬에서 마이그레이션 히스토리 생성
npx prisma migrate resolve --applied "20251105_init"
```

프로덕션 DB에서 실행:

```sql
-- _prisma_migrations 테이블 생성 (없으면)
CREATE TABLE IF NOT EXISTS "aedpics"."_prisma_migrations" (
    "id" VARCHAR(36) PRIMARY KEY NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0
);

-- 초기 마이그레이션 기록 추가
INSERT INTO "aedpics"."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "applied_steps_count", "started_at")
VALUES
    (gen_random_uuid(), 'baseline', now(), '20251105_init', NULL, 0, now());
```

### 4. 이후 스키마 변경 프로세스

#### 4.1 로컬 개발

```bash
# 1. schema.prisma 수정
vim prisma/schema.prisma

# 2. 마이그레이션 생성 및 적용 (로컬 DB)
npx prisma migrate dev --name add_new_field

# 3. 생성된 마이그레이션 파일 확인
cat prisma/migrations/20251105_add_new_field/migration.sql

# 4. Git 커밋
git add prisma/
git commit -m "feat: Add new_field to table_name"
```

#### 4.2 프로덕션 배포

```bash
# 배포 시 자동 실행되도록 설정 (아래 배포 프로세스 참조)
npx prisma migrate deploy
```

## 배포 프로세스 개선

### deploy-production.yml 수정

```yaml
- name: Run Prisma Migrations
  run: |
    cd /var/www/aedpics
    npx prisma migrate deploy
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}

- name: Generate Prisma Client
  run: |
    cd /var/www/aedpics
    npx prisma generate
```

### 순서 중요

1. **prisma migrate deploy** (DB 스키마 변경)
2. **prisma generate** (TypeScript 클라이언트 재생성)
3. **npm run build** (애플리케이션 빌드)
4. **pm2 reload** (서비스 재시작)

## session_status Enum 문제의 올바른 해결

### 잘못된 방법 (주니어 개발자)
```bash
# ❌ prisma generate만 실행 (DB는 변경 안 됨)
npx prisma generate
pm2 reload
```

### 올바른 방법 (시니어 개발자)

#### Option A: Prisma Migration 사용 (권장)

```bash
# 1. 로컬에서 마이그레이션 생성
npx prisma migrate dev --name fix_session_status_enum

# 2. 생성된 SQL 확인 및 수정 (필요시)
cat prisma/migrations/*/migration.sql

# 3. 커밋 및 푸시
git add prisma/migrations/
git commit -m "fix: Convert session_status to enum type"
git push

# 4. 배포 시 자동 실행
# (GitHub Actions workflow에서 prisma migrate deploy 실행)
```

#### Option B: 수동 마이그레이션 + Prisma Resolve (긴급)

```bash
# 1. DB 직접 수정 (검증된 스크립트 사용)
psql -f scripts/fix-session-enum-verified.sql

# 2. Prisma에게 마이그레이션 적용됨을 알림
npx prisma migrate resolve --applied "20251105_fix_session_status"

# 3. Prisma Client 재생성
npx prisma generate

# 4. 서비스 재시작
pm2 reload ecosystem.config.cjs
```

## 마이그레이션 모범 사례

### DO ✓

- 모든 스키마 변경은 `prisma migrate dev` 사용
- 마이그레이션 파일은 Git에 커밋
- 배포 시 `prisma migrate deploy` 자동 실행
- 중요한 변경 전 백업
- 마이그레이션 이름은 명확하게 (`add_user_role`, `fix_enum_type`)

### DON'T ✗

- 프로덕션 DB에서 직접 `prisma migrate dev` 실행
- 이미 배포된 마이그레이션 파일 수정
- `prisma db push` 사용 (프로토타입 전용)
- 마이그레이션 없이 schema.prisma만 수정
- `prisma generate`만 실행하고 DB는 변경 안 함

## 문제 해결

### 로컬과 프로덕션 스키마 불일치

```bash
# 프로덕션 스키마를 introspect
npx prisma db pull

# 차이점 확인
git diff prisma/schema.prisma

# 필요하면 마이그레이션 생성
npx prisma migrate dev --name sync_schema
```

### 마이그레이션 실패

```bash
# 실패한 마이그레이션 표시
npx prisma migrate resolve --rolled-back "20251105_failed"

# 수정 후 다시 시도
npx prisma migrate deploy
```

### 긴급 핫픽스

```bash
# 1. 수동 SQL 실행 (검증된 스크립트만)
psql -f scripts/fix-xxx.sql

# 2. Prisma에 알림
npx prisma migrate resolve --applied "hotfix_name"

# 3. 나중에 정식 마이그레이션으로 등록
npx prisma migrate dev --name formalize_hotfix
```

## 다음 단계

1. ✅ 현재 긴급 문제 해결 (수동 SQL + resolve)
2. ⏭️ Baseline 마이그레이션 설정
3. ⏭️ 배포 프로세스에 `prisma migrate deploy` 추가
4. ⏭️ 팀 교육 및 문서화
5. ⏭️ CI/CD 파이프라인 개선

## 참고 자료

- [Prisma Migration 공식 문서](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Baseline 마이그레이션](https://www.prisma.io/docs/guides/migrate/production-troubleshooting#how-to-baseline-a-database)
- [프로덕션 환경 마이그레이션](https://www.prisma.io/docs/guides/migrate/production-troubleshooting)

---

**작성일**: 2025-11-05
**작성자**: Senior Developer
**검토 필요**: 초기 baseline 설정 시 DBA와 협의
