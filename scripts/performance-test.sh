#!/bin/bash

# AED Check System - Performance Testing Script
# Phase 3: 실제 성능 측정

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 설정
BASE_URL="${BASE_URL:-http://localhost:3000}"
ITERATIONS="${ITERATIONS:-10}"
WARMUP_ITERATIONS=3

echo -e "${BLUE}=== AED Check System Performance Test ===${NC}\n"
echo "Base URL: $BASE_URL"
echo "Iterations: $ITERATIONS (+ $WARMUP_ITERATIONS warmup)"
echo ""

# 결과 저장 디렉토리
RESULTS_DIR="./performance-results"
mkdir -p "$RESULTS_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULT_FILE="$RESULTS_DIR/perf_$TIMESTAMP.txt"

echo "Results will be saved to: $RESULT_FILE"
echo ""

# 헬퍼 함수: API 성능 측정
measure_api() {
  local name="$1"
  local url="$2"
  local method="${3:-GET}"
  local data="${4:-}"

  echo -e "${YELLOW}Testing: $name${NC}"

  # Warmup
  for i in $(seq 1 $WARMUP_ITERATIONS); do
    curl -s -o /dev/null "$url" -H "Cookie: $AUTH_COOKIE" >/dev/null 2>&1 || true
  done

  # 실제 측정
  local total_time=0
  local min_time=999999
  local max_time=0
  local success_count=0

  for i in $(seq 1 $ITERATIONS); do
    if [ "$method" = "GET" ]; then
      response=$(curl -s -w "\n%{time_total}" -H "Cookie: $AUTH_COOKIE" "$url")
    else
      response=$(curl -s -w "\n%{time_total}" -X "$method" -H "Content-Type: application/json" -H "Cookie: $AUTH_COOKIE" -d "$data" "$url")
    fi

    time=$(echo "$response" | tail -1)
    time_ms=$(echo "$time * 1000" | bc)

    # 성공 여부 확인
    if [ $? -eq 0 ]; then
      success_count=$((success_count + 1))
      total_time=$(echo "$total_time + $time" | bc)

      # min/max 업데이트
      if (( $(echo "$time < $min_time" | bc -l) )); then
        min_time=$time
      fi
      if (( $(echo "$time > $max_time" | bc -l) )); then
        max_time=$time
      fi
    fi

    # 진행률 표시
    printf "  Progress: %d/%d (%.0f ms)\r" "$i" "$ITERATIONS" "$time_ms"
  done

  echo "" # 새 줄

  # 통계 계산
  if [ $success_count -gt 0 ]; then
    avg_time=$(echo "scale=3; $total_time / $success_count" | bc)
    avg_ms=$(echo "$avg_time * 1000" | bc)
    min_ms=$(echo "$min_time * 1000" | bc)
    max_ms=$(echo "$max_time * 1000" | bc)
    success_rate=$(echo "scale=2; $success_count * 100 / $ITERATIONS" | bc)

    echo -e "  ${GREEN}✓ Average: ${avg_ms} ms${NC}"
    echo -e "  ${GREEN}  Min: ${min_ms} ms | Max: ${max_ms} ms${NC}"
    echo -e "  ${GREEN}  Success: ${success_rate}%${NC}"

    # 결과 파일에 저장
    echo "$name,$avg_ms,$min_ms,$max_ms,$success_rate" >> "$RESULT_FILE"

    # 목표 대비 평가
    local threshold=1000
    if (( $(echo "$avg_ms < $threshold" | bc -l) )); then
      echo -e "  ${GREEN}✓ Performance: GOOD (< ${threshold}ms)${NC}"
    else
      echo -e "  ${RED}✗ Performance: SLOW (> ${threshold}ms)${NC}"
    fi
  else
    echo -e "  ${RED}✗ All requests failed${NC}"
    echo "$name,FAILED,FAILED,FAILED,0" >> "$RESULT_FILE"
  fi

  echo ""
}

# 결과 파일 헤더
echo "Test Name,Avg (ms),Min (ms),Max (ms),Success Rate (%)" > "$RESULT_FILE"

echo -e "${BLUE}=== Phase 1: 인증 없이 가능한 테스트 ===${NC}\n"

# Health check
measure_api "Health Check" "$BASE_URL/api/health"

echo -e "${BLUE}=== Phase 2: 주요 API 성능 테스트 ===${NC}"
echo -e "${YELLOW}Note: 인증이 필요한 API는 실제 쿠키를 설정해야 합니다${NC}"
echo ""

# AED 데이터 조회 (일반 모드)
# measure_api "AED Data - Normal Mode" "$BASE_URL/api/aed-data?limit=50"

# AED 데이터 조회 (Inspection 모드)
# measure_api "AED Data - Inspection Mode" "$BASE_URL/api/aed-data?viewMode=inspection&limit=50"

# Priority API
# measure_api "Priority List" "$BASE_URL/api/aed-data/priority?limit=50"

# 검색 테스트
# measure_api "Search - 서울" "$BASE_URL/api/aed-data?search=서울&limit=50"

echo -e "${BLUE}=== Phase 3: 데이터베이스 직접 쿼리 성능 ===${NC}\n"

# RPC 함수 테스트는 Supabase에서 직접 실행
echo "Database performance tests (requires Supabase credentials):"
echo "1. Check expiry status function performance"
echo "2. Full-text search performance"
echo "3. Bulk insert RPC performance"
echo ""

echo -e "${GREEN}=== Performance Test Complete ===${NC}"
echo ""
echo "Results saved to: $RESULT_FILE"
echo ""
echo "To run with authentication:"
echo "  1. Login to http://localhost:3000"
echo "  2. Get cookie from browser DevTools (Application > Cookies)"
echo "  3. Run: AUTH_COOKIE='your-cookie' ./scripts/performance-test.sh"
echo ""
echo "To run load test:"
echo "  ab -n 100 -c 10 http://localhost:3000/api/health"
echo ""
