# Phase 3 Monitoring Strategy Planning

## Overview

Phase 3 (Storage/NCP/Dashboard 개발)에서 2025-11-07 배포된 모니터링 시스템의 패턴을 확장하여 구축할 계획입니다.

---

## 학습 활용: "샘플 로그 + 자동 체크" 패턴

### 2025-11-07 배포 모니터링 시스템

```
성공 사례:
├─ PM2 로그 샘플 문서 (PM2_LOG_SAMPLES.md)
│  └─ 예상되는 로그 시퀀스 명시
│     → 문제 발생 시 빠른 진단
│
├─ 자동 회귀 체크 스크립트
│  └─ 매일 Fix #1, #2 검증
│     → 조용한 실패 방지
│
└─ GitHub Actions 자동화
   └─ 일일 스케줄 + Slack 알림
      → 팀 동일화
```

**핵심 가치**:
- ✅ 예상되는 상태 문서화
- ✅ 자동화된 검증
- ✅ 실시간 알림 및 추적

---

## Phase 3 적용 계획

### Phase 3a: Storage/NCP 마이그레이션 (Week 1-2)

#### 기능 개요
- Supabase Storage → NCP Object Storage 마이그레이션
- 사진 업로드/다운로드 엔드포인트 변경
- CDN 캐싱 전략 (이미지 최적화)

#### 모니터링 계획

**1️⃣ 로그 샘플 문서화** (개발 중)

**파일**: `docs/QA/STORAGE_LOG_SAMPLES.md`

```markdown
# NCP Storage Migration Log Samples

## Expected Success Sequence

### Photo Upload
[11-15 14:30:15] [APP] [INFO] PhotoUpload:uploadToNCP - Starting upload
  fileName: "inspection-123-photo-1.webp"
  size: "245KB"
  bucket: "aedpics-inspections"

[11-15 14:30:16] [APP] [INFO] PhotoUpload:uploadToNCP - Upload completed
  fileName: "inspection-123-photo-1.webp"
  publicUrl: "https://cdn.aedpics.ncp/inspection-123-photo-1.webp"
  uploadTime: "1.2s"

## Expected Error Scenarios

### Insufficient Bucket Quota
[ERROR] PhotoUpload:uploadToNCP - Bucket quota exceeded
  available: "50GB"
  required: "100MB"
  -> Fallback to temporary storage

### Network Timeout
[ERROR] PhotoUpload:uploadToNCP - Connection timeout after 30s
  retry: 1/3
  -> Automatic retry scheduled
```

**담당**: Backend 팀 (개발 중 작성)

---

**2️⃣ 자동 회귀 체크 스크립트** (배포 후)

**파일**: `scripts/monitoring/storage-regression-check.sh`

```bash
#!/bin/bash

# Check 1: Photo Upload Success
echo "Verifying photo uploads..."
psql -c "SELECT COUNT(*) FROM inspections
         WHERE photos IS NOT NULL
         AND updated_at >= NOW() - INTERVAL '24 hours';"

# Check 2: CDN Cache Hit Rate
echo "Checking CDN performance..."
# CloudFront/NCP CDN 메트릭 확인

# Check 3: Storage Quota Usage
echo "Monitoring storage quota..."
# NCP API로 현재 사용량 확인

# Check 4: Error Pattern Analysis
echo "Analyzing storage errors..."
grep -i "storage\|quota\|timeout" /var/log/pm2/aedpics-error.log | tail -10
```

**실행**: 주 1회 (금요일 15:00)

---

**3️⃣ GitHub Actions 자동화**

**파일**: `.github/workflows/weekly-storage-check.yml`

```yaml
name: Weekly Storage Regression Check

on:
  schedule:
    - cron: '0 6 * * FRI'  # Friday 06:00 UTC (15:00 KST)

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - run: bash scripts/monitoring/storage-regression-check.sh
      - name: Post to Slack
        if: failure()
        run: |
          curl -X POST ${{ secrets.SLACK_WEBHOOK }}
          -d "Storage regression detected"
```

**알림**: #aedpics-storage 채널

---

### Phase 3b: Dashboard 개발 (Week 2-3)

#### 기능 개요
- 점검 통계 대시보드
- 실시간 모니터링
- 지역별/기관별 분석

#### 모니터링 계획

**1️⃣ 대시보드 로그 샘플**

**파일**: `docs/QA/DASHBOARD_LOG_SAMPLES.md`

```markdown
# Dashboard Statistics Log Samples

## Expected Query Performance

### Inspection Statistics Query
[11-16 10:05:23] [APP] [INFO] DashboardAPI:getStatistics - Query started
  region: "ALL"
  dateRange: "30days"

[11-16 10:05:24] [APP] [INFO] DashboardAPI:getStatistics - Query completed
  totalInspections: 1245
  completionRate: "87.3%"
  queryTime: "1.2s"

## Expected Error Handling

### Slow Query
[WARN] DashboardAPI:getStatistics - Query took 5s (threshold: 3s)
  -> Consider caching or indexing
```

**담당**: Backend 팀

---

**2️⃣ 성능 모니터링 스크립트**

```bash
# scripts/monitoring/dashboard-performance-check.sh

# 대시보드 쿼리 응답 시간 추적
# - 통계 계산: < 3초
# - 맵 렌더링: < 2초
# - 페이지 로드: < 5초

# 주요 메트릭:
# - 대시보드 방문자 수
# - 평균 응답 시간
# - DB 쿼리 시간
# - 캐시 히트율
```

---

### Phase 3c: e-gen 협의 및 감지 (Week 1-2)

#### 기능 개요
- e-gen CSV 자동 감지
- 증분 동기화 (daily batch)
- 변경 사항 자동 적용

#### 모니터링 계획

**1️⃣ e-gen 로그 샘플**

**파일**: `docs/QA/EGEN_LOG_SAMPLES.md`

```markdown
# e-gen Data Sync Log Samples

## Expected Success Sequence

### Daily Sync Started
[2025-11-16 01:00:00] [SYNC] Starting e-gen CSV sync
  remoteFile: "s3://egen/aed-data-20251116.csv"
  expectedRecords: 81500

### Processing
[2025-11-16 01:05:23] [SYNC] Processing batch 1/10
  records: 8150
  insertions: 1200
  updates: 450
  progress: 10%

### Completion
[2025-11-16 01:45:10] [SYNC] Sync completed
  totalInserted: 12000
  totalUpdated: 4500
  failures: 5
  duration: "45min"

## Expected Error Handling

### Corrupted Record
[WARN] SYNC:processRecord - Invalid GPS coordinates (record #4521)
  -> Logged for manual review, sync continues
```

**담당**: Backend + e-gen 협의팀

---

**2️⃣ 자동 동기화 검증 스크립트**

```bash
# scripts/monitoring/egen-sync-check.sh

# Check 1: Last sync timestamp
SELECT MAX(updated_at) FROM aed_data;

# Check 2: Unprocessed records
SELECT COUNT(*) FROM aed_data
WHERE import_status = 'pending';

# Check 3: Sync latency
SELECT
  MAX(updated_at) - MAX(external_updated_at) AS latency
FROM aed_data;

# Check 4: Error logs
grep "SYNC\|EGEN" /var/log/pm2/*.log | tail -20
```

**실행**: 매일 02:00 UTC (11:00 KST, 동기화 1시간 후)

---

## 일관된 모니터링 프레임워크

### 각 기능별 3단계 구조

```
모든 Phase 3 기능:

1️⃣ 로그 샘플 문서
   ├─ 예상되는 성공 로그
   ├─ 일반적인 에러 시나리오
   └─ 대응 절차

2️⃣ 자동화 스크립트
   ├─ 핵심 메트릭 추적
   ├─ 오류 패턴 분석
   └─ Slack 알림

3️⃣ GitHub Actions
   ├─ 정기 자동 실행
   ├─ 결과 저장 (artifacts)
   └─ 팀 알림
```

---

## Phase 3 모니터링 타임라인

### Week 1 (11-10 ~ 11-16)

**모니터링 준비**:
```
11-10 (Mon): 협의 시작
  └─ Storage, e-gen, Dashboard 로그 샘플 작성 시작

11-13 (Wed): 기술 검토
  └─ 로그 샘플 검증
  └─ 자동화 스크립트 작성

11-15 (Fri): 첫 배포
  └─ Storage 마이그레이션 배포
  └─ 실시간 모니터링 활성화
```

---

### Week 2 (11-17 ~ 11-23)

**모니터링 검증**:
```
11-17 (Mon): Dashboard 배포
  └─ 성능 모니터링 활성화

11-19 (Wed): 통계 리포트
  └─ Storage 안정성: ✅
  └─ Dashboard 성능: ✅

11-20 (Thu): e-gen 협의 최종
  └─ 감지 로직 확정
  └─ 자동 동기화 설계
```

---

### Week 3+ (11-24 onwards)

**지속적 모니터링**:
```
매일 08:00 KST: 일반 회귀 체크
  ├─ Fix #1, #2 검증
  ├─ Storage 상태
  └─ e-gen 동기화

금요일 15:00: Storage 주간 체크
금요일 16:00: Dashboard 성능 분석
매일 02:00 UTC: e-gen 동기화 검증

월간: 통합 모니터링 리포트
  └─ 모든 Phase 3 기능 상태
  └─ 개선 사항 도출
```

---

## 기술 구현 체크리스트

### Week 1 준비

**로그 샘플 문서**:
- [ ] STORAGE_LOG_SAMPLES.md 작성 (Backend 팀)
- [ ] DASHBOARD_LOG_SAMPLES.md 작성 (Backend 팀)
- [ ] EGEN_LOG_SAMPLES.md 작성 (e-gen 협의팀)

**자동화 스크립트**:
- [ ] storage-regression-check.sh 작성
- [ ] dashboard-performance-check.sh 작성
- [ ] egen-sync-check.sh 작성

**GitHub Actions**:
- [ ] weekly-storage-check.yml 추가
- [ ] dashboard-performance-check.yml 추가
- [ ] daily-egen-sync-check.yml 추가

---

### Week 2 배포

**모니터링 활성화**:
- [ ] Storage 모니터링 온/오프 테스트
- [ ] Slack 알림 채널 생성 (#aedpics-storage, #aedpics-dashboard)
- [ ] 팀에 문서 공유

**QA 검증**:
- [ ] Storage 마이그레이션 테스트 (로그 샘플과 비교)
- [ ] Dashboard 성능 테스트
- [ ] e-gen 동기화 로그 검증

---

## 예상 효과

### 개발 팀 관점

```
Before (현재):
- Storage 마이그레이션 배포 후 문제 발생
- 원인 파악에 수 시간 소요
- 과거 로그 찾기 어려움

After (Phase 3):
- 배포 전 예상 로그 문서 준비
- 실시간 Slack 알림으로 즉시 감지
- 로그 샘플 대조하여 5분 내 원인 파악
```

### 운영 팀 관점

```
Before:
- Storage 안정성 확인 방법 불명확
- 정기적 검증 절차 없음

After:
- 주간 자동 회귀 체크
- Dashboard 성능 지표 추적
- e-gen 동기화 상태 모니터링
```

### 비용 절감

```
로그 분석 시간 감소:
- 현재: 장애 1건당 2-4시간
- 목표: 자동 감지 + 5분 진단
- 예상 절감: 월 40-80시간

예방적 모니터링:
- 현재: 사용자 보고 후 대응
- 목표: 자동 감지 후 능동적 대응
- 예상 효과: MTTR 80% 감소
```

---

## 기술 부채 최소화

### 일관성 유지

```
모든 Phase 3 기능이 동일한 패턴 사용:

✅ 로그 샘플 + 자동 체크 + 알림
✅ 역할별 문서 (Backend, DevOps, QA)
✅ Slack 채널별 구분 (storage, dashboard, sync)
✅ 월간 리포트 및 메트릭 추적
```

### 확장성

```
향후 다른 기능 추가 시:
1. FUNCTION_LOG_SAMPLES.md 작성 (1시간)
2. function-regression-check.sh 작성 (2시간)
3. GitHub Actions 워크플로우 추가 (30분)
4. 팀에 공지 (30분)

총 소요: 4시간
```

---

## 위험 요소 및 완화 전략

### 위험 1: 모니터링 복잡도 증가

**증상**: 여러 모니터링 시스템 관리 어려움

**완화 전략**:
- 중앙화된 대시보드 (Grafana)
- 통합된 알림 규칙
- 월간 검토 및 정리

---

### 위험 2: False Positive 증가

**증상**: Slack 알림이 너무 많음 → 무시 시작

**완화 전략**:
- 임계값 신중하게 설정
- 첫 2주는 warning만, 실패는 critical만
- 주간 리뷰에서 임계값 조정

---

### 위험 3: 문서 부실화

**증상**: 로그 샘플이 실제와 달라짐

**완화 전략**:
- 월간 문서 검토
- 코드 변경 시 해당 로그 샘플도 함께 업데이트
- CI/CD에 문서 검증 포함

---

## Success Metrics

### Phase 3 모니터링 성공 기준

| 항목 | 목표 | 측정 방법 |
|------|------|----------|
| 회귀 감지 시간 | < 24h | Slack 알림 타임스탐프 |
| False positive 율 | < 15% | 월간 리포트 분석 |
| 문서 정확도 | 95% | QA 팀 검증 |
| 팀 준수도 | 100% | 월간 체크인 |
| 배포 후 안정성 | 99% uptime | 모니터링 메트릭 |

---

## 다음 액션 아이템

### 이번주 (11-07 ~ 11-13)

- [ ] Phase 3 모니터링 전략 팀 회의 (팀 리드)
- [ ] 로그 샘플 작성 가이드라인 배포 (Backend)
- [ ] 자동화 스크립트 템플릿 작성 (DevOps)

### 협의 기간 (11-10 ~ 11-12)

- [ ] Storage 로그 샘플 최초 초안 (Backend)
- [ ] Dashboard 로그 샘플 최초 초안 (Backend)
- [ ] e-gen 로그 샘플 검토 (e-gen 팀)

### Week 1 후반 (11-14 ~ 11-16)

- [ ] 모든 로그 샘플 최종화
- [ ] 자동화 스크립트 구현 완료
- [ ] GitHub Actions 워크플로우 준비

### 배포 후 (11-17+)

- [ ] 모니터링 활성화 및 검증
- [ ] 팀 교육 및 워크스루
- [ ] 주간 리포트 시작

---

## 참고 자료

### 기존 문서
- [docs/QA/PM2_LOG_SAMPLES.md](../QA/PM2_LOG_SAMPLES.md)
- [docs/QA/MONITORING_SETUP_GUIDE.md](../QA/MONITORING_SETUP_GUIDE.md)
- [docs/QA/MONITORING_DAILY_CHECKLIST.md](../QA/MONITORING_DAILY_CHECKLIST.md)

### Phase 3 협의
- [docs/planning/PHASE3_COORDINATION_RESULTS.md](./PHASE3_COORDINATION_RESULTS.md) (준비 중)
- Storage 마이그레이션 상세: [docs/guides/IMAGE_OPTIMIZATION_STRATEGY.md](../guides/IMAGE_OPTIMIZATION_STRATEGY.md)
- e-gen CSV 구조: [docs/CSV_STRUCTURE_ANALYSIS.md](../CSV_STRUCTURE_ANALYSIS.md)

---

**문서 버전**: 1.0
**작성**: 2025-11-07
**검토 대상**: 팀 리드, Backend 팀, DevOps 팀, e-gen 협의팀
**다음 검토**: 2025-11-10 (협의 후)

---

## 최종 정리

> **핵심 메시지**: 2025-11-07 배포의 "샘플 로그 + 자동 체크 + 팀 알림" 패턴을 Phase 3 전체에 확장하면, Storage/Dashboard/e-gen 기능들도 동일한 안정성 수준으로 운영할 수 있습니다.

이를 통해:
- ✅ 개발팀: 배포 후 장애에 빠르게 대응
- ✅ 운영팀: 능동적 모니터링으로 사전 예방
- ✅ 비즈니스: MTTR 80% 감소, 가용성 향상

**예상 투자**: 초기 4주 (로그 샘플 + 자동화 스크립트 작성)
**예상 효과**: 향후 6개월간 지속적 안정성 향상
