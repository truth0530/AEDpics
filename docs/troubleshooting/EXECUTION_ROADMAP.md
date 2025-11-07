# 실행 로드맵 - NCP 이메일 문제 해결 4단계 계획

**배포 상태**: ✅ 완료 (2025-11-07 02:52:48 UTC)
**현재 단계**: Phase 1 시작 준비
**예상 총 소요 시간**: 2-3시간

---

## 개요

모든 코드 변경과 문서화가 완료되었습니다. 이제 4가지 Phase를 순차적으로 실행하기만 하면 됩니다.

```
배포 완료 ✅
   ↓
Phase 1: 수동 기능 테스트 (30-60분)
   ↓
Phase 2: NCP 콘솔 검증 (15분)
   ↓
Phase 3: 팀 커뮤니케이션 (10분)
   ↓
Phase 4: 모니터링 연동 (20분)
   ↓
최종 보고 ✅
```

---

## Phase 1: 수동 기능 테스트 (30-60분)

### 목표
실제 승인/거부 이메일을 보내서 발신자가 올바르게 설정되었는지 확인

### 실행 단계

#### Step 1.1: 테스트 환경 준비 (5분)
```bash
# 문서 열기
open docs/troubleshooting/IMMEDIATE_ACTION_CHECKLIST.md

# 테스트할 이메일 주소 확보:
# 1. 내부 도메인: test-nmc@nmc.or.kr (또는 실제 보건소 계정)
# 2. 외부 도메인: test-external@gmail.com
```

**체크리스트:**
- [ ] 테스트 이메일 2개 준비됨
- [ ] 각 이메일의 스팸 폴더 접근 가능 확인
- [ ] 관리자 계정 (truth0530@nmc.or.kr) 로그인 가능 확인

#### Step 1.2: 승인 이메일 테스트 - nmc.or.kr 도메인 (15분)

**테스트 케이스**: TC-01-Approval-NMC

```bash
# 1. 관리자 대시보드 접속
https://aed.pics/admin/users

# 2. 대기 중인 사용자 중 @nmc.or.kr 도메인 사용자 선택
# 예: test-nmc@nmc.or.kr

# 3. [승인] 버튼 클릭

# 4. 승인 역할 선택 (예: '보건소 담당자')

# 5. [확인] 버튼 클릭
```

**예상 결과:**
```
응답: HTTP 200
로그: "Approval email sent successfully via NCP Mailer"
이메일: 5분 내 수신
발신자: noreply@nmc.or.kr (중요!)
```

**검증 체크리스트:**
- [ ] HTTP 200 응답 확인
- [ ] PM2 로그에 "successfully" 메시지 확인:
  ```bash
  pm2 logs aedpics --err | grep "successfully"
  ```
- [ ] 이메일 수신 (5분 대기)
- [ ] 이메일 헤더에서 발신자 확인:
  ```
  From: noreply@nmc.or.kr <noreply@nmc.or.kr>
  ```

**테스트 결과 기록:**
```
TC-01 결과:
[ ] HTTP 200: YES / NO
[ ] Log 메시지: 있음 / 없음
[ ] 메일 수신: 예 / 아니오 (대기 시간: ___ 분)
[ ] 발신자: noreply@nmc.or.kr / noreply@aed.pics / 기타: ___
[ ] 메일 제목: [AED 시스템] 회원가입이 승인되었습니다
[ ] 메일 본문: 정상 / 비정상
```

#### Step 1.3: 승인 이메일 테스트 - 외부 도메인 (15분)

**테스트 케이스**: TC-02-Approval-External

```bash
# 1. 다른 대기 중인 사용자 중 @gmail.com 등 외부 도메인 선택
# 예: test-external@gmail.com

# 2. [승인] 버튼 클릭

# 3. 승인 역할 선택

# 4. [확인] 버튼 클릭
```

**예상 결과:**
```
응답: HTTP 200
로그: "Approval email sent successfully via NCP Mailer"
이메일: 5분 내 수신
발신자: noreply@aed.pics (중요! nmc.or.kr과 다름)
```

**검증 체크리스트:**
- [ ] HTTP 200 응답 확인
- [ ] PM2 로그 확인
- [ ] 이메일 수신 확인
- [ ] 이메일 발신자 확인:
  ```
  From: noreply@aed.pics <noreply@aed.pics>
  ```

**테스트 결과 기록:**
```
TC-02 결과:
[ ] HTTP 200: YES / NO
[ ] Log 메시지: 있음 / 없음
[ ] 메일 수신: 예 / 아니오 (대기 시간: ___ 분)
[ ] 발신자: noreply@nmc.or.kr / noreply@aed.pics / 기타: ___
[ ] 메일 제목: [AED 시스템] 회원가입이 승인되었습니다
[ ] 메일 본문: 정상 / 비정상
```

#### Step 1.4: 거부 이메일 테스트 (15분)

**테스트 케이스**: TC-03-Rejection

```bash
# 1. 또 다른 대기 중인 사용자 선택
# (앞서 테스트한 2명과 다른 사용자)

# 2. [거부] 버튼 클릭

# 3. 거부 사유 입력 (예: "기관 정보 불일치")

# 4. [확인] 버튼 클릭
```

**예상 결과:**
```
응답: HTTP 200
로그: "Rejection email sent successfully via NCP Mailer"
이메일: 5분 내 수신
발신자: 수신자 도메인에 따라 결정
```

**검증 체크리스트:**
- [ ] HTTP 200 응답 확인
- [ ] PM2 로그 확인
- [ ] 이메일 수신 확인
- [ ] 이메일 발신자 확인 (nmc 도메인이면 noreply@nmc.or.kr, 외부면 noreply@aed.pics)

**테스트 결과 기록:**
```
TC-03 결과:
[ ] HTTP 200: YES / NO
[ ] Log 메시지: 있음 / 없음
[ ] 메일 수신: 예 / 아니오
[ ] 발신자: ___
[ ] 메일 제목: [AED 시스템] 회원가입 검토 결과 안내
[ ] 메일 본문: 정상 / 비정상 (거부 사유 표시됨: YES / NO)
```

### Phase 1 완료 조건

모든 3가지 테스트 케이스가 통과:
- [x] TC-01 (nmc 승인): 발신자 = noreply@nmc.or.kr
- [x] TC-02 (외부 승인): 발신자 = noreply@aed.pics
- [x] TC-03 (거부): 발신자 올바름

---

## Phase 2: NCP 콘솔 검증 (15분)

### 목표
NCP 서비스 로그에서 발신자와 DMARC 상태 확인

### 실행 단계

#### Step 2.1: NCP 콘솔 접속 (5분)

```bash
# 1. NCP Console 로그인
https://console.ncloud.com

# 2. Services → Cloud Outbound Mailer → 발송 이력 이동
```

#### Step 2.2: 발송 이력 확인 (5분)

**찾아야 할 항목:**
- 방금 보낸 3개의 메일 (승인 2개, 거부 1개)

**확인 사항:**

발신자 (From) 필드:
- [ ] noreply@nmc.or.kr 있음 (테스트 1개 이상)
- [ ] noreply@aed.pics 있음 (테스트 1개 이상)
- [ ] ❌ fail0788@naver.com 없음
- [ ] ❌ smy0810@nmc.or.kr 없음
- [ ] ❌ song0811@nmc.or.kr 없음
- [ ] ❌ 기타 개인 계정 없음

발송 상태:
- [ ] 상태: "발송 완료" 또는 "수신 완료"
- [ ] 실패: 0건

**스크린샷 촬영:**
```bash
# NCP 콘솔 발송 이력 화면 캡처
# → POST_DEPLOYMENT_VERIFICATION.md에 저장
```

#### Step 2.3: DMARC / SPF / DKIM 상태 확인 (5분)

```bash
# NCP Console → Email → 통계 및 보고서 이동
```

**확인 사항:**

| 지표 | 예상 값 | 현재 값 | 확인 |
|------|--------|--------|------|
| DMARC 실패 | 0건 | ___ | [ ] |
| Bounce 비율 | < 1% | ___ % | [ ] |
| 스팸 차단 | 정상 | ___ | [ ] |
| 총 발송 | 3건+ | ___ | [ ] |

**스크린샷 촬영:**
```bash
# 통계 화면 캡처
# → 최종 보고서 첨부
```

### Phase 2 완료 조건

- [x] NCP 로그에 올바른 발신자만 기록됨
- [x] DMARC 오류 = 0건
- [x] 개인 계정 미포함
- [x] 스크린샷 저장됨

---

## Phase 3: 팀 커뮤니케이션 (10분)

### 목표
운영팀, 개발팀에 배포 내용과 변경사항 공지

### 실행 단계

#### Step 3.1: #devops 채널 메시지 (5분)

```bash
# Slack 채널 열기
https://slack.com/app_redirect?channel=devops

# 문서 참조
open docs/troubleshooting/SLACK_NOTIFICATION_TEMPLATE.md

# "## 1. #devops 채널" 섹션의 메시지 복사 및 발송
```

**메시지 포함 내용:**
- 배포 완료 알림
- 변경 사항 요약
- 예상되는 발신자
- 운영팀 대응 지침
- 모니터링 항목

**예상 반응:** 운영팀으로부터 확인 메시지

#### Step 3.2: #backend 채널 메시지 (5분)

```bash
# Slack 채널 열기
https://slack.com/app_redirect?channel=backend

# 문서 참조
open docs/troubleshooting/SLACK_NOTIFICATION_TEMPLATE.md

# "## 2. #backend 채널" 섹션의 메시지 복사 및 발송
```

**메시지 포함 내용:**
- 기술 상세 정보 (코드 변경사항)
- 환경 변수 목록
- 로컬 테스트 방법
- 관련 라이브러리
- 향후 개선 방향

**예상 반응:** 개발팀으로부터 기술적 피드백

### Phase 3 완료 조건

- [x] #devops 메시지 발송
- [x] #backend 메시지 발송
- [x] 팀으로부터 반응 확인 (Optional)

---

## Phase 4: 모니터링 연동 (20분)

### 목표
일일 회귀 체크에 이메일 모니터링 항목 추가

### 실행 단계

#### Step 4.1: 일일 회귀 체크 파일 확인 (5분)

```bash
# 파일 열기
open .github/workflows/daily-regression-check.yml

# 또는
open scripts/monitoring/daily-regression-check.sh
```

#### Step 4.2: 모니터링 항목 추가 (15분)

**추가할 항목:**

```bash
# 1. 이메일 발송 성공률 계산
APPROVAL_EMAILS=$(grep "Approval email sent successfully" /var/www/aedpics/logs/*.log | wc -l)
REJECTION_EMAILS=$(grep "Rejection email sent successfully" /var/www/aedpics/logs/*.log | wc -l)
TOTAL_EMAILS=$((APPROVAL_EMAILS + REJECTION_EMAILS))

# 2. DMARC 오류 확인
DMARC_ERRORS=$(grep "DMARC" /var/www/aedpics/logs/*.log | grep -i "fail\|error" | wc -l)

# 3. 환경 변수 검증 오류 확인
CONFIG_ERRORS=$(grep "NCP_CONFIG_ERROR" /var/www/aedpics/logs/*.log | wc -l)

# 4. Slack 알림 전송
if [ $DMARC_ERRORS -gt 0 ] || [ $CONFIG_ERRORS -gt 0 ]; then
  # 경고 알림 발송
  curl -X POST $SLACK_WEBHOOK_URL \
    -H 'Content-type: application/json' \
    -d '{
      "text": "⚠️ 이메일 발송 문제 감지",
      "attachments": [{
        "color": "warning",
        "fields": [
          {"title": "DMARC 오류", "value": "'$DMARC_ERRORS'건"},
          {"title": "Config 오류", "value": "'$CONFIG_ERRORS'건"},
          {"title": "총 발송", "value": "'$TOTAL_EMAILS'건"}
        ]
      }]
    }'
fi
```

**또는 더 간단한 버전:**

```bash
# PM2 로그에서 error 패턴만 감시
pm2 logs aedpics --err | grep -E "send error|validation failed" && \
  echo "⚠️ 이메일 관련 오류 감지됨. PM2 로그 확인 필요"
```

#### Step 4.3: GitHub Actions Workflow 업데이트

```yaml
# .github/workflows/daily-regression-check.yml 에서
# 또는 새 workflow 생성

- name: Monitor Email Sending
  run: |
    # 스크립트 실행
    scripts/monitoring/email-monitoring.sh

    # Slack 알림 연동
    if [ $? -ne 0 ]; then
      # 실패 시 알림
      ./scripts/notify-slack.sh "이메일 모니터링 실패"
    fi
```

### Phase 4 완료 조건

- [x] 모니터링 항목 추가됨
- [x] 스크립트 테스트됨
- [x] Slack 알림 설정됨
- [x] GitHub Actions 통합됨

---

## 최종 보고 (5분)

### 보고 내용

완료 후 다음 정보를 정리하여 truth0530@nmc.or.kr 에 보고:

```
제목: NCP 이메일 발송 시스템 배포 완료 보고

배포 정보:
- 배포 시간: 2025-11-07 02:52:48 UTC
- 검증 완료: [현재 시간]
- 검증자: [당신의 이름]

Phase 1 결과: ✅ 완료
- TC-01 (nmc 승인): PASS
- TC-02 (외부 승인): PASS
- TC-03 (거부): PASS

Phase 2 결과: ✅ 완료
- 발신자 확인: PASS (noreply@nmc.or.kr, noreply@aed.pics만)
- DMARC 오류: 0건
- 스크린샷: [첨부]

Phase 3 결과: ✅ 완료
- #devops 알림: 발송
- #backend 알림: 발송

Phase 4 결과: ✅ 완료
- 모니터링 항목: 추가됨
- Slack 알림: 활성화됨

결론:
이메일 발송 시스템이 정상 작동합니다.
앞으로 자동 모니터링으로 DMARC 오류 및 발송 실패 시 즉시 알림 받게 됩니다.
```

### 첨부 파일

- [ ] NCP 콘솔 발송 이력 스크린샷
- [ ] NCP 콘솔 통계 화면 스크린샷
- [ ] PM2 로그 샘플 (성공 메시지 포함)
- [ ] 테스트 결과 요약 (3가지 TC 결과)

---

## 예상 시간표

```
Phase 1 테스트:           30-60분
  ├─ 준비:                5분
  ├─ nmc 승인:            15분
  ├─ 외부 승인:           15분
  └─ 거부:                15분

Phase 2 검증:             15분
  ├─ NCP 접속:            5분
  ├─ 발송 이력:           5분
  └─ 통계:                5분

Phase 3 커뮤니케이션:      10분
  ├─ #devops:             5분
  └─ #backend:            5분

Phase 4 모니터링:         20분
  ├─ 파일 확인:           5분
  ├─ 항목 추가:           10분
  └─ 테스트:              5분

최종 보고:                5분
─────────────────────────────
총 예상 시간:            80-90분 (1.5-1.5시간)
```

---

## 체크리스트

전체 실행 진행 상황:

- [ ] Phase 1: 수동 테스트 완료
  - [ ] TC-01 PASS
  - [ ] TC-02 PASS
  - [ ] TC-03 PASS

- [ ] Phase 2: NCP 콘솔 검증 완료
  - [ ] 발신자 확인
  - [ ] DMARC 확인
  - [ ] 스크린샷 저장

- [ ] Phase 3: 팀 커뮤니케이션 완료
  - [ ] #devops 메시지
  - [ ] #backend 메시지

- [ ] Phase 4: 모니터링 연동 완료
  - [ ] 스크립트 추가
  - [ ] Slack 알림 설정
  - [ ] 테스트 실행

- [ ] 최종 보고서 작성
  - [ ] 보고 메일 발송
  - [ ] 첨부 파일 포함

---

## 문제 발생 시 빠른 대응

### 이메일을 받지 못함
1. PM2 로그 확인: `pm2 logs aedpics --err | grep successfully`
2. NCP 콘솔 발송 상태 확인
3. 수신 이메일 스팸 폴더 확인
4. 5분 대기 후 재확인

### NCP_CONFIG_ERROR 반환
1. 환경 변수 확인: `cat .env.production | grep NCP`
2. GitHub Secrets 확인
3. 배포 재시작

### DMARC 오류 발생
1. IT 관리자와 협의
2. NCP 콘솔 DMARC 정책 확인
3. 발신자 도메인 확인

---

**준비 상태**: 모든 문서와 코드 준비 완료
**시작 준비**: Phase 1 시작 가능
**예상 완료**: 2025-11-07 18:00 UTC (또는 내일 오전)

이제 Phase 1부터 시작하세요!
