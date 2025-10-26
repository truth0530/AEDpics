# CI/CD 설정 가이드

**작성일**: 2025-10-26
**버전**: 1.0.0

## 개요

GitHub Actions를 사용한 AEDpics 자동 빌드, 테스트, 배포 파이프라인 설정 가이드입니다.

## GitHub Actions Workflows

### 1. Build and Test (build-check.yml)

**트리거**:
- `main`, `develop` 브랜치에 push
- `main` 브랜치로 Pull Request

**동작**:
1. Node.js 20 설정
2. 의존성 설치 (`npm ci`)
3. Prisma Client 생성
4. TypeScript 타입 체크
5. ESLint 실행
6. Next.js 빌드
7. 빌드 결과물 업로드 (7일 보관)

### 2. Deploy to Production (deploy-production.yml)

**트리거**:
- `main` 브랜치에 push
- `v*` 태그 push
- 수동 실행 (workflow_dispatch)

**동작**:
1. 코드 체크아웃
2. 의존성 설치 및 빌드
3. NCP 서버에 SSH 접속
4. 서버에서 git pull, 빌드, PM2 재시작
5. Health Check API 호출
6. Slack 알림 (성공/실패)

### 3. Database Backup (database-backup.yml)

**트리거**:
- 매일 새벽 2시 (KST 11시) 자동 실행
- 수동 실행 가능

**동작**:
1. PostgreSQL 클라이언트 설치
2. pg_dump로 백업 생성
3. gzip 압축
4. GitHub Artifacts에 업로드 (30일 보관)
5. Slack 알림

## GitHub Secrets 설정

GitHub 저장소의 Settings → Secrets and variables → Actions에서 다음 secrets를 추가해야 합니다.

### 필수 Secrets

**데이터베이스**
- `DATABASE_URL`: PostgreSQL 연결 문자열
  ```
  postgresql://aedpics_admin:AEDpics2025*NCP@pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com:5432/aedpics_production?schema=aedpics
  ```
- `DB_HOST`: pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com
- `DB_PORT`: 5432
- `DB_NAME`: aedpics_production
- `DB_USER`: aedpics_admin
- `DB_PASSWORD`: AEDpics2025*NCP

**NextAuth**
- `NEXTAUTH_URL`: https://aedpics.nmc.or.kr
- `NEXTAUTH_SECRET`: (openssl rand -base64 32로 생성)
- `JWT_SECRET`: (openssl rand -base64 32로 생성)

**API Keys**
- `NEXT_PUBLIC_KAKAO_MAP_APP_KEY`: Kakao Maps API 키
- `RESEND_API_KEY`: Resend API 키

**Master Account**
- `MASTER_ACCOUNT_EMAIL`: truth0530@nmc.or.kr

**NCP 서버 (배포용)**
- `NCP_HOST`: NCP 서버 Public IP
- `NCP_USERNAME`: ubuntu (또는 서버 사용자명)
- `NCP_SSH_KEY`: SSH 개인키 (-----BEGIN RSA PRIVATE KEY----- 부터)
- `NCP_SSH_PORT`: 22 (또는 변경한 포트)

**알림 (선택)**
- `SLACK_WEBHOOK_URL`: Slack Incoming Webhook URL

## SSH 키 생성 및 등록

### 1. SSH 키 생성 (로컬)

```bash
# ED25519 키 생성 (권장)
ssh-keygen -t ed25519 -C "github-actions@aedpics" -f ~/.ssh/aedpics_deploy

# 또는 RSA 키 생성
ssh-keygen -t rsa -b 4096 -C "github-actions@aedpics" -f ~/.ssh/aedpics_deploy
```

### 2. 공개키를 NCP 서버에 등록

```bash
# 공개키 내용 확인
cat ~/.ssh/aedpics_deploy.pub

# NCP 서버에 접속하여 authorized_keys에 추가
ssh ubuntu@<NCP_SERVER_IP>
echo "<공개키 내용>" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### 3. 개인키를 GitHub Secrets에 등록

```bash
# 개인키 내용 확인
cat ~/.ssh/aedpics_deploy
```

GitHub → Settings → Secrets → New repository secret
- Name: `NCP_SSH_KEY`
- Value: 개인키 전체 내용 (-----BEGIN부터 -----END까지)

## Slack 알림 설정 (선택)

### 1. Slack Incoming Webhook 생성

1. Slack 워크스페이스에서 Apps 검색
2. "Incoming Webhooks" 앱 추가
3. 채널 선택 (#deployments 등)
4. Webhook URL 복사

### 2. GitHub Secret 등록

- Name: `SLACK_WEBHOOK_URL`
- Value: `https://hooks.slack.com/services/...`

## 배포 프로세스

### 자동 배포 (main 브랜치 푸시 시)

```bash
git add .
git commit -m "feat: 새로운 기능 추가"
git push origin main
```

GitHub Actions가 자동으로:
1. 빌드 및 테스트 실행
2. 성공 시 NCP 서버에 배포
3. PM2로 애플리케이션 재시작
4. Health Check 확인
5. Slack 알림 전송

### 수동 배포

GitHub → Actions → Deploy to Production → Run workflow → Run workflow

### 태그 기반 배포 (릴리스)

```bash
# 버전 태그 생성
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

## 롤백 프로세스

### 방법 1: Git Revert

```bash
# 문제가 있는 커밋 되돌리기
git revert <commit-hash>
git push origin main
```

자동으로 재배포됨

### 방법 2: 서버에서 직접 롤백

```bash
# NCP 서버에 SSH 접속
ssh ubuntu@<NCP_SERVER_IP>

cd /var/www/aedpics

# 이전 커밋으로 롤백
git log --oneline  # 롤백할 커밋 확인
git reset --hard <commit-hash>

# 빌드 및 재시작
npm ci
npx prisma generate
npm run build
pm2 reload aedpics
```

## 환경별 배포 전략

### Development
- `develop` 브랜치
- 자동 빌드/테스트만 실행
- 배포 없음

### Staging (미래)
- `staging` 브랜치
- 자동 배포
- 스테이징 서버

### Production
- `main` 브랜치
- 자동 배포
- Health check 포함

## 모니터링

### GitHub Actions 로그 확인

GitHub → Actions → 워크플로우 선택 → 실행 기록 클릭

### 배포 상태 확인

```bash
# NCP 서버에서
pm2 status
pm2 logs aedpics --lines 50
```

### Health Check

```bash
curl https://aedpics.nmc.or.kr/api/health
```

## 트러블슈팅

### 문제: SSH 연결 실패

**증상**: `Permission denied (publickey)`

**해결**:
1. SSH 키가 올바르게 등록되었는지 확인
2. NCP 서버 ~/.ssh/authorized_keys 권한 확인 (600)
3. GitHub Secret에 올바른 개인키가 등록되었는지 확인

### 문제: 빌드 실패

**증상**: `npm run build` 단계에서 실패

**해결**:
1. 로컬에서 먼저 빌드 테스트
2. 환경변수가 모두 설정되었는지 확인
3. `npm ci`로 깨끗한 설치 시도

### 문제: 배포 후 애플리케이션 실행 안됨

**증상**: Health check 실패

**해결**:
```bash
# NCP 서버에서
pm2 logs aedpics --err
pm2 restart aedpics
```

### 문제: Prisma Client 오류

**증상**: `Cannot find module '@prisma/client'`

**해결**:
```bash
# NCP 서버에서
npx prisma generate
pm2 restart aedpics
```

## 베스트 프랙티스

### 1. 커밋 메시지 규칙
```
feat: 새로운 기능 추가
fix: 버그 수정
docs: 문서 수정
chore: 빌드/설정 변경
refactor: 리팩토링
test: 테스트 추가/수정
```

### 2. Pull Request 사용
- `develop` → `main`으로 PR 생성
- 코드 리뷰 후 머지
- 자동 배포 실행

### 3. 릴리스 노트
- 버전 태그와 함께 릴리스 노트 작성
- GitHub Releases 활용

### 4. 정기 백업 확인
- 매일 백업이 정상 실행되는지 확인
- 주 1회 복구 테스트

## 체크리스트

### 초기 설정
- [ ] GitHub Secrets 모두 등록
- [ ] SSH 키 생성 및 등록
- [ ] NCP 서버에 애플리케이션 초기 배포
- [ ] PM2 설정 완료
- [ ] Nginx 설정 완료
- [ ] Health Check API 동작 확인
- [ ] Slack Webhook 설정 (선택)

### 배포 전
- [ ] 로컬에서 빌드 테스트
- [ ] TypeScript 오류 없음
- [ ] ESLint 통과
- [ ] 기능 테스트 완료

### 배포 후
- [ ] GitHub Actions 성공 확인
- [ ] Health Check 정상
- [ ] 브라우저에서 동작 확인
- [ ] Slack 알림 수신 확인
- [ ] PM2 로그 확인

## 참고 문서

- [GitHub Actions 공식 문서](https://docs.github.com/en/actions)
- [PM2 공식 문서](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [NCP 프로덕션 설정 가이드](./NCP_PRODUCTION_SETUP.md)

---

**최종 업데이트**: 2025-10-26
**문서 버전**: 1.0.0
