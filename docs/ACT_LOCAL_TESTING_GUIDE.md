# act 로컬 GitHub Actions 테스트 가이드

## 문서 정보
- 작성일: 2025-10-27
- 상태: 진행 중 (colima I/O 문제로 중단)
- 목적: GitHub Actions 워크플로우를 로컬에서 테스트하기 위한 act 도구 설정

## 2단계 작업 목표

### 목표
1. act 도구 설치 및 설정
2. 로컬에서 GitHub Actions 워크플로우 테스트
3. NCP 자동 배포 테스트 준비

### 예상 이점
- 푸시 전 로컬에서 워크플로우 검증
- CI/CD 파이프라인 개발 속도 향상
- GitHub Actions 빌드 시간 절약

## 설치 완료 항목

### 1. act 도구 설치
```bash
brew install act
```

**설치 버전**: act version 0.2.82

### 2. Docker 환경 설치
Docker Desktop 설치 실패 (sudo 권한 필요)로 인해 colima 사용:

```bash
brew install colima docker
```

**설치된 버전**:
- colima: 0.9.1
- docker CLI: 28.5.1

### 3. colima 시작
```bash
colima start --cpu 4 --memory 8
```

### 4. act 설정
```bash
mkdir -p "$HOME/Library/Application Support/act"
cat > "$HOME/Library/Application Support/act/actrc" << 'EOF'
-P ubuntu-latest=catthehacker/ubuntu:act-latest
--container-daemon-socket -
EOF
```

## 현재 워크플로우 확인

프로젝트에 3개의 GitHub Actions 워크플로우가 존재:

### 1. build-check.yml
- **트리거**: push (main, develop), pull_request (main)
- **작업**: TypeScript 검사, ESLint, Next.js 빌드
- **상태**: 로컬 테스트 시도 중

### 2. deploy-production.yml
- **트리거**: push (main), tags (v*), workflow_dispatch
- **작업**: 빌드 후 NCP 서버로 SSH 배포
- **특징**: 이미 NCP 자동 배포 스크립트 완성됨
- **배포 단계**:
  ```bash
  cd /var/www/aedpics
  git pull origin main
  npm ci
  npx prisma generate
  npm run build
  pm2 reload aedpics
  ```

### 3. database-backup.yml
- **트리거**: schedule (매일 새벽 2시), workflow_dispatch
- **작업**: PostgreSQL 데이터베이스 백업

## 발생한 문제

### 문제 1: Docker Desktop 설치 실패
**오류**:
```
sudo: a terminal is required to read the password
```

**해결**: colima로 대체 성공

### 문제 2: act 실행 시 Docker socket 마운트 오류
**오류**:
```
error while creating mount source path '/Users/kwangsunglee/.colima/docker.sock':
mkdir /Users/kwangsunglee/.colima/docker.sock: operation not supported
```

**해결 시도**: actrc 설정으로 daemon socket 비활성화
**결과**: 일부 해결

### 문제 3: containerd I/O 오류 (현재 미해결)
**오류**:
```
Error response from daemon: write /var/lib/containerd/io.containerd.metadata.v1.bolt/meta.db:
input/output error
```

**발생 단계**: Docker 이미지 pull 시
**영향**: act로 워크플로우 실행 불가

### 문제 4: npm ci 실행 중 I/O 오류
**오류**:
```
Error response from daemon: chown /var/lib/docker/containers/.../resolv.conf:
input/output error
```

**원인 분석**: colima의 파일 시스템 마운트와 act의 컨테이너 실행 간 호환성 문제

## 시도한 해결 방법

### 1차 시도: actrc 설정 수정
```bash
--container-daemon-socket -
```
부분적으로 성공 (setup 단계 통과)

### 2차 시도: colima 재시작
```bash
colima stop
colima start --cpu 4 --memory 8
```
I/O 오류 지속

### 3차 시도: 백그라운드 실행
여전히 동일한 I/O 오류 발생

## act 사용 방법 (참고용)

### 워크플로우 목록 확인
```bash
act -l
```

### Dry-run (실행 계획 확인)
```bash
act push --container-architecture linux/amd64 -W .github/workflows/build-check.yml -n
```

### 실제 실행
```bash
act push \
  --container-architecture linux/amd64 \
  -W .github/workflows/build-check.yml \
  --secret-file .secrets \
  -j build
```

### 환경변수 설정
`.secrets` 파일에 환경변수 작성:
```bash
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=...
JWT_SECRET=...
```

## 권장 대안 방안

### 옵션 1: colima 완전 재설치
```bash
colima delete
colima start --cpu 4 --memory 8 --disk 60
```

**장점**: 깨끗한 환경에서 재시작
**단점**: 시간 소요, 문제 재발 가능성

### 옵션 2: GitHub Actions에서 직접 테스트 (권장)
```bash
# 테스트 브랜치 생성
git checkout -b test/github-actions

# 변경사항 커밋 및 푸시
git push origin test/github-actions
```

**장점**:
- 실제 환경에서 테스트
- 로컬 환경 문제 회피
- 정확한 결과 확인

**단점**: GitHub Actions 빌드 시간 소요

### 옵션 3: 문서화 후 3단계 진행 (권장)
현재 NCP 배포 워크플로우가 이미 완성되어 있으므로:
1. act 사용 가이드 문서화
2. NCP 배포 워크플로우 검토
3. 3단계 개선사항 적용
   - GitHub Actions 캐싱
   - 병렬 빌드 파이프라인
   - Slack 알림 webhook 설정

## NCP 배포 워크플로우 현황

### 이미 구현된 기능
- SSH를 통한 자동 배포 (appleboy/ssh-action@v1.0.0)
- Health Check (배포 후 API 검증)
- Slack 알림 (성공/실패)

### 필요한 GitHub Secrets
- `NCP_HOST`: NCP 서버 호스트
- `NCP_USERNAME`: SSH 사용자명
- `NCP_SSH_KEY`: SSH 개인키 (1단계에서 등록 필요)
- `NCP_SSH_PORT`: SSH 포트
- `SLACK_WEBHOOK_URL`: Slack webhook URL (3단계)

### 배포 테스트 방법
```bash
# NCP 서버에서 직접 테스트
ssh user@ncp-host
cd /var/www/aedpics
git pull origin main
npm ci
npx prisma generate
npm run build
pm2 reload aedpics
```

## 다음 과제

### 미완료 항목 (보류)
다음 항목은 현재 환경 제약으로 보류되었으며, 추후 재시도 필요:

1. **act 로컬 실행**
   - 상태: colima I/O 오류로 중단
   - 원인: containerd 메타데이터 데이터베이스 쓰기 오류
   - 해결 방안: Docker Desktop 설치 후 재시도 또는 GitHub Actions에서 직접 테스트

2. **NCP SSH 키 GitHub Secrets 등록**
   - 상태: 1단계 미완료 항목
   - 필요성: deploy-production.yml 워크플로우 실행에 필수
   - 등록 방법: GitHub Repository Settings > Secrets and variables > Actions
   - 등록할 Secret: `NCP_SSH_KEY` (SSH 개인키 내용)

### 진행 예정 작업 (3단계)
다음 개선사항을 적용하여 CI/CD 파이프라인 최적화:

1. **GitHub Actions 캐싱**
   - npm 의존성 캐싱
   - Next.js 빌드 캐시
   - 예상 효과: 빌드 시간 50% 단축

2. **병렬 빌드 파이프라인**
   - 독립적인 job들을 병렬로 실행
   - Lint, TypeScript 검사 병렬화
   - 예상 효과: 전체 실행 시간 단축

3. **Slack 알림 webhook 설정**
   - 배포 성공/실패 알림
   - 빌드 상태 실시간 모니터링
   - Slack workspace 연동

## 다음 단계

### 즉시 진행 가능한 작업
1. 3단계 개선사항 적용 (캐싱, 병렬화, Slack 알림)
2. 개선된 워크플로우 테스트
3. 성능 개선 결과 측정

## 참고 자료

### act 공식 문서
- https://nektosact.com/

### colima 공식 문서
- https://github.com/abiosoft/colima

### GitHub Actions 문서
- https://docs.github.com/en/actions

## 결론

act는 로컬에서 GitHub Actions를 테스트하는 유용한 도구이지만,
현재 환경(M-series Mac + colima)에서 I/O 오류가 발생하여 실행이 어렵습니다.

**권장 진행 방향**:
1. NCP 배포 워크플로우가 이미 완성되어 있으므로 GitHub에서 직접 테스트
2. 3단계 개선사항(캐싱, 병렬화, 알림) 적용
3. act 로컬 테스트는 Docker Desktop 설치 가능 시 재시도

---

**마지막 업데이트**: 2025-10-27
**작성자**: Claude (AI Assistant)
