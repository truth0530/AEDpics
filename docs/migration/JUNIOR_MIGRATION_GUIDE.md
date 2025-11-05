# 주니어 개발자를 위한 Prisma Migration 완벽 가이드

## 목차
1. [기본 개념 이해](#기본-개념-이해)
2. [흔한 실수와 해결법](#흔한-실수와-해결법)
3. [올바른 작업 순서](#올바른-작업-순서)
4. [실전 예제](#실전-예제)
5. [문제 해결 체크리스트](#문제-해결-체크리스트)
6. [긴급 상황 대응](#긴급-상황-대응)

---

## 기본 개념 이해

### Prisma의 세 가지 핵심 명령어

| 명령어 | 역할 | 데이터베이스 변경 | 언제 사용? |
|--------|------|------------------|------------|
| `prisma generate` | TypeScript 클라이언트 코드 생성 | ❌ 없음 | 스키마 변경 후 코드 업데이트 |
| `prisma migrate dev` | 개발용 마이그레이션 생성 및 적용 | ✅ 있음 | 로컬 개발 중 |
| `prisma migrate deploy` | 프로덕션 마이그레이션 적용 | ✅ 있음 | 배포 시 |

### 중요한 진실: `generate`는 DB를 바꾸지 않습니다!

```bash
# ❌ 잘못된 이해
npx prisma generate  # "이제 DB가 바뀌었겠지?"
# 실제: TypeScript 코드만 생성됨. DB는 그대로!

# ✅ 올바른 이해
npx prisma generate  # TypeScript 타입 생성
npx prisma migrate dev  # 로컬 DB 변경
npx prisma migrate deploy  # 프로덕션 DB 변경
```

## 흔한 실수와 해결법

### 실수 1: "generate만 계속 실행하기"

**증상**:
```
Error: operator does not exist: text = session_status
```

**원인**:
- Prisma schema에서 enum 타입으로 정의
- 실제 DB는 TEXT 타입
- `prisma generate`만 실행해서 DB는 변경되지 않음

**해결**:
```bash
# 1. 현재 상태 확인
npx prisma migrate status

# 2. 마이그레이션 생성 및 적용
npx prisma migrate dev --name add_enum_type

# 3. 프로덕션 배포
git push  # GitHub Actions가 자동으로 migrate deploy 실행
```

### 실수 2: "에러 메시지를 무시하고 추측하기"

**잘못된 접근**:
```bash
# 에러 발생
# → 구글링
# → 아무거나 시도
# → 더 큰 문제 발생
```

**올바른 접근**:
```bash
# 1. 에러 메시지 정확히 읽기
cat error.log | grep -A 5 "Error:"

# 2. 현재 상태 진단
npx prisma migrate status  # 마이그레이션 상태
npx prisma db pull  # 실제 DB 스키마 확인

# 3. 차이점 파악
diff prisma/schema.prisma prisma/schema.backup.prisma

# 4. 해결책 적용
```

### 실수 3: "프로덕션에서 migrate dev 실행"

**절대 금지**:
```bash
# ❌ 프로덕션 서버에서 실행하면 안 됨!
ssh production-server
npx prisma migrate dev  # 위험! 데이터 손실 가능!
```

**올바른 방법**:
```bash
# ✅ 로컬에서 마이그레이션 생성
npx prisma migrate dev --name descriptive_name

# ✅ Git으로 배포
git add prisma/migrations/
git commit -m "feat: Add new migration"
git push  # GitHub Actions가 migrate deploy 실행
```

## 올바른 작업 순서

### 스키마 변경 시 표준 프로세스

#### Step 1: 로컬 개발
```bash
# 1. schema.prisma 수정
code prisma/schema.prisma

# 2. 변경사항 저장
git diff prisma/schema.prisma  # 변경 확인

# 3. 마이그레이션 생성
npx prisma migrate dev --name add_user_role_field
# → SQL 파일 자동 생성
# → 로컬 DB에 적용
# → TypeScript 코드 자동 생성

# 4. 테스트
npm run dev  # 로컬에서 테스트
```

#### Step 2: 코드 작성
```typescript
// 새로운 필드 사용
const user = await prisma.user.create({
  data: {
    email: "test@example.com",
    role: "admin"  // 새로 추가한 필드
  }
});
```

#### Step 3: 배포
```bash
# 1. 모든 변경사항 커밋
git add .
git commit -m "feat: Add user role field"

# 2. 푸시 (자동 배포)
git push origin main
# → GitHub Actions 실행
# → migrate deploy 자동 실행
# → 프로덕션 DB 업데이트
```

## 실전 예제

### 예제 1: Enum 타입 추가하기

```prisma
// prisma/schema.prisma

// Before
model User {
  id     String @id @default(uuid())
  status String  // TEXT 타입
}

// After
enum UserStatus {
  active
  inactive
  suspended
}

model User {
  id     String     @id @default(uuid())
  status UserStatus @default(active)  // Enum 타입
}
```

**적용 과정**:
```bash
# 1. 마이그레이션 생성
npx prisma migrate dev --name add_user_status_enum

# 2. 생성된 SQL 확인
cat prisma/migrations/*_add_user_status_enum/migration.sql

# 3. 테스트
npm run test

# 4. 배포
git add prisma/
git commit -m "feat: Add UserStatus enum"
git push
```

### 예제 2: 인덱스 추가하기

```prisma
// prisma/schema.prisma
model AED {
  id              String @id
  equipment_serial String
  created_at      DateTime

  @@index([equipment_serial])  // 새 인덱스 추가
  @@index([created_at])        // 새 인덱스 추가
}
```

**적용 과정**:
```bash
# 1. 마이그레이션 생성 (인덱스는 데이터 손실 없음)
npx prisma migrate dev --name add_aed_indexes

# 2. 성능 테스트
npm run test:performance

# 3. 배포
git push  # 자동 배포
```

## 문제 해결 체크리스트

### 에러 발생 시 확인 순서

#### 1. 현재 상태 진단
```bash
# 마이그레이션 상태
npx prisma migrate status

# DB 연결 테스트
npx prisma db pull --print

# 에러 로그 확인
pm2 logs --err --lines 100
```

#### 2. 타입 불일치 확인
```sql
-- PostgreSQL에서 직접 확인
SELECT
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_schema = 'aedpics'
  AND table_name = 'your_table';
```

#### 3. 마이그레이션 히스토리 확인
```sql
-- 적용된 마이그레이션 확인
SELECT * FROM _prisma_migrations
ORDER BY finished_at DESC;
```

### 자주 발생하는 에러와 해결법

#### 에러 1: "The database schema is not empty"
```bash
# 원인: 이미 테이블이 있는 DB에 첫 마이그레이션 시도

# 해결:
npx prisma db pull  # 현재 DB 스키마를 schema.prisma로 가져오기
npx prisma migrate dev --name init --create-only  # 마이그레이션만 생성
npx prisma migrate resolve --applied "20251105_init"  # 이미 적용됨으로 표시
```

#### 에러 2: "P3009: migrate found failed migrations"
```bash
# 원인: 이전 마이그레이션 실패

# 해결:
# 1. 실패한 마이그레이션 확인
npx prisma migrate status

# 2. 수동으로 해결된 경우
npx prisma migrate resolve --applied "migration_name"

# 3. 롤백이 필요한 경우
npx prisma migrate resolve --rolled-back "migration_name"
```

#### 에러 3: "Cannot find module './prisma/client'"
```bash
# 원인: prisma generate 실행 안 함

# 해결:
npx prisma generate
```

## 긴급 상황 대응

### 상황 1: 프로덕션 DB 타입 에러

**즉시 조치**:
```bash
# GitHub Actions 실행
gh workflow run fix-database-enum.yml -f action=diagnose
gh workflow run fix-database-enum.yml -f action=fix
```

### 상황 2: 마이그레이션으로 인한 배포 실패

**해결 과정**:
```bash
# 1. 마이그레이션 상태 확인
gh workflow run monitor-migrations.yml

# 2. Baseline 적용 (이미 수동 적용된 경우)
gh workflow run apply-baseline.yml -f confirm=APPLY -f dry_run=false

# 3. 재배포
git commit --allow-empty -m "chore: Trigger deployment"
git push
```

### 상황 3: 로컬과 프로덕션 스키마 불일치

**동기화 과정**:
```bash
# 1. 프로덕션 스키마 백업
npx prisma db pull --print > schema.production.prisma

# 2. 차이 확인
diff prisma/schema.prisma schema.production.prisma

# 3. 조정
# Option A: 프로덕션에 맞추기
cp schema.production.prisma prisma/schema.prisma
npx prisma generate

# Option B: 로컬 변경 적용
npx prisma migrate deploy
```

## 모니터링 활용

### 자동 모니터링 확인
```bash
# 수동 실행
gh workflow run monitor-migrations.yml

# 결과 확인
gh run list --workflow=monitor-migrations.yml
gh run view <run-id>
```

### Slack 알림 설정
- 6시간마다 자동 체크
- 미적용 마이그레이션 발견 시 알림
- GitHub Issue 자동 생성

## 베스트 프랙티스

### DO ✅
1. **항상 로컬에서 먼저 테스트**
2. **마이그레이션 이름을 명확하게**
   ```bash
   npx prisma migrate dev --name add_user_email_index  # Good
   npx prisma migrate dev --name fix  # Bad
   ```

3. **변경 전 백업**
   ```bash
   cp prisma/schema.prisma prisma/schema.backup.prisma
   ```

4. **단계적 변경**
   - 한 번에 하나씩
   - 각 단계 테스트
   - 문제 발생 시 즉시 롤백

### DON'T ❌
1. **프로덕션에서 직접 스키마 수정 금지**
2. **migrate reset 사용 금지 (데이터 삭제됨)**
3. **에러 무시하고 진행 금지**
4. **백업 없이 대규모 변경 금지**

## 도움 요청

### 막혔을 때
1. **에러 메시지 전체 복사**
2. **현재 상태 정보 수집**
   ```bash
   npx prisma migrate status > status.txt
   npx prisma --version > version.txt
   git log --oneline -5 > recent-commits.txt
   ```

3. **시니어에게 공유**
   - Slack: #dev-help
   - 위 파일들과 함께 상황 설명

### 참고 자료
- [Prisma 공식 문서](https://www.prisma.io/docs)
- [마이그레이션 트러블슈팅](https://www.prisma.io/docs/guides/database/troubleshooting)
- [팀 내부 문서](./PRISMA_MIGRATION_SETUP.md)

---

**작성일**: 2025-11-05
**대상**: 주니어 개발자
**목적**: Prisma Migration 실수 방지 및 올바른 사용법 교육
**업데이트**: 실제 사례 기반으로 지속적 업데이트 예정

## 핵심 요약 (5분 안에 읽기)

1. **`prisma generate` ≠ DB 변경**
   - generate: TypeScript 코드만 생성
   - migrate: 실제 DB 변경

2. **올바른 순서**
   - 로컬: schema 수정 → migrate dev → 테스트
   - 배포: git push → 자동 migrate deploy

3. **에러 시**
   - 추측 금지
   - migrate status 확인
   - 시니어 도움 요청

4. **절대 금지**
   - 프로덕션에서 migrate dev
   - migrate reset
   - 에러 무시

기억하세요: **모르면 물어보는 것이 가장 빠른 해결책입니다!**