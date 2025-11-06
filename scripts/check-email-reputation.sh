#!/bin/bash

echo "=========================================="
echo "이메일 발송 평판 및 설정 검사 스크립트"
echo "=========================================="
echo ""

# 색상 설정
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 도메인 목록
DOMAINS=("aed.pics" "nmc.or.kr")

for DOMAIN in "${DOMAINS[@]}"; do
    echo "=========================================="
    echo "도메인: $DOMAIN"
    echo "=========================================="

    echo ""
    echo "1. SPF 레코드 확인:"
    echo "-------------------"
    SPF=$(dig +short TXT $DOMAIN | grep "v=spf1")
    if [ -z "$SPF" ]; then
        echo -e "${RED}❌ SPF 레코드 없음${NC}"
    else
        echo -e "${GREEN}✅ SPF 레코드:${NC}"
        echo "$SPF"

        # NCP IP가 SPF에 포함되어 있는지 확인
        if echo "$SPF" | grep -q "49.236.138"; then
            echo -e "${GREEN}✅ NCP IP 포함됨${NC}"
        else
            echo -e "${YELLOW}⚠️ NCP IP (49.236.138.18) SPF에 없음${NC}"
        fi
    fi

    echo ""
    echo "2. DKIM 선택자 확인 (일반적인 선택자 테스트):"
    echo "--------------------------------------------"
    SELECTORS=("default" "mail" "ncp" "google" "k1" "s1")
    DKIM_FOUND=false

    for SELECTOR in "${SELECTORS[@]}"; do
        DKIM=$(dig +short TXT ${SELECTOR}._domainkey.$DOMAIN 2>/dev/null)
        if [ ! -z "$DKIM" ]; then
            echo -e "${GREEN}✅ DKIM 레코드 발견 (${SELECTOR}):${NC}"
            echo "$DKIM" | head -c 100
            echo "..."
            DKIM_FOUND=true
            break
        fi
    done

    if [ "$DKIM_FOUND" = false ]; then
        echo -e "${RED}❌ DKIM 레코드를 찾을 수 없음${NC}"
    fi

    echo ""
    echo "3. DMARC 레코드 확인:"
    echo "--------------------"
    DMARC=$(dig +short TXT _dmarc.$DOMAIN)
    if [ -z "$DMARC" ]; then
        echo -e "${RED}❌ DMARC 레코드 없음${NC}"
    else
        echo -e "${GREEN}✅ DMARC 레코드:${NC}"
        echo "$DMARC"
    fi

    echo ""
    echo "4. MX 레코드 확인:"
    echo "-----------------"
    MX=$(dig +short MX $DOMAIN)
    if [ -z "$MX" ]; then
        echo -e "${RED}❌ MX 레코드 없음${NC}"
    else
        echo -e "${GREEN}✅ MX 레코드:${NC}"
        echo "$MX"
    fi

    echo ""
done

echo "=========================================="
echo "5. NCP IP 평판 확인"
echo "=========================================="
NCP_IP="49.236.138.18"

echo ""
echo "IP 주소: $NCP_IP"
echo ""

# 블랙리스트 체크 (주요 RBL만)
echo "주요 블랙리스트 체크:"
echo "-------------------"
RBLS=(
    "zen.spamhaus.org"
    "bl.spamcop.net"
    "b.barracudacentral.org"
    "dnsbl.sorbs.net"
)

for RBL in "${RBLS[@]}"; do
    # IP를 역순으로 변환 (49.236.138.18 -> 18.138.236.49)
    REVERSED_IP=$(echo $NCP_IP | awk -F. '{print $4"."$3"."$2"."$1}')

    RESULT=$(dig +short ${REVERSED_IP}.${RBL})
    if [ -z "$RESULT" ]; then
        echo -e "${GREEN}✅ ${RBL}: 깨끗함${NC}"
    else
        echo -e "${RED}❌ ${RBL}: 블랙리스트 등재됨 - $RESULT${NC}"
    fi
done

echo ""
echo "=========================================="
echo "6. 권장 사항"
echo "=========================================="

echo ""
echo "📌 즉시 확인 필요:"
echo "1. NCP 콘솔에서 발신 도메인 인증 상태"
echo "2. SPF 레코드에 NCP IP 추가"
echo "3. DKIM 서명 설정"
echo "4. DMARC 정책 설정"

echo ""
echo "📌 블랙리스트 등재 시:"
echo "1. 해당 RBL 사이트에서 해제 요청"
echo "2. NCP 지원팀에 문의"
echo "3. 발송 패턴 검토 (대량 발송 여부)"

echo ""
echo "=========================================="
echo "검사 완료"
echo "=========================================="