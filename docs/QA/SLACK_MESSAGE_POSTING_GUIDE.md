# Slack 메시지 발송 가이드

## 개요

2025-11-07 자동 모니터링 시스템 활성화를 Slack을 통해 팀에 공지합니다.

**발송 타이밍**: 즉시 (또는 팀 미팅 직후)
**발송 채널**: #aedpics, #devops, #backend, #qa

---

## Step 1: 채널별 메시지 준비

### #aedpics 채널 (전사 공지)

```
2025-11-07 프로덕션 배포 완료 및 자동 모니터링 시스템 활성화

안녕하세요,

두 가지 중요한 프로덕션 버그 수정사항이 배포되었으며, 앞으로 매일 이 기능들이 정상 작동하는지 자동으로 검증하게 됩니다.

📋 검증 항목
- Fix #1: 점검 완료 기능이 정상 작동하는가?
- Fix #2: 사용자 정보 수정이 DB에 반영되는가?

⏰ 일정
- 매일 08:00 KST에 자동 실행
- 결과는 #aedpics-monitoring 채널에 공지

📊 메시지 유형
✅ 정상: "Daily Regression Check Passed" (특별 조치 불필요)
⚠️ 경고: "Low Activity" (모니터링 권장)
🚨 실패: "CRITICAL" (즉시 대응)

🔗 더 알고 싶으신가요?
- 배포 상세: docs/QA/DEPLOYMENT_SUMMARY_2025-11-07.md
- 로그 해석: docs/QA/PM2_LOG_SAMPLES.md
- 일일 체크: docs/QA/MONITORING_DAILY_CHECKLIST.md

질문 사항은 #aedpics-monitoring 또는 담당팀까지 연락 부탁드립니다.
```

---

### #devops 채널 (운영팀 담당 사항)

```
매일 08:00 KST 이후 회귀 검사 결과 확인 요청

DevOps 팀에서 매일 아래를 확인해주세요:

✅ Step 1: 이 채널 또는 #aedpics-monitoring 확인 (2분)
   - GitHub Actions 링크 클릭
   - "success" 또는 문제 메시지 확인

✅ Step 2: 문제 발생 시 (5분)
   - GitHub Actions > Artifacts 다운로드
   - regression-check-report 파일에서 실제 수치 확인

✅ Step 3: 이상 징후 체크
   - "MISMATCH" 또는 "ERROR" 단어 발견 시
   - 백엔드 팀에 @mention으로 즉시 알림

📖 참고 문서
- 설정 가이드: docs/QA/GITHUB_SECRETS_SETUP.md
- 일일 체크리스트: docs/QA/MONITORING_DAILY_CHECKLIST.md
- 상세 대응: docs/QA/MONITORING_SETUP_GUIDE.md

문의사항: #aedpics-monitoring 또는 DevOps 리드
```

---

### #backend 채널 (개발팀 담당 사항)

```
프로덕션 버그 회귀 감지 시스템 활성화

백엔드 팀에 안내드립니다.

Fix #1 (점검 완료)과 Fix #2 (사용자 정보 수정)이 프로덕션에서 회귀하지 않는지 매일 자동 검증됩니다.

🔍 문제 보고 시 확인 사항

1. 점검 완료 오류 관련
   ```
   pm2 logs --err | grep "InspectionSession\|completeSession"
   ```
   → docs/QA/PM2_LOG_SAMPLES.md 참고

2. 사용자 정보 수정 오류 관련
   ```sql
   SELECT * FROM audit_logs WHERE action='user_updated'
   ORDER BY created_at DESC LIMIT 5;
   ```
   → 실제 DB 상태 확인

3. 회귀 감지 시
   - #aedpics-monitoring에서 DevOps팀과 소통
   - GitHub Actions 링크에서 상세 로그 확인
   - docs/QA/MONITORING_SETUP_GUIDE.md Part 8 참고

📖 필독 문서
- 로그 샘플: docs/QA/PM2_LOG_SAMPLES.md
- 배포 내용: docs/QA/DEPLOYMENT_SUMMARY_2025-11-07.md
- 대응 절차: docs/QA/MONITORING_SETUP_GUIDE.md Part 8

문의: #aedpics-monitoring 또는 관련 담당자
```

---

### #qa 채널 (QA팀 담당 사항)

```
일일 회귀 검사 결과 모니터링 안내

QA 팀에서 다음을 참고해주세요.

📊 매월 말 검토 항목
- 월간 성공률 (목표: 95% 이상)
- 평균 실행 시간 (목표: 3분 이내)
- False positive 율 (목표: 10% 미만)

📈 초기 2-3일 집중 모니터링
- 정상 범위 설정 (일일 inspection/user update 평균)
- 임계값 필요성 판단
- false positive 감소 전략

🔗 참고 문서
- 테스트 절차: docs/QA/POST_DEPLOYMENT_QA_2025-11-07.md
- 배포 상세: docs/QA/DEPLOYMENT_SUMMARY_2025-11-07.md
- 모니터링 개요: docs/QA/MONITORING_IMPLEMENTATION_SUMMARY.md

문의: #aedpics-monitoring 또는 QA 리드
```

---

## Step 2: 메시지 발송 방법

### 방법 1: 수동 복사-붙여넣기 (권장)

1. 위의 채널별 메시지 텍스트 복사
2. Slack 각 채널 열기
3. 메시지 입력창에 붙여넣기
4. 발송 (엔터 또는 전송 버튼)

**장점**: 간단하고 빠름
**단점**: 각 채널마다 수동 입력 필요

---

### 방법 2: Slack API 자동 발송 (선택사항)

Slack 봇 토큰이 있다면 자동화 가능:

```bash
#!/bin/bash

# Slack API 설정
SLACK_TOKEN="xoxb-your-token"
CHANNEL_MAIN="C123456"    # #aedpics
CHANNEL_DEVOPS="C234567"  # #devops
CHANNEL_BACKEND="C345678" # #backend
CHANNEL_QA="C456789"      # #qa

# Step 1: #aedpics 발송
curl -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $SLACK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "'$CHANNEL_MAIN'",
    "text": "2025-11-07 프로덕션 배포 완료 및 자동 모니터링 시스템 활성화",
    "blocks": [...]
  }'

# Step 2: #devops, #backend, #qa 동일하게 발송
```

---

## Step 3: 발송 후 확인

### 확인 체크리스트

- [ ] #aedpics: 메시지 발송 완료
- [ ] #devops: 메시지 발송 완료
- [ ] #backend: 메시지 발송 완료
- [ ] #qa: 메시지 발송 완료
- [ ] #aedpics-monitoring: 채널이 존재하고 접근 가능한지 확인

### 팀 반응 모니터링

- 24시간 내에 팀이 문서를 읽고 질문하거나 확인했는지 모니터링
- 필요시 추가 설명 스레드 답변 준비

---

## Step 4: 팀 미팅 검토 (선택사항)

### 마이크로 워크숍 (30분)

**참석**: DevOps + Backend (필수), QA + 관심있는 팀원 (선택)

**아젠다**:
1. 배포된 두 가지 버그 수정 내용 (5분)
2. 매일 자동 검증 방식 설명 (10분)
3. 로그 해석 실습 (10분)
   - PM2_LOG_SAMPLES.md 예제 보기
   - 실제 GitHub Actions 아티팩트 보기
4. 질의응답 (5분)

---

## Step 5: 첫 자동 실행 모니터링

**2025-11-08 08:00 KST (첫 자동 실행)**

### 사전 준비

- [ ] #aedpics-monitoring 채널 권한 확인
- [ ] GitHub Actions 대시보드 북마크
- [ ] 아티팩트 다운로드 위치 확인

### 실행 후 확인 (08:05 KST)

1. **Slack 메시지 확인** (1분)
   - #aedpics-monitoring에 메시지 도착 확인
   - 메시지 포맷 정상 여부 확인

2. **GitHub Actions 확인** (2분)
   - 워크플로우 실행 완료 확인
   - 모든 단계 통과 여부 확인

3. **아티팩트 검증** (3분)
   - 리포트 파일 다운로드 가능 여부
   - 실제 수치 (inspection, user update) 확인

---

## 다음 단계

1. **초기 모니터링 기간** (2025-11-08 ~ 2025-11-10)
   - 3일 연속 결과 모니터링
   - 정상 범위 파악
   - false positive 여부 판단

2. **임계값 조정** (필요시)
   - 경고/긴급 기준 재설정
   - Slack 메시지 포맷 개선

3. **정기 체계 활성화** (2025-11-11)
   - 일일 DevOps 확인 시작
   - 월간 리포트 계획 수립

---

## 문의 및 피드백

- 기술 질문: #aedpics-monitoring
- 절차 개선 제안: DevOps 리드
- 긴급 이슈: 담당자 @mention

---

**작성**: 2025-11-07
**버전**: 1.0
