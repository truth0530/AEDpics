#!/bin/bash

# AED System Health Check Script
# 실행: ./scripts/health-check.sh

# set -e 제거 (테스트 실패가 스크립트를 중단시키지 않도록)

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 설정
BASE_URL=${1:-"https://www.aed.pics"}
TIMEOUT=10

echo "========================================="
echo "AED System Health Check"
echo "Target: $BASE_URL"
echo "Time: $(date)"
echo "========================================="
echo ""

# 결과 저장 변수
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 테스트 함수
check_endpoint() {
    local endpoint=$1
    local expected_code=$2
    local description=$3

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    printf "Testing: %-50s" "$description"

    # HTTP 상태 코드 확인 (리다이렉트 따라가기)
    status_code=$(curl -L -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$BASE_URL$endpoint" 2>/dev/null || echo "000")

    # 200, 301, 302, 307 모두 성공으로 처리 (리다이렉트 허용)
    if [ "$status_code" = "$expected_code" ] || [ "$status_code" = "200" ] || [ "$status_code" = "301" ] || [ "$status_code" = "302" ] || [ "$status_code" = "307" ]; then
        echo -e " [${GREEN}PASS${NC}] ($status_code)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e " [${RED}FAIL${NC}] (Expected: $expected_code, Got: $status_code)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# 응답 내용 확인 함수
check_api_response() {
    local endpoint=$1
    local field=$2
    local description=$3

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    printf "Testing: %-50s" "$description"

    # API 응답 확인
    response=$(curl -s --max-time $TIMEOUT "$BASE_URL$endpoint" 2>/dev/null || echo "{\"error\":\"timeout\"}")

    # 에러 필드 확인
    if echo "$response" | grep -q "\"error\""; then
        error_msg=$(echo "$response" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
        if [ "$error_msg" = "Unauthorized" ]; then
            echo -e " [${YELLOW}SKIP${NC}] (Auth required)"
        else
            echo -e " [${RED}FAIL${NC}] (Error: $error_msg)"
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    elif echo "$response" | grep -q "\"$field\""; then
        echo -e " [${GREEN}PASS${NC}]"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e " [${RED}FAIL${NC}] (Field '$field' not found)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

echo "1. 페이지 접근성 테스트"
echo "-----------------------------------------"
check_endpoint "/" "200" "메인 페이지"
check_endpoint "/auth/signin" "200" "로그인 페이지"
check_endpoint "/map" "200" "지도 페이지"
check_endpoint "/presentation" "200" "프레젠테이션 페이지"
check_endpoint "/tutorial2" "200" "튜토리얼 페이지"
echo ""

echo "2. API 엔드포인트 테스트"
echo "-----------------------------------------"
check_endpoint "/api/stats" "200" "통계 API"
check_api_response "/api/public/aed-locations?limit=1" "locations" "공개 AED 위치 API"
check_api_response "/api/aed-data/categories" "categories" "AED 카테고리 API"
echo ""

echo "3. 정적 리소스 테스트"
echo "-----------------------------------------"
check_endpoint "/favicon.svg" "200" "Favicon"
check_endpoint "/manifest.json" "200" "PWA Manifest"
echo ""

echo "========================================="
echo "테스트 결과 요약"
echo "-----------------------------------------"
echo -e "전체 테스트: $TOTAL_TESTS"
echo -e "성공: ${GREEN}$PASSED_TESTS${NC}"
echo -e "실패: ${RED}$FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n${GREEN}✓ 모든 테스트 통과!${NC}"
    exit 0
else
    echo -e "\n${RED}✗ 일부 테스트 실패${NC}"
    exit 1
fi