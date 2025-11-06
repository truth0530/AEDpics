#!/bin/bash
# 주간 Export 엔드포인트 리포트

WEEK_START=$(date -d "7 days ago" '+%Y-%m-%d')
WEEK_END=$(date '+%Y-%m-%d')
REPORT_FILE="/var/log/aedpics/export_stats/weekly_report_$(date +%Y-W%V).txt"

echo "=========================================="
echo "주간 Export 엔드포인트 리포트"
echo "기간: $WEEK_START ~ $WEEK_END"
echo "=========================================="

{
  echo "# 주간 Export 통계"
  echo ""
  echo "## 요약"

  # 지난 7일 로그 수집
  TOTAL_SUCCESS=$(find /var/log/aedpics/export_stats -name "export_*.log" -mtime -7 -exec grep -h 'Export:Success' {} \; | wc -l)
  TOTAL_FAILURE=$(find /var/log/aedpics/export_stats -name "export_*.log" -mtime -7 -exec grep -h 'Export:Permission' {} \; | wc -l)
  TOTAL_ERRORS=$(find /var/log/aedpics/export_stats -name "export_*.log" -mtime -7 -exec grep -h 'Export:FilterPolicy' {} \; | wc -l)

  echo "- 총 성공: $TOTAL_SUCCESS"
  echo "- 권한 거부: $TOTAL_FAILURE"
  echo "- 필터 오류: $TOTAL_ERRORS"
  echo ""

  if [ $TOTAL_SUCCESS -gt 0 ]; then
    SUCCESS_RATE=$((TOTAL_SUCCESS * 100 / (TOTAL_SUCCESS + TOTAL_FAILURE + TOTAL_ERRORS)))
    echo "- 성공률: ${SUCCESS_RATE}%"
  fi

  echo ""
  echo "## 역할별 사용 현황"
  echo ""
  find /var/log/aedpics/export_stats -name "export_*.log" -mtime -7 -exec grep -h 'Export:Success' {} \; | \
    grep -o '"role":"\[^"]*"' | \
    awk -F'"' '{print $4}' | \
    sort | uniq -c | \
    sort -rn | \
    sed 's/^/- /'

  echo ""
  echo "## 경고 및 주의사항"
  echo ""

  # 경고 조건 확인
  if [ $TOTAL_FAILURE -gt $((TOTAL_SUCCESS / 10)) ]; then
    echo "- 권한 거부 비율이 높습니다 ($TOTAL_FAILURE건)"
  fi

  if [ $TOTAL_ERRORS -gt 10 ]; then
    echo "- 필터 오류가 다수 발생했습니다 ($TOTAL_ERRORS건)"
  fi

  MAPPING_ERRORS=$(find /var/log/aedpics/export_stats -name "export_*.log" -mtime -7 -exec grep -h 'Export:CityCodeMapping' {} \; | wc -l)
  if [ $MAPPING_ERRORS -gt 0 ]; then
    echo "- City code 매핑 경고: $MAPPING_ERRORS건"
  fi

} > "$REPORT_FILE"

cat "$REPORT_FILE"
