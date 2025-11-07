# NCP 이메일 발송 문제 해결 - 배포 후 검증 가이드

**작성일**: 2025-11-07
**배포 완료**: 2025-11-07 02:52:48 UTC
**상태**: 배포 성공, 검증 단계 진행 중

---

## 1. 배포 내용 요약

### 문제
2025-11-07 09:55:07 UTC에 프로덕션 환경에서 이메일 발송 시 여러 개인 NCP 계정이 발신자로 사용되는 심각한 문제 발생:
- fail0788@naver.com
- smy0810@nmc.or.kr
- song0811@nmc.or.kr
- 등 다중 발신자 사용

### 근본 원인
`app/api/admin/users/approve/route.ts`의 승인/거부 API가 이미 구축된 NCP Cloud Outbound Mailer 대신 Resend API를 사용하고 있었음.

### 배포된 수정사항

#### 1단계: NCP Mailer 통합 (Commit 0c673d4)
- ✅ 승인 이메일: Resend API → `sendSmartEmail()` 함수로 교체
- ✅ 거부 이메일: Resend API → `sendSmartEmail()` 함수로 교체
- ✅ 스마트 발신자 선택: 수신자 도메인 기반 자동 선택
  - `@nmc.or.kr` 수신자 → `noreply@nmc.or.kr`
  - 기타 도메인 → `noreply@aed.pics`
- ✅ 재시도 로직: 지수 백오프 (maxRetries: 3, initialDelay: 1000ms)

#### 2단계: 환경 변수 검증 추가 (Commit 1c2e35a)
- ✅ `validateNCPEmailConfig()` 함수 구현
- ✅ 승인/거부 API 시작 시 필수 환경변수 검증
- ✅ 누락 시 500 에러 반환 (NCP_CONFIG_ERROR)

---

## 2. 배포 후 검증 체크리스트

### Phase 1: 자동 배포 검증 (완료)
- [x] GitHub Actions 배포 성공 (status: completed, conclusion: success)
- [x] 배포 시간: 약 7분
- [x] 빌드 산출물 검증: 통과

### Phase 2: 수동 연기능 테스트 (진행 중)

#### 2.1 승인 이메일 테스트
```bash
# 사전 조건:
# - 보건소 가입 신청 계정 준비
# - 관리자 로그인 (truth0530@nmc.or.kr)
# - https://aed.pics/admin/users 접근

# 테스트 절차:
1. 대기 중인 사용자 목록에서 한 명 선택
2. [승인] 버튼 클릭
3. 승인 이메일 발송 완료 메시지 확인
4. 사용자 이메일로 이메일 수신 확인
5. 발신자 주소 확인 (noreply@nmc.or.kr 또는 noreply@aed.pics 중 하나)
```

**예상 결과:**
- HTTP 200 응답
- Slack 알림: "Approval email sent successfully via NCP Mailer"
- 사용자 이메일 수신 (발신자: noreply@nmc.or.kr 또는 noreply@aed.pics)
- PM2 로그에 성공 메시지 기록

#### 2.2 거부 이메일 테스트
```bash
# 테스트 절차:
1. 대기 중인 사용자 중 다른 한 명 선택
2. [거부] 버튼 클릭
3. 거부 사유 입력
4. [확인] 버튼 클릭
5. 거부 이메일 발송 완료 메시지 확인
6. 사용자 이메일로 이메일 수신 확인
```

**예상 결과:**
- HTTP 200 응답
- Slack 알림: "Rejection email sent successfully via NCP Mailer"
- 사용자 이메일 수신 (발신자: noreply@nmc.or.kr 또는 noreply@aed.pics)
- PM2 로그에 성공 메시지 기록

### Phase 3: NCP 콘솔 로그 검증

#### 3.1 NCP Cloud Outbound Mailer 로그 확인
```
NCP Console → Cloud Outbound Mailer → 발송 이력
```

**확인 사항:**
- 발신자 (From) 필드에 **오직 다음 중 하나만** 표시:
  - `noreply@nmc.or.kr`
  - `noreply@aed.pics`
- ❌ 개인 계정 (fail0788@naver.com, smy0810@nmc.or.kr 등) 미표시

#### 3.2 반송 및 DMARC 오류 확인
```
NCP Console → Email → 통계 및 보고서
```

**확인 사항:**
- DMARC 정책 실패 건수: 0
- Bounce 비율: 정상 수준 (< 1%)
- 수신거부 건수: 0 (반복되는 거부 패턴 없음)

---

## 3. 환경 변수 검증

### 3.1 필수 환경 변수 확인
```bash
# 프로덕션 서버에서 다음 명령어 실행:
echo "환경 변수 검증 결과:"
echo "NCP_ACCESS_KEY: $([ -n "$NCP_ACCESS_KEY" ] && echo '설정됨' || echo '미설정')"
echo "NCP_ACCESS_SECRET: $([ -n "$NCP_ACCESS_SECRET" ] && echo '설정됨' || echo '미설정')"
echo "NCP_SENDER_EMAIL: $NCP_SENDER_EMAIL"
```

**예상 결과:**
```
환경 변수 검증 결과:
NCP_ACCESS_KEY: 설정됨
NCP_ACCESS_SECRET: 설정됨
NCP_SENDER_EMAIL: noreply@nmc.or.kr
```

### 3.2 API 응답 헤더 확인
```bash
# 승인/거부 API 호출 시 로그 확인:
curl -i https://aed.pics/api/admin/users/approve \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"userId":"...", "approvedRoles":[...]}'
```

**예상 결과:**
- HTTP 200 또는 201 (성공)
- HTTP 500 with "NCP_CONFIG_ERROR" (환경 변수 누락)

---

## 4. PM2 로그 모니터링

### 4.1 실시간 로그 확인
```bash
# SSH로 프로덕션 서버 접근 후:
pm2 logs aedpics --err
```

**찾아야 할 메시지 패턴:**

**성공 케이스:**
```
[API:approve] Approval email sent successfully via NCP Mailer
[NCPEmail:Request] Sending email with normalized addresses
[SmartSender] Selected sender for domain
```

**실패 케이스:**
```
[API:approve] NCP email configuration validation failed
[API:approve] Approval email send error
[NCPEmail:Retry] NCP Email send attempt failed, retrying
```

### 4.2 에러 코드 해석

| 에러 코드 | 의미 | 해결 방법 |
|---------|------|---------|
| `NCP_CONFIG_ERROR` | 환경 변수 누락 | GitHub Secrets 확인, 배포 재시작 |
| `NCP Email API error` | NCP 서비스 오류 | NCP 콘솔 상태 확인, 5분 후 재시도 |
| `ERR_INVALID_EMAIL` | 잘못된 이메일 주소 | 사용자 이메일 형식 검증 |

---

## 5. 공동 팀 알림 (Slack)

### 5.1 통지 내용
배포 완료 후 #devops 또는 #backend 채널에 다음 메시지 전달:

```
제목: NCP 이메일 발송 문제 해결 - 배포 완료

변경 내용:
- 승인/거부 이메일 발송 시스템 개선
- Resend API → NCP Cloud Outbound Mailer 전환
- 단일 발신자 기반 설계 (다중 개인 계정 사용 중단)
- 환경 변수 자동 검증 기능 추가

배포 정보:
- 배포 시간: 2025-11-07 02:52:48 UTC
- 커밋: 0c673d4 (NCP 통합), 1c2e35a (환경 변수 검증)
- 상태: 배포 성공, 검증 진행 중

운영팀이 알아야 할 사항:
1. 이메일 발송 실패 시 에러 코드 'NCP_CONFIG_ERROR' 반환
   → 환경 변수 설정 확인 필요
2. 발신자는 다음 중 하나만 사용:
   - noreply@nmc.or.kr (nmc.or.kr 수신자)
   - noreply@aed.pics (기타 도메인)
3. 이전처럼 여러 개인 계정으로 발송되지 않음
4. NCP 콘솔에서 발신자 로그를 주기적으로 모니터링

검증 예정:
- 수동 테스트: 2025-11-07 (승인 / 거부 각 1회)
- NCP 로그 검증: 2025-11-07
- 완료 보고: 2025-11-08

문제 발생 시 연락: truth0530@nmc.or.kr
```

### 5.2 추가 운영 가이드
```
주의사항:
- 개인 계정(예: truth0530@nmc.or.kr)으로는 발송 불가
- DMARC 정책 변경 금지 (이미 IT 팀에서 설정 완료)
- 환경 변수는 GitHub Secrets에서 관리

모니터링 포인트:
- 일일 회귀 체크 시 이메일 발송 로그 포함
- NCP 콘솔 DMARC 실패 건수 = 0 유지
- PM2 로그에 "send error" 패턴 모니터링
```

---

## 6. 배포 후 모니터링 규칙

### 6.1 자동 모니터링 (GitHub Actions)
기존 `daily-regression-check.yml`에 다음 검증 항목 추가 예정:

```bash
# 이메일 발송 로그 샘플 수집
APPROVAL_EMAILS=$(grep "Approval email sent successfully" /var/www/aedpics/logs/*.log | wc -l)
REJECTION_EMAILS=$(grep "Rejection email sent successfully" /var/www/aedpics/logs/*.log | wc -l)

# DMARC 오류 확인
DMARC_ERRORS=$(grep "DMARC" /var/www/aedpics/logs/*.log | grep -i "fail" | wc -l)

# Slack 알림
if [ $DMARC_ERRORS -gt 0 ]; then
  # DMARC 오류 발생 시 경고 알림
fi
```

### 6.2 성공 지표
- 이메일 발송 성공률: > 95%
- DMARC 정책 실패: 0건
- 환경 변수 검증 실패: 0건 (정상 배포 후)
- 응답 시간: < 500ms

### 6.3 경고 지표
- 이메일 발송 실패율: > 5%
- DMARC 정책 실패: > 0건
- NCP_CONFIG_ERROR 반환 빈도: > 3회/일
- API 응답 시간: > 1000ms

---

## 7. 롤백 계획 (필요 시)

만약 배포 후 심각한 문제가 발생할 경우:

```bash
# 1. 이전 버전으로 즉시 롤백
gh workflow run deploy-production.yml \
  -f rollback_commit=<이전_커밋_해시>

# 2. PM2 서비스 재시작
pm2 restart ecosystem.config.cjs

# 3. 롤백 확인
curl https://aed.pics/api/health
```

**롤백 대상 커밋:**
- 최근 정상 배포: 1b1dff3 (2025-11-06)

---

## 8. 예상 FAQ

### Q1: 왜 여러 발신자가 사용되었나?
**A:** Resend API가 여러 개인 계정을 발신자로 처리했기 때문. 이제는 NCP Cloud Outbound Mailer를 통해 단일 설정된 계정만 사용.

### Q2: noreply@nmc.or.kr과 noreply@aed.pics의 차이는?
**A:** DMARC 정책 준수를 위해 수신자 도메인에 따라 자동 선택:
- nmc.or.kr 도메인 사용자 → noreply@nmc.or.kr (도메인 일치)
- 기타 도메인 사용자 → noreply@aed.pics (SPF/DKIM 설정됨)

### Q3: 이메일이 여전히 오지 않으면?
**A:** 다음 순서대로 확인:
1. PM2 로그에 "Approval email sent successfully" 메시지 있는지 확인
2. NCP 콘솔의 발송 이력에서 상태 확인
3. 수신자의 스팸 폴더 확인
4. truth0530@nmc.or.kr로 보고

### Q4: NCP_CONFIG_ERROR가 반환되면?
**A:** 프로덕션 서버의 환경 변수 확인:
```bash
ssh -i $KEY ec2-user@223.130.150.133
cat .env.production | grep NCP
```

---

## 9. 다음 단계

1. **즉시 (2025-11-07):**
   - 승인/거부 이메일 각 1회 테스트
   - NCP 콘솔 로그 확인
   - Slack 팀 알림

2. **당일 (2025-11-07):**
   - 모든 검증 항목 완료
   - 운영팀 가이드 공유
   - 배포 완료 보고

3. **주간 모니터링:**
   - 일일 회귀 체크 실행
   - NCP 콘솔 DMARC 오류 모니터링
   - 이메일 발송 성공률 추적

---

**작성자**: Claude Code
**마지막 업데이트**: 2025-11-07 03:25 UTC
**상태**: 검증 단계
