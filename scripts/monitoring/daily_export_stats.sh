#!/bin/bash
# 일일 Export 엔드포인트 통계 수집

DATE=$(date '+%Y-%m-%d')
LOGDIR="/var/log/aedpics"
STATSDIR="/var/log/aedpics/export_stats"

mkdir -p "$STATSDIR"

echo "=========================================="
echo "일일 Export 통계 ($DATE)"
echo "=========================================="

# PM2 로그에서 Export 관련 로그 수집 (--nostream으로 스트리밍 방지)
pm2 logs aedpics --lines 10000 --nostream 2>/dev/null > "$STATSDIR/export_${DATE}.log"

echo "성공 건수: $(grep -c 'Export:Success' "$STATSDIR/export_${DATE}.log")"
echo "권한 거부: $(grep -c 'Export:Permission' "$STATSDIR/export_${DATE}.log")"
echo "필터 실패: $(grep -c 'Export:FilterPolicy' "$STATSDIR/export_${DATE}.log")"
echo "매핑 경고: $(grep -c 'Export:CityCodeMapping' "$STATSDIR/export_${DATE}.log")"

# 역할별 통계 (JSON 형식에 맞춰 수정: "role": "value" 형태)
echo ""
echo "역할별 성공 건수:"
grep 'Export:Success' "$STATSDIR/export_${DATE}.log" | grep -o '"role": "[^"]*"' | awk -F'"' '{print $4}' | sort | uniq -c | sort -rn

# 에러 분석
echo ""
echo "최근 에러 (상위 5건):"
grep 'Export:Permission\|Export:FilterPolicy' "$STATSDIR/export_${DATE}.log" | tail -5
