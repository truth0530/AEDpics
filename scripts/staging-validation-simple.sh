#!/bin/bash

##################################################################
# 간단한 스테이징 검증 스크립트 (Simple Staging Validation Script)
# 목적: 점검완료 및 일정추가 API 엔드포인트 검증
# 사용: ./scripts/staging-validation-simple.sh https://aed.pics
##################################################################

# 컬러 출력
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 환경 변수
BASE_URL="${1:-https://aed.pictures}"
MASTER_EMAIL="truth0530@nmc.or.kr"
MASTER_PASSWORD="Master2025!"
COOKIES_FILE="/tmp/staging_cookies.txt"

# 결과 카운터
PASS_COUNT=0
FAIL_COUNT=0

print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_pass() {
    echo -e "${GREEN}✅ PASS: $1${NC}"
    ((PASS_COUNT++))
}

print_fail() {
    echo -e "${RED}❌ FAIL: $1${NC}"
    ((FAIL_COUNT++))
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

##################################################################
# 1단계: 환경 준비
##################################################################

print_header "1단계: 환경 준비"

# 쿠키 파일 초기화
rm -f "$COOKIES_FILE"

print_info "기본 URL: $BASE_URL"

# 기본 연결 테스트
print_info "웹 서버 연결 테스트..."
if curl -s -I "$BASE_URL" > /dev/null 2>&1; then
    print_pass "웹 서버 접근 가능"
else
    print_fail "웹 서버에 접근할 수 없음 ($BASE_URL)"
    exit 1
fi

##################################################################
# 2단계: 인증 (Master 계정)
##################################################################

print_header "2단계: Master 계정 인증"

print_info "로그인 시도: $MASTER_EMAIL"

# Follow redirects (-L) to ensure session is properly established
LOGIN_RESPONSE=$(curl -s -L -c "$COOKIES_FILE" \
    -X POST "$BASE_URL/api/auth/signin/credentials" \
    --data-urlencode "email=$MASTER_EMAIL" \
    --data-urlencode "password=$MASTER_PASSWORD" \
    --data-urlencode "callbackUrl=$BASE_URL" \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -1)
BODY=$(echo "$LOGIN_RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ]; then
    print_pass "Master 계정 인증 성공 (HTTP $HTTP_CODE)"

    # 쿠키 확인
    if [ -f "$COOKIES_FILE" ] && [ -s "$COOKIES_FILE" ]; then
        print_info "세션 쿠키 확보 완료"
    else
        print_fail "세션 쿠키를 확보하지 못함"
    fi
else
    print_fail "Master 계정 인증 실패 (HTTP $HTTP_CODE)"
    echo "응답: $BODY"
    exit 1
fi

##################################################################
# 3단계: 일정추가 단일 테스트
##################################################################

print_header "3단계: 일정추가 단일 (Single Assignment)"

print_info "테스트 데이터 준비..."

# 실제 장비 번호 조회 (첫 번째 AED)
EQUIPMENT_RESPONSE=$(curl -s "$BASE_URL/api/aed-data?limit=1" \
    -b "$COOKIES_FILE" \
    -H "Content-Type: application/json" \
    -w "\n%{http_code}")

EQUIPMENT_HTTP=$(echo "$EQUIPMENT_RESPONSE" | tail -1)
EQUIPMENT_BODY=$(echo "$EQUIPMENT_RESPONSE" | head -n -1)

if [ "$EQUIPMENT_HTTP" = "200" ]; then
    SERIAL=$(echo "$EQUIPMENT_BODY" | grep -o '"equipment_serial":"[^"]*' | head -1 | cut -d'"' -f4)

    if [ -z "$SERIAL" ]; then
        print_info "실제 장비 번호를 찾을 수 없음, 테스트 값 사용"
        SERIAL="AED-TEST-001"
    else
        print_info "테스트 장비: $SERIAL"
    fi
else
    print_info "장비 조회 실패, 테스트 값 사용"
    SERIAL="AED-TEST-001"
fi

# 일정추가 요청
print_info "일정추가 요청 전송..."

SINGLE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/inspections/assignments" \
    -H "Content-Type: application/json" \
    -b "$COOKIES_FILE" \
    -d "{
        \"equipmentSerial\": \"$SERIAL\",
        \"assignedTo\": null,
        \"scheduledDate\": \"$(date -u +%Y-%m-%d)\",
        \"scheduledTime\": null,
        \"assignmentType\": \"scheduled\",
        \"priorityLevel\": 0,
        \"notes\": \"스테이징 검증\"
    }" \
    -w "\n%{http_code}")

SINGLE_HTTP=$(echo "$SINGLE_RESPONSE" | tail -1)
SINGLE_BODY=$(echo "$SINGLE_RESPONSE" | head -n -1)

print_info "응답 코드: $SINGLE_HTTP"

if [ "$SINGLE_HTTP" = "201" ]; then
    print_pass "일정추가 단일: 201 Created"

    # 할당 ID 추출
    ASSIGNMENT_ID=$(echo "$SINGLE_BODY" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
    if [ ! -z "$ASSIGNMENT_ID" ]; then
        print_info "할당 ID: $ASSIGNMENT_ID"
    fi
else
    print_fail "일정추가 단일: HTTP $SINGLE_HTTP (예상: 201)"
    echo "응답: $SINGLE_BODY"
fi

##################################################################
# 4단계: 일정추가 대량 테스트
##################################################################

print_header "4단계: 일정추가 대량 (Bulk Assignment)"

# 테스트용 3개 장비 번호 준비
print_info "대량 테스트 데이터 준비..."

EQUIPMENT_LIST=$(curl -s "$BASE_URL/api/aed-data?limit=3" \
    -b "$COOKIES_FILE" \
    -H "Content-Type: application/json" 2>/dev/null | grep -o '"equipment_serial":"[^"]*' | cut -d'"' -f4 | head -3)

SERIALS=()
for serial in $EQUIPMENT_LIST; do
    SERIALS+=("$serial")
done

# 최소 3개가 없으면 테스트용 값 사용
if [ ${#SERIALS[@]} -lt 3 ]; then
    SERIALS=("AED-BULK-001" "AED-BULK-002" "AED-BULK-003")
    print_info "테스트용 장비 번호 사용"
fi

print_info "대량 할당 장비: ${SERIALS[@]}"

# JSON 배열 구성
SERIAL_JSON="["
for i in "${!SERIALS[@]}"; do
    SERIAL_JSON="$SERIAL_JSON\"${SERIALS[$i]}\""
    if [ $i -lt $((${#SERIALS[@]} - 1)) ]; then
        SERIAL_JSON="$SERIAL_JSON,"
    fi
done
SERIAL_JSON="$SERIAL_JSON]"

print_info "대량 일정추가 요청 전송..."

BULK_RESPONSE=$(curl -s -X POST "$BASE_URL/api/inspections/assignments" \
    -H "Content-Type: application/json" \
    -b "$COOKIES_FILE" \
    -d "{
        \"equipmentSerials\": $SERIAL_JSON,
        \"assignedTo\": null,
        \"scheduledDate\": \"$(date -u +%Y-%m-%d)\",
        \"scheduledTime\": null,
        \"assignmentType\": \"scheduled\",
        \"priorityLevel\": 0,
        \"notes\": null
    }" \
    -w "\n%{http_code}")

BULK_HTTP=$(echo "$BULK_RESPONSE" | tail -1)
BULK_BODY=$(echo "$BULK_RESPONSE" | head -n -1)

print_info "응답 코드: $BULK_HTTP"

if [ "$BULK_HTTP" = "201" ] || [ "$BULK_HTTP" = "200" ]; then
    print_pass "일정추가 대량: $BULK_HTTP"

    # 할당 개수 확인
    COUNT=$(echo "$BULK_BODY" | grep -o '"count":[0-9]*' | cut -d':' -f2)
    if [ ! -z "$COUNT" ]; then
        print_info "생성된 할당: $COUNT개"
    fi
else
    print_fail "일정추가 대량: HTTP $BULK_HTTP (예상: 200-201)"
    echo "응답: $BULK_BODY"
fi

##################################################################
# 5단계: 도메인 검증
##################################################################

print_header "5단계: 도메인 검증"

print_info "도메인 검증 테스트..."

# Master 계정은 @nmc.or.kr 도메인이므로 정부 도메인 식별되어야 함
DOMAIN_RESPONSE=$(curl -s "$BASE_URL/api/auth/session" \
    -b "$COOKIES_FILE" \
    -H "Content-Type: application/json" \
    -w "\n%{http_code}")

DOMAIN_HTTP=$(echo "$DOMAIN_RESPONSE" | tail -1)
DOMAIN_BODY=$(echo "$DOMAIN_RESPONSE" | head -n -1)

if [ "$DOMAIN_HTTP" = "200" ]; then
    # 이메일 도메인 확인
    USER_EMAIL=$(echo "$DOMAIN_BODY" | grep -o '"email":"[^"]*' | cut -d'"' -f4)
    if echo "$USER_EMAIL" | grep -q "nmc.or.kr"; then
        print_pass "도메인 검증: nmc.or.kr (정부 도메인)"
    else
        print_fail "도메인 검증: 예상 nmc.or.kr, 실제 $USER_EMAIL"
    fi
else
    print_fail "도메인 검증: 세션 정보 불가 (HTTP $DOMAIN_HTTP)"
fi

##################################################################
# 최종 결과
##################################################################

print_header "검증 결과 요약"

TOTAL=$((PASS_COUNT + FAIL_COUNT))

echo ""
echo "통과: $PASS_COUNT / $TOTAL"
echo "실패: $FAIL_COUNT / $TOTAL"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}✅ 모든 필수 테스트 통과!${NC}"
    exit 0
else
    echo -e "${RED}❌ $FAIL_COUNT개 항목 실패${NC}"
    exit 1
fi
