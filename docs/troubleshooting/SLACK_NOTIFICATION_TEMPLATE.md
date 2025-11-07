# Slack 알림 템플릿 - NCP 이메일 발송 문제 해결

## 1. #devops 채널 (운영팀)

### 제목 및 요약
```
🔧 [완료] NCP 이메일 발송 문제 해결 - 배포 완료

상황: 프로덕션에서 여러 개인 NCP 계정이 이메일 발신자로 사용되는 문제 발생
원인: 승인/거부 API가 Resend 서비스를 사용 중
조치: Resend → NCP Cloud Outbound Mailer로 교체 + 환경 변수 자동 검증
상태: 배포 완료 (2025-11-07 02:52:48 UTC), 검증 진행 중
```

### 상세 알림 내용
```
변경 사항:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣ 이메일 발송 시스템 개선
   • Resend API → NCP Cloud Outbound Mailer 전환
   • 단일 발신자 기반으로 통일 (다중 개인 계정 사용 중단)
   • 스마트 발신자 선택 기능 활성화:
     - nmc.or.kr 도메인 수신자 → noreply@nmc.or.kr
     - 기타 도메인 수신자 → noreply@aed.pics

2️⃣ 환경 변수 검증 강화
   • 승인/거부 API 시작 시 NCP 자격증명 자동 검증
   • 누락 시 500 에러 반환 (error code: NCP_CONFIG_ERROR)
   • 실패 시 즉시 감지 가능 (이전: 런타임 오류)

배포 정보:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• 커밋 1: 0c673d4 - NCP Mailer 통합 (승인/거부 이메일)
• 커밋 2: 1c2e35a - 환경 변수 검증 추가
• 배포 시간: 2025-11-07 02:52:48 UTC (약 7분 소요)
• 상태: ✅ 성공

예상되는 이메일 발송자:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ noreply@nmc.or.kr (기존에도 있었음)
✅ noreply@aed.pics (기존에도 있었음)
❌ fail0788@naver.com (제거됨)
❌ smy0810@nmc.or.kr (제거됨)
❌ song0811@nmc.or.kr (제거됨)
❌ 기타 개인 계정들 (제거됨)

운영팀 대응:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

☑️ 즉시 (2025-11-07):
  1. NCP 콘솔에서 발송 이력 확인
     → 발신자 주소가 noreply@nmc.or.kr 또는 noreply@aed.pics만인지 검증
  2. 실패한 이메일이 있는지 확인
  3. DMARC 정책 오류 건수 = 0 확인

☑️ PM2 로그 모니터링 (매시간):
  ```
  pm2 logs aedpics --err | grep -E "NCP_CONFIG_ERROR|send error"
  ```
  • NCP_CONFIG_ERROR 발생 시: 환경 변수 재확인 필요
  • send error 반복 시: truth0530@nmc.or.kr 에 보고

☑️ 일일 회귀 체크 통합 (내일부터):
  • 이메일 발송 로그 모니터링 추가
  • DMARC 오류 발생률 모니터링
  • Slack 자동 알림 설정

주의사항:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  개인 계정으로 이메일 발송 불가능
    → noreply@nmc.or.kr은 지정 계정이므로 사용 권한이 없음
⚠️  DMARC 정책 임의 변경 금지
    → IT 관리자가 이미 설정 완료
⚠️  환경 변수는 GitHub Secrets 관리
    → 서버 배포 시 자동 로드됨

문제 시 보고:
truth0530@nmc.or.kr (시스템 관리자)

상세 검증 가이드:
🔗 docs/troubleshooting/POST_DEPLOYMENT_VERIFICATION.md
```

---

## 2. #backend 채널 (개발팀)

### 제목 및 요약
```
🚀 [배포 완료] NCP 이메일 발송 문제 해결

상태: 프로덕션 배포 완료 (2025-11-07 02:52:48 UTC)
변경: 승인/거부 이메일 시스템 개선 (Resend → NCP)
영향: app/api/admin/users/approve/route.ts
```

### 상세 알림 내용
```
변경 내용 상세:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 수정된 파일:
   • app/api/admin/users/approve/route.ts

🔧 구현 내용:

1. 승인 이메일 (POST /api/admin/users/approve)
   변경 전:
   ├─ Resend API 호출
   ├─ 발신자: hardcoded 'noreply@aed.pics'
   └─ 재시도: 없음

   변경 후:
   ├─ NCP Cloud Outbound Mailer 호출
   ├─ 발신자: 동적 선택 (sendSmartEmail)
   │  ├─ nmc.or.kr 도메인 → noreply@nmc.or.kr
   │  └─ 기타 도메인 → noreply@aed.pics
   └─ 재시도: 지수 백오프 (maxRetries: 3, initialDelay: 1000ms)

2. 거부 이메일 (DELETE /api/admin/users/approve)
   변경 내용: 승인 이메일과 동일

3. 환경 변수 검증
   추가된 함수: validateNCPEmailConfig()
   ├─ NCP_ACCESS_KEY 확인
   ├─ NCP_ACCESS_SECRET 확인
   └─ 누락 시: 500 에러 (NCP_CONFIG_ERROR)

코드 예시:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```typescript
// 변경 전 (Resend 방식)
await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${RESEND_API_KEY}` },
  body: JSON.stringify({
    from: 'noreply@aed.pics',  // ❌ 하드코딩됨
    to: userEmail,
    subject: '승인 알림',
    html: emailBody
  })
});

// 변경 후 (NCP 방식)
const { sendSmartEmail } = await import('@/lib/email/ncp-email');

const ncpConfig = {
  accessKey: env.NCP_ACCESS_KEY,
  accessSecret: env.NCP_ACCESS_SECRET,
  senderAddress: env.NCP_SENDER_EMAIL || 'noreply@nmc.or.kr'
};

await sendSmartEmail(
  ncpConfig,
  targetUser.email,
  targetUser.email.split('@')[0],
  '승인 알림',
  emailBody,
  { maxRetries: 3, initialDelay: 1000 }
);
```

환경 변수 (GitHub Secrets에서 관리):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NCP_ACCESS_KEY = ncp_iam_... (2025-10-31 생성)
NCP_ACCESS_SECRET = ncp_iam_... (2025-10-31 생성)
NCP_SENDER_EMAIL = noreply@nmc.or.kr (지정 계정)

테스트 시 확인 사항:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

로컬 개발 시:
```bash
# .env.local 확인
echo "NCP_ACCESS_KEY: $NCP_ACCESS_KEY"
echo "NCP_ACCESS_SECRET: $NCP_ACCESS_SECRET"
echo "NCP_SENDER_EMAIL: $NCP_SENDER_EMAIL"

# API 테스트
curl -X POST http://localhost:3001/api/admin/users/approve \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-id",
    "approvedRoles": ["local_admin"]
  }'
```

프로덕션 검증:
✅ PM2 로그에 "Approval email sent successfully via NCP Mailer" 메시지 확인
✅ NCP 콘솔에서 발신자 = noreply@nmc.or.kr 또는 noreply@aed.pics만 표시
✅ 응답 시간 < 500ms

관련 라이브러리:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
lib/email/ncp-email.ts
  ├─ sendNCPEmail() - 재시도 로직 포함된 저수준 발송
  └─ sendSmartEmail() - 도메인 인식 고수준 발송

lib/email/smart-sender-selector-simplified.ts
  ├─ selectSmartSender() - 도메인별 발신자 선택
  ├─ recordSendingFailure() - 실패 기록
  ├─ recordSendingSuccess() - 성공 기록
  └─ clearFailureCache() - 실패 캐시 초기화 (1시간마다)

기여도:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• app/api/admin/users/approve/route.ts: +120 lines, -30 lines
  (Resend API 호출 제거, NCP Mailer 호출 추가)

컬럼 라인 수:
  • 라인 13-32: validateNCPEmailConfig() 함수
  • 라인 36-50: POST 시작 시 환경 변수 검증
  • 라인 300-367: 승인 이메일 발송 (NCP 방식)
  • 라인 450-464: DELETE 시작 시 환경 변수 검증
  • 라인 531-588: 거부 이메일 발송 (NCP 방식)

향후 개선 방향:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 이메일 전송 실패 DB 로깅 (현재: 로그만 기록)
2. Slack 알림 통합 (실패 시 자동 알림)
3. 이메일 템플릿 데이터베이스화
4. 발신자 라운드로빈 (부하 분산)
5. 이메일 발송 통계 대시보드

문의:
truth0530@nmc.or.kr

관련 문서:
🔗 docs/troubleshooting/EMAIL_SENDING_ISSUE_RESOLUTION.md
🔗 docs/troubleshooting/POST_DEPLOYMENT_VERIFICATION.md
```

---

## 3. #general 채널 (회사 공지)

### 제목 및 요약 (선택사항)
```
📧 [공지] 이메일 발송 시스템 개선 완료

사용자 승인/거부 알림 이메일 서비스가 개선되었습니다.
더 안정적인 이메일 발송을 제공합니다.
```

---

## 4. 알림 발송 시점

### 권장 발송 시간
1. **배포 직후 (2025-11-07 02:53 UTC)**
   - #devops 채널: "배포 완료" 알림
   - 운영팀에 긴급 확인 요청

2. **수동 테스트 완료 후 (2025-11-07 18:00 UTC)**
   - #backend 채널: 상세 기술 정보
   - 개발팀 공유

3. **NCP 로그 검증 완료 후 (2025-11-08 09:00 UTC)**
   - #devops 채널: 최종 검증 완료 보고
   - #general 채널: 사용자 공지 (선택사항)

---

## 5. 자동 알림 설정 (향후)

### GitHub Actions 자동 알림
```yaml
# .github/workflows/notify-deployment.yml
- name: Notify Deployment Success
  if: success()
  uses: slackapi/slack-github-action@v1.26
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK_DEVOPS }}
    payload: |
      {
        "text": "이메일 발송 시스템 배포 완료",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*NCP 이메일 발송 시스템 배포 완료*\n배포 시간: ${{ job.started_at }}"
            }
          }
        ]
      }
```

---

**작성자**: Claude Code
**생성 일시**: 2025-11-07 03:25 UTC
**상태**: 배포 완료, 검증 가이드 준비
