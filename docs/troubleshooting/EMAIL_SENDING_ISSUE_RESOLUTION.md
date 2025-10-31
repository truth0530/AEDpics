# NCP 이메일 발송 문제 해결 문서

## 문서 목적
- 2025년 10월 31일 발생한 이메일 발송 실패 문제의 전체 과정 기록
- 잘못된 시행착오를 방지하기 위한 체크리스트 제공
- 향후 동일한 문제 발생 시 빠른 해결을 위한 참조 문서

## 문제 발생 타임라인

### 2025-10-29: 발신자 이메일 변경 과정
1. **초기 문제**: `noreply@aed.pics` 발송 차단
2. **임시 해결**: `truth0530@nmc.or.kr` (개인 이메일)로 발송 성공 (09:07:33)
3. **정식 해결**: `noreply@nmc.or.kr`로 변경 후 발송 성공 (10:38:12)
4. **안정 기간**: 2025-10-29 10:38:12 ~ 2025-10-30 13:25:36 정상 발송

### 2025-10-31: 문제 재발생
1. **04:54-04:55**: GitHub Secrets 환경변수 수정 (이때 잘못된 API 키 입력)
2. **이후**: 모든 이메일 발송 실패 (500 Internal Server Error)
3. **17:00 경**: 사용자 문제 제기
4. **18:02**: 올바른 API 키로 수정 및 배포 완료
5. **18:56**: 발신자 이메일 `noreply@nmc.or.kr`로 재수정 및 배포 완료

## 근본 원인 (Root Cause)

### 실제 원인
**GitHub Secrets에 잘못된 NCP API 키가 저장됨**

- 2025-10-31 04:54-04:55에 환경변수 수정 작업 중 실수
- `NCP_ACCESS_KEY`, `NCP_ACCESS_SECRET`에 잘못된 값 입력
- 프로덕션 서버에 잘못된 키가 배포됨
- NCP API 호출이 인증 실패로 이메일 발송 불가

### 올바른 해결 방법
1. NCP 콘솔에서 올바른 API 키 확인
   - Access Key: `ncp_iam_BPAMKR***********` (보안상 마스킹, NCP 콘솔에서 확인)
   - Secret Key: `ncp_iam_BPKMKRF***********` (보안상 마스킹, NCP 콘솔에서 확인)
2. GitHub Secrets 업데이트
3. 프로덕션 배포 (GitHub Actions)
4. 발신자 이메일: `noreply@nmc.or.kr` (이미 인증된 계정)

**보안 주의**: 실제 API 키는 NCP 콘솔 > 마이페이지 > 인증키 관리에서 확인

## 잘못된 시행착오 (피해야 할 실수)

### 실수 1: 인증 문제로 오인
**잘못된 판단**: "noreply@nmc.or.kr이 인증되지 않았다"
**실제 사실**:
- `noreply@nmc.or.kr`는 2025-10-29부터 정상 작동한 계정
- 2025-10-29 10:38:12 ~ 2025-10-30 13:25:36 정상 발송 이력 존재
- 인증 문제가 아니라 환경변수 문제

**교훈**: 과거 정상 작동 이력이 있으면 인증 문제가 아님

### 실수 2: 개인 이메일 사용
**잘못된 판단**: `truth0530@nmc.or.kr` (개인 이메일) 사용
**문제점**:
- 시스템 이메일에 개인 계정 사용 부적절
- 발송 실패 (발송실패 상태)
- 관리 및 추적 어려움

**교훈**: 시스템 발송은 반드시 `noreply@nmc.or.kr` 사용

### 실수 3: DMARC/SPF 설정 문제로 오인
**잘못된 판단**: "DMARC 인증이 필요하다"
**실제 사실**:
- 과거 정상 작동했던 계정
- IT 관리자가 이미 설정 완료
- 새로운 인증 작업 불필요

**교훈**: 과거 작동 이력 확인 후 판단

## 환경변수 관련 핵심 포인트

### 필수 환경변수
```bash
NCP_ACCESS_KEY="ncp_iam_BPAMKR***********"  # NCP 콘솔에서 확인
NCP_ACCESS_SECRET="ncp_iam_BPKMKRF***********"  # NCP 콘솔에서 확인
NCP_SENDER_EMAIL="noreply@nmc.or.kr"
```

**보안 주의**: 실제 API 키 값은:
- NCP 콘솔 > 마이페이지 > 인증키 관리
- 또는 GitHub Repository > Settings > Secrets and variables > Actions

### 환경변수 설정 위치
1. **로컬 개발**: `.env.local`
2. **GitHub Actions**: Repository Settings > Secrets and variables > Actions
3. **프로덕션 서버**: `/var/www/aedpics/.env.production` (GitHub Actions가 자동 생성)

### 검증 방법
```bash
# 로컬 테스트
npx tsx scripts/test/test-ncp-email.ts

# 프로덕션 서버 환경변수 확인 (SSH 접속 필요)
ssh aedpics@223.130.150.133
cd /var/www/aedpics
cat .env.production | grep NCP
```

## 이메일 발송 실패 디버깅 체크리스트

### 1단계: 환경변수 확인 (최우선)
- [ ] `NCP_ACCESS_KEY`가 올바르게 설정됨 (ncp_iam_BPAMKR로 시작하는 키, NCP 콘솔 확인)
- [ ] `NCP_ACCESS_SECRET`가 올바르게 설정됨 (마지막 변경: 2025-10-31 18:02)
- [ ] `NCP_SENDER_EMAIL`이 `noreply@nmc.or.kr`로 설정됨
- [ ] GitHub Secrets에 올바른 값 저장됨
- [ ] 프로덕션 서버 `.env.production` 파일에 올바른 값 반영됨

### 2단계: 과거 발송 이력 확인
- [ ] NCP 콘솔 > Cloud Outbound Mailer > Mailing list 접속
- [ ] 최근 정상 발송 시점 확인 (마지막 정상: 2025-10-30 13:25:36)
- [ ] 발송 실패 시작 시점 확인
- [ ] 환경변수 변경 시점과 실패 시작 시점 비교

### 3단계: API 키 유효성 검증
- [ ] NCP 콘솔 > 마이페이지 > 인증키 관리 접속
- [ ] Access Key ID 확인
- [ ] API 키 활성화 상태 확인
- [ ] Cloud Outbound Mailer 권한 확인

### 4단계: 코드 레벨 확인
- [ ] `app/api/auth/send-otp/route.ts` 환경변수 검증 로직 확인
- [ ] `app/api/auth/reset-password/route.ts` 환경변수 검증 로직 확인
- [ ] `lib/email/ncp-email.ts` 서명 생성 로직 확인
- [ ] 서버 로그에서 상세 오류 메시지 확인

### 5단계: 로컬 테스트
```bash
# 1. 환경변수 설정 확인
cat .env.local | grep NCP

# 2. 테스트 스크립트 실행
npx tsx scripts/test/test-ncp-email.ts

# 3. 직접 curl 테스트 (긴급 시)
# scripts/test/direct-curl-test.sh 참조
```

### 6단계: 배포 후 검증
- [ ] GitHub Actions 워크플로우 성공 확인
- [ ] 프로덕션 서버 PM2 재시작 확인 (`pm2 status aedpics`)
- [ ] Health Check 통과 확인
- [ ] 실제 이메일 발송 테스트 (https://aed.pics/auth/forgot-password)

## 절대 하지 말아야 할 것

### 1. 과거 정상 작동한 계정을 의심
- `noreply@nmc.or.kr`는 이미 인증되고 설정된 계정
- 갑자기 인증 문제가 생기지 않음
- 환경변수나 코드 변경을 먼저 의심

### 2. 개인 이메일로 시스템 발송
- `truth0530@nmc.or.kr` 같은 개인 계정 사용 금지
- 시스템 발송은 `noreply@nmc.or.kr` 고정

### 3. DMARC/SPF 설정 변경 시도
- IT 관리자가 이미 설정 완료
- 임의로 DNS 레코드 변경 금지
- 문제 발생 시 IT 관리자 확인 후 진행

### 4. API 키 임의 재발급
- 기존 API 키가 다른 시스템에서도 사용 중일 수 있음
- 재발급 시 모든 시스템에 영향
- 기존 키 확인 후 재발급 여부 결정

## 예방 조치

### 1. 환경변수 변경 시 검증 프로세스
```bash
# 환경변수 변경 후 반드시 실행
npm run test:email

# 배포 전 확인
echo "NCP_ACCESS_KEY=$NCP_ACCESS_KEY" | head -c 20
echo "NCP_SENDER_EMAIL=$NCP_SENDER_EMAIL"
```

### 2. 문서화
- 환경변수 변경 시 반드시 변경 이력 기록
- GitHub Secrets 변경 시 커밋 메시지에 명시
- `.env.example` 파일 최신 상태 유지

### 3. 모니터링
- NCP 콘솔에서 발송 통계 주기적 확인
- 발송 실패 알림 설정
- 서버 로그 모니터링

## 관련 파일

### 코드
- [lib/email/ncp-email.ts](../../lib/email/ncp-email.ts) - NCP 이메일 발송 핵심 로직
- [app/api/auth/send-otp/route.ts](../../app/api/auth/send-otp/route.ts) - OTP 이메일 API
- [app/api/auth/reset-password/route.ts](../../app/api/auth/reset-password/route.ts) - 비밀번호 재설정 이메일 API

### 설정
- [.env.example](../../.env.example) - 환경변수 템플릿
- [.github/workflows/deploy-production.yml](../../.github/workflows/deploy-production.yml) - 배포 워크플로우

### 테스트
- [scripts/test/test-ncp-email.ts](../../scripts/test/test-ncp-email.ts) - 이메일 테스트 스크립트

## 참고 링크

- NCP Cloud Outbound Mailer 콘솔: https://console.ncloud.com/
- NCP 인증키 관리: https://console.ncloud.com/mypage/authentication
- 프로덕션 사이트: https://aed.pics
- GitHub Repository: https://github.com/truth0530/AEDpics

## 변경 이력

- 2025-10-31 19:40: 초안 작성 (이메일 발송 문제 해결 후)
- 향후 유사 문제 발생 시 이 문서 업데이트

---

**작성자**: Claude Code (AI)
**검토자**: truth0530@nmc.or.kr
**최종 업데이트**: 2025-10-31
