# Inspection Sessions Enum 타입 오류 해결 (2025-11-05)

## 문제 요약

**발생 시각**: 2025-11-05 15:54~
**오류 코드**: PostgreSQL Error 42883
**영향 범위**: 점검 시작 기능 (inspection sessions) 전체 불능
**심각도**: Critical

## 오류 메시지

```
operator does not exist: text = session_status
ERROR: 42883
HINT: No operator matches the given name and argument types. You might need to add explicit type casts.
```

## 근본 원인

### 1. Prisma Schema vs PostgreSQL Schema 불일치

**Prisma Schema (prisma/schema.prisma)**:
```prisma
model inspection_sessions {
  status    session_status @default(active)  // enum 타입
  // ...
}

enum session_status {
  active
  in_progress
  completed
  cancelled
  paused
}
```

**문제**:
- Prisma 클라이언트가 `session_status` enum 타입으로 정의되어 있음
- 그러나 실제 PostgreSQL 데이터베이스에서는 enum이 제대로 생성되지 않았거나
- Prisma Client가 재생성되지 않아 타입 캐스팅이 올바르게 되지 않음

### 2. 가능한 원인

1. **마이그레이션 미실행**: Prisma migration이 프로덕션에 적용되지 않음
2. **Prisma Client 미갱신**: `prisma generate` 실행 안 됨
3. **DB Enum 누락**: PostgreSQL에 `session_status` enum 타입이 없음

## 진단 과정

### 1. GitHub Actions를 통한 로그 확인

```bash
# 로컬에서 실행
gh workflow run check-server-logs.yml
gh run watch <run-id> --exit-status
gh run view <run-id> --log
```

**결과**:
```
PM2 Status: online (2 instances, 12 restarts)
Uptime: 2h
Error: operator does not exist: text = session_status
```

### 2. SSH 접속 문제 (부차적 문제)

**시도한 명령**:
```bash
ssh -i ~/.ssh/aedpics-server-key.pem root@223.130.150.133
```

**오류**: Permission denied

**원인**:
- SSH 키는 존재하고 권한도 올바름 (400)
- 그러나 서버 접속 정보가 GitHub Secrets에 있어야 함
- 로컬 SSH 키와 서버에 등록된 공개키가 다를 수 있음

## 해결 방법

### 즉시 조치 (Critical Fix)

#### 옵션 1: Prisma Migration 실행 (권장)

GitHub Actions workflow를 통해 안전하게 마이그레이션 실행:

```bash
# 1. 워크플로우 확인
ls .github/workflows/ | grep migrate

# 2. 마이그레이션 워크플로우 실행
gh workflow run <migration-workflow>.yml

# 3. 결과 확인
gh run watch <run-id>
```

#### 옵션 2: Full Rebuild (빠른 해결)

```bash
# Full rebuild 워크플로우 실행
gh workflow run full-rebuild.yml

# 모니터링
gh run watch <run-id> --exit-status
```

**Full rebuild가 하는 일**:
1. `.next` 디렉토리 삭제
2. `node_modules` 삭제
3. `npm install` 재실행
4. `npx prisma generate` 실행 ← **핵심**
5. `npm run build` 실행
6. PM2 restart

### 근본 해결 (Long-term Fix)

#### 1. Prisma Schema 검증

프로덕션 데이터베이스 스키마 확인:

```sql
-- session_status enum이 존재하는지 확인
SELECT
  n.nspname AS schema_name,
  t.typname AS enum_name,
  e.enumlabel AS enum_value
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE t.typname = 'session_status'
ORDER BY e.enumsortorder;
```

**예상 결과**:
```
schema_name | enum_name       | enum_value
aedpics     | session_status  | active
aedpics     | session_status  | in_progress
aedpics     | session_status  | completed
aedpics     | session_status  | cancelled
aedpics     | session_status  | paused
```

#### 2. Enum이 없는 경우

마이그레이션 생성 및 실행:

```sql
-- aedpics 스키마에 session_status enum 생성
CREATE TYPE aedpics.session_status AS ENUM (
  'active',
  'in_progress',
  'completed',
  'cancelled',
  'paused'
);

-- inspection_sessions.status 컬럼 타입 변경
ALTER TABLE aedpics.inspection_sessions
ALTER COLUMN status TYPE aedpics.session_status
USING status::text::aedpics.session_status;
```

#### 3. 배포 체크리스트 업데이트

**docs/deployment/DEPLOYMENT_CHECKLIST.md**에 추가:

```markdown
## 배포 전 필수 확인사항

### Prisma 관련
- [ ] `npx prisma generate` 실행됨 확인
- [ ] 스키마 변경 시 마이그레이션 생성
- [ ] 로컬에서 마이그레이션 테스트
- [ ] 프로덕션 마이그레이션 실행 계획 수립

### 데이터베이스
- [ ] Enum 타입 변경 시 타입 캐스팅 검증
- [ ] 백업 완료 확인
- [ ] Rollback 계획 수립
```

## SSH 접속 표준화 (재발 방지)

### 1. SSH 접속 방법 문서화

**docs/operations/SSH_ACCESS_GUIDE.md** 생성:

```markdown
# 프로덕션 서버 SSH 접속 가이드

## 방법 1: GitHub Actions (권장)

모든 서버 작업은 GitHub Actions를 통해 수행:

\`\`\`bash
# 서버 로그 확인
gh workflow run check-server-logs.yml
gh run watch <run-id>
gh run view <run-id> --log

# PM2 상태 확인
gh workflow run pm2-status.yml

# 전체 재빌드
gh workflow run full-rebuild.yml
\`\`\`

## 방법 2: 직접 SSH 접속 (비상시)

### 사전 요구사항
1. SSH 키가 서버에 등록되어 있어야 함
2. GitHub Secrets에 저장된 키와 동일해야 함

### 접속 명령
\`\`\`bash
# 기본 접속 (권한 거부 시 사용 불가)
ssh -i ~/.ssh/aedpics-server-key.pem root@223.130.150.133

# 포트 지정
ssh -i ~/.ssh/aedpics-server-key.pem -p 22 root@223.130.150.133
\`\`\`

### 접속 실패 시

GitHub Secrets 확인:
- NCP_HOST: 223.130.150.133
- NCP_USERNAME: (서버 사용자명)
- NCP_SSH_KEY: (SSH 개인키 전체 내용)
- NCP_SSH_PORT: 22

### PM2 명령어

\`\`\`bash
# 상태 확인
pm2 status

# 로그 확인 (최근 100줄)
pm2 logs aedpics --nostream --lines 100

# 에러 로그만
pm2 logs --err --lines 50

# 재시작 (Zero-Downtime)
pm2 reload ecosystem.config.cjs

# 완전 재시작
pm2 restart aedpics
\`\`\`

## 비상 연락망

- 시스템 관리자: truth0530@nmc.or.kr
- 기술 지원: inhak@nmc.or.kr
\`\`\`

### 2. GitHub Actions Workflow 개선

**.github/workflows/emergency-db-fix.yml** 생성:

```yaml
name: Emergency DB Fix - Enum Types

on:
  workflow_dispatch:
    inputs:
      confirm:
        description: 'Type "CONFIRM" to proceed with DB fix'
        required: true

jobs:
  fix-enum-types:
    runs-on: ubuntu-latest
    environment: production
    if: github.event.inputs.confirm == 'CONFIRM'

    steps:
    - name: Fix session_status enum
      uses: appleboy/ssh-action@v1.0.0
      with:
        host: ${{ secrets.NCP_HOST }}
        username: ${{ secrets.NCP_USERNAME }}
        key: ${{ secrets.NCP_SSH_KEY }}
        port: ${{ secrets.NCP_SSH_PORT }}
        script: |
          cd /var/www/aedpics

          echo "=== Checking Prisma Client ==="
          npx prisma version

          echo ""
          echo "=== Regenerating Prisma Client ==="
          npx prisma generate

          echo ""
          echo "=== Restarting PM2 ==="
          pm2 reload ecosystem.config.cjs

          echo ""
          echo "=== Verification ==="
          sleep 3
          pm2 status
          pm2 logs --nostream --lines 20
```

## 예방 조치

### 1. 배포 자동화 개선

**GitHub Actions 배포 워크플로우에 추가**:

```yaml
- name: Verify Prisma Client
  run: |
    npx prisma generate
    npx prisma validate

- name: Check for pending migrations
  run: |
    npx prisma migrate status || echo "Migration check failed"
```

### 2. 모니터링 강화

**Slack 알림 추가**:

```yaml
- name: Notify on deployment
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: failure
    text: |
      Deployment failed!
      Check PM2 logs: gh workflow run check-server-logs.yml
```

### 3. Pre-deployment 체크리스트

매 배포 전 실행:

```bash
# 로컬 검증
npm run tsc          # TypeScript 검사
npm run lint         # ESLint 검사
npm run build        # 빌드 성공 확인
npx prisma validate  # Schema 검증
npx prisma generate  # Client 재생성

# 프로덕션 배포
git push origin main
```

## 재발 방지 체크리스트

- [ ] Enum 타입 변경 시 마이그레이션 생성 필수
- [ ] `prisma generate` 배포 스크립트에 포함
- [ ] GitHub Actions 통한 서버 관리 표준화
- [ ] SSH 직접 접속은 비상시에만 사용
- [ ] 모든 DB 변경은 마이그레이션으로 관리
- [ ] 배포 전 로컬 빌드 검증 필수

## 관련 문서

- [NCP 서버 설정](../deployment/NCP_SERVER_SETUP.md)
- [배포 절차](../deployment/DEPLOYMENT.md)
- [PM2 관리](../deployment/PM2_MANAGEMENT.md)
- [데이터베이스 마이그레이션](../migration/DATABASE_MIGRATION_GUIDE.md)

---

**마지막 업데이트**: 2025-11-05
**문서 작성자**: Claude Code
**심각도**: Critical
**해결 상태**: 진행 중
