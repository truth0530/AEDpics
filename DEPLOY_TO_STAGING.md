# 스테이징 배포 실행 가이드 (직접 실행용)

**작성**: 2025-11-10
**버전**: 716b39c (로그인/로그아웃 성능 및 안정성 개선)
**대상 환경**: Staging Server
**예상 소요시간**: 10-15분

---

## 📋 배포 전 체크리스트

스테이징 서버에서 다음을 확인하고 실행하세요:

```bash
# 0. 사전 확인 (배포 전 확인사항)
□ 스테이징 서버에 SSH 접속 가능?
□ /var/www/aedpics-staging 디렉토리 존재?
□ git, npm, pm2, Node.js 설치됨?
□ 디스크 공간 충분? (최소 2GB)
□ 데이터베이스 연결 정상?

확인 명령어:
ls -la /var/www/aedpics-staging
node --version
npm --version
pm2 --version
df -h /var/www/
```

---

## 🚀 배포 실행 (3가지 방법)

### ✅ 방법 1: 완전 자동화 (권장)

스테이징 서버에서 다음을 실행하세요:

```bash
cat > /tmp/deploy-staging.sh << 'EOF'
#!/bin/bash
set -e

echo "=========================================="
echo "스테이징 배포 시작"
echo "시간: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="
echo

cd /var/www/aedpics-staging || exit 1

echo "[1/7] 최신 코드 가져오기..."
git fetch origin
git checkout origin/main
echo "✅ 완료"
echo

echo "[2/7] 프로덕션 의존성 설치..."
npm ci --production
echo "✅ 완료"
echo

echo "[3/7] Prisma 클라이언트 생성..."
npx prisma generate
echo "✅ 완료"
echo

echo "[4/7] 프로덕션 빌드..."
NODE_ENV=production npm run build
echo "✅ 완료"
echo

echo "[5/7] PM2 무중단 배포..."
pm2 reload ecosystem.config.cjs
echo "✅ 완료"
echo

echo "[6/7] 배포 상태 확인..."
pm2 status
echo

echo "[7/7] 최근 로그 확인..."
pm2 logs --lines 10
echo

echo "=========================================="
echo "✅ 배포 완료!"
echo "URL: https://staging.aed.pics"
echo "시간: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="
EOF

chmod +x /tmp/deploy-staging.sh
/tmp/deploy-staging.sh
```

### ✅ 방법 2: 한 줄 명령어

```bash
cd /var/www/aedpics-staging && git fetch origin && git checkout origin/main && npm ci --production && npx prisma generate && NODE_ENV=production npm run build && pm2 reload ecosystem.config.cjs && pm2 status
```

### ✅ 방법 3: 수동 단계별

각 단계를 개별적으로 실행:

```bash
# Step 1: 디렉토리 이동
cd /var/www/aedpics-staging

# Step 2: 최신 코드 가져오기
git fetch origin
git checkout origin/main

# Step 3: 프로덕션 의존성 설치
npm ci --production

# Step 4: Prisma 클라이언트 생성
npx prisma generate

# Step 5: 프로덕션 빌드
NODE_ENV=production npm run build

# Step 6: PM2 무중단 배포
pm2 reload ecosystem.config.cjs

# Step 7: 배포 확인
pm2 status
pm2 logs --lines 20
```

---

## ✅ 배포 후 확인

배포가 완료되었으면 다음을 확인하세요:

### 즉시 확인 (1분)

```bash
# 1. PM2 프로세스 상태 확인
pm2 status

# 예상 출력:
# id │ name           │ mode │ status  │ ↺
# 0  │ aedpics        │ fork │ online  │ 0
#
# ✅ status가 "online"이어야 함!

# 2. 로그 확인 (에러 없는지)
pm2 logs --err --lines 20

# 예상: 에러 없음 또는 이전 에러 로그만 있어야 함

# 3. 웹 서버 응답 확인
curl -I https://staging.aed.pics

# 예상 출력:
# HTTP/2 200
# ✅ 200 OK 응답 필수!
```

### 5분 후 확인

```bash
# 1. 메모리 사용량 확인
pm2 monit

# 2. 재시작 횟수 확인
pm2 status
# restarts 항목이 증가하지 않아야 함

# 3. 에러 로그 다시 확인
pm2 logs --err --lines 50
```

### 15분 후 확인

```bash
# 1. 안정적으로 운영되는지 확인
pm2 status

# 2. 디스크 사용량 확인
df -h /var/www/

# 3. 데이터베이스 연결 확인
# /api/health 또는 로그인 페이지 접속 테스트
curl https://staging.aed.pics/api/auth/signin
```

---

## 🔴 배포 실패 시 대응

### 증상 1: "npm ci 실패"

```bash
# 원인: 의존성 문제
# 해결:
rm -rf node_modules
npm cache clean --force
npm ci --production
```

### 증상 2: "빌드 실패" (Cannot find module)

```bash
# 원인: Prisma 클라이언트 누락
# 해결:
npx prisma generate
NODE_ENV=production npm run build
```

### 증상 3: "PM2 status: errored"

```bash
# 원인: 프로세스 시작 실패
pm2 logs --err --lines 100  # 에러 메시지 확인

# 해결 방법:
# 1. 에러 로그 확인
# 2. 환경변수 확인 (.env.local)
# 3. 데이터베이스 연결 확인
# 4. 다시 배포
./scripts/deploy-staging.sh
```

### 증상 4: "HTTP 502 Bad Gateway"

```bash
# 원인: PM2 프로세스 충돌 또는 빌드 실패
# 해결:
pm2 stop all
pm2 delete all
NODE_ENV=production npm run build
pm2 start ecosystem.config.cjs
```

### 증상 5: "디스크 부족"

```bash
# 원인: .next, node_modules 캐시 누적
# 해결:
rm -rf .next/cache
rm -rf .next.backup
rm -rf node_modules/.cache
npm ci --production
npx prisma generate
NODE_ENV=production npm run build
```

---

## 📊 배포 성공 기준

배포가 성공한 것으로 간주하려면:

```
✅ pm2 status에서 "online" 상태
✅ curl -I https://staging.aed.pics에서 "HTTP/2 200"
✅ pm2 logs에 "Cannot find module" 에러 없음
✅ 15분 동안 restarts 증가 없음
✅ 데이터베이스 연결 정상
✅ /auth/signin 페이지 접속 가능
```

---

## 🧪 배포 후 스테이징 테스트

배포 후 다음 테스트를 실행하세요:

**참고**: [docs/testing/STAGING_TEST_GUIDE.md](docs/testing/STAGING_TEST_GUIDE.md)

### 필수 테스트 4개

```
☐ Test 1: 로그인 성능 (15분)
  ☐ 1.1 정상 로그인 (스피너 < 200ms, 전체 < 2초)
  ☐ 1.2 3G 네트워크 (UI 반응성)

☐ Test 2: 로그아웃 안정성 (15분)
  ☐ 2.1 정상 로그아웃
  ☐ 2.2 네트워크 오류 시뮬레이션 (중요!)
  ☐ 2.3 느린 네트워크

☐ Test 3: 민감정보 필터링 (10분)
  ☐ API 응답에 password_hash 없음
  ☐ account_locked 없음
  ☐ lock_reason 없음

☐ Test 4: 프로필 로드 실패 (10분)
  ☐ API 장애 시뮬레이션
  ☐ /dashboard로 폴백 작동
```

### 테스트 결과 기록

테스트 결과를 기록할 템플릿은 [docs/testing/STAGING_TEST_GUIDE.md](docs/testing/STAGING_TEST_GUIDE.md)에 있습니다.

---

## 📞 배포 중 도움 필요할 경우

### 빠른 진단

```bash
# 1. 현재 배포 상태 확인
pm2 status

# 2. 에러 로그 확인
pm2 logs --err --lines 100

# 3. 빌드 로그 확인
pm2 logs --lines 50

# 4. 최근 git 커밋 확인
git log --oneline -5

# 5. 배포된 버전 확인
git rev-parse --short HEAD
```

### 롤백 (이전 버전으로 되돌리기)

```bash
# 이전 버전으로 되돌리기
git reset --hard HEAD~1
NODE_ENV=production npm run build
pm2 reload ecosystem.config.cjs
```

---

## 📋 배포 체크리스트

```
배포 전:
☐ scp/git으로 최신 코드 준비
☐ 백업 계획 확인
☐ 롤백 방법 확인

배포 중:
☐ 위의 "배포 실행" 섹션 따라 실행
☐ 각 단계 완료 확인

배포 후:
☐ 즉시 확인 (1분)
☐ 5분 후 확인
☐ 15분 후 확인
☐ 스테이징 테스트 실행 (1-2시간)
☐ 모든 테스트 통과 확인
☐ 프로덕션 배포 승인
```

---

## 🎯 배포 완료 후 다음 단계

### 스테이징 테스트 통과 시

```
1. 테스트 결과 정리
2. 모든 항목 "합격" 확인
3. 테스트 담당자 승인
4. 프로덕션 배포 실행
   → git push origin main (또는 수동 배포)
```

### 스테이징 테스트 미통과 시

```
1. 문제 분석
2. 원인 파악
3. 개발팀에 보고
4. 수정 후 재배포
```

---

## 📝 배포 기록

**배포 날짜**: ________________
**배포 담당자**: ________________
**배포 시간**: ________________
**배포 대상 버전**: 716b39c
**배포 결과**: [ ] 성공 / [ ] 실패
**문제 사항**: _______________________________________________
**테스트 담당자 승인**: [ ] 예 / [ ] 아니오
**프로덕션 배포 준비**: [ ] 준비 완료 / [ ] 미준비

---

**이 가이드에 따라 배포를 진행하세요!** 🚀
