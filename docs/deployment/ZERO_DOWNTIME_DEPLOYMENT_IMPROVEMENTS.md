# Zero-Downtime Deployment 개선 사항

**작성일**: 2025-11-03
**목적**: PM2 reload 실패 방지 및 무중단 배포 보장

## 문제점 분석

### 이전 배포 프로세스의 문제점

1. **빌드 검증 부재**
   - 서버에서 빌드 후 성공 여부를 검증하지 않음
   - 빌드 실패 시 PM2 reload로 진행하여 서비스 중단 발생

2. **원자성 부족**
   - 새 빌드와 PM2 reload 사이에 실패 가능 지점 존재
   - 빌드 중단 시 .next 디렉토리 불완전 상태로 PM2 reload 시도

3. **롤백 메커니즘 없음**
   - 배포 실패 시 이전 버전으로 복구 불가
   - 수동 복구 필요로 다운타임 발생

4. **헬스체크 타이밍**
   - PM2 reload 후 즉시 체크하여 앱 초기화 시간 미확보
   - 일시적 실패를 영구 실패로 판단

## 개선 방안

### 6-Phase Deployment Process

#### Phase 1: Backup Current Version
```bash
if [ -d ".next" ]; then
  rm -rf .next.backup
  cp -r .next .next.backup
fi
```
- 현재 작동 중인 빌드를 백업
- 배포 실패 시 즉시 롤백 가능

#### Phase 2: Update Code and Dependencies
```bash
git fetch origin
git reset --hard origin/main
npm install
npx prisma generate
```
- 코드 업데이트 및 의존성 설치
- 실패 시 이전 빌드가 여전히 작동 중

#### Phase 3: Build New Version
```bash
if npm run build; then
  echo "Build successful!"
else
  echo "Build failed! Rolling back..."
  rm -rf .next
  mv .next.backup .next
  exit 1
fi
```
- 빌드 성공 여부 검증
- 실패 시 즉시 백업 복원 및 배포 중단

#### Phase 4: Validate Build Artifacts
```bash
if [ ! -d ".next" ] || [ ! -d ".next/server" ] || [ ! -d ".next/static" ]; then
  echo "ERROR: Build incomplete!"
  rm -rf .next
  mv .next.backup .next
  exit 1
fi
```
- 필수 디렉토리 존재 확인
- 불완전한 빌드로 PM2 reload 방지

#### Phase 5: Zero-Downtime PM2 Reload
```bash
if pm2 reload ecosystem.config.cjs --update-env; then
  sleep 15  # 앱 안정화 대기
  if pm2 describe aedpics | grep -q "online"; then
    echo "Application is online and stable!"
    rm -rf .next.backup
  else
    echo "Rolling back..."
    rm -rf .next
    mv .next.backup .next
    pm2 reload ecosystem.config.cjs --update-env
    exit 1
  fi
fi
```
- PM2 reload 후 15초 대기
- PM2 프로세스 상태 검증
- 실패 시 자동 롤백

#### Phase 6: Cache Cleanup
```bash
rm -rf /var/cache/nginx/* || true
systemctl reload nginx || true
```
- Nginx 캐시 제거
- Nginx 재로드 (선택적)

### Enhanced Health Check

#### Retry Logic
```bash
MAX_RETRIES=5
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if curl -f -s -o /dev/null http://localhost:3000; then
    break
  else
    sleep 3
    RETRY_COUNT=$((RETRY_COUNT + 1))
  fi
done
```
- 최대 5회 재시도 (3초 간격)
- 일시적 네트워크 문제 대응
- 실패 시 PM2 로그 출력으로 디버깅 지원

#### PM2 Status Check
```bash
if ! pm2 describe aedpics | grep -q "online"; then
  pm2 logs aedpics --lines 50 --nostream
  exit 1
fi
```
- PM2 프로세스 상태 확인
- 실패 시 최근 로그 50줄 출력

## 개선 효과

### 1. 무중단 배포 보장
- 빌드 실패 시 이전 버전 계속 작동
- PM2 reload 실패 시 자동 롤백
- 서비스 다운타임 0초 달성

### 2. 배포 안정성 향상
- 빌드 검증으로 불완전한 배포 방지
- 단계별 검증으로 조기 실패 감지
- 자동 롤백으로 복구 시간 단축

### 3. 디버깅 용이성
- 명확한 단계별 로그
- 실패 시 상세 에러 메시지
- PM2 로그 자동 출력

### 4. 운영 효율성
- 수동 개입 불필요
- 야간 배포 가능
- 배포 신뢰도 향상

## PM2 Cluster 모드 설정

### ecosystem.config.cjs
```javascript
{
  instances: 2,           // 2개 프로세스로 클러스터 실행
  exec_mode: 'cluster',   // 클러스터 모드 (Zero-Downtime 핵심)
  wait_ready: true,       // ready 이벤트 대기
  listen_timeout: 10000,  // 10초 내 ready 신호 없으면 실패
  kill_timeout: 5000,     // 프로세스 종료 시 5초 대기
  max_memory_restart: '1G'
}
```

### PM2 Reload 동작 원리
1. Instance 1 종료 시작
2. Instance 2가 모든 요청 처리
3. Instance 1 새 코드로 재시작
4. Instance 1 ready 신호 확인
5. Instance 2 종료 및 재시작
6. 모든 인스턴스 재시작 완료

## 테스트 방법

### 로컬 테스트
```bash
# 빌드 성공 테스트
npm run build

# 빌드 산출물 검증
ls -la .next/server .next/static

# PM2 reload 테스트 (로컬)
pm2 reload ecosystem.config.cjs
```

### 프로덕션 배포 테스트
```bash
# 코드 변경 후 푸시
git add .
git commit -m "test: deployment test"
git push origin main

# GitHub Actions 모니터링
gh run watch

# 서버 상태 확인
curl -I https://aed.pics
```

### 실패 시나리오 테스트

#### 빌드 실패 시나리오
1. 의도적으로 TypeScript 오류 추가
2. 배포 시작
3. Phase 3에서 빌드 실패 확인
4. 백업 복원 확인
5. 서비스 계속 작동 확인

#### PM2 Reload 실패 시나리오
1. ecosystem.config.cjs 의도적 오류 추가
2. 배포 시작
3. Phase 5에서 PM2 reload 실패 확인
4. 자동 롤백 확인
5. 서비스 계속 작동 확인

## 모니터링

### 배포 중 모니터링
```bash
# GitHub Actions 실시간 모니터링
gh run watch

# 서버 로그 모니터링
ssh server "pm2 logs aedpics --lines 100"

# 서버 상태 확인
ssh server "pm2 status"
```

### 배포 후 확인
```bash
# HTTP 상태 확인
curl -I https://aed.pics

# PM2 프로세스 상태
ssh server "pm2 status aedpics"

# 최근 로그 확인
ssh server "pm2 logs aedpics --lines 50"
```

## 문제 해결

### 빌드 실패가 계속되는 경우
1. 로컬에서 `npm run build` 실행
2. TypeScript 오류 수정
3. ESLint 오류 수정
4. 의존성 문제 해결

### PM2 Reload가 계속 실패하는 경우
1. SSH로 서버 접속
2. `pm2 logs aedpics --lines 100` 확인
3. 애플리케이션 오류 수정
4. 필요 시 `gh workflow run full-rebuild.yml` 실행

### 롤백이 제대로 작동하지 않는 경우
```bash
# 수동 롤백
ssh server
cd /var/www/aedpics
rm -rf .next
mv .next.backup .next
pm2 reload ecosystem.config.cjs
```

## 참고 문서

- [PM2 Cluster Mode](https://pm2.keymetrics.io/docs/usage/cluster-mode/)
- [PM2 Reload vs Restart](https://pm2.keymetrics.io/docs/usage/pm2-doc-single-page/)
- [GitHub Actions SSH Action](https://github.com/appleboy/ssh-action)
- [Next.js Production Deployment](https://nextjs.org/docs/deployment)

## 변경 이력

- 2025-11-03: 초기 문서 작성 및 배포 워크플로우 개선
