# session_status Enum 오류 즉시 해결 실행 가이드

## 시니어 개발자의 진단 결과

### 주니어 개발자가 놓친 핵심 문제

**`prisma generate` vs `prisma migrate`의 차이**

```
prisma generate   → TypeScript 클라이언트 코드만 생성 (DB 변경 안 함)
prisma migrate    → 실제 데이터베이스 스키마 변경
```

주니어 개발자는 `npx prisma generate`만 계속 실행했기 때문에,
**데이터베이스 자체는 한 번도 수정되지 않았습니다.**

### 진짜 문제

- Prisma Schema: `session_status` enum으로 정의됨
- PostgreSQL DB: `status` 칼럼이 TEXT 또는 VARCHAR 타입
- **타입 불일치로 쿼리 실패**

## 즉시 해결 방법 (30분 소요)

### Option 1: GitHub Actions 사용 (권장)

#### Step 1: 진단 실행

```bash
# 1. GitHub 웹에서 실행
https://github.com/truth0530/AEDpics/actions/workflows/fix-database-enum.yml

# 2. "Run workflow" 클릭
# 3. action: diagnose 선택
# 4. "Run workflow" 버튼 클릭

# 또는 CLI 사용
gh workflow run fix-database-enum.yml -f action=diagnose

# 결과 확인
gh run watch
```

**예상 결과:**
```
✗ session_status enum이 존재하지 않습니다
✗ status 칼럼이 text 타입입니다 (변환 필요)
```

#### Step 2: 수정 실행

```bash
# 1. GitHub 웹에서 실행
https://github.com/truth0530/AEDpics/actions/workflows/fix-database-enum.yml

# 2. "Run workflow" 클릭
# 3. action: fix 선택
# 4. "Run workflow" 버튼 클릭

# 또는 CLI 사용
gh workflow run fix-database-enum.yml -f action=fix
gh run watch
```

**실행 내용:**
1. Database connection 테스트
2. session_status enum 생성
3. inspection_sessions.status 칼럼을 enum으로 변환
4. 서버에서 Prisma Client 재생성
5. PM2 reload (Zero-Downtime)
6. 검증

**예상 소요 시간:** 5분

#### Step 3: 검증

```bash
# 서버 로그 확인
gh workflow run check-server-logs.yml
gh run watch

# 또는 직접 확인
ssh <server>
pm2 logs aedpics --lines 50
```

**성공 확인:**
- `operator does not exist: text = session_status` 에러가 더 이상 없음
- PM2 status: `online`
- PM2 restarts: 0 또는 낮은 숫자

### Option 2: 수동 실행 (고급)

로컬 머신에서 실행:

```bash
# 1. 프로젝트 디렉토리로 이동
cd /Users/kwangsunglee/Projects/AEDpics

# 2. 진단 실행
PGPASSWORD="<password>" psql \
  -h pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com \
  -U aedpics_admin \
  -d aedpics_production \
  -f scripts/diagnose-session-enum.sql

# 3. 수정 실행
PGPASSWORD="<password>" psql \
  -h pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com \
  -U aedpics_admin \
  -d aedpics_production \
  -f scripts/fix-session-enum-verified.sql

# 4. 서버에서 Prisma Client 재생성
ssh <server> << 'EOF'
cd /var/www/aedpics
npx prisma generate
pm2 reload ecosystem.config.cjs
EOF
```

## 장기 해결 방법 (향후 재발 방지)

### 1. Prisma Migration 초기화

```bash
# 로컬 개발 환경에서

# Step 1: 현재 DB 상태를 기준으로 초기 마이그레이션 생성
npx prisma migrate dev --name init --create-only

# Step 2: 생성된 마이그레이션 확인
cat prisma/migrations/*/migration.sql

# Step 3: 이미 존재하는 테이블이므로 SQL을 비우기
echo "-- Baseline migration (all tables already exist)" > prisma/migrations/*/migration.sql

# Step 4: 마이그레이션을 적용된 것으로 표시
npx prisma migrate resolve --applied "<timestamp>_init"

# Step 5: Git 커밋
git add prisma/migrations/
git commit -m "chore: Initialize Prisma migrations baseline"
git push
```

### 2. 향후 스키마 변경 시 올바른 절차

```bash
# 1. schema.prisma 수정
vim prisma/schema.prisma

# 2. 로컬 마이그레이션 생성 및 적용
npx prisma migrate dev --name descriptive_name

# 3. 생성된 SQL 확인
cat prisma/migrations/*/migration.sql

# 4. Git 커밋
git add prisma/
git commit -m "feat: Add new_field to table"

# 5. Push (자동 배포)
git push origin main
# → GitHub Actions가 자동으로 prisma migrate deploy 실행
```

### 3. 배포 프로세스 개선 완료

`deploy-production.yml`이 이미 개선되었습니다:

```yaml
- name: Run database migrations
  run: |
    npx prisma migrate deploy  # 자동 실행
    npx prisma migrate status   # 검증
```

## 핵심 교훈

### 주니어 개발자의 실수

1. **개념 혼동**
   - `prisma generate`: 클라이언트 코드만 생성
   - `prisma migrate`: DB 스키마 변경
   - 둘은 완전히 다른 명령어!

2. **진단 부족**
   - DB에 직접 접속해서 현재 상태 확인 필요
   - 추측하지 말고, 확인하라

3. **과도한 자동화**
   - 문제를 이해하기 전에 workflow 만들기 금지
   - 간단한 문제는 간단하게 해결

4. **검증 부족**
   - 각 시도 후 결과 확인 필수
   - Silent failure 조심 (exit code 0이지만 실제 실패)

### 올바른 접근

1. **문제 진단**
   ```bash
   # 실제 DB 상태 확인
   psql -c "SELECT * FROM pg_type WHERE typname = 'session_status'"
   ```

2. **검증된 스크립트**
   - 트랜잭션 사용 (ROLLBACK 가능)
   - 각 단계마다 NOTICE 출력
   - 최종 검증 쿼리 포함

3. **단계적 해결**
   - 진단 → 수정 → 검증
   - 한 번에 한 가지만

4. **근본 해결**
   - 임시방편 금지
   - Prisma Migration 도입

## 자주 묻는 질문

### Q: prisma generate를 실행했는데 왜 DB가 변경 안 되나요?

**A:** `prisma generate`는 TypeScript 클라이언트 코드만 생성합니다.
데이터베이스를 변경하려면 `prisma migrate deploy` 또는 수동 SQL이 필요합니다.

### Q: 주니어 개발자가 만든 workflow들은 왜 실패했나요?

**A:**
1. **fix-session-enum.yml**: DATABASE_URL 파싱 실패 (복잡한 bash 구문)
2. **verify-and-fix-enum.yml**: GitHub API 캐시 (workflow_dispatch 인식 안 됨)
3. **emergency-fix-enum.yml**: 동일한 API 캐시 문제

### Q: emergency-fix.yml에 Step 7.5를 추가한 것은 왜 작동하지 않았나요?

**A:** 실제로는 **실행되지 않았습니다**.
주니어 개발자가 웹 UI에서 수동 실행을 시도했지만, GitHub API 캐시 때문에 불가능했습니다.
코드는 올바르지만, 실행되지 못했습니다.

### Q: 왜 여러 workflow를 만들었나요?

**A:** 주니어 개발자가 문제를 제대로 이해하지 못한 채 계속 새로운 시도를 했기 때문입니다.
한 번에 정확한 해결책을 만들었다면 하나의 workflow만 필요했을 것입니다.

### Q: 이제 무엇을 해야 하나요?

**A:**
1. **즉시**: 위의 Option 1 (GitHub Actions) 실행
2. **오늘 중**: Prisma Migration 초기화
3. **다음 주**: 팀 교육 및 문서 공유

## 관련 문서

- [Prisma Migration 도입 가이드](../migration/PRISMA_MIGRATION_SETUP.md)
- [주니어 개발자의 원본 보고서](./INSPECTION_SESSIONS_ENUM_ERROR_2025-11-05.md)
- [수정 스크립트](../../scripts/fix-session-enum-verified.sql)
- [진단 스크립트](../../scripts/diagnose-session-enum.sql)

## 추가 도움

문제가 지속되면:

1. **Slack 채널에 문의**
   - #dev-help 또는 #engineering

2. **시니어 개발자에게 직접 연락**
   - DM 또는 이메일

3. **GitHub Issue 생성**
   - 자세한 에러 로그 첨부

---

**작성일**: 2025-11-05
**작성자**: Senior Developer
**검토자**: Technical Lead

**주의**: 이 가이드를 따라하기 전에 반드시 백업을 확인하세요.
