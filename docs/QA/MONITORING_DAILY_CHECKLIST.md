# Daily Regression Monitoring Checklist

## DevOps 팀용 일일 체크리스트

**주기**: 매일 08:00 KST (자동 실행 후)

**담당**: DevOps 온콜 엔지니어

**소요 시간**: 5-10분

---

## 📋 일일 모니터링 (08:00 KST)

### Step 1: Slack 알림 확인 (1분)

**채널**: #aedpics-monitoring

**확인 사항**:
- [ ] 메시지 수신 확인
- [ ] 타임스탐프: 08:00:00 - 08:01:00 KST

**메시지 타입**:

#### 성공 메시지 (정상)
```
✅ Daily Regression Check Passed

✅ User updates: 5 verified
✅ Inspection completions: 12 completed
✅ PM2 health: OK
✅ No errors detected

Report: [GitHub Actions URL]
```

**조치**: 특별 조치 불필요, 업무 계속 진행

---

#### 경고 메시지 (주의)
```
⚠️ Daily Regression Check - Low Activity

⚠️ User updates: 0 (may be normal)
⚠️ Inspection completions: 0 (may be normal)
✅ No errors detected

Report: [GitHub Actions URL]
```

**조치**:
1. 타입 확인: 데이터가 없는 것이 정상인지 확인
2. 필요시 관찰 계속 (false positive일 가능성 높음)
3. 다음날도 비슷한 패턴이면 팀에 알림

---

#### 실패 메시지 (긴급)
```
🚨 CRITICAL: Daily Regression Check Failed

User update data mismatch (3 detected)

See: [GitHub Actions URL]
Report: [Artifact URL]
```

**조치**:
1. [ ] GitHub Actions URL 클릭
2. [ ] 실행 로그 확인
3. [ ] 어떤 체크가 실패했는지 파악:
   - User update mismatch → Fix #2 회귀 가능성
   - Inspection completion error → Fix #1 회귀 가능성
   - Database connection error → 인프라 문제
4. [ ] 백엔드 팀 @mention으로 알림
5. [ ] Slack #aedpics 채널에 상황 보고

---

### Step 2: GitHub Actions 확인 (2분)

**URL**: https://github.com/anthropics/aedpics/actions

**확인 사항**:

#### 정상 완료
```
Daily Regression Check
Status: ✅ Success (green)
Jobs: All passed
Run time: 2-3 min
Conclusion: success
```

**조치**: 특별 조치 없음

#### 실패
```
Daily Regression Check
Status: ❌ Failed (red)
Jobs: 1 failed
Run time: 1-2 min
Conclusion: failure
```

**조치**:
1. [ ] 실패한 단계 클릭
2. [ ] 로그 확인:
   - "Database connection refused" → DB 문제
   - "Cannot find module" → 코드 문제
   - "Slack webhook failed" → Slack 설정 문제
3. [ ] 팀에 보고

---

### Step 3: 아티팩트 확인 (1-2분, 선택사항)

**타이밍**: 실패 발생 시에만

**URL**: GitHub Actions > Daily Regression Check > [Latest Run] > Artifacts

**파일**: regression-check-report-XXX

**확인 사항**:
```
Check 1: User Update Operations
┌─ Total updates: 5
├─ Role changes: 3
├─ Organization changes: 2
└─ Status: ✅ verified

Check 2: Inspection Completions
┌─ Total completions: 12
├─ Status: "completed"
└─ Stuck inspections: ❌ none detected

Check 3: PM2 Health
└─ Status: ✅ running

Check 4: Error Log Analysis
└─ Errors found: ❌ none
```

**이상 징후**:
- "MISMATCH" 단어 발견 → Fix #2 회귀 확인 필요
- "stuck inspections" 발견 → Fix #1 회귀 확인 필요
- "ERROR" 로그 발견 → 코드/인프라 문제

---

## 📊 주간 모니터링 (금요일 17:00)

### Weekly Summary Report

**담당**: DevOps 팀 리드

**체크**:
- [ ] 7일간 성공 횟수
- [ ] 경고 발생 횟수
- [ ] 실패 발생 횟수
- [ ] 평균 실행 시간

**리포트 포맷**:
```
Weekly Regression Check Summary (Week of 2025-11-07)

✅ Success: 7/7 (100%)
⚠️  Warnings: 0
❌ Failures: 0

Average run time: 2.5 min

Status: ✅ All systems normal
```

**결과**:
- [ ] Slack #aedpics에 보고
- [ ] 팀에 공유

---

## 🚨 이상 징후별 대응

### 시나리오 1: User Update Mismatch 감지

**증상**: "Found X audit log/database mismatches!"

**원인**: Fix #2 회귀 가능성 (snake_case → camelCase)

**대응 절차**:
```
1. GitHub Actions 로그 확인
   ↓
2. "organizationId", "regionCode" 등 camelCase 필드 보이는지 확인
   ↓
3. 백엔드 팀에 즉시 알림
   ➜ Slack: "@backend Fix #2 회귀 감지됨. app/api/admin/users/update 확인"
   ↓
4. 팀이 로그인하여 실제 DB 상태 확인
   ➜ SQL: SELECT * FROM audit_logs WHERE action='user_updated' ORDER BY created_at DESC LIMIT 5;
   ↓
5. 필요시 롤백 고려
   ➜ git revert 9097472
```

**에스컬레이션**: 3회 연속 실패 시 팀 리드에 보고

---

### 시나리오 2: Inspection Completion 오류

**증상**: "Stuck inspections detected" 또는 inspection completions 0

**원인**: Fix #1 회귀 가능성 (logging 제거 또는 에러 발생)

**대응 절차**:
```
1. PM2 로그 확인
   ➜ ssh admin@223.130.150.133
   ➜ pm2 logs --err | grep "InspectionSession"
   ↓
2. [PM2_LOG_SAMPLES.md](PM2_LOG_SAMPLES.md) 참고하여 로그 해석
   ↓
3. 백엔드 팀에 상황 보고
   ➜ Slack: "@backend Inspection complete 로그에 오류 발견"
   ↓
4. 필요시 롤백
   ➜ git revert c6da14c
```

**에스컬레이션**: 즉시 (사용자 영향도 높음)

---

### 시나리오 3: Database Connection 오류

**증상**: "Cannot connect to database" 또는 "connection refused"

**원인**: 인프라 문제 (네트워크, DB 다운 등)

**대응 절차**:
```
1. NCP 콘솔 확인
   ➜ Database > PostgreSQL 상태 확인
   ↓
2. 직접 연결 테스트
   ➜ psql -h pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com \
        -U aedpics_admin \
        -d aedpics_production \
        -c "SELECT NOW();"
   ↓
3. 보안 그룹 확인
   ➜ NCP Console > Server > Security Groups
   ↓
4. DevOps 팀 리드에 보고
```

**에스컬레이션**: 즉시 (인프라 팀)

---

### 시나리오 4: Slack Webhook 오류

**증상**: Workflow는 완료했지만 Slack 메시지 없음

**원인**: Slack webhook 만료 또는 권한 문제

**대응 절차**:
```
1. GitHub Secrets 확인
   ➜ Settings > Secrets > SLACK_WEBHOOK_REGRESSION_CHECK
   ↓
2. Slack API 콘솔 확인
   ➜ https://api.slack.com/apps
   ↓
3. Webhook 재생성 필요시
   ➜ Slack > API > Incoming Webhooks > Add New Webhook
   ➜ 새 URL로 GitHub Secrets 업데이트
   ↓
4. 다음날 확인
```

**에스컬레이션**: 백업으로 이메일 알림 활성화

---

## 📈 Metrics 추적

### 월간 메트릭 (매월 말)

**파일**: Google Sheets 또는 GitHub Issues

**추적 항목**:
| 항목 | 목표 | 현황 |
|------|------|------|
| 성공률 | 95% | ___ |
| 평균 실행 시간 | <3분 | ___ |
| False positive 율 | <10% | ___ |
| 버그 감지 시간 | 24시간 | ___ |

**분석**:
- 성공률 저하 → 임계값 조정 필요
- False positive 증가 → 스크립트 개선 필요
- 실행 시간 증가 → DB 쿼리 최적화 필요

---

## 💬 팀 소통

### Slack 채널별 역할

| 채널 | 용도 | 수신자 |
|------|------|--------|
| #aedpics-monitoring | 자동 알림 | DevOps, Backend |
| #aedpics | 주간 요약 | 전체 팀 |
| #devops | 인프라 이슈 | DevOps |
| #backend | 코드 이슈 | Backend |

### 보고서 템플릿

**주간 (금요일 17:00)**:
```
📊 Week of 2025-11-07 Monitoring Summary

Overall: ✅ All checks passed 7/7

Highlights:
- User updates: 35 total (avg 5/day)
- Inspections: 84 total (avg 12/day)
- Errors: 0 critical

Action items: None

Next week: Continue monitoring
```

**월간 (월 1회)**:
```
📈 November Regression Monitoring Report

Performance:
- Success rate: 99.5% (30/30 checks)
- Avg response time: 2.4 min
- Critical issues detected: 0

Recommendations:
1. Continue current monitoring
2. [Optional] Expand to Phase 3 features
3. [Optional] Integrate with Grafana

Status: ✅ System stable
```

---

## 체크리스트 다운로드

```bash
# 매일 아침 8:05분에 실행
cat > /tmp/morning_check.sh << 'EOF'
#!/bin/bash
echo "☀️ Good morning! Running regression check..."
echo ""
echo "[ ] 1. Check Slack #aedpics-monitoring for alerts"
echo "[ ] 2. Visit GitHub Actions for status"
echo "[ ] 3. Download report if failures detected"
echo "[ ] 4. Escalate to team if needed"
echo ""
echo "✅ Morning check complete!"
EOF

chmod +x /tmp/morning_check.sh
```

---

## 자동화 (선택사항)

### Cron 스크립트로 자동 체크

```bash
# /etc/cron.d/regression-check
# 매일 08:05 UTC에 체크 결과를 이메일로 전송
5 8 * * * /path/to/check-regression.sh | mail -s "Daily Regression Check" devops@example.com
```

### 슬랙 봇으로 자동 팔로우업

```
/regression-check follow-up
→ 어제 실패 항목 자동 리마인더
```

---

## 문제 발생 시 연락처

**긴급 (Critical)**:
- Slack: @devops-oncall
- 또는: #aedpics-monitoring @channel

**일반 (Normal)**:
- Slack: #aedpics-monitoring
- 또는: DevOps 팀 리드

---

## 참고 문서

- [PM2_LOG_SAMPLES.md](PM2_LOG_SAMPLES.md) - 로그 해석
- [MONITORING_SETUP_GUIDE.md](MONITORING_SETUP_GUIDE.md) Part 4 - 상세 대응 절차
- [DEPLOYMENT_SUMMARY_2025-11-07.md](DEPLOYMENT_SUMMARY_2025-11-07.md) - 배포 내용

---

**최종 수정**: 2025-11-07
**버전**: 1.0
**담당**: DevOps Team
