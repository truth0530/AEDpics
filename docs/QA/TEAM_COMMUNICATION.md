# 팀 공지: 2025-11-07 배포 및 모니터링 시스템

## 개요

2025-11-07에 프로덕션 배포된 2가지 중요한 버그 수정사항과 자동화된 모니터링 시스템을 안내드립니다.

---

## 1단계: 문서 공유 (오늘 실시)

### 역할별 추천 읽기 순서

**⏱️ 총 소요 시간**: 역할당 10-30분

#### 백엔드 엔지니어 (기술 구현팀)
```
📖 필수 읽기 (우선순위 순):
1. [PM2_LOG_SAMPLES.md](PM2_LOG_SAMPLES.md) - 15분
   ➜ 문제 발생 시 로그 해석 방법
   ➜ 북마크 필수!

2. [DEPLOYMENT_SUMMARY_2025-11-07.md](DEPLOYMENT_SUMMARY_2025-11-07.md) - 20분
   ➜ 무엇이 고쳐졌고 왜 고쳤는지
   ➜ 커밋: c6da14c, 9097472

3. [MONITORING_SETUP_GUIDE.md](MONITORING_SETUP_GUIDE.md) Part 8 - 10분
   ➜ 회귀 감지 시 대응 절차
```

**언제 읽을까**:
- 지금 (30분)
- 또는 로그를 봐야 할 때 (PM2_LOG_SAMPLES.md만)

---

#### QA/테스트 엔지니어
```
📖 필수 읽기 (우선순위 순):
1. [POST_DEPLOYMENT_QA_2025-11-07.md](POST_DEPLOYMENT_QA_2025-11-07.md) - 30분
   ➜ 7가지 테스트 케이스
   ➜ 단계별 검증 절차

2. [DEPLOYMENT_SUMMARY_2025-11-07.md](DEPLOYMENT_SUMMARY_2025-11-07.md) - 20분
   ➜ 배포 항목 이해

3. [PM2_LOG_SAMPLES.md](PM2_LOG_SAMPLES.md) - 15분
   ➜ 테스트 시 로그 검증
```

**언제 읽을까**:
- 오늘 (계획 수립)
- 내일~모레 (테스트 실행)

---

#### DevOps/SRE (인프라 운영팀)
```
📖 필수 읽기 (우선순위 순):
1. [GITHUB_SECRETS_SETUP.md](GITHUB_SECRETS_SETUP.md) - 20분
   ➜ Secrets 설정 (DATABASE_PASSWORD, SLACK_WEBHOOK)
   ➜ Workflow 수동 테스트
   ➜ 오늘 중에 실행!

2. [MONITORING_SETUP_GUIDE.md](MONITORING_SETUP_GUIDE.md) Part 1-5 - 30분
   ➜ 자동 모니터링 설정
   ➜ 정기 유지보수

3. [MONITORING_IMPLEMENTATION_SUMMARY.md](MONITORING_IMPLEMENTATION_SUMMARY.md) - 10분
   ➜ 전체 모니터링 시스템 개요
```

**언제 읽을까**:
- 오늘 (Secrets 설정)
- 내일 (워크플로우 테스트)

---

#### 팀 리드/관리자
```
📖 필수 읽기 (우선순위 순):
1. [DEPLOYMENT_SUMMARY_2025-11-07.md](DEPLOYMENT_SUMMARY_2025-11-07.md) - 20분
   ➜ 무엇이 고쳐졌는지
   ➜ 프로덕션 영향도

2. [MONITORING_IMPLEMENTATION_SUMMARY.md](MONITORING_IMPLEMENTATION_SUMMARY.md) - 10분
   ➜ 모니터링 시스템 개요
   ➜ 팀 커뮤니케이션 계획

3. [MONITORING_SETUP_GUIDE.md](MONITORING_SETUP_GUIDE.md) Part 7 - 10분
   ➜ Slack 알림 설정
   ➜ 팀 교육 계획
```

**언제 읽을까**:
- 오늘 (팀 미팅)
- 문서 공유 후 (다음 미팅)

---

### 문서 접근 방법

**로컬에서**:
```bash
# 프로젝트 폴더
cd /Users/kwangsunglee/Projects/AEDpics
open docs/QA/

# 또는 직접 파일 열기
code docs/QA/PM2_LOG_SAMPLES.md
```

**GitHub에서**:
```bash
# 저장소 확인
https://github.com/anthropics/aedpics
# docs/QA/ 폴더 탐색
```

---

## 2단계: 워크스루 미팅 (오늘 또는 내일)

### 소규모 그룹 워크숍 개최

**참석자**: QA팀 + 운영팀 (30분)

**안건**:
1. PM2_LOG_SAMPLES.md 실습 (10분)
   - 로그 해석 실전 연습
   - 실제 성공/실패 로그 보기

2. 회귀 감지 시 대응 절차 (10분)
   - Slack 알림 수신 시 어떻게 할지
   - 로그 확인 → 원인 파악 → 보고

3. 질의응답 (10분)

**준비물**:
- 프로젝트션
- PM2 로그 샘플 화면 스크린샷
- 실제 PM2 로그 (pm2 logs 출력)

---

### 전사 공지 (선택사항)

**타이밍**: 워크숍 후

**내용**:
```
안녕하세요,

2025-11-07 프로덕션 배포로 2가지 중요한 버그가 수정되었습니다:
1. 점검 완료 버튼 오류 (로깅 추가)
2. 사용자 정보 수정 오류 (DB 반영 안 됨)

🔍 앞으로 매일 아침 8시에 자동으로 이 두 기능이 정상 작동하는지 검증합니다.
문제 발생 시 #aedpics-monitoring 채널에 알립니다.

📚 더 알고 싶으신 분들:
- 로그 해석 방법: docs/QA/PM2_LOG_SAMPLES.md
- 배포 상세: docs/QA/DEPLOYMENT_SUMMARY_2025-11-07.md
- 테스트 절차: docs/QA/POST_DEPLOYMENT_QA_2025-11-07.md
```

---

## 3단계: 자동 모니터링 시작 (내일)

### DevOps 팀이 수행할 작업

#### 오늘:
- [ ] [GITHUB_SECRETS_SETUP.md](GITHUB_SECRETS_SETUP.md) 읽기 (20분)
- [ ] GitHub Secrets 2개 추가 (10분)
  - DATABASE_PASSWORD
  - SLACK_WEBHOOK_REGRESSION_CHECK
- [ ] Slack #aedpics-monitoring 채널 생성

#### 내일:
- [ ] Workflow 수동 실행 (2분)
- [ ] Slack 알림 확인 (1분)
- [ ] 아티팩트 다운로드 및 검증 (5분)
- [ ] 팀에 보고

**예상 시간**: 총 30분

---

### Slack 알림 받기

**매일 08:00 KST**에 #aedpics-monitoring 채널로 메시지 수신:

```
✅ Daily Regression Check Passed
- 5 user updates verified
- 12 inspections completed
- PM2 health: OK
- No errors detected
```

**또는 문제 발생 시**:

```
🚨 CRITICAL: Daily Regression Check Failed
- User update data mismatch (3 detected)
- See: [GitHub Actions URL]
```

---

## 4단계: 정기 모니터링 (지속적)

### 팀별 역할

#### DevOps 팀
- 매일 아침 Slack 알림 확인 (2분)
- 문제 발생 시 GitHub Actions 로그 확인
- 필요시 엔지니어팀에 알림

#### 백엔드 팀
- PM2_LOG_SAMPLES.md 북마크하기
- 사용자 이슈 보고 시 로그 확인
- [MONITORING_SETUP_GUIDE.md](MONITORING_SETUP_GUIDE.md) Part 8 참고하여 대응

#### QA 팀
- 월간 모니터링 리포트 검토 (GitHub Artifacts)
- 추세 분석 (false positive 감소 여부 등)

---

## FAQ

### Q1: 왜 이 두 기능을 모니터링하나요?

**A**: 최근 프로덕션에서 문제가 있었던 중요한 기능입니다:
- Fix #1: 점검 완료 버튼이 먹통이 되는 오류
- Fix #2: 사용자 정보 변경이 DB에 반영 안 되는 오류

회귀(regression)를 조기에 감지하기 위해 매일 자동으로 검증합니다.

---

### Q2: 매일 Slack 메시지가 오는 건가요?

**A**: 네, 08:00 KST마다 자동으로 옵니다.
- 성공: 요약 메시지만 전송
- 실패: 경고 + GitHub 링크 포함

DevOps 팀이 매일 확인하고, 문제 시 엔지니어팀에 알립니다.

---

### Q3: 로그를 어디서 확인하나요?

**A**: PM2 로그 샘플은 이 문서를 참고하세요:
```
docs/QA/PM2_LOG_SAMPLES.md
```

프로덕션 로그는:
```bash
ssh admin@223.130.150.133
pm2 logs --err
```

---

### Q4: 문제 발생 시 어떻게 대응하나요?

**A**: [MONITORING_SETUP_GUIDE.md](MONITORING_SETUP_GUIDE.md) Part 4를 참고하세요.

빠른 요약:
1. Slack 알림 수신 → GitHub 링크 클릭
2. 실행 로그 확인 → 어떤 체크가 실패했는지 파악
3. PM2_LOG_SAMPLES.md 대조 → 원인 파악
4. 필요시 로그인하여 추가 확인
5. 팀에 보고

---

### Q5: 자동 모니터링을 비활성화하려면?

**A**: GitHub Actions > Daily Regression Check > Disable workflow

하지만 권장하지 않습니다. 문제가 발생하면 즉시 비활성화 후 연락하세요.

---

### Q6: Slack 알림을 개인 DM으로 받을 수 있나요?

**A**: 네, DevOps 팀이 개별 설정 가능합니다.

[MONITORING_SETUP_GUIDE.md](MONITORING_SETUP_GUIDE.md) Part 7 참고.

---

## 다음 약속 사항

| 항목 | 담당 | 기한 | 상태 |
|------|------|------|------|
| 팀 교육 자료 배포 | DevOps | 오늘 | ⏳ |
| GitHub Secrets 설정 | DevOps | 오늘 | ⏳ |
| 워크플로우 테스트 | DevOps | 내일 | ⏳ |
| Slack 알림 확인 | DevOps | 내일 | ⏳ |
| QA 테스트 시작 | QA팀 | 내일 | ⏳ |
| 팀 워크숍 | 전체 | 이번주 | ⏳ |

---

## 문서 링크 정리

### 빠른 참고용
- [PM2_LOG_SAMPLES.md](PM2_LOG_SAMPLES.md) ⭐ **북마크 추천**
- [DEPLOYMENT_SUMMARY_2025-11-07.md](DEPLOYMENT_SUMMARY_2025-11-07.md)

### 설정 및 운영
- [GITHUB_SECRETS_SETUP.md](GITHUB_SECRETS_SETUP.md) - DevOps용
- [MONITORING_SETUP_GUIDE.md](MONITORING_SETUP_GUIDE.md) - 완전 가이드

### QA 검증
- [POST_DEPLOYMENT_QA_2025-11-07.md](POST_DEPLOYMENT_QA_2025-11-07.md) - 7가지 테스트

### 개요
- [README.md](README.md) - 전체 네비게이션
- [MONITORING_IMPLEMENTATION_SUMMARY.md](MONITORING_IMPLEMENTATION_SUMMARY.md)

---

## 긴급 연락처

**문제 발생 시**:
- Slack: @devops-oncall
- 또는: #aedpics-monitoring 채널에 @channel

**설정 문제**:
- Slack: @devops

---

## 마지막 체크리스트

```
팀 리드 체크리스트:
- [ ] 전체 팀에게 이 메시지 공유
- [ ] 각 팀의 담당자 지정
- [ ] 워크숍 일정 예약
- [ ] Slack 채널 #aedpics-monitoring 생성

DevOps 체크리스트:
- [ ] GITHUB_SECRETS_SETUP.md 읽기
- [ ] GitHub Secrets 설정
- [ ] Workflow 수동 실행 및 검증
- [ ] Slack 알림 테스트
- [ ] 팀에 결과 보고

백엔드 체크리스트:
- [ ] PM2_LOG_SAMPLES.md 읽기 및 북마크
- [ ] DEPLOYMENT_SUMMARY 숙지
- [ ] 재해 대응 절차 이해

QA 체크리스트:
- [ ] POST_DEPLOYMENT_QA 문서 검토
- [ ] 테스트 일정 계획
- [ ] 필요한 계정/권한 확인
```

---

**배포 날짜**: 2025-11-07
**커뮤니케이션 날짜**: 2025-11-07
**다음 리뷰**: 2025-11-08 (첫 자동 실행 후)

모두 화이팅! 🚀
