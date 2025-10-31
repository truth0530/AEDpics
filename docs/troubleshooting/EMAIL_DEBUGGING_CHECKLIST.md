# NCP 이메일 발송 실패 디버깅 체크리스트

## 빠른 체크리스트 (30초 진단)

문제 발생 시 이 순서대로 확인하세요:

```
1. [ ] 과거 정상 발송 이력 확인 (NCP 콘솔 > Mailing list)
2. [ ] 최근 환경변수 변경 여부 확인 (GitHub Secrets, .env)
3. [ ] 최근 코드 변경 여부 확인 (git log)
4. [ ] API 키 유효성 확인 (NCP 콘솔)
5. [ ] 로컬 테스트 실행 (npm run test:email)
```

**중요**: 과거 정상 작동했다면 인증 문제가 아닙니다!

## 상세 디버깅 가이드

### 단계 1: 문제 범위 확인 (1분)

#### 1.1 NCP 콘솔 발송 이력 확인
```
1. NCP 콘솔 접속: https://console.ncloud.com/
2. Services > Cloud Outbound Mailer > Mailing list
3. 최근 발송 이력 확인:
   - 마지막 정상 발송 시점
   - 실패 시작 시점
   - 오류 메시지 (SECURITY_AND_POLICY_ABNORMAL, DMARC 등)
```

**판단 기준**:
- 과거 정상 → 환경변수/코드 문제
- 처음부터 실패 → 인증/설정 문제

#### 1.2 최근 변경사항 확인
```bash
# GitHub 최근 커밋 확인
git log --oneline --graph --all -20

# 최근 배포 시간 확인
gh run list --workflow "Deploy to NCP Production" --limit 5

# 환경변수 변경 이력 (GitHub Secrets)
# Settings > Secrets and variables > Actions > Recent changes
```

### 단계 2: 환경변수 검증 (2분)

#### 2.1 로컬 환경변수 확인
```bash
# .env.local 확인
cat .env.local | grep NCP

# 올바른 값 (보안상 실제 값은 NCP 콘솔 확인)
# NCP_ACCESS_KEY="ncp_iam_BPAMKR***********"
# NCP_ACCESS_SECRET="ncp_iam_BPKMKRF***********"
# NCP_SENDER_EMAIL="noreply@nmc.or.kr"
```

#### 2.2 GitHub Secrets 확인
```
1. GitHub Repository > Settings > Secrets and variables > Actions
2. 다음 항목 존재 확인:
   - NCP_ACCESS_KEY
   - NCP_ACCESS_SECRET
   - NCP_SENDER_EMAIL
3. 값 확인 (보안상 마스킹되어 있음, Update 클릭 후 확인)
```

**주의**: GitHub Secrets는 한 번 저장하면 조회 불가, Update 시에만 수정 가능

#### 2.3 프로덕션 서버 환경변수 확인 (SSH 필요)
```bash
# SSH 접속
ssh aedpics@223.130.150.133

# 환경변수 파일 확인
cd /var/www/aedpics
cat .env.production | grep NCP

# PM2 환경변수 확인
pm2 env 0
```

### 단계 3: API 키 유효성 확인 (2분)

#### 3.1 NCP 콘솔에서 API 키 상태 확인
```
1. NCP 콘솔 > 마이페이지 > 인증키 관리
2. Access Key ID 찾기 (ncp_iam_BPAMKR로 시작하는 키)
3. 상태 확인:
   - [x] 활성화됨
   - [x] Cloud Outbound Mailer 권한 있음
   - [ ] 차단되지 않음
```

#### 3.2 발신자 이메일 상태 확인
```
1. NCP 콘솔 > Cloud Outbound Mailer > 발신자 이메일 관리
2. noreply@nmc.or.kr 찾기
3. 상태 확인:
   - [x] 인증 완료
   - [ ] 차단되지 않음
```

### 단계 4: 코드 레벨 확인 (3분)

#### 4.1 환경변수 검증 로직 확인
```bash
# send-otp 라우트 확인
cat app/api/auth/send-otp/route.ts | grep -A 5 "NCP_ACCESS_KEY"

# reset-password 라우트 확인
cat app/api/auth/reset-password/route.ts | grep -A 5 "NCP_ACCESS_KEY"
```

**기대 출력**:
```typescript
if (!process.env.NCP_ACCESS_KEY || !process.env.NCP_ACCESS_SECRET || !process.env.NCP_SENDER_EMAIL) {
  return NextResponse.json(
    { error: '이메일 서비스가 설정되지 않았습니다.' },
    { status: 503 }
  );
}
```

#### 4.2 NCP 이메일 라이브러리 확인
```bash
# 서명 생성 로직 확인
cat lib/email/ncp-email.ts | grep -A 10 "makeSignature"
```

### 단계 5: 로컬 테스트 (5분)

#### 5.1 이메일 테스트 스크립트 실행
```bash
# 기본 테스트 (noreply@nmc.or.kr로 발송)
npx tsx scripts/test/test-ncp-email.ts

# 특정 수신자 지정
npx tsx scripts/test/test-ncp-email.ts truth0530@nmc.or.kr
```

**성공 시 출력**:
```
============================================================
NCP Cloud Outbound Mailer 테스트
============================================================

1. 환경변수 확인:
------------------------------------------------------------
✅ NCP_ACCESS_KEY: ncp_iam_...
✅ NCP_ACCESS_SECRET: ncp_iam_...
✅ NCP_SENDER_EMAIL: noreply@nmc.or.kr

2. 테스트 이메일 발송:
------------------------------------------------------------
발신자: noreply@nmc.or.kr
수신자: truth0530@nmc.or.kr

이메일 발송 중...

✅ 이메일 발송 성공!

응답:
{
  "requestId": "...",
  "count": 1
}

============================================================
✅ 모든 테스트 통과!
============================================================

truth0530@nmc.or.kr 계정의 받은편지함을 확인하세요.
```

#### 5.2 직접 curl 테스트 (고급)
```bash
# test-ncp-direct.js 실행 (타임스탬프와 서명 자동 생성)
node /tmp/test-ncp-direct.js

# 출력된 curl 명령 복사 후 실행
```

### 단계 6: 문제 해결

#### 문제 유형 A: 환경변수 누락/오류
**증상**: 503 Service Unavailable, "이메일 서비스가 설정되지 않았습니다"

**해결**:
```bash
# 1. .env.local 수정 (NCP 콘솔에서 실제 값 확인)
NCP_ACCESS_KEY="ncp_iam_BPAMKR***********"
NCP_ACCESS_SECRET="ncp_iam_BPKMKRF***********"
NCP_SENDER_EMAIL="noreply@nmc.or.kr"

# 2. GitHub Secrets 업데이트
# Settings > Secrets and variables > Actions > Update

# 3. 재배포
git push origin main
```

#### 문제 유형 B: API 키 인증 실패
**증상**: 401 Unauthorized, 403 Forbidden

**해결**:
```bash
# 1. NCP 콘솔에서 API 키 확인
# 마이페이지 > 인증키 관리

# 2. API 키 복사 (정확한 값)
# NCP 콘솔에서 직접 복사하세요
# Access Key ID: ncp_iam_BPAMKR***********
# Secret Key: ncp_iam_BPKMKRF***********

# 3. 환경변수 업데이트 (위 유형 A 참조)
```

#### 문제 유형 C: 발신자 이메일 차단
**증상**: SECURITY_AND_POLICY_ABNORMAL, "발송실패"

**해결**:
```bash
# 1. 발신자 이메일 확인
# NCP 콘솔 > Cloud Outbound Mailer > 발신자 이메일 관리

# 2. noreply@nmc.or.kr 상태 확인
# - 인증 완료 상태여야 함
# - 차단되지 않아야 함

# 3. 개인 이메일 사용 금지
# ❌ truth0530@nmc.or.kr (개인)
# ✅ noreply@nmc.or.kr (시스템)
```

#### 문제 유형 D: DMARC 정책 위반
**증상**: "Email rejected due to DMARC policy violation"

**원인**: 수신 측 이메일 서버(예: Naver)가 DMARC 정책으로 차단

**확인**:
```bash
# 1. 발송 이력 확인
# - 같은 도메인 (@nmc.or.kr → @nmc.or.kr): 성공
# - 외부 도메인 (@nmc.or.kr → @naver.com): 실패

# 2. 과거 이력 확인
# - 과거 외부 도메인 발송 성공 이력 있음 → 일시적 문제
# - 처음부터 실패 → DMARC 설정 필요
```

**해결**:
```bash
# 과거 성공 이력이 있는 경우:
# - 환경변수/API 키 확인 (위 유형 A, B)
# - 일시적 네트워크 문제일 수 있음, 재시도

# 처음부터 실패하는 경우:
# - IT 관리자 확인 필요 (nmc.or.kr 도메인 관리자)
# - SPF/DKIM/DMARC 레코드 확인 필요
```

### 단계 7: 배포 및 검증

#### 7.1 배포
```bash
# 변경사항 커밋
git add .
git commit -m "fix: NCP 이메일 환경변수 수정"
git push origin main

# GitHub Actions 워크플로우 확인
gh run watch

# 배포 완료 대기 (약 3-5분)
```

#### 7.2 프로덕션 검증
```bash
# 1. Health Check
curl -f https://aed.pics

# 2. PM2 상태 확인
ssh aedpics@223.130.150.133 "pm2 status aedpics"

# 3. 실제 이메일 발송 테스트
# https://aed.pics/auth/forgot-password
# 이메일 입력 → 발송 → 수신 확인
```

## 자주 하는 실수

### 실수 1: 과거 정상 작동한 계정을 의심
❌ "noreply@nmc.or.kr이 인증 안됐나?"
✅ 과거 정상 발송 이력 확인 → 환경변수 문제

### 실수 2: 개인 이메일 사용
❌ `NCP_SENDER_EMAIL="truth0530@nmc.or.kr"`
✅ `NCP_SENDER_EMAIL="noreply@nmc.or.kr"`

### 실수 3: API 키 오타
❌ 복사 시 공백, 줄바꿈 포함
✅ 정확한 값 복사 (앞뒤 공백 제거)

### 실수 4: GitHub Secrets 미반영
❌ .env.local만 수정
✅ GitHub Secrets + 재배포

### 실수 5: 캐시 미클리어
❌ 브라우저 캐시로 인한 오류
✅ 하드 리프레시 (Cmd+Shift+R / Ctrl+Shift+R)

## 긴급 연락처

- **시스템 관리자**: truth0530@nmc.or.kr
- **기술 지원**: inhak@nmc.or.kr
- **NCP 고객센터**: 1544-4772

## 관련 문서

- [이메일 발송 문제 해결 전체 문서](./EMAIL_SENDING_ISSUE_RESOLUTION.md)
- [NCP 이메일 설정 가이드](../deployment/NCP_SERVER_SETUP.md)
- [환경변수 설정 가이드](../../.env.example)

---

**최종 업데이트**: 2025-10-31
**버전**: 1.0.0
