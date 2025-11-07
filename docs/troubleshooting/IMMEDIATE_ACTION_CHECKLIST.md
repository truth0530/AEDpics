# 즉시 실행 체크리스트 - NCP 이메일 문제 해결

**배포 시간**: 2025-11-07 02:52:48 UTC
**현재 단계**: 배포 완료, 수동 검증 단계
**예상 소요 시간**: 30-60분

---

## 단계 1: 신원 확인 및 접근 권한 (5분)

- [ ] 프로덕션 서버 SSH 접근 가능 확인
  ```bash
  ssh -i <key> ec2-user@223.130.150.133
  ```

- [ ] NCP 콘솔 로그인 가능 확인
  - URL: https://console.ncloud.com
  - 계정: 프로덕션 계정

- [ ] GitHub 푸시 권한 확인 (필요시)
  ```bash
  git status
  ```

---

## 단계 2: 사전 준비 (10분)

### 2.1 테스트용 가입 신청 계정 준비

- [ ] 테스트 이메일 주소 선택 (2개):
  - 이메일 1: `test-approval@nmc.or.kr` (내부 도메인)
  - 이메일 2: `test-approval@gmail.com` (외부 도메인)

- [ ] 각 이메일의 스팸 폴더 접근 가능 확인

### 2.2 관리자 계정 준비

- [ ] 마스터 계정 로그인 확인
  - 주소: https://aed.pics/login
  - 계정: truth0530@nmc.or.kr
  - 비밀번호: [보안상 별도 확인 필요]

- [ ] 관리자 대시보드 접근 확인
  - 주소: https://aed.pics/admin/users

---

## 단계 3: 수동 기능 테스트 (20분)

### 3.1 승인 이메일 테스트

**테스트 케이스 1: nmc.or.kr 도메인 수신자**

순서:
1. 관리자 대시보드에서 대기 중인 사용자 검색
2. 도메인이 `@nmc.or.kr`인 사용자 선택
3. [승인] 버튼 클릭
4. 승인 역할 선택 후 [확인]

예상 결과:
- [ ] HTTP 200 응답
- [ ] PM2 로그: "Approval email sent successfully via NCP Mailer"
- [ ] 이메일 수신 (5분 이내)
- [ ] 발신자: `noreply@nmc.or.kr`
- [ ] 제목: `[AED 시스템] 회원가입이 승인되었습니다`

검증:
```bash
# 로그 확인
pm2 logs aedpics --err | grep "Approval email"
```

**테스트 케이스 2: 외부 도메인 수신자**

순서:
1. 대기 중인 사용자 중 `@gmail.com` 등 외부 도메인 사용자 선택
2. [승인] 버튼 클릭
3. 승인 역할 선택 후 [확인]

예상 결과:
- [ ] HTTP 200 응답
- [ ] PM2 로그: "Approval email sent successfully via NCP Mailer"
- [ ] 이메일 수신 (5분 이내)
- [ ] 발신자: `noreply@aed.pics`
- [ ] 제목: `[AED 시스템] 회원가입이 승인되었습니다`

### 3.2 거부 이메일 테스트

**테스트 케이스 3: 사용자 거부**

순서:
1. 대기 중인 다른 사용자 선택
2. [거부] 버튼 클릭
3. 거부 사유 입력 (예: "기관 정보 불일치")
4. [확인] 버튼 클릭

예상 결과:
- [ ] HTTP 200 응답
- [ ] PM2 로그: "Rejection email sent successfully via NCP Mailer"
- [ ] 이메일 수신 (5분 이내)
- [ ] 발신자: `noreply@nmc.or.kr` 또는 `noreply@aed.pics` (수신자 도메인에 따라)
- [ ] 제목: `[AED 시스템] 회원가입 검토 결과 안내`

---

## 단계 4: NCP 콘솔 로그 검증 (10분)

### 4.1 발송 이력 확인

1. NCP 콘솔 로그인
   ```
   https://console.ncloud.com
   → Services → Cloud Outbound Mailer → 발송 이력
   ```

2. [ ] 다음 정보 확인:
   - 발신자 (From): `noreply@nmc.or.kr` 또는 `noreply@aed.pics`만 표시
   - ❌ 개인 계정 미포함:
     - fail0788@naver.com ❌
     - smy0810@nmc.or.kr ❌
     - song0811@nmc.or.kr ❌

3. [ ] 발송 상태:
   - 상태: "발송 완료" 또는 "수신 완료"
   - 실패한 이메일: 0건

### 4.2 DMARC / SPF / DKIM 검증

1. NCP 콘솔에서 이메일 통계 확인
   ```
   https://console.ncloud.com
   → Services → Email (Cloud Outbound Mailer)
   → 통계 및 보고서
   ```

2. [ ] 다음 지표 확인:
   - DMARC 정책 실패: **0건**
   - Bounce 비율: **< 1%**
   - 스팸 차단 건수: **0-1건** (정상)

---

## 단계 5: 환경 변수 검증 (5분)

### 5.1 프로덕션 서버 확인

```bash
# SSH 로그인 후 실행
ssh -i <key> ec2-user@223.130.150.133

# 환경 변수 확인
cat .env.production | grep "^NCP"

# 예상 출력:
# NCP_ACCESS_KEY=ncp_iam_BPAMKR***
# NCP_ACCESS_SECRET=ncp_iam_BPKMKRSH***
# NCP_SENDER_EMAIL=noreply@nmc.or.kr
```

- [ ] `NCP_ACCESS_KEY` 설정됨 (길이 > 20)
- [ ] `NCP_ACCESS_SECRET` 설정됨 (길이 > 20)
- [ ] `NCP_SENDER_EMAIL` = `noreply@nmc.or.kr`

### 5.2 GitHub Secrets 확인

```bash
# GitHub에서 확인 (웹 콘솔)
1. Settings → Secrets and variables → Actions
2. 다음 항목 확인:
   - NCP_ACCESS_KEY: 설정됨
   - NCP_ACCESS_SECRET: 설정됨
   - NCP_SENDER_EMAIL: noreply@nmc.or.kr
```

- [ ] 모든 비밀 키 설정됨

---

## 단계 6: PM2 로그 최종 점검 (5분)

### 6.1 실시간 로그 확인

```bash
# SSH 접근 후
pm2 logs aedpics --err --lines 100

# 찾을 패턴 (성공):
# [API:approve] Approval email sent successfully via NCP Mailer
# [NCPEmail:Request] Sending email with normalized addresses
# [SmartSender] Selected sender for domain

# 찾을 패턴 (실패):
# [API:approve] Approval email send error
# [API:approve] NCP email configuration validation failed
# [NCPEmail:Retry] NCP Email send attempt failed
```

- [ ] "successfully" 메시지 확인
- [ ] "error" 메시지 없음 (또는 재시도 후 성공)
- [ ] "validation failed" 메시지 없음

### 6.2 에러 패턴 검색

```bash
pm2 logs aedpics --err | grep -E "NCP_CONFIG_ERROR|send error|DMARC"

# 예상: 출력 없음 (정상)
```

- [ ] NCP_CONFIG_ERROR 없음
- [ ] send error 반복 없음

---

## 단계 7: 팀 알림 (5분)

### 7.1 Slack 채널별 알림

**#devops 채널:**
- [ ] 배포 완료 안내 메시지 발송
- [ ] 검증 결과 요약 포함
- [ ] 모니터링 지침 공유

**#backend 채널:**
- [ ] 기술 상세 정보 공유
- [ ] 코드 변경사항 설명
- [ ] 테스트 가이드 제공

**#general 채널 (선택사항):**
- [ ] 사용자 대상 간단한 공지 (이메일 시스템 개선)

### 7.2 이메일로 단계별 보고

- [ ] truth0530@nmc.or.kr에 검증 완료 보고
- [ ] NCP 콘솔 스크린샷 첨부
- [ ] PM2 로그 샘플 첨부

---

## 단계 8: 문제 해결 (필요시)

### 문제: 이메일을 받지 못함

**체크리스트:**
1. [ ] 스팸 폴더 확인
2. [ ] PM2 로그에 "successfully" 메시지 있는지 확인
   ```bash
   pm2 logs aedpics --err | grep "successfully"
   ```
3. [ ] NCP 콘솔에서 발송 이력 확인 (상태: 발송 완료?)
4. [ ] 환경 변수 재확인
5. [ ] 5분 대기 후 재확인

**해결 안 될 시:**
- truth0530@nmc.or.kr에 보고
- PM2 로그 전문 제공
- NCP 콘솔 스크린샷 첨부

### 문제: NCP_CONFIG_ERROR 응답

**의미:** 환경 변수 누락

**즉시 해결:**
```bash
# 프로덕션 서버에서
cat .env.production | grep NCP

# 누락된 항목 있으면 GitHub Secrets 확인 후 배포 재시작
```

### 문제: PM2에 "send error" 메시지 반복

**의미:** NCP 서비스 일시적 오류

**대응:**
1. [ ] NCP 서비스 상태 확인 (NCP 콘솔)
2. [ ] 5분 대기
3. [ ] 재시도 (동일 사용자로 다시 승인/거부)

---

## 단계 9: 배포 완료 보고

완료 항목 모두 확인 후:

- [ ] 배포 완료 일시: _________________ (현지 시간)
- [ ] 검증자: _________________ (이름)
- [ ] 테스트 이메일 1 상태: ✅ 수신 / ❌ 미수신
- [ ] 테스트 이메일 2 상태: ✅ 수신 / ❌ 미수신
- [ ] NCP 로그 확인: ✅ 정상 / ⚠️ 경고 / ❌ 오류
- [ ] 환경 변수: ✅ 모두 설정 / ❌ 누락

**최종 보고 메시지:**
```
배포 완료 보고

배포 내용: NCP 이메일 발송 시스템 개선
배포 시간: 2025-11-07 02:52:48 UTC
검증 완료: 2025-11-07 [시간] (현지 시간)

검증 결과:
✅ 승인 이메일: 정상 발송
✅ 거부 이메일: 정상 발송
✅ NCP 로그: 정상 (DMARC 오류 0건)
✅ 환경 변수: 모두 설정됨

조치: 운영팀 모니터링 시작
```

---

**작성자**: Claude Code
**생성 일시**: 2025-11-07 03:25 UTC
**예상 완료 시간**: 2025-11-07 18:00 UTC
