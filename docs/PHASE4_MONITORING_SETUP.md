# Phase 4 Export 엔드포인트 모니터링 셋업 가이드

**작성일**: 2025-11-06
**대상**: DevOps Team, 운영 담당자
**목표**: 배포 후 핵심 메트릭 모니터링

---

## 1. 배포 후 즉시 확인 항목 (Smoke Test)

### 1.1 엔드포인트 응답 확인
```bash
# Master 계정으로 기본 요청
curl -X POST "https://aed.pics/api/inspections/export" \
  -H "Authorization: Bearer ${MASTER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}' \
  -w "\n=== RESPONSE HEADERS ===\nContent-Type: %{content_type}\nHTTP Status: %{http_code}\nX-Applied-Limit: %{header_x_applied_limit}\nX-Role-Max-Limit: %{header_x_role_max_limit}\nX-Record-Count: %{header_x_record_count}\n" \
  -o smoke_test.xlsx

# 예상:
# - HTTP Status: 200
# - Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
# - X-Applied-Limit: 10
# - X-Role-Max-Limit: 10000
# - X-Record-Count: 10 (또는 데이터 수에 따라)
```

### 1.2 PM2 프로세스 상태 확인
```bash
# 프로세스 상태 확인
pm2 status

# 예상: status: online, restarts: 0 또는 적은 수

# 최근 에러 로그 확인
pm2 logs --err --lines 20

# 예상: "Export:" 관련 에러 없음
```

### 1.3 응답 시간 확인
```bash
# 평균 응답 시간 측정 (5번 반복)
for i in {1..5}; do
  echo "Request $i:"
  curl -X POST "https://aed.pics/api/inspections/export" \
    -H "Authorization: Bearer ${MASTER_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"limit": 100}' \
    -w "Response time: %{time_total}s\n" \
    -o /dev/null -s
done

# 예상: 1-3초 이내
```

---

## 2. PM2 로그 필터 설정

### 2.1 실시간 모니터링 명령어 (운영자용)

```bash
# 모든 Export 관련 로그 필터링 (실시간)
pm2 logs aedpics | grep "Export:"

# 구간별 검색
# 지난 1시간 logs (날짜 기준)
pm2 logs aedpics | grep "2025-11-06" | grep "Export:"

# 특정 로그 타입만
pm2 logs aedpics | grep "Export:Success"     # 성공
pm2 logs aedpics | grep "Export:Permission"  # 권한 거부
pm2 logs aedpics | grep "Export:FilterPolicy" # 필터 검증 실패
pm2 logs aedpics | grep "Export:CityCodeMapping" # City code 매핑 실패
```

### 2.2 로그 파이프 설정 (자동화)

**실시간 모니터링 스크립트** (scripts/monitor-export.sh):

```bash
#!/bin/bash
# Phase 4 Export 엔드포인트 모니터링

echo "🔍 Export 엔드포인트 모니터링 시작..."
echo "=========================================="

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 로그 타입별 카운터
declare -A log_counts

while true; do
  # 최근 로그 확인
  logs=$(pm2 logs aedpics --lines 100 2>/dev/null | tail -20)

  # Export 로그 필터링
  export_logs=$(echo "$logs" | grep "Export:")

  if [ -n "$export_logs" ]; then
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} Export 로그 감지:"

    # 로그 타입별 처리
    if echo "$export_logs" | grep -q "Export:Success"; then
      echo -e "${GREEN}✅ Success${NC}"
      ((log_counts["success"]++))
    fi

    if echo "$export_logs" | grep -q "Export:Permission"; then
      echo -e "${YELLOW}⚠️  Permission Denied${NC}"
      ((log_counts["permission"]++))
    fi

    if echo "$export_logs" | grep -q "Export:FilterPolicy"; then
      echo -e "${RED}❌ Filter Policy Failure${NC}"
      ((log_counts["filter"]++))
    fi

    if echo "$export_logs" | grep -q "Export:CityCodeMapping"; then
      echo -e "${YELLOW}⚠️  City Code Mapping Warning${NC}"
      ((log_counts["mapping"]++))
    fi

    echo "$export_logs"
  fi

  # 5초마다 확인
  sleep 5
done
```

**실행 방법**:
```bash
chmod +x scripts/monitor-export.sh
./scripts/monitor-export.sh
```

### 2.3 로그 집계 (매일 아침)

```bash
#!/bin/bash
# 어제 Export 로그 요약

YESTERDAY=$(date -d "yesterday" '+%Y-%m-%d')

echo "=== Export Logs for $YESTERDAY ==="

pm2 logs aedpics | grep "$YESTERDAY" | grep "Export:" > /tmp/export_logs_${YESTERDAY}.txt

echo "📊 Statistics:"
echo "Success: $(grep "Export:Success" /tmp/export_logs_${YESTERDAY}.txt | wc -l)"
echo "Permission Denied: $(grep "Export:Permission" /tmp/export_logs_${YESTERDAY}.txt | wc -l)"
echo "Filter Failures: $(grep "Export:FilterPolicy" /tmp/export_logs_${YESTERDAY}.txt | wc -l)"
echo "Mapping Warnings: $(grep "Export:CityCodeMapping" /tmp/export_logs_${YESTERDAY}.txt | wc -l)"

# 에러 상세 보기
echo ""
echo "📋 Permission Errors:"
grep "Export:Permission" /tmp/export_logs_${YESTERDAY}.txt | tail -5

echo ""
echo "📋 Mapping Failures:"
grep "Export:CityCodeMapping" /tmp/export_logs_${YESTERDAY}.txt | tail -5
```

---

## 3. 핵심 메트릭 모니터링

### 3.1 성공률 모니터링
```bash
# 시간대별 성공/실패 통계
pm2 logs aedpics | grep "Export:Success\|Export:Permission\|Export:FilterPolicy" | \
  awk '{print $1}' | sort | uniq -c
```

**예상 정상 상황**:
- Export:Success가 대부분
- Export:Permission은 소수 (권한 없는 사용자)
- Export:FilterPolicy는 매우 적음 (필터 검증 실패)

### 3.2 응답 시간 모니터링

**PM2 타임스탬프 기반 분석**:
```bash
# 요청-응답 짝 찾기 (Export:Request → Export:Success)
pm2 logs aedpics | grep "Export:Request\|Export:Success" | \
  awk '{
    if ($0 ~ /Export:Request/) {
      req_time = $2; req_user = $(NF-1);
      print "User: " req_user " - Request at " req_time
    }
    if ($0 ~ /Export:Success/) {
      resp_time = $2;
      print "Success at " resp_time
    }
  }'
```

### 3.3 역할별 사용 현황

```bash
# 역할별 export 요청 현황
pm2 logs aedpics | grep "Export:Success" | \
  awk -F'"role":"' '{print $2}' | awk -F'"' '{print $1}' | sort | uniq -c
```

**예상**:
- master: 소수 (관리자만)
- local_admin: 중간~높음 (지역별 담당자)
- regional_admin: 소수 (광역 담당자)

---

## 4. 알림 규칙 설정

### 4.1 위험 신호 감지

| 신호 | 원인 | 대응 |
|------|------|------|
| Export:Permission 증가 | 권한 정책 변경 또는 탈취 | 권한 검토 필요 |
| Export:CityCodeMapping 증가 | City code 매핑 실패 증가 | 매핑 테이블 검토 필요 |
| Export:FilterPolicy 증가 | 필터 정책 위반 | enforceFilterPolicy 동작 확인 |
| HTTP 502/503 | 서버 장애 | PM2 프로세스 상태 확인 |
| 응답 시간 > 5초 | 성능 저하 | 쿼리 최적화, 데이터 제한 검토 |

### 4.2 알림 설정 예시

**Slack 연동** (향후):
```bash
# PM2+ 서비스 설정
pm2 plus  # 웹 대시보드 + Slack 연동

# 또는 수동 스크립트
if pm2 logs | grep -q "Export:Permission\|Export:FilterPolicy"; then
  curl -X POST $SLACK_WEBHOOK \
    -H 'Content-Type: application/json' \
    -d '{"text":"⚠️ Export API Error Detected"}'
fi
```

---

## 5. 일일 점검 체크리스트

### 5.1 아침 점검 (오픈 전)
```bash
# 1. PM2 프로세스 상태 확인
pm2 status
# 예상: aedpics status: online, restarts: <5

# 2. 디스크 공간 확인
df -h | grep /var/www
# 예상: 사용률 < 80%

# 3. 최근 에러 로그 확인
pm2 logs --err --lines 20
# 예상: Export 관련 에러 없음

# 4. Smoke test 실행
curl -X POST "https://aed.pics/api/inspections/export" \
  -H "Authorization: Bearer ${MASTER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}' \
  -w "HTTP %{http_code}\n" \
  -o /dev/null -s
# 예상: HTTP 200
```

### 5.2 사용 시간 중 모니터링 (30분마다)
```bash
# Export 요청 트래픽 확인
pm2 logs aedpics | grep "Export:Request" | tail -10

# 성공률 확인
pm2 logs aedpics | grep "Export:Success" | wc -l
pm2 logs aedpics | grep "Export:Permission\|Export:FilterPolicy" | wc -l
```

### 5.3 일일 마감 (퇴근 전)
```bash
# 일일 통계 저장
date > /var/log/export_stats_$(date +%Y%m%d).txt
echo "=== Export Logs ===" >> /var/log/export_stats_$(date +%Y%m%d).txt
pm2 logs aedpics | grep "Export:" >> /var/log/export_stats_$(date +%Y%m%d).txt

# 에러 확인
if pm2 logs | grep -q "Export:Permission\|Export:FilterPolicy"; then
  echo "⚠️ Export errors detected. Check logs." | mail -s "Export API Alert" admin@nmc.or.kr
fi
```

---

## 6. 장애 대응 프로세스

### 6.1 "502 Bad Gateway" 발생 시
```bash
# 1. PM2 프로세스 상태 확인
pm2 status
# → status: errored 면 재시작

# 2. 최근 에러 로그 확인
pm2 logs --err --lines 50

# 3. Full rebuild 필요 여부 판단
if pm2 logs | grep -q "Cannot find module\|ENOSPC"; then
  gh workflow run full-rebuild.yml
else
  pm2 reload ecosystem.config.js
fi
```

### 6.2 "400 Bad Request" 증가 시
```bash
# 요청 내용 확인
pm2 logs aedpics | grep "Invalid" | tail -10

# 예상 원인:
# - "Invalid limit: must be an integer" → limit 타입 검증
# - "Invalid cityCodes: all elements must be strings" → 배열 요소 타입
# → QA Team 피드백 필요
```

### 6.3 "403 Forbidden" 증가 시
```bash
# 거부된 역할 확인
pm2 logs aedpics | grep "Export:Permission" | \
  grep -o '"role":"[^"]*"' | sort | uniq -c

# 예상:
# - 정상: temporary_inspector 또는 unknown role
# - 이상: local_admin이 403 → 권한 설정 확인
```

---

## 7. 성능 튜닝 포인트

### 7.1 응답 시간 개선
```bash
# maxResultLimit 조정 (lib/auth/access-control.ts)
# 현재: master=10k, local_admin=1k
# → 필요시 감소 (예: 5k, 500)

# Query 최적화 포인트
# - city_code 인덱스 확인 (DB)
# - inspection 조인 최적화
# - masking 함수 성능 검토
```

### 7.2 병렬 요청 처리
```bash
# 동시 요청 부하 테스트
ab -n 100 -c 10 \
  -H "Authorization: Bearer ${MASTER_TOKEN}" \
  -H "Content-Type: application/json" \
  -p export_request.json \
  https://aed.pics/api/inspections/export

# 예상: 99%ile 응답 시간 < 5초
```

---

## 8. 운영 체크리스트

배포 후 지속적으로 확인:

- [ ] 일일 아침 점검: PM2 상태, 디스크, Smoke test
- [ ] 시간마다 모니터링: Export 요청 로그
- [ ] 일일 마감: 통계 저장, 에러 알림
- [ ] 주간 분석: 사용 패턴, 성능 트렌드
- [ ] 월간 검토: 정책 조정, 성능 튜닝

---

## 9. 연락 정보

| 역할 | 담당자 | 연락처 |
|------|--------|--------|
| 기술 담당 | 김인학 | inhak@nmc.or.kr |
| 운영 담당 | 운영팀 | ops@nmc.or.kr |
| PM | 정운우 | woo@nmc.or.kr |
| 긴급 연락 | 대표 | 02-XXXX-XXXX |

**긴급 상황**:
- 502 에러 지속 > 15분: 기술 담당자 연락
- Permission 거부 이상 증가: 권한 관리자 연락
- 데이터 누락 의심: PM에 보고

---

**상태**: 🟢 배포 준비 완료
**다음**: 배포 후 이 문서의 체크리스트 실행
