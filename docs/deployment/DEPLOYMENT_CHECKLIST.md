# 배포 체크리스트

## 배포 전 필수 검증 (로컬)

### 1. 코드 품질 검사
```bash
# TypeScript 타입 검사
npm run tsc

# ESLint 검사
npm run lint

# 로컬 빌드 테스트
npm run build
```

**통과 기준**: 모든 검사가 에러 없이 완료되어야 함

### 2. 빌드 산출물 검증
```bash
# .next 디렉토리 생성 확인
ls -la .next/

# 필수 파일 존재 여부 확인
ls -la .next/server/
ls -la .next/static/

# 빌드 크기 확인 (참고용)
du -sh .next/
```

**통과 기준**:
- `.next/server/` 디렉토리 존재
- `.next/static/` 디렉토리 존재
- 빌드 크기 정상 범위 (100-300MB)

### 3. 환경변수 검증
```bash
# .env.production 파일 존재 확인
cat .env.production | grep -E "DATABASE_URL|NEXTAUTH_URL|NEXTAUTH_SECRET"

# 필수 환경변수 체크
node -e "
const required = [
  'DATABASE_URL',
  'NEXTAUTH_URL',
  'NEXTAUTH_SECRET',
  'JWT_SECRET',
  'NEXT_PUBLIC_KAKAO_MAP_APP_KEY',
  'NCP_ACCESS_KEY',
  'NCP_SENDER_EMAIL'
];
const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.error('Missing:', missing);
  process.exit(1);
}
console.log('All required env vars present');
"
```

**통과 기준**: 모든 필수 환경변수 존재

## GitHub Actions 배포 (자동)

### 배포 트리거
```bash
# main 브랜치에 푸시
git push origin main

# 또는 수동 트리거
gh workflow run deploy-production.yml
```

### 배포 중 모니터링
```bash
# 실시간 모니터링
gh run watch

# 또는 상태 확인
gh run list --workflow "Deploy to NCP Production" --limit 1
```

### 배포 단계별 체크포인트

1. **Setup & Cache** (30초)
   - Node.js 20.x 설치
   - Next.js 빌드 캐시 복원

2. **Install Dependencies** (1-2분)
   - `npm ci` 실행
   - `node_modules` 생성

3. **Prisma Generate** (10-20초)
   - Prisma Client 생성

4. **Build** (3-5분)
   - Next.js 프로덕션 빌드
   - 118개 페이지 생성

5. **Deploy to Server** (1분)
   - 서버로 파일 전송
   - `pm2 reload` 실행

6. **Health Check** (30초)
   - 서버 응답 확인
   - PM2 프로세스 상태 확인

**예상 총 소요 시간**: 5-7분

## 배포 후 검증 (프로덕션)

### 1. PM2 프로세스 상태 확인
```bash
# PM2 상태 워크플로우 실행
gh workflow run pm2-status.yml

# 또는 직접 SSH 접속
ssh aedpics@223.130.150.133
pm2 status
```

**통과 기준**:
```
┌────┬─────────┬─────────┬────────┬──────┬──────────┐
│ id │ name    │ mode    │ status │ cpu  │ memory   │
├────┼─────────┼─────────┼────────┼──────┼──────────┤
│ 0  │ aedpics │ cluster │ online │ 0%   │ 250-300M │
│ 1  │ aedpics │ cluster │ online │ 0%   │ 250-300M │
└────┴─────────┴─────────┴────────┴──────┴──────────┘
```

**실패 기준** (재배포 필요):
- status: `errored`
- pid: `0`
- restarts: 10회 이상

### 2. 애플리케이션 응답 확인
```bash
# HTTP 상태 코드 확인
curl -I https://aed.pics

# 또는 브라우저로 직접 확인
```

**통과 기준**:
- HTTP 200 OK
- 페이지 정상 로드

**실패 사례**:
- 502 Bad Gateway → PM2 프로세스 문제
- 500 Internal Server Error → 애플리케이션 에러
- 504 Gateway Timeout → 서버 과부하

### 3. 로그 확인
```bash
# 에러 로그 확인
pm2 logs --err --lines 50

# 정상 로그 확인
pm2 logs --out --lines 20
```

**통과 기준**:
- "Ready in XXXms" 메시지 확인
- 최근 에러 없음

**주의 신호**:
- `Cannot find module` 에러
- `MODULE_NOT_FOUND` 에러
- `Unhandled rejection` 에러

### 4. 데이터베이스 연결 확인
```bash
# 간단한 쿼리 테스트
ssh aedpics@223.130.150.133
cd /var/www/aedpics
npx prisma db execute --stdin <<< "SELECT 1;"
```

**통과 기준**: 쿼리 성공

## 문제 발생 시 대응

### 502 Bad Gateway

**증상**: Nginx가 Next.js에 연결 실패

**원인 파악**:
```bash
# PM2 상태 확인
pm2 status

# 에러 로그 확인
pm2 logs --err --lines 100
```

**해결 방법**:

1. **빌드 산출물 누락**:
   ```bash
   # Full rebuild 실행
   gh workflow run full-rebuild.yml
   ```

2. **환경변수 누락**:
   ```bash
   # .env.production 확인
   ssh server "cat /var/www/aedpics/.env.production"
   ```

3. **메모리 부족**:
   ```bash
   # 메모리 확인
   ssh server "free -h"

   # PM2 재시작
   pm2 restart ecosystem.config.cjs
   ```

### 500 Internal Server Error

**증상**: 애플리케이션 런타임 에러

**원인 파악**:
```bash
# 최근 에러 확인
pm2 logs --err --lines 50 --nostream

# 브라우저 콘솔 확인
```

**해결 방법**:
1. 코드 롤백: `git revert HEAD && git push`
2. 로그 분석 후 핫픽스 배포

### 빌드 실패

**증상**: GitHub Actions 빌드 단계 실패

**원인 파악**:
```bash
# 워크플로우 로그 확인
gh run view --log
```

**해결 방법**:
1. 로컬에서 `npm run build` 재현
2. 타입 에러 수정
3. 의존성 문제 해결 (`npm ci` 재실행)

## 긴급 롤백 절차

### 1. 이전 커밋으로 복구
```bash
# 마지막 배포 커밋 확인
git log --oneline -5

# 롤백 (주의: 신중히 선택)
git revert HEAD
git push origin main
```

### 2. PM2 재시작으로 빠른 복구
```bash
ssh server
cd /var/www/aedpics
pm2 restart ecosystem.config.cjs
```

### 3. Full rebuild로 완전 복구
```bash
gh workflow run full-rebuild.yml
```

**복구 시간**:
- PM2 재시작: 10초
- 이전 커밋 재배포: 5-7분
- Full rebuild: 3-5분

## 정기 점검 (주 1회 권장)

### 디스크 용량
```bash
ssh server "df -h"
```
**기준**: 50% 미만 사용

### 빌드 캐시 정리
```bash
ssh server "cd /var/www/aedpics && rm -rf .next/cache"
```

### PM2 로그 정리
```bash
ssh server "pm2 flush"
```

### 의존성 업데이트 확인
```bash
npm outdated
```

## 재발 방지 체크리스트

배포 전 필수 확인:
- [ ] 로컬 빌드 성공
- [ ] 타입 검사 통과
- [ ] 린트 검사 통과
- [ ] .env.production 준비
- [ ] GitHub Secrets 확인

배포 중 모니터링:
- [ ] 빌드 단계 완료
- [ ] 서버 전송 완료
- [ ] PM2 reload 성공

배포 후 검증:
- [ ] PM2 status = online
- [ ] HTTP 200 응답
- [ ] 로그 에러 없음
- [ ] 주요 기능 테스트

문제 발생 시:
- [ ] 로그 즉시 확인
- [ ] 원인 파악 후 조치
- [ ] 트러블슈팅 문서 업데이트

---

**작성일**: 2025-11-01
**최종 업데이트**: 2025-11-01
**관련 문서**:
- [NCP 서버 설정](NCP_SERVER_SETUP.md)
- [502 에러 분석](../troubleshooting/SERVER_502_ANALYSIS_2025-11-01.md)
- [배포 가이드](DEPLOYMENT.md)
