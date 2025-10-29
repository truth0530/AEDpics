#!/bin/bash

# 프로덕션 서버 환경 체크 스크립트
# 사용법: ssh aedpics@223.130.150.133 'bash -s' < scripts/check-production-env.sh

echo "=== 1. PM2 상태 확인 ==="
pm2 status

echo ""
echo "=== 2. PM2 로그 (최근 50줄) ==="
pm2 logs aedpics --lines 50 --nostream 2>&1 | tail -50

echo ""
echo "=== 3. 환경변수 확인 ==="
cd /var/www/aedpics
if [ -f .env ]; then
    echo "✓ .env 파일 존재"
    echo "주요 환경변수 설정 상태:"
    echo "- DATABASE_URL: $(grep -c '^DATABASE_URL=' .env) 개"
    echo "- NEXTAUTH_SECRET: $(grep -c '^NEXTAUTH_SECRET=' .env) 개"
    echo "- NEXT_PUBLIC_KAKAO_MAP_APP_KEY: $(grep -c '^NEXT_PUBLIC_KAKAO_MAP_APP_KEY=' .env) 개"
    echo "- NCP_ACCESS_KEY: $(grep -c '^NCP_ACCESS_KEY=' .env) 개"
else
    echo "✗ .env 파일 없음!"
fi

echo ""
echo "=== 4. 빌드 상태 ==="
if [ -d ".next" ]; then
    echo "✓ .next 디렉토리 존재"
    echo "빌드 시간: $(stat -f "%Sm" .next 2>/dev/null || stat -c "%y" .next 2>/dev/null)"
else
    echo "✗ .next 디렉토리 없음!"
fi

echo ""
echo "=== 5. Node.js 버전 ==="
node --version

echo ""
echo "=== 6. 디스크 사용량 ==="
df -h | grep -E 'Filesystem|/var'

echo ""
echo "=== 7. 메모리 사용량 ==="
free -h 2>/dev/null || vm_stat 2>/dev/null | head -5

echo ""
echo "=== 8. 최근 에러 로그 (최근 10줄) ==="
pm2 logs aedpics --err --lines 10 --nostream 2>&1 || echo "에러 로그 없음"
